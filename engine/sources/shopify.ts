// Öffentliche Shopify-Storefront-Feeds: /meta.json, /products.json, /services/javascripts/currencies.js
import type { FxRates, Shop, ShopMarket } from '../../shared/types';
import { fetchJson, fetchText, isAllowed, robotsFor, sleep } from '../http';

export interface ShopifyImage { src: string; width?: number; height?: number }
export interface ShopifyVariant {
  id: number; title: string; option1: string | null; option2: string | null; option3: string | null;
  price: string; compare_at_price: string | null; available?: boolean; sku?: string | null; grams?: number;
}
export interface ShopifyProduct {
  id: number; title: string; handle: string; body_html: string | null; vendor: string; product_type: string;
  tags: string[] | string; created_at: string; published_at?: string; updated_at: string;
  options: { name: string; position?: number; values: string[] }[];
  variants: ShopifyVariant[]; images: ShopifyImage[];
}

export interface ShopMeta { shipsToCH: boolean; currency: string; count: number; name: string }

export async function fetchMeta(domain: string): Promise<ShopMeta | null> {
  const r = await fetchJson<{ ships_to_countries?: string[]; currency?: string; published_products_count?: number; name?: string }>(`https://${domain}/meta.json`, { retries: 1 });
  if (!r.data) return null;
  return {
    // "*" = Versandzone "Restliche Welt" (schliesst die Schweiz ein)
    shipsToCH: (r.data.ships_to_countries ?? []).some((c) => c === 'CH' || c === '*'),
    currency: r.data.currency ?? '',
    count: r.data.published_products_count ?? 0,
    name: r.data.name ?? domain,
  };
}

export async function productsAllowed(domain: string, prefix = ''): Promise<boolean> {
  const rules = await robotsFor(domain);
  return isAllowed(rules, `${prefix}/products.json`) && isAllowed(rules, `${prefix}/products/x`);
}

export async function fetchPage(domain: string, page: number, prefix = ''): Promise<ShopifyProduct[] | null> {
  const r = await fetchJson<{ products: ShopifyProduct[] }>(`https://${domain}${prefix}/products.json?limit=250&page=${page}`, { timeoutMs: 30000 });
  if (r.status !== 200 || !r.data) return null;
  // Geo-Weiterleitung auf einen anderen Markt erkennen
  if (prefix && !new URL(r.url).pathname.startsWith(prefix)) return null;
  return r.data.products ?? [];
}

/** Holt die angegebenen Seiten nacheinander mit Pause (Höflichkeit) */
export async function fetchPages(domain: string, pages: number[], prefix = '', delayMs = 700): Promise<{ products: ShopifyProduct[]; lastPageShort: boolean; failed: number }> {
  const out: ShopifyProduct[] = [];
  let lastPageShort = false;
  let failed = 0;
  for (const p of pages) {
    const res = await fetchPage(domain, p, prefix).catch(() => null);
    if (res === null) {
      failed++;
      if (failed >= 2) break;
      continue;
    }
    out.push(...res);
    if (res.length < 250) {
      lastPageShort = true;
      break;
    }
    await sleep(delayMs);
  }
  return { products: out, lastPageShort, failed };
}

/** Wechselkurse aus dem öffentlichen Shopify-Kursfeed (USD-Basis) → CHF je Einheit */
export async function fetchShopifyFx(domains: string[]): Promise<FxRates | null> {
  for (const d of domains) {
    try {
      const r = await fetchText(`https://${d}/services/javascripts/currencies.js`, { retries: 1, accept: '*/*' });
      const m = r.text.match(/rates:\s*(\{[^}]+\})/);
      if (!m) continue;
      const rates = JSON.parse(m[1]) as Record<string, number>;
      const chf = rates.CHF;
      if (!chf) continue;
      const toCHF: Record<string, number> = {};
      for (const [k, v] of Object.entries(rates)) if (v > 0) toCHF[k] = Math.round((v / chf) * 1e6) / 1e6;
      toCHF.CHF = 1;
      // Plausibilitätsprüfung
      if (toCHF.EUR < 0.7 || toCHF.EUR > 1.3) continue;
      return { toCHF, source: 'shopify', date: new Date().toISOString().slice(0, 10) };
    } catch {
      /* nächster Shop */
    }
  }
  return null;
}

/**
 * Erkennt einen Schweizer Markt mit CHF-Preisen (Subfolder /de-ch, /en-ch, /fr-ch).
 * Vergleicht Stichproben mit dem Basispreis, um zu erkennen, ob die MWST enthalten ist.
 */
export async function detectChMarket(shop: Shop, fx: FxRates): Promise<ShopMarket | null> {
  if (shop.currency === 'CHF') return null;
  for (const loc of ['de-ch', 'en-ch', 'fr-ch', 'it-ch']) {
    const prefix = `/${loc}`;
    const r = await fetchJson<{ products: ShopifyProduct[] }>(`https://${shop.domain}${prefix}/products.json?limit=60`, { redirect: 'manual', retries: 1 }).catch(() => null);
    if (!r || r.status !== 200 || !r.data?.products?.length) continue;
    const sample = r.data.products;
    const page = await fetchText(`https://${shop.domain}${prefix}/products/${sample[0].handle}`, { redirect: 'manual', retries: 1, accept: 'text/html' }).catch(() => null);
    if (!page || page.status !== 200) continue;
    const cur = page.text.match(/Shopify\.currency\s*=\s*\{"active":"([A-Z]{3})"/)?.[1];
    if (cur !== 'CHF') return null;
    const base = await fetchJson<{ products: ShopifyProduct[] }>(`https://${shop.domain}/products.json?limit=60`, { retries: 1 }).catch(() => null);
    const baseById = new Map((base?.data?.products ?? []).map((p) => [p.id, p]));
    const ratios: number[] = [];
    const rate = fx.toCHF[shop.currency];
    for (const p of sample) {
      const b = baseById.get(p.id);
      const chf = Number(p.variants[0]?.price);
      const bp = Number(b?.variants[0]?.price);
      if (b && chf > 0 && bp > 0 && rate) ratios.push(chf / (bp * rate));
    }
    if (!ratios.length) continue;
    ratios.sort((a, b) => a - b);
    const ratio = Math.round(ratios[Math.floor(ratios.length / 2)] * 1000) / 1000;
    // Sehr abweichende Verhältnisse deuten auf Fehler hin → nicht verwenden
    if (ratio < 0.6 || ratio > 1.6) return null;
    return { prefix, ratio, mode: ratio >= 0.95 ? 'ddp' : 'dap', checkedAt: new Date().toISOString() };
  }
  return null;
}
