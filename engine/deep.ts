// Gesamtsortiment: holt bei grossen Shops auch die älteren Feed-Seiten (bis 25’000 Produkte pro Shop).
// Höflich: jeder Shop höchstens 1× pro Tag vollständig, mit Seitenbudget pro Lauf und Pausen zwischen den Seiten.
// Ausgabe: data/deep/<gruppe>.json (kompaktes Zeilenformat) + data/deep/index.json – die App lädt nur bei Bedarf.
import fs from 'node:fs';
import path from 'node:path';
import type { FxRates, Product, Shop } from '../shared/types';
import { FIELDS, packProduct } from '../shared/catalog';
import { DEEP_GROUPS, deepGroupOf, type DeepIndex, type PackedDeep } from '../shared/deep';
import { landedCost } from '../shared/pricing';
import { qualityScore } from '../shared/quality';
import { fetchPages } from './sources/shopify';
import { normalizeProduct, type NormProduct } from './normalize';
import { paths, readJson, writeJson, type EngineState } from './store';

const DAY = 86400;
const MAX_PAGES = 100; // Shopify liefert höchstens 100 Seiten à 250 Produkte

/** Preis/Qualität für das Gesamtsortiment (ohne Preisverlauf) */
export function toDeepProduct(n: NormProduct, shop: Shop, fx: FxRates, now: number): Product {
  const cost = landedCost(n.p, shop, fx, { compareAt: n.pc });
  const q = qualityScore({ cat: n.cat, mat: n.mat, fx: n.fx, b: n.b, seg: n.seg, cond: n.cond }, shop);
  const { published, imgs: _i, d: _d, ...rest } = n;
  void _i;
  void _d;
  const first = published > 0 ? Math.min(now, Math.round(published)) : now;
  return { ...rest, chf: cost.item, chfWas: cost.itemWas, tot: cost.total, q: q.score, qc: q.confidence, first, upd: now };
}

/** Bisheriges Gesamtsortiment laden, nach Shop gruppiert (gepackte Zeilen, Shop-ID an Position 1) */
export function loadDeepRows(): Map<string, unknown[][]> {
  const out = new Map<string, unknown[][]>();
  const idx = readJson<DeepIndex | null>(path.join(paths.deep, 'index.json'), null);
  if (!idx) return out;
  for (const g of Object.keys(idx.groups)) {
    const shard = readJson<PackedDeep | null>(path.join(paths.deep, `${g}.json`), null);
    for (const r of shard?.rows ?? []) {
      const s = String(r[1]);
      if (!out.has(s)) out.set(s, []);
      out.get(s)!.push(r);
    }
  }
  return out;
}

export function totalPages(count: number | undefined): number {
  return count ? Math.min(MAX_PAGES, Math.ceil(Math.min(count, 25000) / 250)) : 0;
}

interface DeepOptions {
  /** erfolgreich abgerufene Shops dieses Laufs (mit CH-Markt) */
  shops: Shop[];
  /** Shops, deren Daten erhalten bleiben sollen (z. B. vorübergehend nicht erreichbar oder nicht abgefragt) */
  keep: Set<string>;
  mainIds: Set<string>;
  /** normalisierte Produkte, die nicht mehr in den Hauptkatalog passten */
  overflow: Map<string, NormProduct[]>;
  fx: FxRates;
  state: EngineState;
  /** max. Feed-Seiten in diesem Lauf (0 = nur bestehende Daten aktualisieren) */
  budget: number;
  /** bereits geladene bisherige Daten (sonst aus data/deep) */
  existing?: Map<string, unknown[][]>;
  now: number;
  log: (...m: unknown[]) => void;
}

