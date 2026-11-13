import { describe, expect, it } from 'vitest';
import { classifyCategory, classifyGender, extractColors, extractCondition, extractFeatures, extractMaterials, extractSizesAndColors, normSize, sizeFromText } from '../shared/classify';
import { basketCost, itemPriceCHF, landedCost } from '../shared/pricing';
import { qualityScore, valueScore } from '../shared/quality';
import { matchesSearch, parseQuery } from '../shared/search';
import { packCatalog, unpackCatalog } from '../shared/catalog';
import { decryptJson, encryptJson } from '../shared/crypto';
import { buildOutfits, colorsCompatible } from '../shared/outfits';
import { matchProfile, DEFAULT_PROFILE } from '../shared/personalize';
import { sameProductOffers, similarProducts } from '../shared/similar';
import { platformLinks } from '../shared/platforms';
import { imgUrl, packImg, productUrl } from '../shared/media';
import type { Catalog, FxRates, Product, Shop } from '../shared/types';

const fx: FxRates = { toCHF: { CHF: 1, EUR: 0.92, GBP: 1.1, USD: 0.83, DKK: 0.124 }, source: 'shopify', date: '2026-11-13' };

const shop = (o: Partial<Shop> = {}): Shop => ({
  id: 's', name: 'Shop', domain: 'shop.example', country: 'DE', currency: 'EUR', segment: 'new', duty: 'dap', homeVat: 0.19,
  exportVatRemoved: true, shipping: { currency: 'EUR', cost: 10, freeFrom: 150, days: [2, 5], verified: true }, tier: 4, styles: ['minimal'], ...o,
});

const product = (o: Partial<Product> = {}): Product => ({
  id: 's:1', s: 's', seg: 'new', t: 'Merino Crew Sweater - Navy', b: 'Brand', u: 'merino-crew', img: '~x.jpg', p: 100, cur: 'EUR', chf: 77, tot: 100,
  cat: 'knit', g: 'men', col: ['navy'], mat: [{ k: 'merino', pct: 100 }], fx: [], sz: ['M', 'L'], sza: ['S', 'M', 'L'], av: true, q: 80, qc: 0.7,
  st: ['minimal'], first: 1_700_000_000, upd: 1_700_000_000, ...o,
});

