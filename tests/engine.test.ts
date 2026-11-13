import { describe, expect, it } from 'vitest';
import { isAllowed, parseRobots } from '../engine/http';
import { normalizeProduct } from '../engine/normalize';
import { computeEvents } from '../engine/alerts';
import { dropPct } from '../engine/build';
import type { Catalog, Product, Shop, UserState } from '../shared/types';
import { DEFAULT_PROFILE } from '../shared/personalize';

const shop: Shop = {
  id: 'cs', name: 'Colorful Standard', domain: 'colorfulstandard.com', country: 'DK', currency: 'EUR', segment: 'new', duty: 'dap', homeVat: 0.25,
  exportVatRemoved: true, shipping: { currency: 'CHF', cost: 9, freeFrom: 140, days: [1, 2], verified: true }, tier: 4, styles: ['minimal'],
};

describe('robots.txt', () => {
  const txt = `User-agent: *\nDisallow: /cart/\nDisallow: /*/checkout\nAllow: /products/account\n\nUser-agent: BadBot\nDisallow: /`;
  const rules = parseRobots(txt);
  it('erlaubt Produkt-Feeds und sperrt Warenkorb', () => {
    expect(isAllowed(rules, '/products.json')).toBe(true);
    expect(isAllowed(rules, '/cart/add')).toBe(false);
    expect(isAllowed(rules, '/de-ch/checkout')).toBe(false);
  });
  it('respektiert spezifische Gruppen', () => {
    expect(isAllowed(parseRobots('User-agent: stilkompassbot\nDisallow: /products.json\nUser-agent: *\nAllow: /'), '/products.json')).toBe(false);
  });
});

describe('Normalisierung (echtes Shopify-Format)', () => {
  const raw = {
    id: 16285554606405, title: 'Women Merino Wool Turtleneck - Red Tangerine', handle: 'women-merino-wool-turtleneck-red-tangerine-female',
    body_html: '<p>100% recycled merino wool turtleneck, made in Portugal from Italian yarn. A heavyweight knit.</p>', vendor: 'Colorful Standard',
    product_type: 'CS5071/Women Merino Wool Turtleneck/F', tags: ['women', 'men', 'knitwear'], created_at: '2026-10-01T10:00:00Z', published_at: '2026-10-02T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z', options: [{ name: 'Size', values: ['XS', 'S', 'M'] }],
    variants: [
      { id: 1, title: 'XS', option1: 'XS', option2: null, option3: null, price: '145.00', compare_at_price: null, available: false },
      { id: 2, title: 'S', option1: 'S', option2: null, option3: null, price: '145.00', compare_at_price: null, available: true },
      { id: 3, title: 'M', option1: 'M', option2: null, option3: null, price: '145.00', compare_at_price: null, available: true },
    ],
    images: [{ src: 'https://cdn.shopify.com/s/files/1/0053/files/a.jpg?v=1' }],
  };
  it('liefert vollständigen Katalogeintrag', () => {
    const n = normalizeProduct(raw, shop)!;
    expect(n.cat).toBe('knit');
    expect(n.g).toBe('women');
    expect(n.col).toContain('red');
    expect(n.mat[0].k).toMatch(/merino/);
    expect(n.fx).toEqual(expect.arrayContaining(['o:pt', 'italianfabric', 'heavyweight']));
    expect(n.sz).toEqual(['S', 'M']);
    expect(n.sza).toEqual(['XS', 'S', 'M']);
    expect(n.u).toBe(raw.handle);
    expect(n.img.startsWith('~')).toBe(true);
  });
  it('sortiert Nicht-Kleidung aus', () => {
    expect(normalizeProduct({ ...raw, title: 'Gift Card', product_type: 'Gift Card' }, shop)).toBeNull();
    expect(normalizeProduct({ ...raw, title: 'TreeMug ToGo', product_type: 'MUG' }, shop)).toBeNull();
  });
});

describe('Alarme', () => {
  const base = (o: Partial<Product>): Product => ({
    id: 'cs:1', s: 'cs', seg: 'new', t: 'Turtleneck', b: 'Colorful Standard', u: 'x', img: '~a.jpg', p: 145, cur: 'EUR', chf: 116, tot: 120,
    cat: 'knit', g: 'women', col: ['red'], mat: [], fx: [], sz: ['M'], sza: ['S', 'M'], av: true, q: 80, qc: 0.8, st: [], first: 0, upd: 0, ...o,
  });
  const cat = (products: Product[]): Catalog => ({ v: 1, generatedAt: '', fx: { toCHF: { CHF: 1, EUR: 0.92 }, source: 'static', date: '' }, shops: [shop], products });
  const user: UserState = {
    v: 1, updatedAt: 0, favorites: [], profile: DEFAULT_PROFILE,
    watch: [{ id: 'cs:1', addedAt: 0, priceAtAdd: 120, target: 100, size: 'S', notifyDrop: true, notifyStock: true }],
    searches: [{ id: 'q1', name: 'Rote Rollkragen', query: 'roter pullover', filters: {}, segment: 'new', notifyNew: true, createdAt: 0 }],
  };
  it('meldet Preissturz, Wunschpreis, Verfügbarkeit und neue Treffer', () => {
    const now = 2_000_000_000;
    const prev = cat([base({})]);
    const cur = cat([base({ tot: 95, sz: ['S', 'M'], upd: now }), base({ id: 'cs:2', t: 'Red Merino Sweater', first: now - 60 })]);
    const types = computeEvents(user, cur, prev, now).map((e) => e.type).sort();
    expect(types).toEqual(['new', 'stock', 'target']);
    const dropOnly = computeEvents({ ...user, watch: [{ ...user.watch[0], target: undefined }] }, cat([base({ tot: 110 })]), prev, now);
    expect(dropOnly.map((e) => e.type)).toEqual(['drop']);
  });
  it('berechnet Preissenkung aus dem Verlauf', () => {
    expect(dropPct([[0, 100, 1], [10, 80, 1]], 20)).toBe(20);
    expect(dropPct([[0, 80, 1], [10, 100, 1]], 20)).toBeUndefined();
  });
});
