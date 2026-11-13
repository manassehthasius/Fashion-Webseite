// Gesamtpreis in CHF inkl. Versand, Schweizer Einfuhr-MWST und Verzollungsgebühr.
//
// Rechtsgrundlagen / Quellen (Stand 11/2026):
// - Seit 1.1.2024 keine Industriezölle mehr auf Kleidung/Schuhe (Zolltarif-Kapitel 25–97, BAZG/SECO).
// - Einfuhr-MWST 8,1 %; Steuerbeträge bis CHF 5 werden nicht erhoben (≈ Warenwert inkl. Versand bis CHF 62).
// - Verzollungsgebühr Post: Grundpreis CHF 13.00 (EU) bzw. CHF 16.00 (übrige Länder) + 3 % des Warenwerts, max. CHF 70.
//   Kuriere (DHL, UPS, FedEx) können abweichende, oft höhere Gebühren verlangen.
import type { FxRates, PriceBreakdown, Shop } from './types';
import { round2 } from './text';

export const CH_IMPORT = {
  vatRate: 0.081,
  vatMinTax: 5,
  postFeeEU: 13,
  postFeeOther: 16,
  postFeePct: 0.03,
  postFeeMax: 70,
  duty: 0,
};

export const EU_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU',
  'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

/** Fallback-Kurse (CHF je Einheit), manuell gepflegt – nur genutzt, wenn keine Tageskurse verfügbar sind */
export const STATIC_FX: FxRates = {
  toCHF: { CHF: 1, EUR: 0.93, GBP: 1.1, USD: 0.83, CAD: 0.58, SEK: 0.084, DKK: 0.124, NOK: 0.087, AUD: 0.55, JPY: 0.0053 },
  source: 'static',
  date: '2026-11-13',
};

export function toCHF(amount: number, currency: string, fx: FxRates): number {
  const r = fx.toCHF[currency] ?? STATIC_FX.toCHF[currency];
  if (!r) throw new Error(`Kein Wechselkurs für ${currency}`);
  return amount * r;
}

/** Artikelpreis in CHF, wie ihn ein Schweizer Kunde beim Shop bezahlt (vor Versand/Import) */
export function itemPriceCHF(price: number, shop: Shop, fx: FxRates): number {
  // Preis aus dem Schweizer Shop-Markt: bereits in CHF, wie vom Shop berechnet
  if (shop.market) return round2(price);
  let net = price;
  if (shop.duty === 'domestic') return round2(toCHF(net, shop.currency, fx));
  if (shop.homeVat > 0 && (shop.exportVatRemoved || shop.duty === 'ddp')) net = price / (1 + shop.homeVat);
  // DDP: Shop rechnet Schweizer MWST bereits ein
  if (shop.duty === 'ddp') net = net * (1 + CH_IMPORT.vatRate);
  return round2(toCHF(net, shop.currency, fx));
}

export interface CostOptions {
  /** Bestellwert weiterer Artikel desselben Shops (CHF), für Gratisversand-Schwelle */
  basketExtraCHF?: number;
  compareAt?: number;
}

