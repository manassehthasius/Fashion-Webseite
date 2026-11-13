// Kompakte Speicherung von Bild- und Produkt-URLs (spart viel Platz im Katalog).
import type { Product, Shop } from './types';

const SHOPIFY_CDN = 'https://cdn.shopify.com/s/files/';

/** Bild-URL ohne Breitenparameter und mit Kürzel für häufige Präfixe */
export function packImg(url: string, domain: string): string {
  let u = url.startsWith('//') ? `https:${url}` : url;
  u = u.replace(/([?&])width=\d+&?/, '$1').replace(/[?&]$/, '');
  if (u.startsWith(SHOPIFY_CDN)) return '~' + u.slice(SHOPIFY_CDN.length);
  const own = `https://${domain}/cdn/shop/`;
  if (u.startsWith(own)) return '@' + u.slice(own.length);
  const ownWww = `https://www.${domain.replace(/^www\./, '')}/cdn/shop/`;
  if (u.startsWith(ownWww)) return '@' + u.slice(ownWww.length);
  return u;
}

export function imgUrl(packed: string | undefined, shop: Pick<Shop, 'domain'> | undefined, width = 600): string {
  if (!packed) return '';
  let u = packed;
  if (u.startsWith('~')) u = SHOPIFY_CDN + u.slice(1);
  else if (u.startsWith('@')) u = `https://${shop?.domain ?? ''}/cdn/shop/${u.slice(1)}`;
  return u + (u.includes('?') ? '&' : '?') + `width=${width}`;
}

/** Produkt-URL (p.u enthält nur den Handle) */
export function productUrl(p: Pick<Product, 'u'>, shop: Pick<Shop, 'domain' | 'market'> | undefined): string {
  if (p.u.startsWith('http')) return p.u;
  return `https://${shop?.domain ?? ''}${shop?.market?.prefix ?? ''}/products/${p.u}`;
}
