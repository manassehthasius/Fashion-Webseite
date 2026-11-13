// Suche, Filter, Sortierung und Facetten im Browser (36’000+ Produkte in wenigen Millisekunden).
import type { Category, Condition, Gender, SearchFilters, StyleProfile, Style } from '@shared/types';
import { buildVocab, groupsMatch, matchFilters, parseQuery, textMatches, textScore, type ParsedQuery, type Vocab } from '@shared/search';
import { combinedMatch, isPersonalized, rankValue } from '@shared/personalize';
import type { Interests } from '@shared/interests';
import type { Item } from './data';
import { getData } from './data';

export type Sort = 'relevance' | 'price' | 'price_desc' | 'quality' | 'value' | 'new' | 'drop';

export const SORT_LABELS: Record<Sort, string> = {
  relevance: 'Empfohlen',
  value: 'Beste Preis-Leistung',
  quality: 'Höchste Qualität',
  price: 'Gesamtpreis aufsteigend',
  price_desc: 'Gesamtpreis absteigend',
  new: 'Neueste',
  drop: 'Grösste Preissenkung',
};

export interface QueryInput {
  q: string;
  filters: SearchFilters;
  segment: 'new' | 'secondhand' | 'all';
  sort: Sort;
  profile?: StyleProfile;
  personalize?: boolean;
  interests?: Interests;
}

export interface QueryResult {
  items: Item[];
  parsed: ParsedQuery;
  /** Suche nach einem bestimmten Produkt/Modell (Marke oder Modellbegriffe) → Preisvergleich anzeigen */
  specific: boolean;
  understood: string[];
  effective: SearchFilters;
  facets: Facets;
  ms: number;
}

export interface Facets {
  categories: [Category, number][];
  brands: [string, number][];
  colors: [string, number][];
  materials: [string, number][];
  styles: [Style, number][];
  sizes: [string, number][];
  shops: [string, number][];
  genders: [Gender, number][];
  conditions: [Condition, number][];
}

const FACET_MATERIALS = ['cashmere', 'merino', 'wool', 'alpaca', 'linen', 'silk', 'organic_cotton', 'cotton', 'leather', 'suede', 'down', 'lyocell', 'hemp', 'recycled_polyester', 'polyester', 'nylon'];

function count<K>(m: Map<K, number>, k: K) {
  m.set(k, (m.get(k) ?? 0) + 1);
}
const top = <K,>(m: Map<K, number>, n: number): [K, number][] => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

let vocabCache: { items: Item[]; vocab: Vocab } | null = null;
export function getVocab(): Vocab {
  const { items } = getData();
  if (!vocabCache || vocabCache.items !== items) vocabCache = { items, vocab: buildVocab(items) };
  return vocabCache.vocab;
}

