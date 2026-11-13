// Intelligente Suche ohne KI-Kosten: versteht "schwarzer merino pullover herren unter 150 grösse m".
// Wird in der App (Ranking) und in der Engine (gespeicherte Suchen → Alarme) identisch verwendet.
import type { Category, Condition, Gender, Product, SearchFilters, Shop, Style } from './types';
import { CATEGORY_KEYWORDS, CATEGORY_LABELS, COLORS, CONDITION_LABELS, MATERIALS, STYLE_KEYWORDS, STYLE_LABELS, MATERIAL_BY_KEY, COLOR_BY_KEY } from './taxonomy';
import { fold, hasWord, norm, wordRegex } from './text';

export interface QueryGroup {
  label: string;
  anyOf: string[]; // mindestens einer dieser Begriffe muss vorkommen …
  fit?: string; // … oder die Passform stimmt
}

export interface ParsedQuery {
  text: string[]; // verbleibende Suchbegriffe (alle müssen vorkommen)
  groups: QueryGroup[]; // Bedeutungsgruppen ("weit" = wide/baggy/relaxed …)
  soft: string[]; // verbessern nur das Ranking
  filters: SearchFilters;
  understood: string[]; // erkannte Bestandteile (für die Anzeige "Verstanden: …")
  corrected: [string, string][]; // Tippfehler-Korrekturen
}

/** Wortschatz aus dem Katalog für Marken-Erkennung und Tippfehler-Korrektur (optional) */
export interface Vocab {
  brands: Map<string, string>; // gefaltet/klein → Anzeigename
  tokens: Map<string, number>; // Wort → Häufigkeit
}

interface Concept { words: string[]; label: string; cat?: Category; fit?: string; anyOf?: string[]; soft?: string[] }

