// Klassifizierung: Kategorie, Geschlecht, Farben, Materialien, Grössen, Zustand, Stil, Qualitätsmerkmale.
import type { Category, Condition, Gender, Material, Shop, Style } from './types';
import {
  BRAND_TIERS, CATEGORY_KEYWORDS, CERT_RULES, COLORS, CONDITION_RULES, EXCLUDE_KEYWORDS, FEATURE_RULES,
  FIT_KEYWORDS, GENDER_KEYWORDS, MATERIALS, ORIGINS, SIZE_ORDER, STYLE_KEYWORDS,
} from './taxonomy';
import { hasWord, lastEndOfWord, norm, titleCase, uniq } from './text';

// ---------- Kategorie ----------

/** Wörter, die unabhängig von der Position entscheiden (z. B. "Swim Shorts" → Bademode) */
const STRONG: [Category, string[]][] = [
  ['swim', ['swim', 'swimwear', 'bikini', 'swimsuit', 'badehose', 'badeanzug', 'boardshort', 'board short', 'swim short', 'swim trunk']],
  ['underwear', ['pyjama', 'pajama', 'sleepwear', 'nightwear', 'boxer', 'boxers', 'bra', 'bralette', 'briefs', 'unterhose', 'long johns', 'base layer', 'baselayer']],
  ['socks', ['sock', 'socks', 'socken']],
  ['polo', ['polo shirt', 'poloshirt', 'knit polo', 'polo knit']],
  ['knit', ['strickjacke', 'cardigan']],
  ['sneakers', ['sneaker', 'sneakers']],
  ['bag', ['shoe bag', 'belt bag', 'tote bag']],
];

function categoryFrom(text: string): Category | null {
  if (!text.trim()) return null;
  const t = text.replace(/\bboot[\s-]?cut\b/gi, 'bootcut').replace(/\bdown[\s-]to[\s-]earth\b/gi, '');
  for (const [cat, words] of STRONG) if (words.some((w) => hasWord(t, w))) return cat;
  let best: Category | null = null;
  let bestEnd = -1;
  let bestLen = 0;
  for (const [cat, words] of CATEGORY_KEYWORDS) {
    for (const w of words) {
      const end = lastEndOfWord(t, w);
      if (end < 0) continue;
      // Kopfwort = letzter Treffer; bei gleichem Ende gewinnt die längere Phrase ("t-shirt" vor "shirt")
      if (end > bestEnd || (end === bestEnd && w.length > bestLen)) {
        best = cat;
        bestEnd = end;
        bestLen = w.length;
      }
    }
  }
  return best;
}

export function isExcluded(type: string, title: string, titleCat: Category | null): boolean {
  const t = norm(type);
  if (EXCLUDE_KEYWORDS.some((w) => hasWord(t, w))) return true;
  if (titleCat) return false;
  const ti = norm(title);
  return EXCLUDE_KEYWORDS.some((w) => hasWord(ti, w));
}

/** Allgemeine Produkttypen, bei denen der Titel genauer ist */
const GENERIC_TYPE = new Set<Category>(['top', 'accessory', 'shoes', 'other']);

export function classifyCategory(type: string, title: string, tags: string[], body: string): Category | null {
  const ti = categoryFrom(norm(title));
  const ty = categoryFrom(norm(type));
  if (ti && ty && ti !== ty) {
    // Der vom Shop gepflegte Produkttyp ist meist zuverlässiger – ausser er ist allgemein ("Tops", "Accessories", "Shoes")
    if (GENERIC_TYPE.has(ty) || ['socks', 'underwear', 'swim'].includes(ti)) return ti;
    return ty;
  }
  return ti ?? ty ?? categoryFrom(norm(tags.join(' , '))) ?? categoryFrom(norm(body.slice(0, 160)));
}

// ---------- Geschlecht ----------

function genderOf(text: string): Gender | null {
  const t = norm(text.replace(/[-_/]/g, ' '));
  const found = new Set<Gender>();
  for (const [g, re] of GENDER_KEYWORDS) if (re.test(t)) found.add(g);
  if (found.has('kids')) return 'kids';
  if (found.has('unisex')) return 'unisex';
  if (found.has('women') && found.has('men')) return 'unisex';
  if (found.has('women')) return 'women';
  if (found.has('men')) return 'men';
  return null;
}

/** Erste eindeutige Quelle gewinnt (Reihenfolge: explizites Feld, Titel, Produkttyp, Handle, Tags) */
export function classifyGender(parts: string[], fallback: Gender = 'unisex'): Gender {
  for (const p of parts) {
    if (!p) continue;
    const g = genderOf(p);
    if (g) return g;
  }
  return fallback;
}

// ---------- Farben ----------

