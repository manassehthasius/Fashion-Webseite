// Engine-Lauf: Shops abrufen → normalisieren → Preise/Qualität → Katalog, Verlauf, Alarme, Embeddings.
// Aufruf: npm run update  (Optionen: --shops=a,b  --no-alerts  --embed=2000  --no-embed  --quiet
//                            --deep=300 Feed-Seiten fürs Gesamtsortiment, --discover=8 Marken auf eigenen Shop prüfen)
import { SHOPS } from './shops';
import { fetchMeta, fetchPages, fetchProduct, fetchShopifyFx, detectChMarket, productsAllowed } from './sources/shopify';
import { loadDeepRows, runDeep } from './deep';
import { discoveredShops, loadDiscovery, pruneDiscovery, runDiscovery } from './discover';
import { normalizeProduct, type NormProduct } from './normalize';
import { enrich, pruneState } from './build';
import { loadCatalog, loadHistory, loadState, paths, writeJson, type EngineState } from './store';
import { packCatalog } from '../shared/catalog';
import path from 'node:path';
import { STATIC_FX } from '../shared/pricing';
import type { Catalog, FxRates, Product, Shop } from '../shared/types';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
) as Record<string, string | boolean>;

const log = (...m: unknown[]) => {
  if (!args.quiet) console.log(...m);
};

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

interface CrawlResult {
  shop: Shop;
  products: NormProduct[];
  /** normalisierte Produkte jenseits des Katalog-Limits (→ Gesamtsortiment) */
  overflow?: NormProduct[];
  ok: boolean;
  error?: string;
}

async function crawlShop(base: Shop, fx: FxRates, state: EngineState): Promise<CrawlResult> {
  const ss = (state.shops[base.id] ??= { rotate: 0 });
  try {
    const meta = await fetchMeta(base.domain).catch(() => null);
    if (meta && !meta.shipsToCH) {
      ss.shipsToCH = false;
      return { shop: base, products: [], ok: false, error: 'Liefert laut Shop nicht mehr in die Schweiz' };
    }
    ss.shipsToCH = meta ? true : ss.shipsToCH;
    if (meta?.count) ss.count = meta.count;

    // Schweizer Markt (CHF-Preise) höchstens 1× pro Tag prüfen
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    if (base.currency !== 'CHF' && (!ss.marketCheckedAt || Date.parse(ss.marketCheckedAt) < dayAgo)) {
      ss.market = await detectChMarket(base, fx).catch(() => ss.market ?? null);
      ss.marketCheckedAt = new Date().toISOString();
    }
    const shop: Shop = { ...base, market: ss.market ?? null };
    const prefix = shop.market?.prefix ?? '';
    if (!(await productsAllowed(shop.domain, prefix))) {
      return { shop, products: [], ok: false, error: 'robots.txt erlaubt den Produkt-Feed nicht' };
    }
    const total = meta?.count ? Math.ceil(Math.min(meta.count, 25000) / 250) : shop.maxPages!;
    const pages = Array.from({ length: Math.max(1, Math.min(shop.maxPages!, total)) }, (_, i) => i + 1);
    let res = await fetchPages(shop.domain, pages, prefix);
    if (!res.products.length && prefix) {
      // CH-Markt plötzlich weitergeleitet → Basisfeed
      shop.market = null;
      ss.market = null;
      res = await fetchPages(shop.domain, pages, '');
    }
    if (!res.products.length) return { shop, products: [], ok: false, error: `Feed leer oder nicht erreichbar (${res.failed} Fehler)` };
    const normalized = res.products.map((p) => normalizeProduct(p, shop)).filter((p): p is NormProduct => !!p);
    normalized.sort((a, b) => b.published - a.published);
    const products = normalized.slice(0, shop.cap);
    const overflow = normalized.slice(shop.cap);
    ss.lastOkAt = new Date().toISOString();
    ss.lastError = undefined;
    ss.products = products.length;
    log(`  ✓ ${shop.name.padEnd(26)} ${String(products.length).padStart(5)} / ${res.products.length} Rohprodukte${shop.market ? `  [CH-Markt ${shop.market.prefix} ${shop.market.mode} r=${shop.market.ratio}]` : ''}`);
    return { shop, products, overflow, ok: true };
  } catch (e) {
    ss.lastError = (e as Error).message;
    return { shop: { ...base, market: ss.market ?? null }, products: [], ok: false, error: (e as Error).message };
  }
}