/** Mode-Begriffe mit Bedeutung (DE/EN) */
const CONCEPTS: Concept[] = [
  { words: ['anzughose', 'stoffhose', 'bundfaltenhose', 'suit trousers', 'suit trouser', 'suit pants', 'dress pants', 'dress trousers', 'tailored trousers', 'tailored pants', 'pleated trousers', 'business hose'], label: 'Anzughose', cat: 'trousers', soft: ['tailored', 'suit', 'pleat', 'pleated', 'wool', 'dress', 'formal', 'smart', 'trouser'] },
  { words: ['breit', 'weit', 'wide', 'wide leg', 'wide-leg', 'weites bein', 'baggy', 'locker', 'loose', 'oversized', 'oversize', 'relaxed'], label: 'weite Passform', fit: 'relaxed', anyOf: ['wide', 'weit', 'baggy', 'loose', 'relaxed', 'oversize', 'balloon', 'barrel', 'flare', 'palazzo', 'boxy'] },
  { words: ['schmal', 'slim', 'eng', 'skinny', 'tapered', 'tailliert'], label: 'schmale Passform', fit: 'slim', anyOf: ['slim', 'skinny', 'tapered', 'narrow', 'fitted'] },
  { words: ['gerade', 'straight'], label: 'gerade Passform', fit: 'regular', anyOf: ['straight', 'regular'] },
  { words: ['low', 'lo', 'niedrig', 'ox', 'low top', 'low-top'], label: 'Low', anyOf: ['low', 'ox', 'lo'] },
  { words: ['high', 'hi', 'hoch', 'high top', 'high-top'], label: 'High', anyOf: ['high', 'hi', 'hi-top'] },
  { words: ['kurzarm', 'short sleeve', 'short-sleeve'], label: 'Kurzarm', anyOf: ['short sleeve', 'short-sleeve', 's/s', 'kurzarm'] },
  { words: ['langarm', 'long sleeve', 'long-sleeve', 'longsleeve'], label: 'Langarm', anyOf: ['long sleeve', 'long-sleeve', 'l/s', 'longsleeve', 'langarm'] },
  { words: ['rollkragen', 'rollkragenpullover', 'turtleneck', 'rollneck', 'roll neck'], label: 'Rollkragen', cat: 'knit', anyOf: ['turtleneck', 'roll neck', 'rollneck', 'roll-neck', 'mock neck', 'rollkragen'] },
  { words: ['strickjacke', 'cardigan'], label: 'Cardigan', cat: 'knit', anyOf: ['cardigan', 'strickjacke'] },
  { words: ['kapuzenpullover', 'hoodie', 'kapuze', 'hoody'], label: 'Hoodie', cat: 'sweat', anyOf: ['hood', 'hoodie', 'hoody'] },
  { words: ['wasserdicht', 'waterproof', 'regenfest', 'wetterfest'], label: 'wasserdicht', anyOf: ['waterproof', 'gore-tex', 'goretex', 'water repellent', 'water-repellent', 'wasserdicht', 'rain', 'shell'] },
  { words: ['gestreift', 'streifen', 'striped', 'stripe'], label: 'gestreift', anyOf: ['stripe', 'striped', 'breton', 'streifen'] },
  { words: ['kariert', 'karo', 'checked', 'plaid', 'tartan'], label: 'kariert', anyOf: ['check', 'plaid', 'tartan', 'gingham', 'houndstooth'] },
  { words: ['chuck', 'chucks', 'chuck taylor', 'all star', 'allstar'], label: 'Chuck Taylor', anyOf: ['chuck', 'all star', 'all-star'] },
  { words: ['chelsea', 'chelsea boots', 'chelsea boot'], label: 'Chelsea Boots', cat: 'boots', anyOf: ['chelsea'] },
  { words: ['loafer', 'loafers', 'penny loafer'], label: 'Loafer', cat: 'shoes', anyOf: ['loafer', 'penny', 'moccasin'] },
  { words: ['derby', 'derbies', 'oxford schuh', 'brogue', 'brogues'], label: 'Derby/Oxford', cat: 'shoes', anyOf: ['derby', 'oxford', 'brogue', 'wingtip', 'gibson'] },
  { words: ['chino', 'chinos'], label: 'Chino', cat: 'trousers', anyOf: ['chino'] },
  { words: ['cargo', 'cargohose', 'cargo pants'], label: 'Cargo', cat: 'trousers', anyOf: ['cargo'] },
  { words: ['jogger', 'jogginghose', 'sweatpants', 'trainerhose'], label: 'Jogger', cat: 'trousers', anyOf: ['jogger', 'sweatpant', 'sweat pant', 'track pant', 'jogging'] },
  { words: ['bomber', 'bomberjacke'], label: 'Bomber', cat: 'jacket', anyOf: ['bomber'] },
  { words: ['trench', 'trenchcoat'], label: 'Trench', cat: 'coat', anyOf: ['trench'] },
  { words: ['parka'], label: 'Parka', cat: 'coat', anyOf: ['parka'] },
  { words: ['daunenjacke', 'puffer', 'pufferjacke', 'steppjacke', 'down jacket'], label: 'Daunen-/Steppjacke', cat: 'jacket', anyOf: ['down', 'puffer', 'padded', 'quilted', 'daunen', 'stepp', 'insulated'] },
  { words: ['overshirt', 'hemdjacke', 'shacket'], label: 'Overshirt', cat: 'jacket', anyOf: ['overshirt', 'shirt jacket', 'shacket'] },
  { words: ['sakko'], label: 'Sakko', cat: 'blazer' },
  { words: ['wachsjacke', 'wax jacket', 'waxed jacket'], label: 'Wachsjacke', cat: 'jacket', anyOf: ['wax', 'waxed', 'wachs'] },
  { words: ['wachs', 'gewachst', 'waxed', 'wax'], label: 'gewachst', anyOf: ['wax', 'waxed', 'wachs'] },
  { words: ['krawatte', 'krawatten', 'tie', 'ties'], label: 'Krawatte', cat: 'accessory', anyOf: ['tie', 'krawatte'] },
  { words: ['gürtel', 'guertel', 'belt'], label: 'Gürtel', cat: 'accessory', anyOf: ['belt', 'gürtel'] },
  { words: ['mütze', 'muetze', 'beanie', 'strickmütze'], label: 'Mütze', cat: 'accessory', anyOf: ['beanie', 'hat', 'cap', 'mütze', 'watch cap'] },
  { words: ['schal', 'scarf'], label: 'Schal', cat: 'accessory', anyOf: ['scarf', 'schal', 'stole', 'shawl'] },
];

const CONCEPT_PHRASES = CONCEPTS.flatMap((c) => c.words.map((w) => ({ w, c }))).sort((a, b) => b.w.length - a.w.length);