describe('Klassifizierung', () => {
  it('erkennt Kategorien über das Kopfwort', () => {
    expect(classifyCategory('', 'Heavy Organic T-Shirt', [], '')).toBe('tshirt');
    expect(classifyCategory('', 'Shirt Jacket in Navy Wool', [], '')).toBe('jacket');
    expect(classifyCategory('', 'Sweat Shorts Grey', [], '')).toBe('shorts');
    expect(classifyCategory('', 'Polo Shirt Pique', [], '')).toBe('polo');
    expect(classifyCategory('', 'Swim Shorts Tropical', [], '')).toBe('swim');
    expect(classifyCategory('', 'Chelsea Boot Suede', [], '')).toBe('boots');
    expect(classifyCategory('', 'Merino Wool Turtleneck - Red Tangerine', [], '')).toBe('knit');
    expect(classifyCategory('', 'Bootcut Jeans Indigo', [], '')).toBe('jeans');
  });
  it('bevorzugt den Shop-Produkttyp ausser bei allgemeinen Typen', () => {
    expect(classifyCategory('T-SHIRT', 'Tree Shirt For Rest Kids', [], '')).toBe('tshirt');
    expect(classifyCategory('PANTS', 'Tree Pants Thermo Fleece', [], '')).toBe('trousers');
    expect(classifyCategory('Accessories', 'Merino Socks 3-Pack', [], '')).toBe('socks');
    expect(classifyCategory('Tops', 'Cashmere Cardigan', [], '')).toBe('knit');
  });
  it('erkennt Geschlecht mit Titel-Vorrang', () => {
    expect(classifyGender(['', 'Women Classic Merino Wool Crew', '', '', 'men, women'])).toBe('women');
    expect(classifyGender(['Mens', 'Oakley Jacket', '', '', ''])).toBe('men');
    expect(classifyGender(['', 'Plain Tee', '', 'plain-tee', ''], 'unisex')).toBe('unisex');
    expect(classifyGender(['', 'Kids Hoodie', '', '', ''])).toBe('kids');
  });
  it('liest Materialzusammensetzungen', () => {
    expect(extractMaterials('Sweater', '80% Wolle, 20% Polyamid. Made in Portugal', [])).toEqual([{ k: 'wool', pct: 80 }, { k: 'nylon', pct: 20 }]);
    expect(extractMaterials('Tee', 'Composition: 100% organic cotton', [])).toEqual([{ k: 'organic_cotton', pct: 100 }]);
    expect(extractMaterials('Merino Wool Beanie', 'Soft and warm', [])).toEqual([{ k: 'merino' }]);
    expect(extractMaterials('Corduroy Trousers', '', [])[0]?.k).toBe('cotton');
    expect(extractMaterials('Button Down Shirt', '', [])).toEqual([]); // kein "down" als Daune
  });
  it('erkennt Qualitätsmerkmale, Herkunft, Stoffgewicht', () => {
    const fx = extractFeatures('Selvedge Jeans', '14oz Japanese selvedge denim from Kaihara, chain stitched hems. Made in Japan. 100% cotton', []);
    expect(fx).toEqual(expect.arrayContaining(['selvedge', 'japanesefabric', 'chainstitch', 'o:jp', 'oz:14']));
    expect(extractFeatures('Tee', 'Heavyweight 300 gsm jersey, GOTS certified', [])).toEqual(expect.arrayContaining(['heavyweight', 'gsm:300', 'cert:gots']));
  });
  it('normalisiert Farben und Grössen', () => {
    expect(extractColors('Light Blue / Off White')).toEqual(['lightblue', 'ecru']);
    expect(normSize('X-Large')).toBe('XL');
    expect(normSize('One Size')).toBe('ONE SIZE');
    expect(sizeFromText('Oakley Jacket - XS Black Polyester', 'fits X-Small', [])).toBe('XS');
    const r = extractSizesAndColors([{ name: "Tricker's Size", values: ['7', '8'] }], [
      { option1: '7', option2: null, option3: null, available: false, price: '1', compare_at_price: null },
      { option1: '8', option2: null, option3: null, available: true, price: '1', compare_at_price: null },
    ]);
    expect(r.all).toEqual(['7', '8']);
    expect(r.available).toEqual(['8']);
  });
  it('erkennt Secondhand-Zustand', () => {
    expect(extractCondition(['New with tags'], '', '')).toBe('nwt');
    expect(extractCondition([], 'Gender: Mens Condition: Very Good Brand: Oakley', '')).toBe('very_good');
    expect(extractCondition(['Condition: 3-star (good)'], '', '')).toBe('good');
  });
});

describe('Gesamtpreis Schweiz', () => {
  it('rechnet EU-Shop (DAP) mit MWST-Abzug, Versand, Einfuhr-MWST und Post-Gebühr', () => {
    const b = landedCost(119, shop(), fx);
    expect(b.item).toBeCloseTo((119 / 1.19) * 0.92, 2); // 92.00
    expect(b.shipping).toBeCloseTo(9.2, 2);
    expect(b.vat).toBeCloseTo((92 + 9.2) * 0.081, 2);
    expect(b.clearance).toBeCloseTo(13 + (92 + 9.2) * 0.03, 2);
    expect(b.duty).toBe(0);
    expect(b.total).toBeCloseTo(b.item + b.shipping + b.vat + b.clearance, 2);
  });
  it('erhebt unter CHF 62 Warenwert keine MWST/Gebühr', () => {
    const b = landedCost(40, shop({ shipping: { currency: 'EUR', cost: 5, days: [2, 5], verified: true } }), fx);
    expect(b.vat).toBe(0);
    expect(b.clearance).toBe(0);
  });
  it('berücksichtigt Gratisversand-Schwelle und Warenkorb', () => {
    expect(landedCost(200, shop(), fx).shippingFree).toBe(true);
    const sep = landedCost(80, shop(), fx).total * 2;
    const together = basketCost([80, 80], shop(), fx).total;
    expect(together).toBeLessThan(sep);
  });
  it('Schweizer Shop und CH-Markt ohne Importkosten', () => {
    const ch = landedCost(100, shop({ country: 'CH', currency: 'CHF', duty: 'domestic', homeVat: 0.081, exportVatRemoved: false, shipping: { currency: 'CHF', cost: 7.5, freeFrom: 200, days: [1, 3], verified: true } }), fx);
    expect(ch.total).toBe(107.5);
    const mk = shop({ market: { prefix: '/de-ch', ratio: 1.1, mode: 'ddp', checkedAt: '' } });
    expect(itemPriceCHF(145, mk, fx)).toBe(145);
    expect(landedCost(145, mk, fx).vat).toBe(0);
  });
  it('Nicht-EU-Shop: höhere Post-Grundgebühr', () => {
    const us = shop({ country: 'US', currency: 'USD', homeVat: 0, exportVatRemoved: false, shipping: { currency: 'USD', cost: 20, days: [5, 10], verified: false } });
    const b = landedCost(200, us, fx);
    expect(b.clearance).toBeCloseTo(16 + (200 * 0.83 + 20 * 0.83) * 0.03, 2);
    expect(b.estimated).toBe(true);
  });
});