const COLOR_PHRASES = COLORS.flatMap((c) => c.words.map((w) => ({ w, key: c.key }))).sort((a, b) => b.w.length - a.w.length);

export function extractColors(text: string, max = 3): string[] {
  let t = norm(text);
  const out: string[] = [];
  for (const { w, key } of COLOR_PHRASES) {
    const re = new RegExp(`(^|[^a-zäöüéèàç])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s-]+')}(?=$|[^a-zäöüéèàç])`, 'i');
    if (re.test(t)) {
      if (!out.includes(key)) out.push(key);
      t = t.replace(re, '$1 ');
      if (out.length >= max) break;
    }
  }
  return out;
}

// ---------- Materialien ----------

const MATERIAL_PHRASES = MATERIALS.flatMap((m) => m.words.map((w) => ({ w, key: m.key }))).sort((a, b) => b.w.length - a.w.length);

function materialKey(phrase: string): string | null {
  const t = norm(phrase);
  for (const { w, key } of MATERIAL_PHRASES) if (hasWord(t, w)) return key;
  return null;
}

/** Erkennt Zusammensetzungen wie "80% Wolle, 20% Polyamid" oder "Cotton 100%" */
export function extractMaterials(title: string, body: string, tags: string[] = []): Material[] {
  const text = `${body} ${tags.filter((t) => /material|fabric|stoff|%/i.test(t)).join(', ')}`;
  const found: Material[] = [];
  let sum = 0;
  const re1 = /(\d{1,3}(?:[.,]\d+)?)\s?%\s*(?:of\s+)?([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ\- ]{1,40})/g;
  const re2 = /([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ\- ]{1,30}?)\s*:?\s(\d{1,3}(?:[.,]\d+)?)\s?%/g;
  const push = (pct: number, phrase: string) => {
    if (pct <= 0 || pct > 100 || sum >= 99.5) return;
    const k = materialKey(phrase.split(/[,.;/(]| and | und | et /)[0]);
    if (!k) return;
    const ex = found.find((m) => m.k === k);
    if (ex) ex.pct = (ex.pct ?? 0) + pct;
    else found.push({ k, pct });
    sum += pct;
  };
  let m: RegExpExecArray | null;
  while ((m = re1.exec(text)) && sum < 99.5) push(parseFloat(m[1].replace(',', '.')), m[2]);
  if (!found.length) while ((m = re2.exec(text)) && sum < 99.5) push(parseFloat(m[2].replace(',', '.')), m[1]);
  if (found.length && sum >= 60) {
    return found.sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0)).map((x) => ({ k: x.k, pct: Math.round(x.pct ?? 0) }));
  }
  // Ohne Prozentangaben: Materialwörter im Titel (stark) oder im Text (schwächer)
  const kw: Material[] = [];
  const tTitle = norm(title);
  const tBody = norm(`${body.slice(0, 700)} ${tags.join(' ')}`);
  for (const src of [tTitle, tBody]) {
    for (const { w, key } of MATERIAL_PHRASES) {
      if (kw.length >= 3) break;
      if (kw.some((x) => x.k === key)) continue;
      // "organic cotton" soll nicht zusätzlich "cotton" liefern
      if (key === 'cotton' && kw.some((x) => ['organic_cotton', 'supima', 'recycled_cotton'].includes(x.k))) continue;
      if (key === 'wool' && kw.some((x) => ['merino', 'lambswool', 'cashmere', 'alpaca'].includes(x.k))) continue;
      if (key === 'leather' && kw.some((x) => ['fullgrain', 'suede'].includes(x.k))) continue;
      if (key === 'polyester' && kw.some((x) => x.k === 'recycled_polyester')) continue;
      if (key === 'nylon' && kw.some((x) => x.k === 'recycled_nylon')) continue;
      if (hasWord(src, w)) kw.push({ k: key });
    }
    if (kw.length && src === tTitle) break;
  }
  return kw;
}

// ---------- Merkmale (Verarbeitung, Herkunft, Zertifikate, Stoffgewicht) ----------

export function extractFeatures(title: string, body: string, tags: string[]): string[] {
  const text = `${title}. ${body} ${tags.join(' ')}`;
  const fx: string[] = [];
  for (const [code, , , re] of FEATURE_RULES) if (re.test(text)) fx.push(code);
  for (const [code, , re] of CERT_RULES) if (re.test(text)) fx.push(`cert:${code}`);
  for (const [code, , , re] of ORIGINS) {
    if (re.test(text)) {
      fx.push(`o:${code}`);
      break;
    }
  }
  const gsm = text.match(/(\d{3})\s?(?:gsm|g\/m²|g\/m2|grams per square|g\/qm|gr\/m2)/i);
  if (gsm) {
    const g = parseInt(gsm[1], 10);
    if (g >= 90 && g <= 900) fx.push(`gsm:${g}`);
  }
  const oz = text.match(/(\d{1,2}(?:[.,]\d)?)\s?(?:oz|ounce)\b/i);
  if (oz && /denim|jean|canvas|selvedge|duck/i.test(text)) {
    const o = parseFloat(oz[1].replace(',', '.'));
    if (o >= 6 && o <= 32) fx.push(`oz:${o}`);
  }
  return uniq(fx);
}

