// Shopify-Rohdaten → kompakter Katalogeintrag (ohne Preis/Zeitfelder, die build.ts berechnet).
import type { Category, Product, Shop } from '../shared/types';
import {
  classifyCategory, classifyGender, extractBrand, extractColors, extractCondition, extractEra, extractFeatures,
  extractFit, extractMaterials, extractSizesAndColors, extractStyles, isExcluded, normSize, sizeFromText,
} from '../shared/classify';
import { stripHtml } from '../shared/text';
import { packImg } from '../shared/media';
import type { ShopifyProduct } from './sources/shopify';

export type NormProduct = Omit<Product, 'chf' | 'chfWas' | 'tot' | 'q' | 'qc' | 'first' | 'upd' | 'low' | 'drop'> & { published: number };

const KEEP: Category[] = [
  'tshirt', 'top', 'shirt', 'polo', 'knit', 'sweat', 'jacket', 'coat', 'blazer', 'suit', 'vest', 'trousers', 'jeans',
  'shorts', 'dress', 'skirt', 'jumpsuit', 'shoes', 'boots', 'sneakers', 'sandals', 'bag', 'accessory', 'underwear', 'socks', 'swim',
];

export function normalizeProduct(raw: ShopifyProduct, shop: Shop): NormProduct | null {
  const tags = Array.isArray(raw.tags) ? raw.tags : String(raw.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean);
  const body = stripHtml(raw.body_html);
  const title = (raw.title ?? '').trim();
  if (!title || !raw.variants?.length) return null;

  // CamelCase trennen ("TreePants" → "Tree Pants") für die Klassifizierung
  const clsTitle = title.replace(/([a-zäöü])([A-Z])/g, '$1 $2');
  const cat = classifyCategory(raw.product_type ?? '', clsTitle, tags, body);
  if (isExcluded(raw.product_type ?? '', clsTitle, cat)) return null;
  if (!cat || !KEEP.includes(cat)) return null;
  if (shop.onlyTypes && !shop.onlyTypes.some((t) => `${raw.product_type} ${tags.join(' ')}`.toLowerCase().includes(t))) return null;

  const prices = raw.variants.map((v) => Number(v.price)).filter((n) => n > 0);
  if (!prices.length) return null;
  const availableVariants = raw.variants.filter((v) => v.available !== false && Number(v.price) > 0);
  const priceSource = availableVariants.length ? availableVariants : raw.variants;
  const minVariant = priceSource.reduce((a, b) => (Number(b.price) > 0 && Number(b.price) < Number(a.price) ? b : a), priceSource[0]);
  const p = Number(minVariant.price);
  if (!(p > 0)) return null;
  const pcRaw = Number(minVariant.compare_at_price ?? 0);
  const pc = pcRaw > p * 1.02 ? pcRaw : undefined;

  const sizes = extractSizesAndColors(raw.options ?? [], raw.variants);
  let sza = sizes.all;
  let sz = sizes.available;
  if (!sizes.hasSizeOption) {
    const s = sizeFromText(title, body, tags);
    if (s) {
      sza = [s];
      sz = availableVariants.length ? [s] : [];
    } else if (raw.variants.length === 1) {
      const t = raw.variants[0].title;
      if (t && t !== 'Default Title') {
        sza = [normSize(t)];
        sz = availableVariants.length ? sza : [];
      }
    }
  }

  const genderField = body.match(/\b(?:gender|geschlecht)\s*:\s*([a-zäöü']+)/i)?.[1] ?? '';
  const g = classifyGender([genderField, clsTitle, raw.product_type, raw.handle, tags.join(' ')], shop.gender ?? 'unisex');
  const colorText = sizes.colorValues.length ? sizes.colorValues.join(' / ') : `${title.split(/\s[-–|]\s/).slice(1).join(' ') || title} ${tags.filter((t) => t.length < 25).join(' ')}`;
  let col = extractColors(colorText);
  if (!col.length) col = extractColors(`${title} ${body.slice(0, 200)}`);
  const mat = extractMaterials(title, body, tags);
  const fx = extractFeatures(title, body, tags);
  const seg = shop.segment;
  const b = extractBrand(raw.vendor, title, tags, shop);
  const st = extractStyles(`${title} ${raw.product_type} ${tags.join(' ')} ${body.slice(0, 300)}`, cat, shop, seg);
  const cond = seg === 'secondhand' ? extractCondition(tags, body, title) : undefined;
  const era = seg === 'secondhand' ? extractEra(title, body, tags) : undefined;
  const fit = extractFit(`${title} ${body.slice(0, 400)} ${tags.join(' ')}`);

  const imgs = (raw.images ?? []).slice(0, 3).map((i) => packImg(i.src, shop.domain));
  if (!imgs.length) return null;

  const kw = [raw.product_type, ...tags.filter((t) => t.length > 2 && t.length < 24 && !/^\d+$|:|_|^\d\d\/\d\d|^[A-Z]\d{3,}/.test(t)).slice(0, 8)]
    .filter(Boolean)
    .join(' ')
    .slice(0, 90);

  return {
    id: `${shop.id}:${raw.id}`,
    s: shop.id,
    seg,
    t: title.length > 140 ? title.slice(0, 137) + '…' : title,
    b,
    u: raw.handle,
    img: imgs[0],
    imgs: imgs.length > 1 ? imgs.slice(1) : undefined,
    p,
    pc,
    cur: shop.market ? 'CHF' : shop.currency,
    cat,
    g,
    col,
    mat,
    fx,
    sz,
    sza,
    av: availableVariants.length > 0,
    st,
    cond,
    era,
    fit,
    kw: kw || undefined,
    d: body ? (body.length > 700 ? body.slice(0, 697) + '…' : body) : undefined,
    published: Date.parse(raw.published_at ?? raw.created_at) / 1000 || 0,
  };
}