describe('Qualitätsscore', () => {
  it('bewertet Kaschmir höher als Acryl-Strick', () => {
    const s = shop();
    const good = qualityScore({ cat: 'knit', mat: [{ k: 'cashmere', pct: 100 }], fx: ['o:it', 'fullyfashioned'], b: 'Brand', seg: 'new' }, s);
    const bad = qualityScore({ cat: 'knit', mat: [{ k: 'acrylic', pct: 100 }], fx: [], b: 'Brand', seg: 'new' }, s);
    expect(good.score).toBeGreaterThan(bad.score + 20);
    expect(good.score).toBeLessThanOrEqual(100);
    expect(good.confidence).toBeGreaterThan(bad.confidence);
  });
  it('kennzeichnet Schätzungen bei fehlenden Daten', () => {
    const q = qualityScore({ cat: 'jacket', mat: [], fx: [], b: 'Unknown', seg: 'new' }, shop({ multiBrand: true }));
    expect(q.estimated).toBe(true);
    expect(q.parts.find((p) => p.key === 'material')?.source).toBe('estimate');
  });
  it('nutzt den Zustand bei Secondhand', () => {
    const s = shop({ segment: 'secondhand', multiBrand: true });
    const nwt = qualityScore({ cat: 'coat', mat: [{ k: 'wool', pct: 100 }], fx: [], b: 'Max Mara', seg: 'secondhand', cond: 'nwt' }, s);
    const fair = qualityScore({ cat: 'coat', mat: [{ k: 'wool', pct: 100 }], fx: [], b: 'Max Mara', seg: 'secondhand', cond: 'fair' }, s);
    expect(nwt.score - fair.score).toBe(11);
  });
  it('Preis-Leistung steigt bei günstigerem Preis', () => {
    expect(valueScore(70, 50, 100)).toBeGreaterThan(valueScore(70, 200, 100));
  });
});

describe('Suche', () => {
  it('versteht natürliche Sprache', () => {
    const q = parseQuery('schwarzer Merino Pullover Herren unter 150 Grösse M');
    expect(q.filters.colors).toEqual(['black']);
    expect(q.filters.materials).toEqual(['merino']);
    expect(q.filters.categories).toEqual(['knit']);
    expect(q.filters.genders).toEqual(['men']);
    expect(q.filters.maxPrice).toBe(150);
    expect(q.filters.sizes).toEqual(['M']);
    expect(q.text).toEqual([]);
  });
  it('findet Produkte für gespeicherte Suchen', () => {
    const p = product({ tot: 140 });
    expect(matchesSearch(p, 'merino pullover unter 150', {}, shop(), 'new')).toBe(true);
    expect(matchesSearch(p, 'merino pullover unter 100', {}, shop(), 'new')).toBe(false);
    expect(matchesSearch(p, 'wolle pullover', {}, shop(), 'all')).toBe(true); // Materialfamilie
    expect(matchesSearch(p, 'merino', { genders: ['women'] }, shop(), 'all')).toBe(false);
  });
});

