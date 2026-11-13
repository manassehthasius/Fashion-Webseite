// Intelligente Suche ohne KI-Kosten: versteht "schwarzer merino pullover herren unter 150 grösse m".
// Wird in der App (Ranking) und in der Engine (gespeicherte Suchen → Alarme) identisch verwendet.
import type { Category, Condition, Gender, Product, SearchFilters, Shop, Style } from './types';
import { CATEGORY_KEYWORDS, CATEGORY_LABELS, COLORS, CONDITION_LABELS, MATERIALS, STYLE_KEYWORDS, STYLE_LABELS, MATERIAL_BY_KEY, COLOR_BY_KEY } from './taxonomy';
import { fold, hasWord, norm } from './text';

export interface ParsedQuery {
  text: string[]; // verbleibende Suchbegriffe
  filters: SearchFilters;
  understood: string[]; // erkannte Bestandteile (für die Anzeige "Verstanden: …")
}

const GENDER_WORDS: [Gender, string[]][] = [
  ['men', ['herren', 'herr', 'männer', 'mann', 'men', 'mens', "men's", 'homme', 'male', 'him']],
  ['women', ['damen', 'dame', 'frauen', 'frau', 'women', 'womens', "women's", 'femme', 'female', 'her', 'ladies']],
  ['kids', ['kinder', 'kind', 'kids', 'baby', 'jungen', 'mädchen']],
];

const COND_WORDS: [Condition, string[]][] = [
  ['nwt', ['neu mit etikett', 'new with tags', 'nwt', 'ungetragen']],
  ['excellent', ['wie neu', 'like new', 'neuwertig']],
];

const STOP = new Set(['der', 'die', 'das', 'ein', 'eine', 'einen', 'mit', 'und', 'für', 'fuer', 'in', 'aus', 'von', 'the', 'a', 'an', 'and', 'with', 'for', 'of', 'chf', 'fr', 'franken', 'im', 'am', 'zum', 'zur', 'ich', 'suche', 'möchte', 'will', 'bitte']);

/** Deutsche Adjektivendungen: "schwarzer" → "schwarz" */
function stemDe(w: string): string[] {
  const out = [w];
  for (const suf of ["er", "es", "en", "em", "e"]) if (w.length >= suf.length + 3 && w.endsWith(suf)) out.push(w.slice(0, -suf.length));
  return out;
}

const SIZE_TOKEN = /^(xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl)$/i;

