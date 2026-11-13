// Engine-Lauf: Shops abrufen → normalisieren → Preise/Qualität → Katalog, Verlauf, Alarme, Embeddings.
// Aufruf: npm run update  (Optionen: --shops=a,b  --no-alerts  --embed=2000  --no-embed  --quiet)
import { SHOPS } from './shops';
import { fetchMeta, fetchPages, fetchShopifyFx, detectChMarket, productsAllowed } from './sources/shopify';
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
    ss.lastOkAt = new Date().toISOString();
    ss.lastError = undefined;
    ss.products = products.length;
    log(`  ✓ ${shop.name.padEnd(26)} ${String(products.length).padStart(5)} / ${res.products.length} Rohprodukte${shop.market ? `  [CH-Markt ${shop.market.prefix} ${shop.market.mode} r=${shop.market.ratio}]` : ''}`);
    return { shop, products, ok: true };
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
  const shops = SHOPS.filter((s) => !only || only.has(s.id));

  log(`Stilkompass-Update: ${shops.length} Shops …`);
  const fx: FxRates = (await fetchShopifyFx(['colorfulstandard.com', 'nikin.com', 'sunspel.com']).catch(() => null)) ?? prev?.fx ?? STATIC_FX;
  log(`Kurse (${fx.source}, ${fx.date}): EUR ${fx.toCHF.EUR} · GBP ${fx.toCHF.GBP} · USD ${fx.toCHF.USD}`);

  const results = await pool(shops, 6, (s) => crawlShop(s, fx, state));

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
  };
  writeJson(paths.meta, meta, true);
  log(`Fertig in ${meta.durationS}s: ${meta.products} Produkte (${meta.new} neu, ${meta.secondhand} Secondhand) aus ${meta.shops} Shops · Katalog ${(size / 1e6).toFixed(1)} MB`);
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