describe('Katalogformat, Medien, Verschlüsselung', () => {
  it('packt und entpackt verlustfrei (relevante Felder)', () => {
    const s = shop();
    const c: Catalog = { v: 1, generatedAt: 'x', fx, shops: [s], products: [product({ pc: 150, cond: undefined, low: 90, drop: 5 })] };
    const u = unpackCatalog(JSON.parse(JSON.stringify(packCatalog(c))));
    const p = u.products[0];
    expect(p.t).toBe('Merino Crew Sweater - Navy');
    expect(p.sza).toEqual(['S', 'M', 'L']);
    expect(p.sz).toEqual(['M', 'L']);
    expect(p.mat).toEqual([{ k: 'merino', pct: 100 }]);
    expect(p.pc).toBe(150);
    expect(p.drop).toBe(5);
    expect(p.seg).toBe('new');
  });
  it('komprimiert Bild-URLs', () => {
    const packed = packImg('https://cdn.shopify.com/s/files/1/2/3/files/a.jpg?v=12&width=600', 'shop.example');
    expect(packed).toBe('~1/2/3/files/a.jpg?v=12');
    expect(imgUrl(packed, { domain: 'shop.example' }, 300)).toBe('https://cdn.shopify.com/s/files/1/2/3/files/a.jpg?v=12&width=300');
    expect(productUrl({ u: 'abc' }, { domain: 'shop.example', market: { prefix: '/de-ch', ratio: 1, mode: 'ddp', checkedAt: '' } })).toBe('https://shop.example/de-ch/products/abc');
  });
  it('verschlüsselt den Nutzerzustand (AES-GCM)', async () => {
    const blob = await encryptJson({ watch: [1, 2, 3] }, 'eine lange passphrase');
    expect(blob.data).not.toContain('watch');
    expect(await decryptJson(blob, 'eine lange passphrase')).toEqual({ watch: [1, 2, 3] });
    await expect(decryptJson(blob, 'falsch')).rejects.toBeTruthy();
  });
});

describe('Outfits, Personalisierung, Ähnlichkeit', () => {
  const items: Product[] = [
    product({ id: 's:1', cat: 'knit', col: ['navy'] }),
    product({ id: 's:2', cat: 'trousers', col: ['beige'], t: 'Wool Trousers', mat: [{ k: 'wool', pct: 100 }], tot: 180 }),
    product({ id: 's:3', cat: 'boots', col: ['brown'], t: 'Chelsea Boot', mat: [{ k: 'suede' }], tot: 300, sz: ['43'], sza: ['43'] }),
    product({ id: 's:4', cat: 'coat', col: ['grey'], t: 'Wool Overcoat', tot: 400 }),
    product({ id: 's:5', cat: 'tshirt', col: ['red'], t: 'Red Tee', tot: 40 }),
    product({ id: 's:6', cat: 'jeans', col: ['blue'], t: 'Selvedge Jeans', tot: 150 }),
  ];
  it('Farbharmonie: max. zwei Akzente, keine Clash-Farben', () => {
    expect(colorsCompatible([['navy'], ['beige'], ['brown']]).ok).toBe(true);
    expect(colorsCompatible([['red'], ['pink']]).ok).toBe(false);
  });
  it('baut vollständige Outfits im Budget', () => {
    const o = buildOutfits(items, { profile: { ...DEFAULT_PROFILE, genders: ['men'] }, month: 11, count: 3 });
    expect(o.length).toBeGreaterThan(0);
    expect(o[0].items.top && o[0].items.bottom && o[0].items.shoes).toBeTruthy();
    const capped = buildOutfits(items, { profile: DEFAULT_PROFILE, month: 11, budget: 400 });
    capped.forEach((x) => expect(x.total).toBeLessThanOrEqual(408));
  });
  it('Profil: Grösse, Budget, Marken ausblenden', () => {
    const p = product();
    expect(matchProfile(p, { ...DEFAULT_PROFILE, sizes: { top: ['M'] } }).reasons).toContain('in deiner Grösse');
    expect(matchProfile(p, { ...DEFAULT_PROFILE, avoidBrands: ['Brand'] }).blocked).toBe(true);
    expect(matchProfile(p, { ...DEFAULT_PROFILE, budget: { knit: 50 } }).score).toBeLessThan(50);
  });
  it('findet günstigere Alternativen und gleiche Produkte in anderen Shops', () => {
    const a = product({ id: 'a:1', s: 'a', tot: 200, q: 80 });
    const b = product({ id: 'b:1', s: 'b', tot: 150, q: 78 });
    expect(similarProducts(a, [a, b], { cheaper: true }).map((x) => x.p.id)).toEqual(['b:1']);
    expect(sameProductOffers(a, [a, b]).map((x) => x.id)).toEqual(['b:1']);
  });
  it('Plattform-Links enthalten die Suche', () => {
    const l = platformLinks({ q: 'Barbour Jacke', maxPrice: 200 });
    expect(l.find((x) => x.id === 'ricardo')?.url).toContain('Barbour%20Jacke');
    expect(l.find((x) => x.id === 'vinted')?.shipsToCH).toBe(false);
    expect(l.find((x) => x.id === 'ebay')?.url).toContain('_udhi=200');
  });
});