export function landedCost(price: number, shop: Shop, fx: FxRates, opts: CostOptions = {}): PriceBreakdown {
  const notes: string[] = [];
  let estimated = fx.source === 'static';
  const item = itemPriceCHF(price, shop, fx);
  const itemWas = opts.compareAt && opts.compareAt > price ? itemPriceCHF(opts.compareAt, shop, fx) : undefined;
  const orderValue = item + (opts.basketExtraCHF ?? 0);

  // Versand
  const sh = shop.shipping;
  const shipCHF = round2(toCHF(sh.cost, sh.currency, fx));
  const freeFromCHF = sh.freeFrom !== undefined ? toCHF(sh.freeFrom, sh.currency, fx) : Infinity;
  const shippingFree = shipCHF === 0 || orderValue >= freeFromCHF;
  const shipping = shippingFree ? 0 : shipCHF;
  if (!sh.verified) {
    estimated = true;
    notes.push('Versandkosten geschätzt (Shop nennt keine Schweizer Tarife öffentlich).');
  }
  if (sh.freeFrom !== undefined && !shippingFree) {
    notes.push(`Gratisversand ab ${sh.currency} ${sh.freeFrom} (noch CHF ${round2(freeFromCHF - orderValue).toFixed(2)}).`);
  }

  let vat = 0;
  let clearance = 0;
  const duty = shop.market ? shop.market.mode : shop.duty;
  if (shop.market) notes.push('Echter CHF-Preis aus dem Schweizer Shop-Markt.');
  if (duty === 'dap') {
    const goods = item + shipping; // MWST-Bemessung inkl. Transportkosten
    const tax = goods * CH_IMPORT.vatRate;
    if (tax > CH_IMPORT.vatMinTax) {
      vat = round2(tax);
      const base = EU_COUNTRIES.has(shop.country) ? CH_IMPORT.postFeeEU : CH_IMPORT.postFeeOther;
      clearance = round2(Math.min(CH_IMPORT.postFeeMax, base + goods * CH_IMPORT.postFeePct));
      notes.push('Einfuhr-MWST 8,1 % und Verzollungsgebühr (Post-Tarif) bei Lieferung zu bezahlen.');
      if (sh.carrier === 'courier') notes.push('Kurierdienste verlangen teils höhere Verzollungsgebühren als die Post.');
    } else {
      notes.push('Warenwert unter CHF 62: keine Einfuhr-MWST und keine Verzollungsgebühr.');
    }
    if (shop.homeVat > 0 && !shop.market) {
      estimated = true;
      notes.push(`Annahme: ${shop.country}-MWST (${Math.round(shop.homeVat * 100)} %) wird beim Export abgezogen.`);
    }
  } else if (duty === 'ddp') {
    notes.push(shop.market ? 'CHF-Preis enthält MWST – keine Importkosten erwartet (DDP).' : 'Zoll & MWST im Preis enthalten (DDP) – keine Gebühren bei Lieferung.');
    if (shop.currency !== 'CHF' && !shop.market) estimated = true;
  } else {
    notes.push('Schweizer Shop – Preis inkl. MWST, keine Importkosten.');
  }
  if (shop.currency !== 'CHF' && !shop.market) notes.push(`Umgerechnet aus ${shop.currency} (${fx.source === 'shopify' ? 'Tageskurs' : 'Fixkurs'} ${fx.date}).`);

  const total = round2(item + shipping + vat + clearance);
  return {
    item,
    itemWas,
    discountPct: itemWas ? Math.round((1 - item / itemWas) * 100) : undefined,
    shipping,
    shippingFree,
    vat,
    clearance,
    duty: CH_IMPORT.duty,
    total,
    days: sh.days,
    estimated,
    notes,
  };
}

/** Mehrere Artikel aus demselben Shop: ein Versand, eine Verzollung */
export function basketCost(prices: number[], shop: Shop, fx: FxRates): PriceBreakdown {
  const items = prices.map((p) => itemPriceCHF(p, shop, fx));
  const sum = items.reduce((a, b) => a + b, 0);
  // Gesamtwert als ein "Artikel" rechnen
  const duty = shop.market ? shop.market.mode : shop.duty;
  const fake: Shop = { ...shop, market: null, currency: 'CHF', homeVat: 0, exportVatRemoved: false, duty: duty === 'ddp' ? 'domestic' : duty };
  const b = landedCost(sum, fake, { ...fx, toCHF: { ...fx.toCHF, CHF: 1 } });
  if (duty === 'ddp') b.notes = ['Zoll & MWST im Preis enthalten (DDP).', ...b.notes.filter((n) => !n.startsWith('Schweizer Shop'))];
  return { ...b, item: round2(sum) };
}
