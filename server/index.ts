// Lokaler Stilkompass-Server: liefert die App aus, speichert den Nutzerzustand und aktualisiert alle 30 Minuten.
// Start: npm start   (PORT=8787, HOST=127.0.0.1, UPDATE_INTERVAL_MIN=30, EMBED_BUDGET=800)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import { DATA_DIR, ROOT, paths, readJson, writeJson } from '../engine/store';
import { loadEnv } from '../engine/env';
import type { UserState } from '../shared/types';

loadEnv();
const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '127.0.0.1';
const INTERVAL_MIN = Math.max(10, Number(process.env.UPDATE_INTERVAL_MIN ?? 30));
const EMBED_BUDGET = Number(process.env.EMBED_BUDGET ?? 800);
const DIST = path.join(ROOT, 'dist');
const USER_FILE = path.join(paths.userDir, 'local.json');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.wasm': 'application/wasm', '.bin': 'application/octet-stream', '.txt': 'text/plain; charset=utf-8',
};

// ---------- Engine-Lauf im Kindprozess ----------
let running = false;
let lastRun: { at: string; ok: boolean; durationS: number; log: string[] } | null = null;
let nextRunAt = 0;

function runEngine(reason: string): Promise<void> {
  if (running) return Promise.resolve();
  running = true;
  const t0 = Date.now();
  const logLines: string[] = [];
  console.log(`[${new Date().toLocaleTimeString('de-CH')}] Aktualisierung gestartet (${reason}) …`);
  const args = ['--import', 'tsx', path.join(ROOT, 'engine', 'run.ts'), '--quiet'];
  if (EMBED_BUDGET > 0) args.push(`--embed=${EMBED_BUDGET}`);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    const onData = (d: Buffer) => {
      for (const line of d.toString().split('\n').filter(Boolean)) {
        logLines.push(line);
        if (logLines.length > 200) logLines.shift();
        if (/Fertig|Alarme|Embeddings fertig|🔔|✗|Error|Fehler/.test(line)) console.log('  ' + line);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('close', (code) => {
      running = false;
      lastRun = { at: new Date().toISOString(), ok: code === 0, durationS: Math.round((Date.now() - t0) / 1000), log: logLines.slice(-40) };
      console.log(`  → ${code === 0 ? 'erfolgreich' : 'mit Fehler'} in ${lastRun.durationS}s`);
      resolve();
    });
  });
}

function schedule() {
  const meta = readJson<{ generatedAt?: string } | null>(paths.meta, null);
  const age = meta?.generatedAt ? Date.now() - Date.parse(meta.generatedAt) : Infinity;
  const due = age >= INTERVAL_MIN * 60_000;
  const wait = due ? 2000 : INTERVAL_MIN * 60_000 - age;
  nextRunAt = Date.now() + wait;
  setTimeout(async () => {
    await runEngine(due && !Number.isFinite(age) ? 'erster Start' : 'Zeitplan');
    schedule();
  }, wait);
}

// ---------- Statische Dateien ----------
const gzCache = new Map<string, { mtime: number; buf: Buffer }>();

function sendFile(req: http.IncomingMessage, res: http.ServerResponse, file: string, cache: 'immutable' | 'short' | 'none') {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    res.writeHead(404).end('Nicht gefunden');
    return;
  }
  const ext = path.extname(file);
  const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const headers: Record<string, string> = {
    'content-type': TYPES[ext] ?? 'application/octet-stream',
    etag,
    'cache-control': cache === 'immutable' ? 'public, max-age=31536000, immutable' : cache === 'short' ? 'no-cache' : 'no-store',
    'x-content-type-options': 'nosniff',
  };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers).end();
    return;
  }
  const compressible = /\.(json|js|mjs|css|html|svg|webmanifest|txt)$/.test(file) && stat.size > 1024;
  if (compressible && /gzip/.test(String(req.headers['accept-encoding'] ?? ''))) {
    let c = gzCache.get(file);
    if (!c || c.mtime !== stat.mtimeMs) {
      c = { mtime: stat.mtimeMs, buf: zlib.gzipSync(fs.readFileSync(file), { level: 6 }) };
      gzCache.set(file, c);
    }
    res.writeHead(200, { ...headers, 'content-encoding': 'gzip', 'content-length': String(c.buf.length), vary: 'accept-encoding' });
    res.end(req.method === 'HEAD' ? undefined : c.buf);
    return;
  }
  res.writeHead(200, { ...headers, 'content-length': String(stat.size) });
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(file).pipe(res);
}

function readBody(req: http.IncomingMessage, limit = 2_000_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('zu gross'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const json = (res: http.ServerResponse, code: number, body: unknown) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }).end(JSON.stringify(body));
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const p = decodeURIComponent(url.pathname);

    // ---- API ----
    if (p === '/api/health') return json(res, 200, { app: 'stilkompass', running, lastRun: lastRun && { at: lastRun.at, ok: lastRun.ok, durationS: lastRun.durationS }, nextRunAt: new Date(nextRunAt).toISOString(), intervalMin: INTERVAL_MIN });
    if (p === '/api/status') return json(res, 200, { running, lastRun, nextRunAt: new Date(nextRunAt).toISOString() });
    if (p === '/api/state' && req.method === 'GET') return json(res, 200, readJson<UserState | null>(USER_FILE, null));
    if (p === '/api/state' && (req.method === 'PUT' || req.method === 'POST')) {
      const body = JSON.parse(await readBody(req)) as UserState;
      if (!body || typeof body !== 'object' || !Array.isArray(body.favorites) || !Array.isArray(body.watch)) return json(res, 400, { error: 'Ungültiger Zustand' });
      writeJson(USER_FILE, body);
      return json(res, 200, { ok: true });
    }
    if (p === '/api/refresh' && req.method === 'POST') {
      if (!running) void runEngine('manuell');
      return json(res, 202, { started: !running });
    }
    if (p.startsWith('/api/')) return json(res, 404, { error: 'Unbekannt' });

    // ---- Daten ----
    if (p.startsWith('/data/')) {
      const file = path.join(DATA_DIR, p.slice('/data/'.length));
      if (!file.startsWith(DATA_DIR)) return json(res, 403, { error: 'verboten' });
      return sendFile(req, res, file, 'short');
    }

    // ---- App ----
    if (!fs.existsSync(path.join(DIST, 'index.html'))) {
      res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' }).end('App noch nicht gebaut. Bitte "npm run build" ausführen.');
      return;
    }
    let file = path.join(DIST, p === '/' ? 'index.html' : p);
    if (!file.startsWith(DIST)) return json(res, 403, { error: 'verboten' });
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    const cache = file.includes(`${path.sep}assets${path.sep}`) ? 'immutable' : 'short';
    return sendFile(req, res, file, cache);
  } catch (e) {
    json(res, 500, { error: (e as Error).message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\nStilkompass läuft:  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`Aktualisierung alle ${INTERVAL_MIN} Minuten${EMBED_BUDGET > 0 ? `, KI-Bildindex bis ${EMBED_BUDGET} neue Bilder/Lauf` : ''}. Beenden mit Ctrl+C.\n`);
  schedule();
});
