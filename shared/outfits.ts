// Regelbasierter Outfit-Generator: Farbharmonie, Stil-Kohärenz, Formalität, Saison, Budget, Qualität.
import type { Category, Product, Style, StyleProfile } from './types';
import { COLOR_BY_KEY, OUTFIT_ROLE } from './taxonomy';
import { hasMySize, matchProfile } from './personalize';

export type Role = 'top' | 'bottom' | 'outer' | 'shoes' | 'onepiece' | 'acc';

export interface Outfit {
  items: Partial<Record<Role, Product>>;
  total: number;
  score: number;
  why: string[];
}

const FORMALITY: Partial<Record<Category, number>> = {
  tshirt: 1, top: 2, polo: 2, sweat: 1, knit: 2.5, shirt: 3, jacket: 2.2, coat: 3.5, blazer: 4, vest: 2.2, suit: 5,
  jeans: 2, trousers: 3, shorts: 1, skirt: 3, dress: 3.5, jumpsuit: 2.5, sneakers: 1.5, boots: 2.5, shoes: 4, sandals: 1, bag: 3, accessory: 3,
};

const NEUTRAL = new Set(['black', 'white', 'ecru', 'grey', 'navy', 'beige', 'brown', 'olive']);
const CLASH: [string, string][] = [['red', 'pink'], ['red', 'orange'], ['green', 'red'], ['orange', 'pink'], ['purple', 'orange'], ['yellow', 'purple'], ['burgundy', 'orange']];

export function colorsCompatible(colors: string[][]): { ok: boolean; accents: number } {
  const all = colors.flat();
  const accents = new Set(all.filter((c) => !NEUTRAL.has(c) && c !== 'blue' && c !== 'lightblue' && c !== 'multi'));
  const multi = all.filter((c) => c === 'multi').length;
  for (const [a, b] of CLASH) if (accents.has(a) && accents.has(b)) return { ok: false, accents: accents.size };
  if (accents.size > 2 || multi > 1) return { ok: false, accents: accents.size };
  return { ok: true, accents: accents.size };
}

export function season(month = new Date().getMonth() + 1): 'winter' | 'summer' | 'mid' {
  if ([11, 12, 1, 2].includes(month)) return 'winter';
  if ([6, 7, 8].includes(month)) return 'summer';
  return 'mid';
}

function seasonOk(p: Product, s: ReturnType<typeof season>): boolean {
  if (s === 'winter' && ['shorts', 'sandals', 'swim'].includes(p.cat)) return false;
  if (s === 'summer' && (p.cat === 'coat' || p.mat.some((m) => ['cashmere', 'alpaca', 'shearling', 'down'].includes(m.k)))) return false;
  return true;
}

export interface OutfitOptions {
  anchor?: Product | null;
  profile: StyleProfile;
  budget?: number;
  styles?: Style[];
  count?: number;
  month?: number;
  segment?: 'new' | 'secondhand' | 'all';
}

