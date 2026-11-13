// Automatische Shop-Entdeckung: Marken, die bei unseren Fachhändlern verkauft werden, haben oft einen eigenen
// Online-Shop. Pro Lauf werden einige Marken geprüft und offizielle Marken-Shops aufgenommen, wenn sie
//  1. in die Schweiz liefern (/meta.json),
//  2. eindeutig zur Marke gehören (Shop-Name + Marke der Produkte),
//  3. Rückgabe- und Datenschutzbestimmungen veröffentlichen,
//  4. robots.txt den Produkt-Feed erlaubt,
//  5. überwiegend Kleidung/Schuhe/Taschen führen (mind. 15 Produkte).
// Abgelehnte Marken werden gemerkt und erst nach 60 Tagen erneut versucht. Kein externer Dienst, nur die Shops selbst.
import type { FxRates, Product, Shop, Style } from '../shared/types';
import { landedCost } from '../shared/pricing';
import { brandTier } from '../shared/classify';
import { fold } from '../shared/text';
import { fetchJson, fetchText } from './http';
import { fetchPage, productsAllowed } from './sources/shopify';
import { normalizeProduct } from './normalize';
import { est, VAT } from './shops';
import { paths, readJson, writeJson } from './store';

const DAY = 86400;
const EU = new Set(['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK']);
const EU_VAT: Record<string, number> = { ...VAT, FI: 0.255, IE: 0.23, PL: 0.23, LU: 0.17, GR: 0.24, CZ: 0.21, HU: 0.27, RO: 0.19, LT: 0.21, LV: 0.21, EE: 0.22, SI: 0.22, SK: 0.23, HR: 0.25, BG: 0.2, CY: 0.19, MT: 0.18 };
const SKIP = new Set(['vintage', 'unbranded', 'other', 'misc', 'various', 'unknown', 'no brand', 'gift card', 'giftcard', 'sample', 'archive']);

export interface DiscoveredEntry {
  shop: Omit<Shop, 'health' | 'market'>;
  brand: string;
  count: number;
}

export interface DiscoveryState {
  v: 1;
  shops: DiscoveredEntry[];
  tried: Record<string, { at: number; ok: boolean; reason: string }>;
}

export function loadDiscovery(): DiscoveryState {
  return readJson<DiscoveryState>(paths.discovery, { v: 1, shops: [], tried: {} });
}

export function discoveredShops(st: DiscoveryState): Shop[] {
  return st.shops.map((e) => ({ ...e.shop }) as Shop);
}

const slug = (s: string) => fold(s.toLowerCase()).replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
const slugDash = (s: string) => fold(s.toLowerCase()).replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function candidateDomains(brand: string): string[] {
  const a = slug(brand);
  const d = slugDash(brand);
  const out = [`${a}.com`];
  if (d !== a) out.push(`${d}.com`);
  out.push(`${a}.co.uk`, `${a}.de`, `${a}.eu`, `${a}.ch`, `${a}.dk`, `${a}.fr`, `${a}.it`, `${a}.nl`, `${a}.se`, `${a}.co`, `${a}studios.com`, `${a}clothing.com`);
  return [...new Set(out)];
}

/** Gehört der Shop-Name zur Marke? (z. B. "Arte Antwerp" ↔ "ARTE", "Wood Wood Official" ↔ "Wood Wood") */
export function nameMatches(brand: string, shopName: string, domain: string): boolean {
  void domain;
  const b = slug(brand);
  const n = slug(shopName);
  if (!b || !n) return false;
  // ganze Wörter des Shop-Namens ergeben die Marke ("Wood Wood Official" → woodwood)
  const words = fold(shopName.toLowerCase()).split(/[^a-z0-9]+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) for (let j = i + 1; j <= words.length; j++) if (words.slice(i, j).join('') === b) return true;
  // längere Namen dürfen Teil voneinander sein ("Arte Antwerp Store" ↔ "Arte Antwerp")
  return (b.length >= 5 && n.includes(b)) || (n.length >= 5 && b.includes(n));
}

interface Meta {
  name?: string;
  country?: string;
  currency?: string;
  ships_to_countries?: string[];
  published_products_count?: number;
  domain?: string;
}

async function policyOk(domain: string, kind: string): Promise<boolean> {
  try {
    const r = await fetchText(`https://${domain}/policies/${kind}`, { retries: 0, accept: 'text/html', timeoutMs: 12000 });
    return r.status === 200 && r.text.length > 3000 && new URL(r.url).pathname.includes('/policies/');
  } catch {
    return false;
  }
}