export function parseQuery(q: string): ParsedQuery {
  const filters: SearchFilters = {};
  const understood: string[] = [];
  let t = norm(q).replace(/(\d)\s*(?:chf|fr\.?|franken)\b/g, '$1');

  // Preis: "unter 150", "bis 150", "max 150", "< 150", "under 150", "150-300", "ab 50", "über 50"
  const max = t.match(/(?:unter|bis|max(?:imal)?|höchstens|<|under|below|weniger als)\s*(\d{1,5})/);
  if (max) {
    filters.maxPrice = Number(max[1]);
    understood.push(`bis CHF ${max[1]}`);
    t = t.replace(max[0], ' ');
  }
  const min = t.match(/(?:ab|über|mindestens|min|>|over|above|mehr als)\s*(\d{1,5})/);
  if (min) {
    filters.minPrice = Number(min[1]);
    understood.push(`ab CHF ${min[1]}`);
    t = t.replace(min[0], ' ');
  }
  const range = t.match(/\b(\d{2,5})\s*[-–]\s*(\d{2,5})\b/);
  if (range && !filters.maxPrice) {
    filters.minPrice = Number(range[1]);
    filters.maxPrice = Number(range[2]);
    understood.push(`CHF ${range[1]}–${range[2]}`);
    t = t.replace(range[0], ' ');
  }
  // Grösse: "grösse m", "gr. 42", "size l", "eu 43"
  const size = t.match(/\b(?:grösse|grosse|größe|gr\.?|size|eu|taille)\s*([a-z0-9.,/]{1,5})\b/);
  if (size) {
    filters.sizes = [size[1].toUpperCase().replace(',', '.')];
    understood.push(`Grösse ${filters.sizes[0]}`);
    t = t.replace(size[0], ' ');
  }
  // Qualität / Versand / Sale / Zustand
  const flags: [RegExp, () => void, string][] = [
    [/\b(hochwertig\w*|premium|top qualität|beste qualität|high quality)\b/, () => (filters.minQuality = 72), 'hohe Qualität'],
    [/\b(gratis versand|kostenlose[rn]? versand|versandkostenfrei|free shipping)\b/, () => (filters.freeShipping = true), 'Gratisversand'],
    [/\b(ohne zoll|zollfrei|ohne importkosten|keine zollgebühren)\b/, () => (filters.noImportFees = true), 'ohne Importkosten'],
    [/\b(sale|reduziert|rabatt|im angebot|deal|deals|angebot)\b/, () => (filters.onSale = true), 'im Sale'],
  ];
  for (const [re, fn, label] of flags) {
    if (re.test(t)) {
      fn();
      understood.push(label);
      t = t.replace(re, ' ');
    }
  }
  for (const [c, words] of COND_WORDS) {
    for (const w of words) {
      if (hasWord(t, w)) {
        filters.conditions = [...(filters.conditions ?? []), c];
        understood.push(CONDITION_LABELS[c]);
        t = t.replace(new RegExp(w, 'i'), ' ');
      }
    }
  }
  // Geschlecht
  for (const [g, words] of GENDER_WORDS) {
    for (const w of words) {
      if (hasWord(t, w)) {
        filters.genders = [...new Set([...(filters.genders ?? []), g])];
        t = t.replace(new RegExp(`(^|\\s)${w.replace("'", "\\'")}s?(?=\\s|$)`, 'i'), ' ');
        understood.push(g === 'men' ? 'Herren' : g === 'women' ? 'Damen' : 'Kinder');
        break;
      }
    }
  }

  // Wortweise: Farben, Materialien, Kategorien, Stile
  const words = t.split(/\s+/).filter(Boolean);
  const text: string[] = [];
  const cats = new Set<Category>();
  const colors = new Set<string>();
  const mats = new Set<string>();
  const styles = new Set<Style>();
  const joined = ` ${words.join(' ')} `;
  // Mehrwort-Phrasen zuerst (z. B. "light blue", "organic cotton")
  let rest = joined;
  for (const m of [...MATERIALS].flatMap((x) => x.words.map((w) => [x.key, w] as const)).sort((a, b) => b[1].length - a[1].length)) {
    if (m[1].includes(' ') && hasWord(rest, m[1])) {
      mats.add(m[0]);
      rest = rest.replace(new RegExp(m[1], 'i'), ' ');
    }
  }
  for (const c of COLORS) for (const w of c.words) if (w.includes(' ') && hasWord(rest, w)) {
    colors.add(c.key);
    rest = rest.replace(new RegExp(w, 'i'), ' ');
  }
  for (const raw of rest.split(/\s+/).filter(Boolean)) {
    if (STOP.has(raw)) continue;
    if (SIZE_TOKEN.test(raw) && raw.length <= 3 && !filters.sizes) {
      // einzelne Grössenbuchstaben nur, wenn sonst etwas erkannt wurde ("pullover m")
      if (raw.length > 1 || words.length > 1) {
        filters.sizes = [raw.toUpperCase()];
        understood.push(`Grösse ${raw.toUpperCase()}`);
        continue;
      }
    }
    let matched = false;
    for (const w of stemDe(raw)) {
      const col = COLORS.find((c) => c.words.includes(w));
      if (col && col.key !== 'multi') {
        colors.add(col.key);
        matched = true;
        break;
      }
      const mat = MATERIALS.find((m) => m.words.includes(w));
      if (mat && !['canvas', 'twill', 'denim', 'cord', 'terry'].includes(w)) {
        mats.add(mat.key);
        matched = true;
        break;
      }
      const cat = CATEGORY_KEYWORDS.find(([, ws]) => ws.includes(w));
      if (cat) {
        cats.add(cat[0]);
        matched = true;
        break;
      }
      const st = STYLE_KEYWORDS.find(([s, ws]) => ws.includes(w) || fold(STYLE_LABELS[s].toLowerCase()) === fold(w));
      if (st && ['minimal', 'minimalist', 'minimalistisch', 'klassisch', 'classic', 'streetwear', 'workwear', 'outdoor', 'sportlich', 'sporty', 'preppy', 'elegant', 'vintage', 'boho', 'casual', 'smart'].includes(w)) {
        styles.add(st[0]);
        matched = true;
        break;
      }
    }
    if (!matched && (raw === 'secondhand' || raw === 'gebraucht' || raw === 'used' || raw === 'preloved')) matched = true;
    if (!matched && raw.length > 1) text.push(raw);
  }
  if (cats.size) {
    filters.categories = [...cats];
    understood.push(...[...cats].map((c) => CATEGORY_LABELS[c]));
  }
  if (colors.size) {
    filters.colors = [...colors];
    understood.push(...[...colors].map((c) => COLOR_BY_KEY[c]?.label ?? c));
  }
  if (mats.size) {
    filters.materials = [...mats];
    understood.push(...[...mats].map((m) => MATERIAL_BY_KEY[m]?.label ?? m));
  }
  if (styles.size) {
    filters.styles = [...styles];
    understood.push(...[...styles].map((s) => STYLE_LABELS[s]));
  }
  return { text, filters, understood };
}