/** Kopfwörter deutscher Komposita: "Wollmantel" → Material Wolle + Mantel */
const COMPOUND_HEADS: [string, Category][] = [
  ['hosen', 'trousers'], ['hose', 'trousers'], ['jacken', 'jacket'], ['jacke', 'jacket'], ['mäntel', 'coat'], ['mantel', 'coat'],
  ['pullover', 'knit'], ['pulli', 'knit'], ['kleider', 'dress'], ['kleid', 'dress'], ['hemden', 'shirt'], ['hemd', 'shirt'],
  ['shirts', 'tshirt'], ['shirt', 'tshirt'], ['röcke', 'skirt'], ['rock', 'skirt'], ['schuhe', 'shoes'], ['schuh', 'shoes'],
  ['stiefel', 'boots'], ['taschen', 'bag'], ['tasche', 'bag'], ['mütze', 'accessory'], ['schal', 'accessory'], ['socken', 'socks'],
  ['weste', 'vest'], ['sneakers', 'sneakers'], ['sneaker', 'sneakers'], ['sandalen', 'sandals'], ['shorts', 'shorts'], ['jeans', 'jeans'],
  ['anzug', 'suit'], ['bluse', 'top'], ['blazer', 'blazer'], ['boots', 'boots'],
];

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
  // Plural: "hosen" → "hose", "jacken" → "jacke", "shirts" → "shirt"
  if (w.length >= 5 && (w.endsWith('n') || w.endsWith('s'))) out.push(w.slice(0, -1));
  return out;
}

const SIZE_TOKEN = /^(xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl)$/i;

