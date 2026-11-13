// Preisalarme im Hintergrund: Watchlist & gespeicherte Suchen → Web-Push (auch bei geschlossener Seite).
// Nutzerzustand: lokal state/user/*.json (vom Server geschrieben) oder verschlüsselt aus GitHub (STATE_FILE + STATE_PASSPHRASE).
import fs from 'node:fs';
import path from 'node:path';
import webpush from 'web-push';
import type { AlertEvent, Catalog, Product, PushSubscriptionJSONLike, UserState } from '../shared/types';
import { decryptJson, type EncryptedBlob } from '../shared/crypto';
import { matchesSearch } from '../shared/search';
import { imgUrl } from '../shared/media';
import { paths, readJson, writeJson } from './store';
import { loadEnv } from './env';

interface AlertsLog {
  sent: Record<string, number>;
}

interface UserSource {
  id: string;
  state: UserState;
  file?: string; // lokal beschreibbar (abgelaufene Push-Abos entfernen)
}

export async function loadUserStates(log: (...m: unknown[]) => void = console.log): Promise<UserSource[]> {
  loadEnv();
  const out: UserSource[] = [];
  // 1) Lokale Zustände
  if (fs.existsSync(paths.userDir)) {
    for (const f of fs.readdirSync(paths.userDir)) {
      if (!f.endsWith('.json') || f.endsWith('.enc.json')) continue;
      const file = path.join(paths.userDir, f);
      const s = readJson<UserState | null>(file, null);
      if (s?.v) out.push({ id: f.replace(/\.json$/, ''), state: s, file });
    }
  }
  // 2) Verschlüsselter Zustand aus GitHub
  const enc = process.env.STATE_FILE ?? path.join(paths.userDir, 'remote.enc.json');
  const pass = process.env.STATE_PASSPHRASE;
  if (fs.existsSync(enc)) {
    if (!pass) log('  Hinweis: verschlüsselter Nutzerzustand gefunden, aber STATE_PASSPHRASE fehlt.');
    else {
      try {
        const blob = readJson<EncryptedBlob | null>(enc, null);
        if (blob) out.push({ id: 'github', state: await decryptJson<UserState>(blob, pass) });
      } catch {
        log('  ✗ Nutzerzustand konnte nicht entschlüsselt werden (Passphrase prüfen).');
      }
    }
  }
  return out;
}

export function computeEvents(user: UserState, cur: Catalog, prev: Catalog | null, now = Math.floor(Date.now() / 1000)): AlertEvent[] {
  const byId = new Map(cur.products.map((p) => [p.id, p]));
  const prevById = new Map((prev?.products ?? []).map((p) => [p.id, p]));
  const shopById = Object.fromEntries(cur.shops.map((s) => [s.id, s]));
  const events: AlertEvent[] = [];
  const icon = (p: Product) => imgUrl(p.img, shopById[p.s], 300);
  const fmt = (n: number) => `CHF ${n.toFixed(2)}`;

  for (const w of user.watch) {
    const p = byId.get(w.id);
    if (!p) continue;
    const old = prevById.get(w.id);
    const url = `./#/alarme?p=${encodeURIComponent(p.id)}`;
    if (w.target && p.av && p.tot <= w.target && (!old || old.tot > w.target)) {
      events.push({ key: `t:${p.id}:${w.target}`, type: 'target', productId: p.id, title: `Wunschpreis erreicht: ${p.b}`, body: `${p.t} – jetzt ${fmt(p.tot)} (Ziel ${fmt(w.target)})`, url, img: icon(p), at: now });
    } else if (w.notifyDrop && old && p.av && p.tot < old.tot - Math.max(1, old.tot * 0.03)) {
      const pct = Math.round((1 - p.tot / old.tot) * 100);
      events.push({ key: `d:${p.id}:${p.tot}`, type: 'drop', productId: p.id, title: `Preissturz −${pct}%: ${p.b}`, body: `${p.t} – ${fmt(old.tot)} → ${fmt(p.tot)}`, url, img: icon(p), at: now });
    }
    if (w.notifyStock && old) {
      const back = w.size ? !old.sz.includes(w.size) && p.sz.includes(w.size) : !old.av && p.av;
      if (back) events.push({ key: `s:${p.id}:${w.size ?? 'any'}:${p.upd}`, type: 'stock', productId: p.id, title: `Wieder verfügbar: ${p.b}`, body: `${p.t}${w.size ? ` in Grösse ${w.size}` : ''} – ${fmt(p.tot)}`, url, img: icon(p), at: now });
    }
  }

  if (prev) {
    const fresh = cur.products.filter((p) => !prevById.has(p.id) && p.av && now - p.first < 2 * 3600);
    for (const s of user.searches) {
      if (!s.notifyNew) continue;
      const hits = fresh.filter((p) => matchesSearch(p, s.query, s.filters, shopById[p.s], s.segment));
      if (!hits.length) continue;
      const best = [...hits].sort((a, b) => b.q - a.q)[0];
      const path = s.segment === 'secondhand' ? '/secondhand' : s.segment === 'new' ? '/neu' : '/suche';
      events.push({
        key: `n:${s.id}:${hits.map((h) => h.id).sort().join(',').slice(0, 200)}`,
        type: 'new',
        productId: best.id,
        title: hits.length === 1 ? `Neu: ${best.b}` : `${hits.length} neue Treffer: ${s.name}`,
        body: hits.length === 1 ? `${best.t} – ${fmt(best.tot)}` : `z. B. ${best.b} ${best.t} – ${fmt(best.tot)}`,
        url: hits.length === 1 ? `./#${path}?p=${encodeURIComponent(best.id)}` : `./#${path}?q=${encodeURIComponent(s.query)}&sort=new`,
        img: icon(best),
        at: now,
      });
    }
  }
  return events;
}