import { buildVocab, groupsMatch, haystack } from '../shared/search';
import { emptyInterests, interestMatch, learnImage, learnProduct, learnSearch, decayed, SIGNAL } from '../shared/interests';
import { combinedMatch, isPersonalized } from '../shared/personalize';

describe('Produktsuche über alle Shops', () => {
  const s = shop({ multiBrand: true });
  const conv = product({ id: 'k:1', b: 'Converse', t: 'Chuck 70 Ox - Black', cat: 'sneakers', col: ['black'], mat: [{ k: 'cotton' }] });
  const pants = product({ id: 'k:2', b: 'Brand', t: 'Tailored Wide Trousers - Black', cat: 'trousers', col: ['black'], fit: 'relaxed' });
  const slim = product({ id: 'k:3', b: 'Brand', t: 'Slim Chino - Black', cat: 'trousers', col: ['black'], fit: 'slim' });
  const vocab = buildVocab([conv, pants, slim].map((p) => ({ b: p.b, h: haystack(p, s) })));
  it('versteht "breite schwarze Anzughosen"', () => {
    const q = parseQuery('breite schwarze anzughosen', vocab);
    expect(q.filters.categories).toEqual(['trousers']);
    expect(q.filters.colors).toEqual(['black']);
    expect(q.groups.map((g) => g.label)).toEqual(['weite Passform']);
    expect(groupsMatch(pants, haystack(pants, s), q.groups)).toBe(true);
    expect(groupsMatch(slim, haystack(slim, s), q.groups)).toBe(false);
    expect(q.soft).toContain('tailored');
  });
  it('korrigiert Tippfehler und erkennt Marken und Modelle', () => {
    const q = parseQuery('converser chuck low', vocab);
    expect(q.corrected).toEqual([['converser', 'converse']]);
    expect(q.filters.brands).toEqual(['Converse']);
    expect(groupsMatch(conv, haystack(conv, s), q.groups)).toBe(true); // "Ox" = Low
  });
  it('zerlegt deutsche Komposita und erkennt Schuhgrössen', () => {
    const q = parseQuery('wollmantel damen');
    expect(q.filters.categories).toEqual(['coat']);
    expect(q.filters.materials).toEqual(['wool']);
    const z = parseQuery('lederschuhe braun 43');
    expect(z.filters.sizes).toEqual(['43']);
    expect(z.filters.materials).toEqual(['leather']);
    expect(parseQuery('converse chuck 70').text).toEqual(['converse', '70']); // ohne Wortschatz keine Markenerkennung
  });
});

describe('Lernende Interessen', () => {
  const p = product({ b: 'Sunspel', cat: 'tshirt', col: ['navy'], g: 'men' });
  it('lernt aus Ansichten, Favoriten und Suchen', () => {
    let i = emptyInterests();
    i = learnProduct(i, p, SIGNAL.favorite);
    i = learnProduct(i, p, SIGNAL.view);
    i = learnSearch(i, { categories: ['tshirt'], colors: ['navy'] });
    expect(i.brands.Sunspel).toBe(5);
    expect(i.seen[0]).toBe(p.id);
    const fit = interestMatch(i, p);
    const other = interestMatch(i, product({ b: 'Other', cat: 'dress', col: ['red'], g: 'women' }));
    expect(fit.score).toBeGreaterThan(other.score + 30);
    expect(isPersonalized(DEFAULT_PROFILE, i)).toBe(true);
    expect(combinedMatch(p, DEFAULT_PROFILE, i).reasons.length).toBeGreaterThan(0);
  });
  it('vergisst langsam und respektiert Pausieren', () => {
    const i = learnProduct(emptyInterests(), p, 4);
    const later = decayed({ ...i, updatedAt: Date.now() - 30 * 86400000 });
    expect(later.brands.Sunspel).toBeCloseTo(2, 1);
    const off = learnProduct({ ...emptyInterests(), on: false }, p, 4);
    expect(off.brands).toEqual({});
  });
  it('speichert Bild-Fingerabdrücke (max. 8), keine Fotos', () => {
    let i = emptyInterests();
    for (let k = 0; k < 10; k++) i = learnImage(i, new Float32Array([0.1234567, 0.2]), { cat: 'knit' });
    expect(i.img.length).toBe(8);
    expect(i.img[0].vec[0]).toBe(0.123);
    expect(i.cats.knit).toBeGreaterThan(0);
  });
});
