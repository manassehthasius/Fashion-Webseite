// Personalisierung: Passung zum Style-Profil, Grössen-Logik, Budget – erklärbar und ohne KI-Kosten.
import type { Category, Product, StyleProfile } from './types';
import { CATEGORY_LABELS, MATERIAL_BY_KEY } from './taxonomy';
import { interestMatch, totalSignal, type Interests } from './interests';

export const DEFAULT_PROFILE: StyleProfile = {
  genders: [],
  styles: [],
  brands: [],
  avoidBrands: [],
  colors: [],
  avoidColors: [],
  materials: [],
  avoidMaterials: [],
  fits: [],
  sizes: {},
  budget: {},
  minQuality: 0,
  priority: 'balanced',
};

export const SIZE_GROUP: Partial<Record<Category, 'top' | 'bottom' | 'shoes'>> = {
  tshirt: 'top', top: 'top', shirt: 'top', polo: 'top', knit: 'top', sweat: 'top', jacket: 'top', coat: 'top',
  blazer: 'top', vest: 'top', dress: 'top', jumpsuit: 'top', suit: 'top', underwear: 'top', swim: 'top',
  trousers: 'bottom', jeans: 'bottom', shorts: 'bottom', skirt: 'bottom',
  shoes: 'shoes', boots: 'shoes', sneakers: 'shoes', sandals: 'shoes',
};

export function profileIsEmpty(p: StyleProfile): boolean {
  return !p.genders.length && !p.styles.length && !p.brands.length && !p.colors.length && !p.materials.length && !Object.values(p.sizes).some((s) => s?.length) && !Object.keys(p.budget).length;
}

/** Grössen aus dem Profil, die zur Kategorie passen */
export function profileSizesFor(cat: Category, profile: StyleProfile): string[] {
  const g = SIZE_GROUP[cat];
  if (!g) return [];
  const s = [...(profile.sizes[g] ?? [])];
  if (g === 'bottom') s.push(...(profile.sizes.waist ?? []));
  return s.map((x) => x.toUpperCase());
}

export function hasMySize(p: Product, profile: StyleProfile): boolean | null {
  const mine = profileSizesFor(p.cat, profile);
  if (!mine.length || !p.sza.length) return null;
  if (p.sza.length === 1 && p.sza[0] === 'ONE SIZE') return p.av;
  return p.sz.some((s) => mine.includes(s.toUpperCase()));
}

export function budgetFor(cat: Category, profile: StyleProfile): number | undefined {
  return profile.budget[cat] ?? profile.budget.default;
}

export interface Match {
  score: number; // 0–100
  reasons: string[];
  blocked: boolean;
}

export function matchProfile(p: Product, profile: StyleProfile): Match {
  const reasons: string[] = [];
  let s = 50;
  let blocked = false;
  if (profile.genders.length && !profile.genders.includes(p.g) && !(p.g === 'unisex' && !profile.genders.includes('kids'))) blocked = true;
  if (profile.avoidBrands.some((b) => b.toLowerCase() === p.b.toLowerCase())) blocked = true;
  if (profile.brands.some((b) => b.toLowerCase() === p.b.toLowerCase())) {
    s += 14;
    reasons.push(`Lieblingsmarke ${p.b}`);
  }
  const st = p.st.filter((x) => profile.styles.includes(x));
  if (profile.styles.length) {
    if (st.length) {
      s += 8 + st.length * 4;
      reasons.push('passt zu deinem Stil');
    } else s -= 8;
  }
  if (profile.colors.length) {
    if (p.col.some((c) => profile.colors.includes(c))) {
      s += 8;
      reasons.push('deine Farben');
    }
  }
  if (p.col.some((c) => profile.avoidColors.includes(c))) s -= 18;
  if (profile.materials.length && p.mat.some((m) => profile.materials.includes(m.k) && (m.pct ?? 100) >= 40)) {
    s += 8;
    reasons.push(`${MATERIAL_BY_KEY[p.mat[0].k]?.label ?? 'Wunschmaterial'}`);
  }
  if (p.mat.some((m) => profile.avoidMaterials.includes(m.k) && (m.pct ?? 100) >= 20)) s -= 20;
  if (profile.fits.length && p.fit && profile.fits.includes(p.fit)) {
    s += 5;
    reasons.push('Passform');
  }
  const size = hasMySize(p, profile);
  if (size === true) {
    s += 10;
    reasons.push('in deiner Grösse');
  } else if (size === false) s -= 25;
  const budget = budgetFor(p.cat, profile);
  if (budget) {
    if (p.tot <= budget) {
      s += 6;
      reasons.push('im Budget');
    } else s -= Math.min(30, ((p.tot - budget) / budget) * 40);
  }
  if (profile.minQuality && p.q < profile.minQuality) s -= 15;
  return { score: Math.max(0, Math.min(100, Math.round(s))), reasons, blocked };
}

/** Gesamtranking: Qualität, Preis-Leistung und Profil gemäss Priorität */
export function rankValue(p: Product, value: number, match: Match | null, priority: StyleProfile['priority']): number {
  const w = priority === 'quality' ? [0.5, 0.2] : priority === 'price' ? [0.2, 0.5] : [0.35, 0.35];
  const m = match ? match.score : 50;
  const fresh = p.drop ? Math.min(8, p.drop / 3) : 0;
  return p.q * w[0] + value * w[1] + m * 0.3 + fresh - (p.qc < 0.35 ? 3 : 0);
}

/** Personalisierung aktiv, wenn ein Profil gesetzt ist oder genug gelernt wurde */
export function isPersonalized(profile: StyleProfile, interests?: Interests): boolean {
  return !profileIsEmpty(profile) || totalSignal(interests) >= 3;
}

/** Profil (explizit) + gelernte Interessen (implizit) kombiniert */
export function combinedMatch(p: Product, profile: StyleProfile, interests?: Interests): Match {
  const m = matchProfile(p, profile);
  const im = interestMatch(interests, p, { cat: (c) => CATEGORY_LABELS[c as Category] ?? c });
  const learned = totalSignal(interests) >= 3;
  if (!learned) return m;
  const score = profileIsEmpty(profile) ? im.score : Math.round(m.score * 0.6 + im.score * 0.4);
  return { score, reasons: [...m.reasons, ...im.reasons].slice(0, 3), blocked: m.blocked };
}
