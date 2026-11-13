// Lernende Interessen: aus Ansichten, Favoriten, Alarmen, Shop-Klicks, Suchen und hochgeladenen Bildern.
// Läuft komplett lokal (kein KI-Dienst), mit Zerfall über die Zeit, transparent und löschbar.
import type { Category, Gender, Product, SearchFilters, Style } from './types';

export type Dim = 'brands' | 'cats' | 'colors' | 'mats' | 'styles' | 'shops' | 'genders';

export interface Interests {
  v: 1;
  on: boolean; // automatisch lernen
  updatedAt: number;
  brands: Record<string, number>;
  cats: Record<string, number>;
  colors: Record<string, number>;
  mats: Record<string, number>;
  styles: Record<string, number>;
  shops: Record<string, number>;
  genders: Record<string, number>;
  price: { sum: number; w: number }; // gewichteter Durchschnittspreis
  img: { vec: number[]; at: number; label?: string }[]; // Bild-Embeddings deiner Uploads (keine Bilder)
  seen: string[]; // zuletzt angesehene Produkte
  muted: string[]; // ausgeblendete Interessen ("brands:Kith")
}

export const SIGNAL = { view: 1, click: 3, favorite: 4, watch: 5, search: 1.5, image: 2.5, unfavorite: -2 } as const;
const HALF_LIFE_DAYS = 30;
const MAX_IMG = 8;

export function emptyInterests(): Interests {
  return { v: 1, on: true, updatedAt: Date.now(), brands: {}, cats: {}, colors: {}, mats: {}, styles: {}, shops: {}, genders: {}, price: { sum: 0, w: 0 }, img: [], seen: [], muted: [] };
}

/** Exponentieller Zerfall: ältere Signale zählen weniger (Halbwertszeit 30 Tage) */
export function decayed(i: Interests, now = Date.now()): Interests {
  const days = (now - i.updatedAt) / 86_400_000;
  if (days < 0.5) return i;
  const f = Math.pow(0.5, days / HALF_LIFE_DAYS);
  const scale = (r: Record<string, number>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v * f]).filter(([, v]) => (v as number) > 0.05));
  return {
    ...i,
    updatedAt: now,
    brands: scale(i.brands), cats: scale(i.cats), colors: scale(i.colors), mats: scale(i.mats), styles: scale(i.styles), shops: scale(i.shops), genders: scale(i.genders),
    price: { sum: i.price.sum * f, w: i.price.w * f },
  };
}

function add(r: Record<string, number>, k: string | undefined, w: number) {
  if (!k) return;
  r[k] = Math.max(0, (r[k] ?? 0) + w);
  if (r[k] === 0) delete r[k];
}

export function learnProduct(i0: Interests, p: Pick<Product, 'id' | 'b' | 'cat' | 'col' | 'mat' | 'st' | 's' | 'g' | 'tot'>, w: number): Interests {
  if (!i0.on) return i0;
  const i = decayed(structuredClone(i0));
  add(i.brands, p.b, w);
  add(i.cats, p.cat, w);
  p.col.slice(0, 2).forEach((c, n) => add(i.colors, c, w * (n === 0 ? 1 : 0.5)));
  p.mat.slice(0, 2).forEach((m, n) => add(i.mats, m.k, w * (n === 0 ? 1 : 0.5)));
  p.st.slice(0, 2).forEach((s) => add(i.styles, s, w * 0.7));
  add(i.shops, p.s, w * 0.5);
  if (p.g !== 'unisex') add(i.genders, p.g, w);
  if (w > 0) i.price = { sum: i.price.sum + p.tot * w, w: i.price.w + w };
  if (w > 0) i.seen = [p.id, ...i.seen.filter((x) => x !== p.id)].slice(0, 40);
  i.updatedAt = Date.now();
  return i;
}