function vapidReady(log: (...m: unknown[]) => void): boolean {
  loadEnv();
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    log('  Push: keine VAPID-Schlüssel (npm run setup bzw. GitHub-Secrets) – Benachrichtigungen übersprungen.');
    return false;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:stilkompass@example.invalid', pub, priv);
  return true;
}

export async function sendPush(sub: PushSubscriptionJSONLike, ev: Pick<AlertEvent, 'title' | 'body' | 'url' | 'img' | 'key'>): Promise<'ok' | 'gone' | 'error'> {
  try {
    await webpush.sendNotification(sub as webpush.PushSubscription, JSON.stringify({ title: ev.title, body: ev.body, url: ev.url, icon: ev.img, tag: ev.key.slice(0, 60) }), { TTL: 24 * 3600, urgency: 'normal' });
    return 'ok';
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    return code === 404 || code === 410 ? 'gone' : 'error';
  }
}

export async function runAlerts(cur: Catalog, prev: Catalog | null, opts: { log?: (...m: unknown[]) => void } = {}) {
  const log = opts.log ?? console.log;
  const users = await loadUserStates(log);
  if (!users.length) {
    log('Alarme: kein Nutzerzustand synchronisiert – übersprungen.');
    return { sent: 0, events: 0 };
  }
  const alog = readJson<AlertsLog>(paths.alertsLog, { sent: {} });
  const now = Math.floor(Date.now() / 1000);
  for (const [k, t] of Object.entries(alog.sent)) if (now - t > 45 * 86400) delete alog.sent[k];
  const canPush = vapidReady(log);
  let sent = 0;
  let total = 0;
  for (const u of users) {
    const events = computeEvents(u.state, cur, prev, now).filter((e) => !alog.sent[`${u.id}|${e.key}`]);
    total += events.length;
    if (!events.length) continue;
    const subs = u.state.push ?? [];
    const gone = new Set<string>();
    for (const ev of events.slice(0, 10)) {
      let delivered = false;
      if (canPush) {
        for (const s of subs) {
          if (gone.has(s.endpoint)) continue;
          const r = await sendPush(s, ev);
          if (r === 'ok') delivered = true;
          if (r === 'gone') gone.add(s.endpoint);
        }
      }
      // Auch ohne Zustellung als "gesendet" markieren, damit nicht bei jedem Lauf erneut versucht wird
      alog.sent[`${u.id}|${ev.key}`] = now;
      if (delivered) sent++;
      log(`  🔔 ${ev.title} – ${ev.body}${delivered ? '' : ' (nicht zugestellt)'}`);
    }
    if (gone.size && u.file) {
      u.state.push = subs.filter((s) => !gone.has(s.endpoint));
      writeJson(u.file, u.state);
      log(`  ${gone.size} abgelaufene Push-Abos entfernt.`);
    }
  }
  writeJson(paths.alertsLog, alog);
  log(`Alarme: ${total} neue Ereignisse, ${sent} Push-Nachrichten zugestellt.`);
  return { sent, events: total };
}