/** Prüft eine Marke; gibt den Shop zurück oder den Ablehnungsgrund */
async function probeBrand(brand: string, styles: Style[], via: string[], known: Set<string>, fx: FxRates, refTot: number): Promise<{ entry?: DiscoveredEntry; reason: string }> {
  const toCHF = fx.toCHF;
  let reason = 'kein eigener Shopify-Shop gefunden';
  for (const dom of candidateDomains(brand)) {
    const m = await fetchJson<Meta>(`https://${dom}/meta.json`, { retries: 0, timeoutMs: 10000 }).catch(() => null);
    if (!m?.data?.name) continue;
    const meta = m.data;
    const domain = new URL(m.url).hostname;
    if (known.has(domain.replace(/^www\./, ''))) return { reason: 'Shop bereits vorhanden' };
    if (!nameMatches(brand, meta.name ?? '', domain)) {
      reason = `${domain}: gehört nicht zur Marke („${meta.name}“)`;
      continue;
    }
    if (!(meta.ships_to_countries ?? []).some((c) => c === 'CH' || c === '*')) return { reason: `${domain}: liefert nicht in die Schweiz` };
    const currency = meta.currency ?? '';
    if (!toCHF[currency]) return { reason: `${domain}: Währung ${currency} unbekannt` };
    if ((meta.published_products_count ?? 0) < 20) return { reason: `${domain}: zu wenige Produkte` };
    if (!(await productsAllowed(domain))) return { reason: `${domain}: robots.txt erlaubt den Feed nicht` };
    const [refund, privacy, terms] = await Promise.all([policyOk(domain, 'refund-policy'), policyOk(domain, 'privacy-policy'), policyOk(domain, 'terms-of-service')]);
    if (!refund || !privacy) return { reason: `${domain}: keine Rückgabe-/Datenschutzbestimmungen` };
    const raw = await fetchPage(domain, 1).catch(() => null);
    if (!raw?.length) return { reason: `${domain}: Produkt-Feed nicht lesbar` };
    const b = slug(brand);
    const own = raw.filter((p) => {
      const v = slug(p.vendor ?? '');
      return !v || v.includes(b) || b.includes(v) || nameMatches(brand, p.vendor ?? '', domain);
    }).length;
    if (own / raw.length < 0.6) return { reason: `${domain}: kein offizieller Marken-Shop (fremde Marken)` };
    const country = (meta.country ?? '').toUpperCase() || 'US';
    const shop = buildShop(brand, domain, country, currency, styles, via, terms);
    const norm = raw.map((p) => normalizeProduct(p, shop)).filter((p): p is NonNullable<typeof p> => !!p);
    if (norm.length < 15 || norm.length / raw.length < 0.4) return { reason: `${domain}: zu wenig Kleidung (${norm.length}/${raw.length})` };
    // Schutz vor Fake-Shops: Preise dürfen nicht viel tiefer sein als bei den Fachhändlern
    const tots = norm.map((p) => landedCost(p.p, shop as Shop, fx).total).sort((a, b) => a - b);
    const med = tots[Math.floor(tots.length / 2)];
    if (refTot > 0 && med < refTot * 0.4) return { reason: `${domain}: Preise unplausibel tief (Median CHF ${Math.round(med)} statt ~${Math.round(refTot)})` };
    return { entry: { shop, brand, count: meta.published_products_count ?? 0 }, reason: 'aufgenommen' };
  }
  return { reason };
}

export function buildShop(brand: string, domain: string, country: string, currency: string, styles: Style[], via: string[], terms: boolean): Omit<Shop, 'health' | 'market'> {
  const ch = country === 'CH';
  const eu = EU.has(country);
  const gb = country === 'GB';
  const homeVat = ch ? VAT.CH : eu ? EU_VAT[country] ?? 0.2 : gb ? VAT.GB : 0;
  const shipping = ch
    ? est('CHF', 9, undefined, [1, 4], 'Geschätzt (automatisch gefundener Shop)')
    : eu
      ? est('EUR', 15, undefined, [3, 8], 'Geschätzt (automatisch gefundener Shop)')
      : gb
        ? est('GBP', 15, undefined, [3, 8], 'Geschätzt (automatisch gefundener Shop)', 'courier')
        : est('USD', 30, undefined, [5, 12], 'Geschätzt (automatisch gefundener Shop)', 'courier');
  const checks = ['Liefert in die Schweiz', 'Rückgabe- und Datenschutzbestimmungen', ...(terms ? ['AGB'] : []), 'Offizieller Marken-Shop (Produkte der Marke)', 'robots.txt erlaubt Feed'];
  const duty = ch ? 'domestic' : 'dap';
  return {
    id: `x-${slug(brand).slice(0, 30)}`,
    name: brand,
    domain,
    country,
    currency,
    segment: 'new',
    duty,
    homeVat,
    exportVatRemoved: duty === 'dap' && homeVat > 0,
    shipping,
    tier: brandTier(brand) ?? 3,
    styles: styles.length ? styles : ['casual'],
    cap: 200,
    maxPages: 2,
    trust: { level: 'auto', basis: `Automatisch gefunden: offizieller Shop der Marke ${brand}, die bei ${via.slice(0, 2).join(' und ')} geführt wird` },
    discovered: { at: new Date().toISOString(), via, checks },
  };
}