export function learnSearch(i0: Interests, f: SearchFilters): Interests {
  if (!i0.on) return i0;
  const i = decayed(structuredClone(i0));
  const w = SIGNAL.search;
  f.brands?.forEach((b) => add(i.brands, b, w));
  f.categories?.forEach((c) => add(i.cats, c, w));
  f.colors?.forEach((c) => add(i.colors, c, w));
  f.materials?.forEach((m) => add(i.mats, m, w));
  f.styles?.forEach((s) => add(i.styles, s, w));
  f.genders?.forEach((g) => add(i.genders, g, w));
  i.updatedAt = Date.now();
  return i;
}

export function learnImage(i0: Interests, vec: Float32Array | number[], attrs: { cat?: Category; color?: string; style?: Style }, label?: string): Interests {
  if (!i0.on) return i0;
  const i = decayed(structuredClone(i0));
  const w = SIGNAL.image;
  add(i.cats, attrs.cat, w);
  add(i.colors, attrs.color, w);
  add(i.styles, attrs.style, w);
  i.img = [{ vec: Array.from(vec, (x) => Math.round(x * 1000) / 1000), at: Date.now(), label }, ...i.img].slice(0, MAX_IMG);
  i.updatedAt = Date.now();
  return i;
}

export function totalSignal(i: Interests | undefined): number {
  if (!i) return 0;
  return Object.values(i.cats).reduce((a, b) => a + b, 0) + i.img.length * 2;
}

function norm(r: Record<string, number>, k: string | undefined, muted: string[], dim: Dim): number {
  if (!k || muted.includes(`${dim}:${k}`)) return 0;
  const v = r[k];
  if (!v) return 0;
  const max = Math.max(...Object.values(r));
  return max > 0 ? v / max : 0;
}

export interface InterestMatch {
  score: number; // 0–100 (50 = neutral)
  reasons: string[];
}

/** Wie gut passt ein Produkt zu den gelernten Interessen? */
export function interestMatch(i: Interests | undefined, p: Pick<Product, 'b' | 'cat' | 'col' | 'mat' | 'st' | 's' | 'g' | 'tot'>, labels?: { brand?: (b: string) => string; cat?: (c: string) => string }): InterestMatch {
  if (!i || totalSignal(i) < 3) return { score: 50, reasons: [] };
  const m = i.muted;
  const b = norm(i.brands, p.b, m, 'brands');
  const c = norm(i.cats, p.cat, m, 'cats');
  const col = Math.max(0, ...p.col.map((x) => norm(i.colors, x, m, 'colors')));
  const mat = Math.max(0, ...p.mat.map((x) => norm(i.mats, x.k, m, 'mats')));
  const st = Math.max(0, ...p.st.map((x) => norm(i.styles, x, m, 'styles')));
  const g = p.g === 'unisex' ? 0.6 : norm(i.genders, p.g, m, 'genders');
  let s = 30 + b * 22 + c * 18 + col * 10 + mat * 8 + st * 10 + g * 6;
  // Preisniveau: nahe am üblichen Preis = besser
  if (i.price.w > 2) {
    const avg = i.price.sum / i.price.w;
    const ratio = p.tot / avg;
    s += ratio <= 1.3 ? 6 : ratio <= 2 ? 0 : -10;
  }
  // Geschlecht klar gelernt, aber Produkt passt nicht → abwerten
  const gTotal = Object.values(i.genders).reduce((a, x) => a + x, 0);
  if (gTotal > 4 && p.g !== 'unisex' && g < 0.15) s -= 25;
  const reasons: string[] = [];
  if (b > 0.5) reasons.push(`du magst ${labels?.brand?.(p.b) ?? p.b}`);
  if (c > 0.6) reasons.push(`oft angesehen: ${labels?.cat?.(p.cat) ?? p.cat}`);
  if (col > 0.6 && reasons.length < 2) reasons.push('deine Farben');
  return { score: Math.max(0, Math.min(100, Math.round(s))), reasons };
}

export function topOf(i: Interests, dim: Dim, n = 8): [string, number][] {
  const r = i[dim] as Record<string, number>;
  return Object.entries(r)
    .filter(([k]) => !i.muted.includes(`${dim}:${k}`))
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0;
  for (let k = 0; k < a.length; k++) s += a[k] * b[k];
  return s;
}

export type { Gender };
