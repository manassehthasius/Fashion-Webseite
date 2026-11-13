// Synchronisierung des Nutzerzustands mit dem Hintergrund-Dienst, damit Alarme auch bei geschlossener Seite laufen.
// - Lokal: eigener Node-Server (npm start) → /api/state
// - GitHub: verschlüsselte Datei user/state.enc.json im Branch "userstate" deines Repos (GitHub-API, eigenes Token)
import { useSyncExternalStore } from 'react';
import type { UserState } from '@shared/types';
import { decryptJson, encryptJson, utf8ToB64, b64ToUtf8, type EncryptedBlob } from '@shared/crypto';
import { getUser, onUserChange, setUser } from './store';

export interface SyncConfig {
  mode: 'auto' | 'off' | 'github';
  github?: { owner: string; repo: string; token: string; passphrase: string; branch: string };
}

export interface SyncStatus {
  backend: 'none' | 'local' | 'github';
  state: 'idle' | 'syncing' | 'ok' | 'error';
  lastSync?: number;
  message?: string;
}

const CFG_KEY = 'stilkompass:sync:v1';
const FILE = 'user/state.enc.json';

export function loadSyncConfig(): SyncConfig {
  try {
    return { mode: 'auto', ...JSON.parse(localStorage.getItem(CFG_KEY) ?? '{}') };
  } catch {
    return { mode: 'auto' };
  }
}
export function saveSyncConfig(c: SyncConfig) {
  localStorage.setItem(CFG_KEY, JSON.stringify(c));
  config = c;
  void initSync(true);
}

let config = loadSyncConfig();
let status: SyncStatus = { backend: 'none', state: 'idle' };
const subs = new Set<() => void>();
const setStatus = (s: Partial<SyncStatus>) => {
  status = { ...status, ...s };
  subs.forEach((f) => f());
};
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => status,
  );
}

// ---------- Lokaler Server ----------
async function localAvailable(): Promise<boolean> {
  // Statisches Hosting (GitHub Pages) hat keinen lokalen Server
  const h = location.hostname;
  const local = h === 'localhost' || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h.endsWith('.local') || !!location.port;
  if (!local) return false;
  try {
    const r = await fetch('./api/health', { cache: 'no-store' });
    if (!r.ok) return false;
    const j = await r.json();
    return j?.app === 'stilkompass';
  } catch {
    return false;
  }
}

async function localPull(): Promise<UserState | null> {
  const r = await fetch('./api/state', { cache: 'no-store' });
  if (!r.ok) return null;
  const j = await r.json();
  return j && j.v ? (j as UserState) : null;
}

async function localPush(s: UserState) {
  const r = await fetch('./api/state', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(s) });
  if (!r.ok) throw new Error(`Server antwortet ${r.status}`);
}

// ---------- GitHub ----------
function gh(path: string, init: RequestInit = {}) {
  const g = config.github!;
  return fetch(`https://api.github.com/repos/${g.owner}/${g.repo}${path}`, {
    ...init,
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${g.token}`, 'x-github-api-version': '2022-11-28', ...(init.headers ?? {}) },
  });
}

async function ensureBranch(): Promise<void> {
  const g = config.github!;
  const r = await gh(`/git/ref/heads/${g.branch}`);
  if (r.ok) return;
  const repo = await gh('');
  if (!repo.ok) throw new Error(`Repo nicht erreichbar (${repo.status}) – Token/Name prüfen.`);
  const def = (await repo.json()).default_branch as string;
  const head = await gh(`/git/ref/heads/${def}`);
  const sha = (await head.json()).object.sha as string;
  const c = await gh('/git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${g.branch}`, sha }) });
  if (!c.ok) throw new Error(`Branch "${g.branch}" konnte nicht erstellt werden (${c.status}).`);
}

async function githubPull(): Promise<{ state: UserState | null; sha?: string }> {
  const g = config.github!;
  const r = await gh(`/contents/${FILE}?ref=${encodeURIComponent(g.branch)}`, { cache: 'no-store' });
  if (r.status === 404) return { state: null };
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  const j = await r.json();
  const blob = JSON.parse(b64ToUtf8(j.content)) as EncryptedBlob;
  const state = await decryptJson<UserState>(blob, g.passphrase);
  return { state, sha: j.sha };
}

async function githubPush(s: UserState) {
  const g = config.github!;
  await ensureBranch();
  const cur = await gh(`/contents/${FILE}?ref=${encodeURIComponent(g.branch)}`, { cache: 'no-store' });
  const sha = cur.ok ? (await cur.json()).sha : undefined;
  const blob = await encryptJson(s, g.passphrase);
  const r = await gh(`/contents/${FILE}`, {
    method: 'PUT',
    body: JSON.stringify({ message: 'Nutzerzustand aktualisiert (verschlüsselt)', content: utf8ToB64(JSON.stringify(blob)), branch: g.branch, sha }),
  });
  if (!r.ok) throw new Error(`Speichern fehlgeschlagen (${r.status})`);
}

/** Löst einen sofortigen Engine-Lauf über GitHub Actions aus (Token braucht "Actions: Read and write") */
export async function triggerGithubUpdate(): Promise<void> {
  if (!config.github) throw new Error('GitHub nicht verbunden');
  const repo = await gh('');
  const def = (await repo.json()).default_branch as string;
  const r = await gh('/actions/workflows/update.yml/dispatches', { method: 'POST', body: JSON.stringify({ ref: def }) });
  if (!r.ok) throw new Error(`Workflow-Start fehlgeschlagen (${r.status}) – Token-Berechtigung "Actions" prüfen.`);
}

// ---------- Ablauf ----------
let timer: number | undefined;
let unsub: (() => void) | undefined;

function merge(local: UserState, remote: UserState | null): UserState {
  if (!remote) return local;
  return (remote.updatedAt ?? 0) > (local.updatedAt ?? 0) ? remote : local;
}

export async function initSync(force = false) {
  if (status.state === 'syncing' && !force) return;
  unsub?.();
  if (config.mode === 'off') {
    setStatus({ backend: 'none', state: 'idle', message: 'Synchronisierung aus' });
    return;
  }
  let backend: SyncStatus['backend'] = 'none';
  if (config.mode === 'github' && config.github?.token && config.github.passphrase) backend = 'github';
  else if (await localAvailable()) backend = 'local';
  setStatus({ backend, state: backend === 'none' ? 'idle' : 'syncing', message: undefined });
  if (backend === 'none') return;
  try {
    const remote = backend === 'local' ? await localPull() : (await githubPull()).state;
    const local = getUser();
    const merged = merge(local, remote);
    if (merged !== local) setUser(merged, { silent: true });
    else if (!remote || (remote.updatedAt ?? 0) < (local.updatedAt ?? 0)) await push(backend);
    setStatus({ state: 'ok', lastSync: Date.now() });
  } catch (e) {
    setStatus({ state: 'error', message: (e as Error).message });
  }
  unsub = onUserChange(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void push(backend).then(() => setStatus({ state: 'ok', lastSync: Date.now(), message: undefined })).catch((e) => setStatus({ state: 'error', message: (e as Error).message })), 1500);
  });
}

async function push(backend: SyncStatus['backend']) {
  const s = getUser();
  if (backend === 'local') await localPush(s);
  else if (backend === 'github') await githubPush(s);
}

export async function syncNow() {
  await initSync(true);
}

export function getBackend() {
  return status.backend;
}