// ---------- Grössen ----------

const SIZE_OPTION = /(^|\b|')(size|sizes|grösse|größe|groesse|taille|taglia|talla|maat|storlek|størrelse|koko|rozmiar|waist|bundweite|schuhgrösse|schuhgröße)\b/i;
const COLOR_OPTION = /^(colou?r|colou?rs|farbe|farben|couleur|colore|color\/colour|colourway|farve|färg|shade|wash)$/i;

const SIZE_WORDS: [RegExp, string][] = [
  [/^(xxx[\s-]?small|3xs|xxxs)$/i, 'XXXS'], [/^(xx[\s-]?small|2xs|xxs)$/i, 'XXS'], [/^(x[\s-]?small|extra small|xs)$/i, 'XS'],
  [/^(small|s|sm)$/i, 'S'], [/^(medium|m|med)$/i, 'M'], [/^(large|l|lg)$/i, 'L'], [/^(x[\s-]?large|extra large|xl)$/i, 'XL'],
  [/^(xx[\s-]?large|2xl|xxl)$/i, 'XXL'], [/^(xxx[\s-]?large|3xl|xxxl)$/i, 'XXXL'], [/^(4xl|xxxxl)$/i, '4XL'],
  [/^(one[\s-]?size|os|o\/s|onesize|einheitsgrösse|einheitsgröße|taille unique|default title|one size fits all|u)$/i, 'ONE SIZE'],
];

export function normSize(raw: string): string {
  const s = raw.trim().replace(/\s+/g, ' ');
  for (const [re, v] of SIZE_WORDS) if (re.test(s)) return v;
  const up = s.toUpperCase().replace(/^(EU|IT|FR|DE)\s+/, '');
  return up.length > 14 ? up.slice(0, 14) : up;
}

export function sizeSortKey(s: string): number {
  const i = SIZE_ORDER.indexOf(s);
  if (i >= 0) return i;
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? 100 + n : 1000;
}

interface ShopifyOption { name: string; position?: number; values: string[] }
interface ShopifyVariant { option1: string | null; option2: string | null; option3: string | null; available?: boolean; price: string; compare_at_price: string | null; title?: string }

export function extractSizesAndColors(options: ShopifyOption[], variants: ShopifyVariant[]) {
  const sizeIdx = options.findIndex((o) => SIZE_OPTION.test(o.name.trim()));
  const colorIdx = options.findIndex((o) => COLOR_OPTION.test(o.name.trim()));
  const key = (v: ShopifyVariant, i: number) => (i === 0 ? v.option1 : i === 1 ? v.option2 : v.option3) ?? '';
  const all = new Set<string>();
  const avail = new Set<string>();
  if (sizeIdx >= 0) {
    for (const v of variants) {
      const s = normSize(key(v, sizeIdx));
      if (!s) continue;
      all.add(s);
      if (v.available !== false) avail.add(s);
    }
  }
  const sort = (a: string, b: string) => sizeSortKey(a) - sizeSortKey(b) || a.localeCompare(b);
  const colorValues = colorIdx >= 0 ? options[colorIdx].values : [];
  return { all: [...all].sort(sort), available: [...avail].sort(sort), colorValues, hasSizeOption: sizeIdx >= 0 };
}

/** Grösse aus Titel/Text (Secondhand: "Jacket - XS Black", "fits X-Small", "Size: M") */
export function sizeFromText(title: string, body: string, tags: string[]): string | null {
  const t = `${title} | ${body.slice(0, 400)}`;
  const m =
    t.match(/\b(?:size|grösse|größe|fits|taille|gr\.)\s*:?\s*(x{0,3}[\s-]?(?:small|large)|medium|[2-4]?x{0,3}[sml]|\d{2}(?:[.,]5)?|w\d{2}\s*l\d{2}|one size)\b/i) ??
    title.match(/\s-\s(XXS|XS|S|M|L|XL|XXL|XXXL)\b/);
  if (m) return normSize(m[1]);
  const tag = tags.find((x) => /^(XXS|XS|S|M|L|XL|XXL|XXXL|\d{2}(\.5)?)$/i.test(x.trim()));
  return tag ? normSize(tag) : null;
}

// ---------- Zustand (Secondhand) ----------

export function extractCondition(tags: string[], body: string, title: string): Condition | undefined {
  const explicit = `${body} ${title}`.match(/condition\s*:?\s*([^.|•\n]{2,40})|zustand\s*:?\s*([^.|•\n]{2,40})/i);
  const candidates = [
    ...tags.filter((t) => /condition|zustand|grade|star|new with|excellent|very good|good|fair|like new|neu|gut|mint/i.test(t)),
    explicit ? explicit[1] ?? explicit[2] : '',
  ].filter(Boolean);
  for (const c of candidates) for (const [cond, re] of CONDITION_RULES) if (re.test(c)) return cond;
  return undefined;
}

export function extractEra(title: string, body: string, tags: string[]): string | undefined {
  const m = `${title} ${body.slice(0, 500)} ${tags.join(' ')}`.match(/\b(?:era\s*:?\s*)?((?:19|20)?[5-9]0'?s|y2k|20[01]0'?s)\b/i);
  if (!m) return undefined;
  let e = m[1].toLowerCase().replace("'", '');
  if (/^\d0s$/.test(e)) e = (Number(e[0]) >= 5 ? '19' : '20') + e;
  return e === 'y2k' ? 'Y2K' : e;
}

export function extractFit(text: string): string | undefined {
  for (const [fit, re] of FIT_KEYWORDS) if (re.test(text)) return fit;
  return undefined;
}

// ---------- Stil ----------

const CATEGORY_STYLE: Partial<Record<Category, Style[]>> = {
  blazer: ['smart', 'classic'], suit: ['elegant', 'classic'], coat: ['classic'], sweat: ['casual'],
  sneakers: ['casual'], boots: ['workwear'], dress: ['elegant'], shirt: ['smart'], polo: ['preppy'],
  shoes: ['classic'], jeans: ['casual'], tshirt: ['casual', 'minimal'], knit: ['classic'],
};

export function extractStyles(text: string, cat: Category, shop: Shop, seg: string): Style[] {
  const t = norm(text);
  const score = new Map<Style, number>();
  for (const [style, words] of STYLE_KEYWORDS) {
    let n = 0;
    for (const w of words) if (hasWord(t, w)) n++;
    if (n) score.set(style, n * 2);
  }
  shop.styles.forEach((s, i) => score.set(s, (score.get(s) ?? 0) + (i === 0 ? 1.5 : 1)));
  (CATEGORY_STYLE[cat] ?? []).forEach((s) => score.set(s, (score.get(s) ?? 0) + 0.8));
  if (seg === 'secondhand' && /vintage|retro|\d0s|y2k/i.test(text)) score.set('vintage', (score.get('vintage') ?? 0) + 3);
  return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s);
}