/** Materialgruppen: "Wolle" findet auch Merino, Kaschmir, Lammwolle */
const MATERIAL_FAMILY: Record<string, string[]> = {
  wool: ['wool', 'merino', 'lambswool', 'cashmere', 'alpaca', 'mohair', 'camelhair', 'yak'],
  cotton: ['cotton', 'organic_cotton', 'supima', 'recycled_cotton'],
  leather: ['leather', 'fullgrain', 'suede', 'shearling'],
  polyester: ['polyester', 'recycled_polyester'],
  nylon: ['nylon', 'recycled_nylon'],
};

export function materialMatches(p: Product, wanted: string[]): boolean {
  return wanted.some((w) => {
    const fam = MATERIAL_FAMILY[w] ?? [w];
    return p.mat.some((m) => fam.includes(m.k) && (m.pct === undefined || m.pct >= 30));
  });
}

export function haystack(p: Product, shop?: Shop): string {
  return fold(
    norm(
      [
        p.t, p.b, p.kw ?? '', CATEGORY_LABELS[p.cat], p.cat, ...p.col.map((c) => COLOR_BY_KEY[c]?.label ?? c),
        ...p.mat.map((m) => MATERIAL_BY_KEY[m.k]?.label ?? m.k), ...p.st.map((s) => STYLE_LABELS[s]), shop?.name ?? '', p.era ?? '',
      ].join(' '),
    ),
  );
}

const DE_EN: Record<string, string[]> = {
  hemd: ['shirt'], hose: ['trouser', 'pant'], mantel: ['coat'], jacke: ['jacket'], pullover: ['sweater', 'jumper', 'knit'],
  pulli: ['sweater', 'jumper'], strick: ['knit'], kleid: ['dress'], rock: ['skirt'], schuhe: ['shoe'], stiefel: ['boot'],
  tasche: ['bag'], gürtel: ['belt'], guertel: ['belt'], mütze: ['beanie', 'cap', 'hat'], schal: ['scarf'], socken: ['sock'],
  wolle: ['wool'], baumwolle: ['cotton'], leinen: ['linen'], seide: ['silk'], leder: ['leather'], kaschmir: ['cashmere'],
  daunen: ['down'], weste: ['vest', 'gilet'], anzug: ['suit'], kapuze: ['hood'], streifen: ['stripe'], kariert: ['check', 'plaid'],
};