export async function runUpdate(): Promise<{ catalog: Catalog; prev: Catalog | null }> {
  const t0 = Date.now();
  const now = Math.floor(t0 / 1000);
  const state = loadState();
  const history = loadHistory();
  const prev = loadCatalog();

  const only = typeof args.shops === 'string' ? new Set(args.shops.split(',')) : null;
  const discovery = loadDiscovery();
  const known = [...SHOPS, ...discoveredShops(discovery)];
  const shops = known.filter((s) => !only || only.has(s.id));

  log(`Stilkompass-Update: ${shops.length} Shops …`);
  const fx: FxRates = (await fetchShopifyFx(['colorfulstandard.com', 'nikin.com', 'sunspel.com']).catch(() => null)) ?? prev?.fx ?? STATIC_FX;
  log(`Kurse (${fx.source}, ${fx.date}): EUR ${fx.toCHF.EUR} · GBP ${fx.toCHF.GBP} · USD ${fx.toCHF.USD}`);

  const results = await pool(shops, 6, (s) => crawlShop(s, fx, state));

  async function promoteWatched(res: CrawlResult[], deepRows: Map<string, unknown[][]>) {
    if (args['no-alerts']) return;
    const { loadUserStates } = await import('./alerts');
    const users = await loadUserStates(() => {}).catch(() => []);
    const want = new Set(users.flatMap((u) => u.state.watch.map((w) => w.id)));
    if (!want.size) return;
    for (const r of res) for (const p of r.products) want.delete(p.id);
    if (!want.size) return;
    const byShop = new Map(res.filter((r) => r.ok).map((r) => [r.shop.id, r]));
    let n = 0;
    for (const rows of deepRows.values()) {
      for (const row of rows) {
        const id = String(row[0]);
        if (!want.has(id) || n >= 60) continue;
        const r = byShop.get(String(row[1]));
        if (!r) continue;
        n++;
        const raw = await fetchProduct(r.shop.domain, String(row[4]), r.shop.market?.prefix ?? '', r.shop.market ? 'CHF' : r.shop.currency).catch(() => null);
        const np = raw ? normalizeProduct(raw, r.shop) : null;
        if (np && np.id === id) r.products.push(np);
      }
    }
    if (n) log(`Beobachtete Teile aus dem Gesamtsortiment aktualisiert: ${n}`);
  }

  // Beobachtete Teile aus dem Gesamtsortiment in den Hauptkatalog holen (Preisverlauf + Alarme alle 30 Min.)
  const existingDeep = loadDeepRows();
  await promoteWatched(results, existingDeep);

  const prevByShop = new Map<string, Product[]>();
  for (const p of prev?.products ?? []) {
    if (!prevByShop.has(p.s)) prevByShop.set(p.s, []);
    prevByShop.get(p.s)!.push(p);
  }

  const products: Product[] = [];
  const shopsOut: Shop[] = [];
  for (const r of results) {
    const health = { ok: r.ok, at: new Date().toISOString(), products: r.products.length, error: r.error };
    if (r.ok) {
      // Details (weitere Bilder, Beschreibung) pro Shop separat – werden in der App erst bei Bedarf geladen
      const details: Record<string, [string[], string]> = {};
      for (const n of r.products) {
        details[n.id] = [n.imgs ?? [], n.d ?? ''];
        const { imgs: _i, d: _d, ...rest } = n;
        void _i;
        void _d;
        products.push(enrich(rest, r.shop, fx, state, history, now));
      }
      writeJson(path.join(paths.details, `${r.shop.id}.json`), details);
    } else {
      // Abruf fehlgeschlagen: letzte Daten bis 72 h weiterverwenden (als veraltet markiert)
      const old = (prevByShop.get(r.shop.id) ?? []).filter((p) => now - (state.products[p.id]?.seen ?? 0) < 72 * 3600);
      products.push(...old);
      health.products = old.length;
      if (r.error) log(`  ✗ ${r.shop.name.padEnd(26)} ${r.error}${old.length ? ` (behalte ${old.length} ältere Einträge)` : ''}`);
    }
    if (r.ok || health.products > 0) shopsOut.push({ ...r.shop, health });
  }
  // Nicht abgefragte Shops (z. B. --shops) aus dem alten Katalog übernehmen
  if (only && prev) {
    for (const s of prev.shops) {
      if (!only.has(s.id)) {
        shopsOut.push(s);
        products.push(...(prevByShop.get(s.id) ?? []));
      }
    }
  }

  // Gesamtsortiment (ältere Feed-Seiten grosser Shops, rotierend 1× pro Tag)
  const mainIds = new Set(products.map((p) => p.id));
  const keep = new Set(only ? known.filter((s) => !only.has(s.id)).map((s) => s.id) : []);
  for (const r of results) if (!r.ok && state.shops[r.shop.id]?.shipsToCH !== false) keep.add(r.shop.id);
  const overflow = new Map(results.filter((r) => r.ok && r.overflow?.length).map((r) => [r.shop.id, r.overflow!]));
  const deepBudget = Number(args.deep ?? process.env.DEEP_BUDGET ?? 300);
  const deep = await runDeep({ shops: results.filter((r) => r.ok).map((r) => r.shop), keep, mainIds, overflow, fx, state, budget: only ? 0 : deepBudget, existing: existingDeep, now, log });

  // Neue Shops entdecken (werden ab dem nächsten Lauf abgefragt)
  const removed = pruneDiscovery(discovery, state.shops, now);
  if (removed.length) log(`Shop-Entdeckung: entfernt ${removed.join(', ')}`);
  const segOf = new Map(known.map((s) => [s.id, s.segment]));
  const deepLite = [...deep.rows.values()].map((r) => ({ b: String(r[3]), s: String(r[1]), tot: Number(r[8]), q: Number(r[17] ?? 0), st: (typeof r[19] === 'string' && r[19] ? r[19].split(',') : []) as Product['st'], seg: segOf.get(String(r[1])) ?? 'new' }));
  const disc = await runDiscovery({
    products: [...products, ...deepLite],
    shops: known,
    fx,
    probes: only ? 0 : Number(args.discover ?? process.env.DISCOVER_PROBES ?? 8),
    maxNew: 3,
    maxTotal: 150,
    now,
    log,
  }).catch((e) => {
    log(`Shop-Entdeckung fehlgeschlagen: ${(e as Error).message}`);
    return discovery;
  });

  pruneState(state, history, now);
  state.runs++;
  state.lastRun = new Date().toISOString();

  const catalog: Catalog = { v: 1, generatedAt: new Date().toISOString(), fx, shops: shopsOut, products };
  const size = writeJson(paths.catalog, packCatalog(catalog));
  const hsize = writeJson(paths.history, history);
  writeJson(paths.state, state);
  const meta = {
    generatedAt: catalog.generatedAt,
    durationS: Math.round((Date.now() - t0) / 1000),
    products: products.length,
    new: products.filter((p) => p.seg === 'new').length,
    secondhand: products.filter((p) => p.seg === 'secondhand').length,
    shops: shopsOut.length,
    failed: results.filter((r) => !r.ok).map((r) => ({ id: r.shop.id, error: r.error })),
    fx: { source: fx.source, date: fx.date },
    catalogBytes: size,
    historyBytes: hsize,
    deep: deep.index.total,
    deepBytes: Object.values(deep.index.groups).reduce((a, g) => a + g.bytes, 0),
    discovered: disc.shops.map((e) => ({ id: e.shop.id, name: e.shop.name, at: e.shop.discovered?.at })),
  };
  writeJson(paths.meta, meta, true);
  log(`Fertig in ${meta.durationS}s: ${meta.products} Produkte + ${meta.deep} im Gesamtsortiment (${meta.new} neu, ${meta.secondhand} Secondhand) aus ${meta.shops} Shops · Katalog ${(size / 1e6).toFixed(1)} MB`);
  return { catalog, prev };
}

const isMain = process.argv[1] && /run\.(ts|js)$/.test(process.argv[1]);
if (isMain) {
  runUpdate()
    .then(async ({ catalog, prev }) => {
      if (!args['no-alerts']) {
        const { runAlerts } = await import('./alerts');
        await runAlerts(catalog, prev, { log });
      }
      if (args.embed && !args['no-embed']) {
        const { runEmbeddings } = await import('./embed');
        await runEmbeddings(catalog, { budget: typeof args.embed === 'string' ? Number(args.embed) : 1500, log });
      }
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
