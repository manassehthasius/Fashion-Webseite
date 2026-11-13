// HTTP mit höflichem Crawling: eigener User-Agent, Timeouts, Retries, robots.txt, Proxy-Unterstützung.
// Hinweis: Wir nutzen undici.request statt fetch, weil fetch immer "Accept-Language: *" sendet –
// manche Shops leiten dann auf ihren US-Markt um und die Schweizer CHF-Preise wären nicht erreichbar.
import { Agent, EnvHttpProxyAgent, request, setGlobalDispatcher, type Dispatcher } from 'undici';

const useProxy = !!(process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY);
const dispatcher: Dispatcher = useProxy ? new EnvHttpProxyAgent() : new Agent({ connections: 16 });
if (useProxy) setGlobalDispatcher(dispatcher);

export const USER_AGENT =
  process.env.STILKOMPASS_UA ||
  'Mozilla/5.0 (compatible; StilkompassBot/1.0; private non-commercial price comparison; max 1 run/30min)';

export interface FetchResult {
  status: number;
  url: string;
  text: string;
  location?: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchText(
  url: string,
  opts: { timeoutMs?: number; retries?: number; redirect?: 'follow' | 'manual'; accept?: string } = {},
): Promise<FetchResult> {
  const { timeoutMs = 20000, retries = 2, redirect = 'follow', accept = 'application/json,text/html;q=0.9,*/*;q=0.5' } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      let current = url;
      for (let hop = 0; hop < 6; hop++) {
        const res = await request(current, {
          method: 'GET',
          headers: { 'user-agent': USER_AGENT, accept },
          dispatcher,
          headersTimeout: timeoutMs,
          bodyTimeout: timeoutMs,
        });
        const status = res.statusCode;
        const loc = res.headers.location;
        const location = Array.isArray(loc) ? loc[0] : loc ?? null;
        if (status >= 300 && status < 400 && location) {
          await res.body.dump();
          if (redirect === 'manual') return { status, url: current, text: '', location };
          current = new URL(location, current).toString();
          continue;
        }
        if ((status === 429 || status >= 500) && attempt < retries) {
          const ra = Number(res.headers['retry-after']);
          await res.body.dump();
          await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 30) * 1000 : 1500 * 2 ** attempt);
          throw new RetrySignal();
        }
        const text = await res.body.text();
        return { status, url: current, text, location };
      }
      throw new Error('Zu viele Weiterleitungen');
    } catch (e) {
      if (!(e instanceof RetrySignal)) {
        lastErr = e;
        if (attempt < retries) await sleep(1000 * 2 ** attempt);
      }
    }
  }
  throw new Error(`Abruf fehlgeschlagen: ${url} (${(lastErr as Error)?.message ?? lastErr})`);
}

class RetrySignal extends Error {}

/** Binärdaten (Bilder für Embeddings) */
export async function fetchBuffer(url: string, timeoutMs = 20000): Promise<Buffer | null> {
  try {
    let current = url;
    for (let hop = 0; hop < 5; hop++) {
      const res = await request(current, { headers: { 'user-agent': USER_AGENT, accept: 'image/*,*/*' }, dispatcher, headersTimeout: timeoutMs, bodyTimeout: timeoutMs });
      const loc = res.headers.location;
      if (res.statusCode >= 300 && res.statusCode < 400 && loc) {
        await res.body.dump();
        current = new URL(Array.isArray(loc) ? loc[0] : loc, current).toString();
        continue;
      }
      if (res.statusCode !== 200) {
        await res.body.dump();
        return null;
      }
      return Buffer.from(await res.body.arrayBuffer());
    }
  } catch {
    return null;
  }
  return null;
}

export async function fetchJson<T>(url: string, opts?: Parameters<typeof fetchText>[1]): Promise<{ status: number; data: T | null; url: string }> {
  const r = await fetchText(url, opts);
  if (r.status !== 200) return { status: r.status, data: null, url: r.url };
  try {
    return { status: r.status, data: JSON.parse(r.text) as T, url: r.url };
  } catch {
    return { status: r.status, data: null, url: r.url };
  }
}

// ---------- robots.txt ----------

interface Rule { allow: boolean; pattern: RegExp; len: number }

function toRegex(path: string): RegExp {
  const esc = path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + (esc.endsWith('\\$') ? esc.slice(0, -2) + '$' : esc));
}

export function parseRobots(txt: string, agent = 'stilkompassbot'): Rule[] {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let cur: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!cur) continue;
      if ((key === 'allow' || key === 'disallow') && val) cur.rules.push({ allow: key === 'allow', pattern: toRegex(val), len: val.length });
    }
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && agent.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  return chosen.flatMap((g) => g.rules);
}

export function isAllowed(rules: Rule[], path: string): boolean {
  let best: Rule | null = null;
  for (const r of rules) {
    if (r.pattern.test(path) && (!best || r.len > best.len || (r.len === best.len && r.allow))) best = r;
  }
  return best ? best.allow : true;
}

const robotsCache = new Map<string, Rule[]>();

export async function robotsFor(domain: string): Promise<Rule[]> {
  if (robotsCache.has(domain)) return robotsCache.get(domain)!;
  let rules: Rule[] = [];
  try {
    const r = await fetchText(`https://${domain}/robots.txt`, { retries: 1, accept: 'text/plain,*/*' });
    if (r.status === 200) rules = parseRobots(r.text);
  } catch {
    rules = [];
  }
  robotsCache.set(domain, rules);
  return rules;
}

export { sleep };