/** Prüft Suchbegriffe (alle müssen vorkommen, Präfix-Treffer erlaubt, DE→EN-Synonyme) */
export function textMatches(hay: string, terms: string[]): boolean {
  return terms.every((term) => {
    const f = fold(term.toLowerCase());
    if (hay.includes(` ${f}`) || (f.length >= 5 && hay.includes(f))) return true;
    const syn = DE_EN[term] ?? DE_EN[f];
    return !!syn && syn.some((s) => hay.includes(` ${s}`));
  });
}

export function textScore(_hay: string, title: string, brand: string, terms: string[]): number {
  let s = 0;
  const t = fold(title.toLowerCase());
  const b = fold(brand.toLowerCase());
  for (const term of terms) {
    const f = fold(term);
    if (b === f || b.startsWith(f)) s += 6;
    if (new RegExp(`(^|\\W)${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t)) s += 4;
    else if (t.includes(f)) s += 2;
    else s += 0.5;
  }
  return s;
}

export function matchFilters(p: Product, f: SearchFilters, shop: Shop | undefined): boolean {
  if (f.onlyAvailable !== false && !p.av) return false;
  if (f.categories?.length && !f.categories.includes(p.cat)) return false;
  if (f.genders?.length && !(f.genders.includes(p.g) || (p.g === 'unisex' && !f.genders.includes('kids')))) return false;
  if (f.brands?.length && !f.brands.some((b) => b.toLowerCase() === p.b.toLowerCase())) return false;
  if (f.colors?.length && !p.col.some((c) => f.colors!.includes(c))) return false;
  if (f.materials?.length && !materialMatches(p, f.materials)) return false;
  if (f.styles?.length && !p.st.some((s) => f.styles!.includes(s))) return false;
  if (f.sizes?.length && !p.sz.some((s) => f.sizes!.some((w) => w.toUpperCase() === s.toUpperCase()))) return false;
  if (f.shops?.length && !f.shops.includes(p.s)) return false;
  if (f.conditions?.length && !(p.cond && f.conditions.includes(p.cond))) return false;
  if (f.minPrice !== undefined && p.tot < f.minPrice) return false;
  if (f.maxPrice !== undefined && p.tot > f.maxPrice) return false;
  if (f.minQuality !== undefined && p.q < f.minQuality) return false;
  if (f.onSale && !(p.chfWas && p.chfWas > p.chf) && !p.drop) return false;
  if (shop) {
    if (f.freeShipping) {
      const sh = shop.shipping;
      if (!(sh.cost === 0 || (sh.freeFrom !== undefined && p.chf >= sh.freeFrom * (sh.currency === 'CHF' ? 1 : 0.95)))) return false;
    }
    if (f.noImportFees) {
      const duty = shop.market ? shop.market.mode : shop.duty;
      if (duty === 'dap' && p.tot > 62) return false;
    }
    if (f.maxDays !== undefined && shop.shipping.days[1] > f.maxDays) return false;
  }
  return true;
}

/** Vollständiger Treffer-Test (für gespeicherte Suchen/Alarme in der Engine) */
export function matchesSearch(p: Product, query: string, extra: SearchFilters, shop: Shop | undefined, segment: 'new' | 'secondhand' | 'all' = 'all'): boolean {
  if (segment !== 'all' && p.seg !== segment) return false;
  const pq = parseQuery(query);
  const f: SearchFilters = { ...pq.filters, ...stripEmpty(extra) };
  if (!matchFilters(p, f, shop)) return false;
  return pq.text.length === 0 || textMatches(haystack(p, shop), pq.text);
}

function stripEmpty(f: SearchFilters): SearchFilters {
  const out: SearchFilters = {};
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === null || (Array.isArray(v) && !v.length)) continue;
    (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export function mergeFilters(a: SearchFilters, b: SearchFilters): SearchFilters {
  return { ...stripEmpty(a), ...stripEmpty(b) };
}