/**
 * Prüft pro Lauf bis zu `probes` Marken. Kandidaten: Marken mit mehreren Produkten bei unseren Fachhändlern
 * (Hauptkatalog + Gesamtsortiment), nach Qualität und Anzahl sortiert.
 */
export async function runDiscovery(o: {
  products: Pick<Product, 'b' | 's' | 'q' | 'st' | 'seg' | 'tot'>[];
  shops: Shop[];
  fx: FxRates;
  probes: number;
  maxNew: number;
  maxTotal: number;
  now: number;
  log: (...m: unknown[]) => void;
}): Promise<DiscoveryState> {
  const st = loadDiscovery();
  if (o.probes <= 0) return st;
  const shopById = new Map(o.shops.map((s) => [s.id, s]));
  const known = new Set(o.shops.map((s) => s.domain.replace(/^www\./, '')));
  for (const e of st.shops) known.add(e.shop.domain.replace(/^www\./, ''));
  const covered = new Set([...o.shops.map((s) => slug(s.name)), ...st.shops.map((e) => slug(e.brand))]);

  const agg = new Map<string, { brand: string; n: number; q: number; tots: number[]; via: Map<string, number>; styles: Map<Style, number> }>();
  for (const p of o.products) {
    const shop = shopById.get(p.s);
    if (!shop?.multiBrand || p.seg !== 'new' || !p.b) continue;
    const k = slug(p.b);
    if (k.length < 2 || SKIP.has(p.b.toLowerCase()) || slug(shop.name) === k) continue;
    let a = agg.get(k);
    if (!a) agg.set(k, (a = { brand: p.b, n: 0, q: 0, tots: [], via: new Map(), styles: new Map() }));
    a.n++;
    a.q += p.q;
    if (a.tots.length < 200) a.tots.push(p.tot);
    a.via.set(shop.name, (a.via.get(shop.name) ?? 0) + 1);
    for (const s of p.st) a.styles.set(s, (a.styles.get(s) ?? 0) + 1);
  }
  const cands = [...agg.entries()]
    .filter(([k, a]) => a.n >= 4 && !covered.has(k) && ![...covered].some((c) => c.length >= 4 && (k.includes(c) || c.includes(k))))
    .filter(([k]) => {
      const t = st.tried[k];
      return !t || (!t.ok && o.now - t.at > 60 * DAY);
    })
    .map(([k, a]) => ({ k, ...a, score: (a.q / a.n) * Math.log2(1 + a.n) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, o.probes);

  if (!cands.length || st.shops.length >= o.maxTotal) return st;
  o.log(`Shop-Entdeckung: prüfe ${cands.length} Marken (${st.shops.length} bisher aufgenommen) …`);
  let added = 0;
  for (const c of cands) {
    if (added >= o.maxNew || st.shops.length >= o.maxTotal) break;
    const via = [...c.via.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
    const styles = [...c.styles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s);
    const sorted = [...c.tots].sort((a, b) => a - b);
    const r = await probeBrand(c.brand, styles, via, known, o.fx, sorted[Math.floor(sorted.length / 2)] ?? 0).catch((e) => ({ reason: (e as Error).message, entry: undefined }));
    st.tried[c.k] = { at: o.now, ok: !!r.entry, reason: r.reason };
    if (r.entry) {
      st.shops.push(r.entry);
      known.add(r.entry.shop.domain.replace(/^www\./, ''));
      added++;
      o.log(`  + Neuer Shop: ${r.entry.shop.name} (${r.entry.shop.domain}, ${r.entry.shop.country}, ${r.entry.count} Produkte)`);
    } else {
      o.log(`  · ${c.brand}: ${r.reason}`);
    }
  }
  writeJson(paths.discovery, st);
  return st;
}

/** Entdeckte Shops entfernen, die nicht mehr in die Schweiz liefern oder seit 7 Tagen nicht erreichbar sind */
export function pruneDiscovery(st: DiscoveryState, health: Record<string, { shipsToCH?: boolean; lastOkAt?: string }>, now: number): string[] {
  const removed: string[] = [];
  st.shops = st.shops.filter((e) => {
    const h = health[e.shop.id];
    const lastOk = h?.lastOkAt ? Date.parse(h.lastOkAt) / 1000 : Date.parse(e.shop.discovered?.at ?? '') / 1000;
    const bad = h?.shipsToCH === false || (lastOk && now - lastOk > 7 * DAY);
    if (bad) {
      removed.push(e.shop.name);
      st.tried[slug(e.brand)] = { at: now, ok: false, reason: 'entfernt: nicht mehr erreichbar oder keine Lieferung in die Schweiz' };
    }
    return !bad;
  });
  if (removed.length) writeJson(paths.discovery, st);
  return removed;
}