export function parseQuery(q: string, vocab?: Vocab): ParsedQuery {
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

  // Wortweise: Marken, Mode-Begriffe, Farben, Materialien, Kategorien, Stile
  const text: string[] = [];
  const groups: QueryGroup[] = [];
  const soft: string[] = [];
  const corrected: [string, string][] = [];
  const cats = new Set<Category>();
  const colors = new Set<string>();
  const mats = new Set<string>();
  const styles = new Set<Style>();
  let rest = ` ${t.split(/\s+/).filter(Boolean).join(' ')} `;
  const wordCount = rest.trim().split(' ').filter(Boolean).length;

  // Marken (auch mehrteilig: "norse projects", "merz b. schwanen")
  if (vocab) {
    const brands: string[] = [];
    for (const [key, display] of sortedBrands(vocab)) {
      if (key.length < 3 || STOP.has(key) || BRAND_STOP.has(key)) continue;
      const lower = display.toLowerCase();
      const hit = hasWord(rest, key) ? key : hasWord(rest, lower) ? lower : null;
      if (hit) {
        brands.push(display);
        rest = rest.replace(wordRegex(hit), ' ');
      }
    }
    if (brands.length) {
      filters.brands = [...new Set(brands)];
      understood.push(...filters.brands);
    }
  }
  // Mehrwort-Phrasen zuerst (z. B. "wide leg", "light blue", "organic cotton")
  const addConcept = (c: Concept) => {
    if (c.cat) cats.add(c.cat);
    if (c.anyOf || c.fit) groups.push({ label: c.label, anyOf: c.anyOf ?? [], fit: c.fit });
    if (c.soft) soft.push(...c.soft);
    understood.push(c.label);
  };
  for (const { w, c } of CONCEPT_PHRASES) {
    if (w.includes(' ') && hasWord(rest, w)) {
      addConcept(c);
      rest = rest.replace(wordRegex(w), ' ');
    }
  }
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

  const recognize = (raw: string): boolean => {
    for (const w of stemDe(raw)) {
      const concept = CONCEPT_PHRASES.find((x) => x.w === w);
      if (concept) {
        addConcept(concept.c);
        return true;
      }
      const col = COLORS.find((c) => c.words.includes(w));
      if (col && col.key !== 'multi') {
        colors.add(col.key);
        return true;
      }
      const mat = MATERIALS.find((m) => m.words.includes(w));
      if (mat && !['canvas', 'twill', 'denim', 'cord', 'terry'].includes(w)) {
        mats.add(mat.key);
        return true;
      }
      const cat = CATEGORY_KEYWORDS.find(([, ws]) => ws.includes(w));
      if (cat) {
        cats.add(cat[0]);
        // spezifische Unterarten (z. B. "cardigan", "bermuda") zusätzlich als Begriff verlangen
        if (!GENERIC_CAT_WORDS.has(w)) groups.push({ label: w, anyOf: [w] });
        return true;
      }
      const st = STYLE_KEYWORDS.find(([s, ws]) => ws.includes(w) || fold(STYLE_LABELS[s].toLowerCase()) === fold(w));
      if (st && STYLE_QUERY_WORDS.has(w)) {
        styles.add(st[0]);
        return true;
      }
    }
    return false;
  };

  for (const raw of rest.split(/\s+/).filter(Boolean)) {
    if (STOP.has(raw)) continue;
    if (SIZE_TOKEN.test(raw) && raw.length <= 3 && !filters.sizes) {
      // einzelne Grössenbuchstaben nur, wenn sonst etwas erkannt wurde ("pullover m")
      if (raw.length > 1 || wordCount > 1) {
        filters.sizes = [raw.toUpperCase()];
        understood.push(`Grösse ${raw.toUpperCase()}`);
        continue;
      }
    }
    if (recognize(raw)) continue;
    // Zahlen wie 43 oder 42.5 = Grösse (Schuhe/Konfektion), "chuck 70" bleibt Modellname
    if (/^\d{2}([.,]5)?$/.test(raw) && Number(raw.replace(',', '.')) >= 34 && Number(raw.replace(',', '.')) <= 50 && !filters.sizes) {
      filters.sizes = [raw.replace(',', '.')];
      understood.push(`Grösse ${raw}`);
      continue;
    }
    if (raw === 'secondhand' || raw === 'gebraucht' || raw === 'used' || raw === 'preloved' || raw === 'vintage') continue;
    // Deutsche Komposita: "wollmantel", "leinenhemd", "lederschuhe", "winterjacke"
    const head = raw.length >= 7 ? COMPOUND_HEADS.find(([h]) => raw.endsWith(h) && raw.length - h.length >= 3) : undefined;
    if (head) {
      const rawPrefix = raw.slice(0, raw.length - head[0].length);
      const prefix = rawPrefix.replace(/[-s]$/, '');
      cats.add(head[1]);
      understood.push(CATEGORY_LABELS[head[1]]);
      const mat = prefix.length >= 4 ? MATERIALS.find((m) => m.words.some((w) => !w.includes(' ') && w.length >= 4 && (w.startsWith(prefix) || prefix.startsWith(w)))) : undefined;
      const col = prefix.length >= 3 ? COLORS.find((c) => c.key !== 'multi' && c.words.some((w) => !w.includes(' ') && w.length >= 3 && (w === prefix || prefix.startsWith(w)))) : undefined;
      if (recognize(rawPrefix)) continue;
      if (mat) mats.add(mat.key);
      else if (col) colors.add(col.key);
      else if (!recognize(prefix)) soft.push(prefix);
      continue;
    }
    // Tippfehler-Korrektur anhand des Katalog-Wortschatzes
    let term = raw;
    if (vocab && raw.length >= 4 && !vocab.tokens.has(fold(raw))) {
      const fix = closest(fold(raw), vocab);
      if (fix) {
        corrected.push([raw, fix]);
        term = fix;
        const brand = vocab.brands.get(fix);
        if (brand) {
          filters.brands = [...new Set([...(filters.brands ?? []), brand])];
          understood.push(brand);
          continue;
        }
        if (recognize(fix)) continue;
      }
    }
    if (term.length > 1) text.push(term);
  }
  if (cats.size) {
    filters.categories = [...cats];
    for (const c of cats) if (!understood.includes(CATEGORY_LABELS[c])) understood.push(CATEGORY_LABELS[c]);
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
  return { text, groups, soft, filters, understood: [...new Set(understood)], corrected };
}

const GENERIC_CAT_WORDS = new Set([
  'hose', 'hosen', 'trouser', 'trousers', 'pant', 'pants', 'pullover', 'pulli', 'sweater', 'sweaters', 'jumper', 'jacke', 'jacken', 'jacket',
  'jackets', 'schuh', 'schuhe', 'shoe', 'shoes', 'shirt', 'shirts', 'hemd', 'hemden', 'kleid', 'kleider', 'dress', 'mantel', 'coat', 'coats',
  't-shirt', 't-shirts', 'tshirt', 'tshirts', 'tee', 'tees', 'top', 'tops', 'rock', 'skirt', 'jeans', 'jean', 'shorts', 'socken', 'socks', 'sock',
  'tasche', 'taschen', 'bag', 'bags', 'stiefel', 'boot', 'boots', 'sneaker', 'sneakers', 'sandalen', 'sandals', 'knit', 'knitwear', 'strick',
  'sweatshirt', 'sweat', 'blazer', 'weste', 'vest', 'polo', 'anzug', 'suit', 'bluse', 'blouse', 'accessoires', 'unterwäsche', 'underwear',
  'swimwear', 'bademode', 'kleidung', 'trainers', 'cap', 'mütze', 'schal', 'scarf', 'beanie',
]);
const STYLE_QUERY_WORDS = new Set(['minimal', 'minimalist', 'minimalistisch', 'klassisch', 'classic', 'streetwear', 'workwear', 'outdoor', 'sportlich', 'sporty', 'preppy', 'elegant', 'boho', 'casual', 'smart']);
/** Markennamen, die zugleich normale Suchwörter sind */
const BRAND_STOP = new Set(['hast', 'folk', 'basic', 'basics', 'essentials', 'core', 'original', 'originals', 'unknown', 'unbekannt', 'vintage', 'black', 'white', 'wool', 'cashmere', 'linen', 'denim', 'leather', 'boots', 'socks', 'kids', 'women', 'men', 'home', 'sale', 'new', 'classic', 'outdoor', 'sport', 'studio', 'label', 'goods']);

const brandCache = new WeakMap<Vocab, [string, string][]>();
function sortedBrands(v: Vocab): [string, string][] {
  let list = brandCache.get(v);
  if (!list) {
    list = [...v.brands.entries()].sort((a, b) => b[0].length - a[0].length);
    brandCache.set(v, list);
  }
  return list;
}

/** Wortschatz aus Katalogprodukten bauen (Marken inkl. Schreibweise ohne Apostroph) */
export function buildVocab(items: { b: string; h?: string }[]): Vocab {
  const brands = new Map<string, string>();
  const tokens = new Map<string, number>();
  for (const p of items) {
    const key = fold(p.b.toLowerCase());
    if (!brands.has(key)) {
      brands.set(key, p.b);
      const plain = key.replace(/['’.]/g, '').replace(/\s+/g, ' ');
      if (plain !== key && !brands.has(plain)) brands.set(plain, p.b);
    }
    if (p.h) for (const t of p.h.split(' ')) if (t.length > 2) tokens.set(t, (tokens.get(t) ?? 0) + 1);
  }
  return { brands, tokens };
}

function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, k) => k);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Nächstes bekanntes Wort/Marke (Tippfehler), bevorzugt häufige Wörter */
function closest(term: string, vocab: Vocab): string | null {
  const max = term.length >= 8 ? 2 : 1;
  let best: string | null = null;
  let bestD = max + 1;
  let bestF = 0;
  const consider = (cand: string, freq: number) => {
    if (Math.abs(cand.length - term.length) > max || cand[0] !== term[0]) return;
    const d = editDistance(term, cand, max);
    if (d < bestD || (d === bestD && freq > bestF)) {
      best = cand;
      bestD = d;
      bestF = freq;
    }
  };
  for (const [b] of vocab.brands) if (!b.includes(' ') && b.length >= 4 && !BRAND_STOP.has(b)) consider(b, 1000);
  for (const [tok, f] of vocab.tokens) if (f >= 2 && tok.length >= 4) consider(tok, f);
  return bestD <= max ? best : null;
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

function termIn(hay: string, term: string): boolean {
  const f = fold(term.toLowerCase());
  if (f.length <= 3) return hay.includes(` ${f} `) || hay.includes(` ${f}-`);
  if (hay.includes(` ${f}`) || (f.length >= 5 && hay.includes(f))) return true;
  // englischer Plural: "trousers" findet "trouser"
  if (f.length > 4 && f.endsWith('s') && hay.includes(` ${f.slice(0, -1)}`)) return true;
  return false;
}

/** Prüft Suchbegriffe (alle müssen vorkommen, Präfix-Treffer erlaubt, DE→EN-Synonyme) */
export function textMatches(hay: string, terms: string[]): boolean {
  return terms.every((term) => {
    if (termIn(hay, term)) return true;
    const f = fold(term.toLowerCase());
    const syn = DE_EN[term] ?? DE_EN[f];
    return !!syn && syn.some((s) => hay.includes(` ${s}`));
  });
}

/** Bedeutungsgruppen: jede Gruppe muss erfüllt sein (Begriff im Text oder passende Passform) */
export function groupsMatch(p: Pick<Product, 'fit'>, hay: string, groups: QueryGroup[]): boolean {
  return groups.every((g) => (g.fit && p.fit === g.fit) || g.anyOf.some((a) => termIn(hay, a)));
}

export function textScore(_hay: string, title: string, brand: string, terms: string[], soft: string[] = []): number {
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
  // ganze Phrase im Titel (z. B. "chuck 70 low")
  if (terms.length > 1 && t.includes(terms.map((x) => fold(x)).join(' '))) s += 6;
  for (const w of soft) if (t.includes(fold(w))) s += 2.5;
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
  if (!pq.text.length && !pq.groups.length) return true;
  const hay = haystack(p, shop);
  return textMatches(hay, pq.text) && groupsMatch(p, hay, pq.groups);
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