export function runQuery(input: QueryInput): QueryResult {
  const t0 = performance.now();
  const { items, shopById } = getData();
  const pq = parseQuery(input.q, input.q.trim() ? getVocab() : undefined);
  const hasText = pq.text.length > 0 || pq.groups.length > 0 || pq.soft.length > 0;
  // Explizite Filter haben Vorrang vor erkannten Begriffen
  const effective: SearchFilters = { ...pq.filters };
  for (const [k, v] of Object.entries(input.filters)) {
    if (v === undefined || (Array.isArray(v) && !v.length)) continue;
    (effective as Record<string, unknown>)[k] = v;
  }
  const profile = input.profile;
  const usePersonal = !!(input.personalize && profile && isPersonalized(profile, input.interests));
  const out: { p: Item; score: number }[] = [];
  const fCat = new Map<Category, number>(), fBrand = new Map<string, number>(), fCol = new Map<string, number>(), fMat = new Map<string, number>();
  const fSty = new Map<Style, number>(), fSize = new Map<string, number>(), fShop = new Map<string, number>(), fG = new Map<Gender, number>(), fCond = new Map<Condition, number>();

  for (const p of items) {
    if (input.segment !== 'all' && p.seg !== input.segment) continue;
    const shop = shopById[p.s];
    if (!matchFilters(p, effective, shop)) continue;
    if (pq.text.length && !textMatches(p.h, pq.text)) continue;
    if (pq.groups.length && !groupsMatch(p, p.h, pq.groups)) continue;
    let match = null;
    if (usePersonal) {
      match = combinedMatch(p, profile!, input.interests);
      if (match.blocked) continue;
    }
    let score = 0;
    switch (input.sort) {
      case 'price': score = -p.tot; break;
      case 'price_desc': score = p.tot; break;
      case 'quality': score = p.q + p.qc * 4; break;
      case 'value': score = p.v; break;
      case 'new': score = p.first; break;
      case 'drop': score = (p.drop ?? 0) * 10 + (p.chfWas ? (1 - p.chf / p.chfWas) * 100 : 0); break;
      default:
        score = rankValue(p, p.v, match, profile?.priority ?? 'balanced') + (hasText ? textScore(p.h, p.t, p.b, pq.text, pq.soft) * 3 : 0) - (shop?.trust?.level === 'mixed' ? 4 : 0);
    }
    out.push({ p, score });
    count(fCat, p.cat);
    count(fBrand, p.b);
    p.col.forEach((c) => count(fCol, c));
    p.mat.forEach((m) => FACET_MATERIALS.includes(m.k) && count(fMat, m.k));
    p.st.forEach((s) => count(fSty, s));
    p.sz.forEach((s) => count(fSize, s));
    count(fShop, p.s);
    count(fG, p.g);
    if (p.cond) count(fCond, p.cond);
  }
  out.sort((a, b) => b.score - a.score);
  const specific = !!(effective.brands?.length || pq.text.length || pq.groups.some((g) => !g.fit));
  return {
    items: out.map((x) => x.p),
    parsed: pq,
    specific,
    understood: pq.understood,
    effective,
    facets: {
      categories: top(fCat, 30), brands: top(fBrand, 200), colors: top(fCol, 20), materials: top(fMat, 20), styles: top(fSty, 15),
      sizes: top(fSize, 60), shops: top(fShop, 80), genders: top(fG, 4), conditions: top(fCond, 6),
    },
    ms: Math.round(performance.now() - t0),
  };
}

// ---------- Filter ⇄ URL ----------
const LIST_KEYS: (keyof SearchFilters)[] = ['categories', 'genders', 'brands', 'colors', 'materials', 'styles', 'sizes', 'shops', 'conditions'];
const SHORT: Record<string, string> = { categories: 'cat', genders: 'g', brands: 'b', colors: 'col', materials: 'mat', styles: 'st', sizes: 'sz', shops: 'shop', conditions: 'cond' };

export function filtersFromParams(sp: URLSearchParams): SearchFilters {
  const f: SearchFilters = {};
  for (const k of LIST_KEYS) {
    const v = sp.get(SHORT[k]);
    if (v) (f as Record<string, unknown>)[k] = v.split('~').filter(Boolean);
  }
  const num = (k: string) => (sp.get(k) ? Number(sp.get(k)) : undefined);
  f.minPrice = num('min');
  f.maxPrice = num('max');
  f.minQuality = num('minq');
  f.maxDays = num('days');
  if (sp.get('free') === '1') f.freeShipping = true;
  if (sp.get('nofee') === '1') f.noImportFees = true;
  if (sp.get('sale') === '1') f.onSale = true;
  if (sp.get('all') === '1') f.onlyAvailable = false;
  return f;
}

export function filtersToParams(f: SearchFilters): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const k of LIST_KEYS) {
    const v = f[k] as string[] | undefined;
    out[SHORT[k]] = v && v.length ? v.join('~') : null;
  }
  out.min = f.minPrice !== undefined ? String(f.minPrice) : null;
  out.max = f.maxPrice !== undefined ? String(f.maxPrice) : null;
  out.minq = f.minQuality !== undefined ? String(f.minQuality) : null;
  out.days = f.maxDays !== undefined ? String(f.maxDays) : null;
  out.free = f.freeShipping ? '1' : null;
  out.nofee = f.noImportFees ? '1' : null;
  out.sale = f.onSale ? '1' : null;
  out.all = f.onlyAvailable === false ? '1' : null;
  return out;
}

export function activeFilterCount(f: SearchFilters): number {
  let n = 0;
  for (const k of LIST_KEYS) n += (f[k] as string[] | undefined)?.length ?? 0;
  for (const k of ['minPrice', 'maxPrice', 'minQuality', 'maxDays'] as const) if (f[k] !== undefined) n++;
  for (const k of ['freeShipping', 'noImportFees', 'onSale'] as const) if (f[k]) n++;
  return n;
}