// ---------- Marke ----------

const BRAND_KEYS = Object.keys(BRAND_TIERS).sort((a, b) => b.length - a.length);

export function brandTier(brand: string): number | undefined {
  const b = brand.toLowerCase().trim();
  if (BRAND_TIERS[b] !== undefined) return BRAND_TIERS[b];
  const k = BRAND_KEYS.find((key) => key.length > 3 && (b === key || b.startsWith(key + ' ')));
  return k ? BRAND_TIERS[k] : undefined;
}

export function extractBrand(vendor: string, title: string, tags: string[], shop: Shop): string {
  const v = (vendor ?? '').trim();
  const looksLikeCode = !v || /^[A-Z]{0,3}\d{2,}$/i.test(v) || /^(default|vendor|unknown)$/i.test(v);
  if (!shop.multiBrand) {
    if (!looksLikeCode && v.length < 40 && !/myshopify/i.test(v)) return v.toLowerCase() === shop.name.toLowerCase() ? shop.name : titleCase(v) === v ? v : smartCase(v);
    return shop.name;
  }
  if (!looksLikeCode) return smartCase(v);
  const tagBrand = tags.find((t) => brandTier(t) !== undefined && t.length > 2);
  if (tagBrand) return smartCase(tagBrand);
  const tl = title.toLowerCase();
  const k = BRAND_KEYS.find((key) => tl.startsWith(key + ' '));
  if (k) return smartCase(title.slice(0, k.length));
  const caps = title.match(/^((?:[A-Z0-9&'.\-]{2,}\s){1,3})/);
  return caps ? smartCase(caps[1].trim()) : 'Unbekannt';
}

/** "LOUIS VUITTON" → "Louis Vuitton", "A.P.C." bleibt */
export function smartCase(s: string): string {
  if (/^[A-Z0-9&'.\- ]+$/.test(s) && s.replace(/[^A-Z]/g, '').length > 3 && !/^[A-Z]\.[A-Z]/.test(s)) return titleCase(s);
  return s;
}