export function buildOutfits(products: Product[], opts: OutfitOptions): Outfit[] {
  const { anchor, profile, budget, count = 6 } = opts;
  const s = season(opts.month);
  const styles = opts.styles?.length ? opts.styles : anchor ? anchor.st : profile.styles;
  const gender = anchor ? (anchor.g === 'unisex' ? profile.genders[0] : anchor.g) : profile.genders[0];
  const baseFormality = anchor ? FORMALITY[anchor.cat] ?? 2.5 : styles.includes('elegant') || styles.includes('smart') ? 3.5 : styles.includes('streetwear') || styles.includes('sporty') ? 1.5 : 2.5;

  // Kandidaten je Rolle (beste zuerst)
  const byRole: Record<Role, { p: Product; s: number }[]> = { top: [], bottom: [], outer: [], shoes: [], onepiece: [], acc: [] };
  for (const p of products) {
    if (!p.av || (anchor && p.id === anchor.id)) continue;
    if (opts.segment && opts.segment !== 'all' && p.seg !== opts.segment) continue;
    const role = OUTFIT_ROLE[p.cat];
    if (!role) continue;
    if (gender && p.g !== gender && p.g !== 'unisex') continue;
    if (p.g === 'kids' && gender !== 'kids') continue;
    if (!seasonOk(p, s)) continue;
    const f = FORMALITY[p.cat] ?? 2.5;
    if (Math.abs(f - baseFormality) > 1.6) continue;
    const m = matchProfile(p, profile);
    if (m.blocked) continue;
    if (hasMySize(p, profile) === false) continue;
    const styleFit = styles.length ? (p.st.some((x) => styles.includes(x)) ? 12 : -6) : 0;
    const score = p.q * 0.55 + m.score * 0.35 + styleFit - Math.abs(f - baseFormality) * 4;
    byRole[role].push({ p, s: score });
  }
  for (const r of Object.keys(byRole) as Role[]) byRole[r] = byRole[r].sort((a, b) => b.s - a.s).slice(0, 60);

  const anchorRole = anchor ? OUTFIT_ROLE[anchor.cat] : undefined;
  const needOuter = s === 'winter';
  const outfits: Outfit[] = [];
  const used = new Set<string>();
  const pick = (role: Role, current: Product[], maxPrice: number): Product | undefined => {
    for (const { p } of byRole[role]) {
      if (used.has(p.id) || p.tot > maxPrice) continue;
      if (!colorsCompatible([...current.map((x) => x.col), p.col]).ok) continue;
      return p;
    }
    return undefined;
  };

  for (let i = 0; i < count * 3 && outfits.length < count; i++) {
    const items: Partial<Record<Role, Product>> = {};
    if (anchor && anchorRole) items[anchorRole] = anchor;
    const remainingBudget = () => (budget ?? Infinity) - Object.values(items).reduce((a, p) => a + (p?.tot ?? 0), 0);
    const onepiece = anchorRole === 'onepiece' || (!anchor && i % 4 === 3 && byRole.onepiece.length > 0 && gender === 'women');
    const roles: Role[] = onepiece ? ['onepiece', 'shoes', 'outer', 'acc'] : ['top', 'bottom', 'shoes', 'outer', 'acc'];
    for (const role of roles) {
      if (items[role]) continue;
      if (role === 'outer' && !needOuter && i % 2 === 1) continue;
      if (role === 'acc' && i % 3 !== 0) continue;
      const slots = roles.filter((r) => !items[r]).length;
      const p = pick(role, Object.values(items) as Product[], Math.max(20, remainingBudget() / Math.max(1, slots - 0.5)));
      if (p) items[role] = p;
    }
    const core = onepiece ? ['onepiece', 'shoes'] : ['top', 'bottom', 'shoes'];
    if (!core.every((r) => items[r as Role])) {
      // Rolle ohne Kandidaten im Budget → Variante überspringen
      for (const p of Object.values(items)) if (p && p !== anchor) used.add(p.id);
      continue;
    }
    if (needOuter && !items.outer && anchorRole !== 'outer') {
      /* Outfit trotzdem zeigen, aber schlechter bewerten */
    }
    const list = Object.values(items) as Product[];
    const total = Math.round(list.reduce((a, p) => a + p.tot, 0) * 100) / 100;
    if (budget && total > budget * 1.02) {
      list.forEach((p) => p !== anchor && used.add(p.id));
      continue;
    }
    const harmony = colorsCompatible(list.map((p) => p.col));
    const avgQ = list.reduce((a, p) => a + p.q, 0) / list.length;
    const why: string[] = [];
    why.push(harmony.accents === 0 ? 'Ruhige, neutrale Farbpalette' : harmony.accents === 1 ? 'Neutrale Basis mit einem Farbakzent' : 'Zwei harmonierende Akzentfarben');
    const sharedStyle = styles.find((st) => list.filter((p) => p.st.includes(st)).length >= 2);
    if (sharedStyle) why.push(`Stimmiger Look (${sharedStyle})`);
    why.push(`Ø Qualität ${Math.round(avgQ)}/100`);
    if (s === 'winter' && items.outer) why.push('Wintertauglich');
    outfits.push({ items, total, score: avgQ + (sharedStyle ? 5 : 0) - harmony.accents * 2 + (needOuter && items.outer ? 4 : 0), why });
    list.forEach((p) => p !== anchor && used.add(p.id));
  }
  return outfits.sort((a, b) => b.score - a.score);
}

export function colorLabel(key: string) {
  return COLOR_BY_KEY[key]?.label ?? key;
}