export async function runDeep(o: DeepOptions): Promise<{ index: DeepIndex; rows: Map<string, unknown[]> }> {
  const existing = o.existing ?? loadDeepRows();
  const byShop = new Map<string, unknown[][]>();
  const due = o.shops
    .filter((s) => totalPages(o.state.shops[s.id]?.count) > s.maxPages!)
    .filter((s) => {
      const ss = o.state.shops[s.id];
      const last = Math.max(ss?.deepAt ?? 0, (ss?.deepTriedAt ?? 0) - 20 * 3600);
      return o.now - last > DAY;
    })
    .sort((a, b) => (o.state.shops[a.id]?.deepAt ?? 0) - (o.state.shops[b.id]?.deepAt ?? 0));

  // Seitenbudget verteilen: Shops vollständig abrufen, solange das Budget reicht
  let left = o.budget;
  const jobs: { shop: Shop; pages: number[] }[] = [];
  for (const s of due) {
    if (left <= 0) break;
    const tp = totalPages(o.state.shops[s.id]?.count);
    const pages = Array.from({ length: tp - s.maxPages! }, (_, i) => s.maxPages! + 1 + i);
    // Ein grosser Shop darf das Budget allein ausschöpfen, sonst passende kleinere zuerst
    if (pages.length <= left || !jobs.length) {
      jobs.push({ shop: s, pages });
      left -= pages.length;
    }
  }

  const fresh = new Map<string, Product[]>();
  if (jobs.length) o.log(`Gesamtsortiment: ${jobs.length} Shop(s), ${jobs.reduce((a, j) => a + j.pages.length, 0)} Feed-Seiten …`);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, jobs.length) }, async () => {
      while (i < jobs.length) {
        const { shop, pages } = jobs[i++];
        const ss = (o.state.shops[shop.id] ??= { rotate: 0 });
        ss.deepTriedAt = o.now;
        try {
          const res = await fetchPages(shop.domain, pages, shop.market?.prefix ?? '', 800);
          if (!res.products.length) {
            o.log(`  ✗ Gesamtsortiment ${shop.name}: keine Daten (${res.failed} Fehler)`);
            continue;
          }
          const list: Product[] = [];
          for (const raw of res.products) {
            const n = normalizeProduct(raw, shop);
            if (n) list.push(toDeepProduct(n, shop, o.fx, o.now));
          }
          fresh.set(shop.id, list);
          ss.deepAt = o.now;
          o.log(`  ✓ Gesamtsortiment ${shop.name.padEnd(24)} +${String(list.length).padStart(5)} aus ${res.products.length} Rohprodukten (${pages.length} Seiten)`);
        } catch (e) {
          o.log(`  ✗ Gesamtsortiment ${shop.name}: ${(e as Error).message}`);
        }
      }
    }),
  );

  const shopById = new Map(o.shops.map((s) => [s.id, s]));
  const ids = new Set<string>();
  const add = (s: string, r: unknown[]) => {
    const id = String(r[0]);
    if (o.mainIds.has(id) || ids.has(id)) return;
    ids.add(id);
    if (!byShop.has(s)) byShop.set(s, []);
    byShop.get(s)!.push(r);
  };
  for (const [s, ov] of o.overflow) {
    const shop = shopById.get(s);
    if (shop) for (const n of ov) add(s, packProduct(toDeepProduct(n, shop, o.fx, o.now)));
  }
  for (const [s, list] of fresh) for (const p of list) add(s, packProduct(p));
  // Bisherige Daten übernehmen (nicht neu abgerufene Shops), entfernte Shops weglassen
  for (const [s, rows] of existing) {
    if (fresh.has(s)) continue;
    if (!shopById.has(s) && !o.keep.has(s)) continue;
    for (const r of rows) add(s, r);
  }

  // In Kategorie-Gruppen schreiben
  const groups = new Map<string, unknown[][]>(Object.keys(DEEP_GROUPS).map((g) => [g, []]));
  const all = new Map<string, unknown[]>();
  for (const rows of byShop.values()) {
    for (const r of rows) {
      groups.get(deepGroupOf(r[9] as Product['cat']))!.push(r);
      all.set(String(r[0]), r);
    }
  }
  fs.mkdirSync(paths.deep, { recursive: true });
  const generatedAt = new Date().toISOString();
  const index: DeepIndex = { v: 1, generatedAt, total: all.size, groups: {}, shops: {} };
  for (const [g, rows] of groups) {
    const file = path.join(paths.deep, `${g}.json`);
    if (!rows.length) {
      fs.rmSync(file, { force: true });
      continue;
    }
    const packed: PackedDeep = { v: 2, generatedAt, fields: FIELDS, rows };
    index.groups[g] = { n: rows.length, bytes: writeJson(file, packed) };
  }
  for (const [s, rows] of byShop) {
    const at = o.state.shops[s]?.deepAt;
    index.shops[s] = { n: rows.length, at: at ? new Date(at * 1000).toISOString() : undefined };
  }
  writeJson(path.join(paths.deep, 'index.json'), index);
  const mb = Object.values(index.groups).reduce((a, g) => a + g.bytes, 0) / 1e6;
  o.log(`Gesamtsortiment: ${index.total} zusätzliche Produkte (${mb.toFixed(1)} MB)`);
  return { index, rows: all };
}
