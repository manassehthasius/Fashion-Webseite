// Ähnliche Produkte, günstigere Alternativen und gleiche Produkte in mehreren Shops.
import type { Product } from './types';
import { COLORS } from './taxonomy';
import { fold, norm } from './text';

const COLOR_WORDS = new Set(COLORS.flatMap((c) => c.words).flatMap((w) => w.split(' ')));
const NOISE = new Set(['the', 'in', 'and', 'with', 'for', 'de', 'la', 'le', 'men', 'mens', 'women', 'womens', 'herren', 'damen', 'unisex', 'new', 'size', 'x', '-', '|', '/']);

export function titleTokens(p: Pick<Product, 't' | 'b'>): string[] {
  const brand = fold(p.b.toLowerCase());
  return fold(norm(p.t))
    .split(/[\s|/,()–-]+/)
    .filter((w) => w.length > 1 && !NOISE.has(w) && !COLOR_WORDS.has(w) && !brand.split(' ').includes(w) && !/^\d+$/.test(w));
}

export function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

const FAMILY: Record<string, string> = {
  merino: 'wool', wool: 'wool', lambswool: 'wool', cashmere: 'wool', alpaca: 'wool', mohair: 'wool', camelhair: 'wool', yak: 'wool',
  cotton: 'cotton', organic_cotton: 'cotton', supima: 'cotton', recycled_cotton: 'cotton', leather: 'leather', fullgrain: 'leather', suede: 'leather',
  polyester: 'synthetic', recycled_polyester: 'synthetic', nylon: 'synthetic', recycled_nylon: 'synthetic', linen: 'linen', hemp: 'linen',
};

/** Ähnlichkeit 0–1 aus Kategorie, Farbe, Material, Stil, Titel (+ optional Bild-Embedding) */
export function similarity(a: Product, b: Product, imageSim?: number): number {
  if (a.cat !== b.cat) return 0;
  if (a.g !== b.g && a.g !== 'unisex' && b.g !== 'unisex') return 0;
  let s = 0.25;
  if (a.col.some((c) => b.col.includes(c))) s += 0.2;
  const fa = new Set(a.mat.map((m) => FAMILY[m.k] ?? m.k));
  if (b.mat.some((m) => fa.has(FAMILY[m.k] ?? m.k))) s += 0.15;
  if (a.st.some((x) => b.st.includes(x))) s += 0.1;
  if (a.fit && a.fit === b.fit) s += 0.05;
  s += jaccard(titleTokens(a), titleTokens(b)) * 0.25;
  if (imageSim !== undefined) s = s * 0.45 + Math.max(0, (imageSim - 0.5) / 0.5) * 0.55;
  return Math.min(1, s);
}

export function similarProducts(p: Product, all: Product[], opts: { limit?: number; cheaper?: boolean; imageSim?: (id: string) => number | undefined } = {}): { p: Product; sim: number }[] {
  const { limit = 12, cheaper = false } = opts;
  const out: { p: Product; sim: number }[] = [];
  for (const o of all) {
    if (o.id === p.id || !o.av || o.cat !== p.cat) continue;
    if (cheaper && (o.tot >= p.tot * 0.97 || o.q < p.q - 10)) continue;
    const sim = similarity(p, o, opts.imageSim?.(o.id));
    if (sim >= (cheaper ? 0.5 : 0.45)) out.push({ p: o, sim });
  }
  return out.sort((a, b) => (cheaper ? b.sim * 100 + b.p.q * 0.3 - a.sim * 100 - a.p.q * 0.3 : b.sim - a.sim)).slice(0, limit);
}

/** Gleiches Produkt in anderen Shops (gleiche Marke, sehr ähnlicher Titel) */
export function sameProductOffers(p: Product, all: Product[]): Product[] {
  const brand = fold(p.b.toLowerCase());
  const tok = titleTokens(p);
  if (tok.length < 2) return [];
  return all
    .filter((o) => o.s !== p.s && o.cat === p.cat && fold(o.b.toLowerCase()) === brand && jaccard(tok, titleTokens(o)) >= 0.6)
    .sort((a, b) => a.tot - b.tot);
}
