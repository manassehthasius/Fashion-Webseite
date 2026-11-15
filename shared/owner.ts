// Persönliche Einstellungen des Besitzers dieser Stilkompass-Instanz.
// Die Engine sammelt NUR passende Artikel (Herren/Unisex in diesen Grössen) – so passen pro Shop viel mehr
// relevante Teile ins Limit. Zum Ändern: Werte hier anpassen und pushen (die App übernimmt sie als Startprofil).
import type { Category, Gender, Product, StyleProfile } from './types';
import { DEFAULT_PROFILE, SIZE_GROUP } from './personalize';
import { offeredIn } from './sizes';

export const OWNER = {
  /** Version: bei Änderung übernimmt die App die neuen Werte ins gespeicherte Profil */
  v: 1,
  genders: ['men', 'unisex'] as Gender[],
  sizes: {
    top: ['S', 'M'],
    bottom: ['S', 'M', '46', '48'],
    waist: ['30', '32'],
    shoes: ['41', '42'],
  },
  /** Guter Mix: Streetwear, Smart/Klassisch, Minimal/Basics, Casual/Workwear */
  styles: ['streetwear', 'smart', 'classic', 'minimal', 'casual', 'workwear'] as StyleProfile['styles'],
};

export const OWNER_PROFILE: StyleProfile = {
  ...DEFAULT_PROFILE,
  genders: ['men'],
  styles: OWNER.styles,
  sizes: { top: OWNER.sizes.top, bottom: OWNER.sizes.bottom, waist: OWNER.sizes.waist, shoes: OWNER.sizes.shoes },
};

export function ownerSizesFor(cat: Category): string[] {
  const g = SIZE_GROUP[cat];
  if (!g) return [];
  return g === 'bottom' ? [...OWNER.sizes.bottom, ...OWNER.sizes.waist] : OWNER.sizes[g];
}

/** Gehört das Produkt in den persönlichen Katalog? (Geschlecht + in meiner Grösse angeboten) */
// "Unisex" heisst oft nur: der Shop gibt kein Geschlecht an. Typische Damen-/Kinderteile trotzdem aussortieren.
const NOT_MINE = /\b(women'?s?|womens|damen|ladies|girls?|bluse|blouse|leggings?|bra|bralette|bikini|badeanzug|swimsuit|kleid|dress|skirt|rock|mini ?rock|crop ?top|bodysuit|kids?|kinder|baby|junior|youth|toddler|maternity)\b/i;

export function ownerWants(p: Pick<Product, 'g' | 'cat' | 'sza'> & { t?: string; kw?: string }): boolean {
  if (!OWNER.genders.includes(p.g)) return false;
  if (p.cat === 'dress' || p.cat === 'skirt') return false;
  if (p.g === 'unisex' && NOT_MINE.test(`${p.t ?? ''} ${p.kw ?? ''}`)) return false;
  const g = SIZE_GROUP[p.cat];
  if (!g) return true;
  return offeredIn(p.sza, g, ownerSizesFor(p.cat), p.cat) !== false;
}
