// Kompaktes Katalogformat (Zeilen statt Objekte, Listen als Strings) – ca. 50 % kleiner als JSON-Objekte.
import type { Catalog, Category, Condition, FxRates, Gender, Product, Shop, Style } from './types';
import { itemPriceCHF } from './pricing';
import { sizeSortKey } from './classify';

export const FIELDS = [
  'id', 's', 't', 'b', 'u', 'img', 'p', 'pc', 'tot', 'cat', 'g', 'col', 'mat', 'fx', 'sz', 'sx', 'av', 'q', 'qc',
  'st', 'cond', 'era', 'fit', 'kw', 'first', 'upd', 'low', 'drop',
] as const;

export interface PackedCatalog {
  v: 2;
  generatedAt: string;
  fx: FxRates;
  shops: Shop[];
  fields: readonly string[];
  rows: unknown[][];
}

const list = (a?: string[]) => (a && a.length ? a.join(',') : '');
const unlist = (s: unknown) => (typeof s === 'string' && s ? s.split(',') : []);

export function packProduct(p: Product): unknown[] {
  const sold = p.sza.filter((x) => !p.sz.includes(x));
  const row: unknown[] = [
    p.id, p.s, p.t, p.b, p.u, p.img, p.p, p.pc ?? 0, p.tot, p.cat, p.g, list(p.col),
    p.mat.map((m) => (m.pct !== undefined ? `${m.k}:${m.pct}` : m.k)).join(','),
    list(p.fx), list(p.sz), list(sold), p.av ? 1 : 0, p.q, Math.round(p.qc * 10) / 10,
    list(p.st.slice(0, 2)), p.cond ?? '', p.era ?? '', p.fit ?? '', p.kw ?? '', Math.round(p.first / 60), Math.round(p.upd / 60), p.low ?? 0, p.drop ?? 0,
  ];
  // leere Werte am Ende entfernen
  while (row.length && (row[row.length - 1] === '' || row[row.length - 1] === 0)) row.pop();
  return row;
}

export function packCatalog(c: Catalog): PackedCatalog {
  return { v: 2, generatedAt: c.generatedAt, fx: c.fx, shops: c.shops, fields: FIELDS, rows: c.products.map(packProduct) };
}

export function unpackProduct(r: unknown[], shopById: Record<string, Shop>, fx: FxRates): Product | null {
  const get = (i: number) => r[i];
  const s = String(get(1));
  const shop = shopById[s];
  if (!shop) return null;
  const p = Number(get(6));
  const pc = Number(get(7) ?? 0) || undefined;
  const sz = unlist(get(14));
  const sx = unlist(get(15));
  const sza = [...sz, ...sx].sort((a, b) => sizeSortKey(a) - sizeSortKey(b) || a.localeCompare(b));
  let chf = 0;
  let chfWas: number | undefined;
  try {
    chf = itemPriceCHF(p, shop, fx);
    chfWas = pc ? itemPriceCHF(pc, shop, fx) : undefined;
  } catch {
    /* fehlender Kurs */
  }
  return {
    id: String(get(0)),
    s,
    seg: shop.segment,
    t: String(get(2)),
    b: String(get(3)),
    u: String(get(4)),
    img: String(get(5)),
    p,
    pc,
    cur: shop.market ? 'CHF' : shop.currency,
    chf,
    chfWas,
    tot: Number(get(8)),
    cat: get(9) as Category,
    g: get(10) as Gender,
    col: unlist(get(11)),
    mat: unlist(get(12)).map((x) => {
      const [k, pct] = x.split(':');
      return pct !== undefined ? { k, pct: Number(pct) } : { k };
    }),
    fx: unlist(get(13)),
    sz,
    sza,
    av: get(16) === 1,
    q: Number(get(17) ?? 0),
    qc: Number(get(18) ?? 0),
    st: unlist(get(19)) as Style[],
    cond: (get(20) || undefined) as Condition | undefined,
    era: (get(21) || undefined) as string | undefined,
    fit: (get(22) || undefined) as string | undefined,
    kw: (get(23) || undefined) as string | undefined,
    first: Number(get(24) ?? 0) * 60,
    upd: Number(get(25) ?? 0) * 60,
    low: Number(get(26) ?? 0) || undefined,
    drop: Number(get(27) ?? 0) || undefined,
  };
}

export function unpackCatalog(pc: PackedCatalog | Catalog): Catalog {
  if ((pc as Catalog).products) return pc as Catalog;
  const packed = pc as PackedCatalog;
  const shopById = Object.fromEntries(packed.shops.map((s) => [s.id, s]));
  const products: Product[] = [];
  for (const r of packed.rows) {
    const p = unpackProduct(r, shopById, packed.fx);
    if (p) products.push(p);
  }
  return { v: 1, generatedAt: packed.generatedAt, fx: packed.fx, shops: packed.shops, products };
}
