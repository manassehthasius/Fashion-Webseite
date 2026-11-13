// Kuratierte Shops mit öffentlichem Produkt-Feed und Lieferung in die Schweiz.
// Lieferland CH wird bei jedem Lauf über /meta.json (ships_to_countries) erneut geprüft.
// verified: true = Schweizer Versandkosten aus den Versandbedingungen des Shops (geprüft 11/2026).
import type { Shop } from '../shared/types';

type S = Omit<Shop, 'segment' | 'exportVatRemoved'> & { segment?: Shop['segment']; exportVatRemoved?: boolean };

const VAT: Record<string, number> = { DE: 0.19, DK: 0.25, NL: 0.21, GB: 0.2, FR: 0.2, ES: 0.21, PT: 0.23, BE: 0.21, SE: 0.25, AT: 0.2, IT: 0.22, US: 0, CA: 0, CH: 0.081 };

const est = (currency: string, cost: number, freeFrom: number | undefined, days: [number, number], note?: string, carrier?: 'post' | 'courier') => ({ currency, cost, freeFrom, days, verified: false, note, carrier });
const ver = (currency: string, cost: number, freeFrom: number | undefined, days: [number, number], note?: string, carrier?: 'post' | 'courier') => ({ currency, cost, freeFrom, days, verified: true, note, carrier });

const RAW: S[] = [
  // ---------- Schweiz ----------
  { id: 'nikin', name: 'NIKIN', domain: 'nikin.com', country: 'CH', currency: 'CHF', duty: 'domestic', homeVat: VAT.CH, tier: 3, styles: ['casual', 'minimal', 'outdoor'], gender: 'unisex', shipping: est('CHF', 7.9, 100, [1, 3]), certifications: [], perks: ['Pflanzt einen Baum pro Produkt'] },
  { id: 'qwstion', name: 'QWSTION', domain: 'qwstion.com', country: 'CH', currency: 'CHF', duty: 'domestic', homeVat: VAT.CH, tier: 4, styles: ['minimal', 'smart'], gender: 'unisex', shipping: ver('CHF', 7.5, 200, [1, 3]) },
  { id: 'rotauf', name: 'ROTAUF', domain: 'rotauf.ch', country: 'CH', currency: 'CHF', duty: 'domestic', homeVat: VAT.CH, tier: 4, styles: ['outdoor', 'minimal'], gender: 'unisex', shipping: est('CHF', 8, 150, [1, 3]), perks: ['Made in Europe, Bündner Wolle'] },
  { id: 'muntagnard', name: 'Muntagnard', domain: 'muntagnard.ch', country: 'CH', currency: 'CHF', duty: 'domestic', homeVat: VAT.CH, tier: 4, styles: ['outdoor', 'classic'], gender: 'unisex', shipping: ver('CHF', 8.5, 150, [1, 4]) },

  // ---------- EU ----------
  { id: 'colorfulstandard', cap: 1000, name: 'Colorful Standard', domain: 'colorfulstandard.com', country: 'DK', currency: 'EUR', duty: 'dap', homeVat: VAT.DK, tier: 4, styles: ['minimal', 'casual'], gender: 'unisex', shipping: ver('CHF', 9, 140, [1, 2], 'DHL'), certifications: ['bcorp'] },
  { id: 'organicbasics', name: 'Organic Basics', domain: 'organicbasics.com', country: 'DK', currency: 'EUR', duty: 'dap', homeVat: VAT.DK, tier: 3, styles: ['minimal', 'sporty'], shipping: est('EUR', 9.95, 100, [3, 6]), certifications: ['bcorp'] },
  { id: 'snocks', name: 'SNOCKS', domain: 'snocks.com', country: 'DE', currency: 'EUR', duty: 'dap', homeVat: VAT.DE, tier: 2, styles: ['minimal', 'casual'], shipping: ver('CHF', 6, undefined, [2, 5]), cap: 700 },
  { id: 'merzbschwanen', name: 'Merz b. Schwanen', domain: 'merzbschwanen.com', country: 'DE', currency: 'EUR', duty: 'dap', homeVat: VAT.DE, tier: 5, styles: ['classic', 'workwear', 'minimal'], shipping: est('EUR', 20, 250, [2, 6], 'Express-Versand international') },
  { id: 'kingsofindigo', name: 'Kings of Indigo', domain: 'kingsofindigo.com', country: 'NL', currency: 'EUR', duty: 'dap', homeVat: VAT.NL, tier: 3, styles: ['casual', 'workwear'], shipping: ver('CHF', 20, undefined, [3, 10], 'Import-MWST + Gebühr bei Lieferung') },
  { id: 'knowledgecotton', name: 'Knowledge Cotton Apparel', domain: 'knowledgecottonapparel.com', country: 'DK', currency: 'EUR', duty: 'dap', homeVat: VAT.DK, tier: 3, styles: ['casual', 'minimal'], shipping: ver('EUR', 7.5, 100, [3, 7], 'MWST nicht enthalten'), certifications: ['gots'] },
  { id: 'mudjeans', name: 'MUD Jeans', domain: 'mudjeans.eu', country: 'NL', currency: 'EUR', duty: 'dap', homeVat: VAT.NL, tier: 3, styles: ['casual', 'minimal'], shipping: est('EUR', 15, 150, [3, 7]), certifications: ['bcorp'], perks: ['Kostenlose Reparatur'] },
  { id: 'armedangels', name: 'ARMEDANGELS', domain: 'armedangels.com', country: 'DE', currency: 'EUR', duty: 'dap', homeVat: VAT.DE, tier: 3, styles: ['casual', 'minimal'], shipping: est('CHF', 6.9, 80, [2, 5]), certifications: ['gots', 'fairwear'], cap: 1500 },
  { id: 'akindofguise', name: 'A Kind of Guise', domain: 'akindofguise.com', country: 'DE', currency: 'EUR', duty: 'dap', homeVat: VAT.DE, tier: 4, styles: ['classic', 'outdoor', 'workwear'], gender: 'men', shipping: est('EUR', 20, undefined, [2, 5], 'DHL/FedEx; Nicht-EU-Preise ohne MWST'), exportVatRemoved: true },
  { id: 'langbrett', name: 'LANGBRETT', domain: 'langbrett.com', country: 'DE', currency: 'EUR', duty: 'dap', homeVat: VAT.DE, tier: 3, styles: ['outdoor', 'casual'], shipping: ver('EUR', 16.5, undefined, [3, 7]) },
  { id: 'ecoalf', name: 'ECOALF', domain: 'ecoalf.com', country: 'ES', currency: 'EUR', duty: 'dap', homeVat: VAT.ES, tier: 3, styles: ['outdoor', 'minimal'], shipping: ver('EUR', 15, 250, [3, 7], 'Gratisversand ab EUR 250; Basistarif geschätzt'), certifications: ['bcorp'] },
  { id: 'thinkingmu', name: 'Thinking MU', domain: 'thinkingmu.com', country: 'ES', currency: 'EUR', duty: 'dap', homeVat: VAT.ES, tier: 3, styles: ['casual', 'boho'], shipping: est('EUR', 15, 150, [3, 7]), certifications: ['gots'] },
  { id: 'madsnorgaard', name: 'Mads Nørgaard', domain: 'madsnorgaard.com', country: 'DK', currency: 'EUR', duty: 'dap', homeVat: VAT.DK, tier: 3, styles: ['casual', 'classic'], shipping: ver('CHF', 20, undefined, [3, 5], 'GLS; Zoll/MWST nicht enthalten') },
  { id: 'hast', name: 'Hast', domain: 'hast.fr', country: 'FR', currency: 'EUR', duty: 'dap', homeVat: VAT.FR, tier: 4, styles: ['classic', 'smart'], gender: 'men', shipping: ver('CHF', 9, 250, [3, 5]) },
  { id: 'rouje', name: 'Rouje', domain: 'rouje.com', country: 'FR', currency: 'EUR', duty: 'dap', homeVat: VAT.FR, tier: 3, styles: ['elegant', 'boho'], gender: 'women', shipping: est('EUR', 15, undefined, [2, 4], 'UPS') },
  { id: 'bonnegueule', name: 'BonneGueule', domain: 'bonnegueule.fr', country: 'FR', currency: 'EUR', duty: 'dap', homeVat: VAT.FR, tier: 4, styles: ['classic', 'smart'], gender: 'men', shipping: ver('EUR', 15, undefined, [3, 8], 'Colissimo → Post CH', 'post') },
  { id: 'palomawool', name: 'Paloma Wool', domain: 'palomawool.com', country: 'ES', currency: 'EUR', duty: 'dap', homeVat: VAT.ES, tier: 3, styles: ['avantgarde', 'minimal'], gender: 'women', shipping: ver('EUR', 12, undefined, [2, 6], 'DHL; Zoll nicht enthalten', 'courier') },
  { id: 'armorlux', name: 'Armor-Lux', domain: 'armorlux.com', country: 'FR', currency: 'EUR', duty: 'dap', homeVat: VAT.FR, tier: 3, styles: ['classic', 'preppy'], shipping: est('EUR', 15, 150, [3, 7]), cap: 800 },
  { id: 'portugueseflannel', name: 'Portuguese Flannel', domain: 'portugueseflannel.com', country: 'PT', currency: 'EUR', duty: 'dap', homeVat: VAT.PT, tier: 4, styles: ['casual', 'classic'], gender: 'men', shipping: est('EUR', 15, 200, [3, 7]) },
  { id: 'norseprojects', name: 'Norse Projects', domain: 'norseprojects.com', country: 'DK', currency: 'DKK', duty: 'dap', homeVat: VAT.DK, tier: 4, styles: ['minimal', 'outdoor', 'classic'], shipping: ver('EUR', 20, 350, [1, 3], 'DHL Express (Europa-Tarif)', 'courier') },

  // ---------- Grossbritannien ----------
  { id: 'sunspel', name: 'Sunspel', domain: 'sunspel.com', country: 'GB', currency: 'GBP', duty: 'dap', homeVat: VAT.GB, tier: 5, styles: ['minimal', 'classic'], shipping: est('GBP', 20, undefined, [3, 6], 'Rest-of-World-Versand; Zoll bei Lieferung', 'courier') },
  { id: 'universalworks', name: 'Universal Works', domain: 'universalworks.co.uk', country: 'GB', currency: 'GBP', duty: 'dap', homeVat: VAT.GB, tier: 4, styles: ['workwear', 'casual'], gender: 'men', shipping: est('GBP', 15, 200, [3, 5]) },
  { id: 'folk', name: 'Folk', domain: 'folkclothing.com', country: 'GB', currency: 'GBP', duty: 'dap', homeVat: VAT.GB, tier: 4, styles: ['minimal', 'casual'], shipping: est('GBP', 15, 200, [3, 6]) },
  { id: 'oliverspencer', name: 'Oliver Spencer', domain: 'oliverspencer.co.uk', country: 'GB', currency: 'GBP', duty: 'ddp', homeVat: VAT.GB, tier: 4, styles: ['smart', 'classic'], gender: 'men', shipping: est('GBP', 15, 200, [2, 5], 'Zoll & Steuern vorab im Checkout') },
  { id: 'privatewhite', name: 'Private White V.C.', domain: 'privatewhitevc.com', country: 'GB', currency: 'GBP', duty: 'dap', homeVat: VAT.GB, tier: 5, styles: ['classic', 'workwear'], gender: 'men', shipping: est('GBP', 20, undefined, [3, 6]) },
  { id: 'percival', name: 'Percival', domain: 'percivalclo.com', country: 'GB', currency: 'GBP', duty: 'dap', homeVat: VAT.GB, tier: 3, styles: ['smart', 'casual'], gender: 'men', shipping: est('GBP', 15, 200, [3, 6]) },
  { id: 'waxlondon', name: 'Wax London', domain: 'waxlondon.com', country: 'GB', currency: 'GBP', duty: 'dap', homeVat: VAT.GB, tier: 3, styles: ['casual', 'smart'], gender: 'men', shipping: est('GBP', 15, 200, [3, 6]) },
  { id: 'drakes', name: "Drake's", domain: 'drakes.com', country: 'GB', currency: 'GBP', duty: 'ddp', homeVat: VAT.GB, tier: 5, styles: ['classic', 'preppy', 'smart'], gender: 'men', shipping: ver('CHF', 20, 260, [2, 4], 'DHL Express, Zoll & Steuern inklusive'), cap: 1200 },
  { id: 'sheepinc', name: 'Sheep Inc', domain: 'sheepinc.com', country: 'GB', currency: 'GBP', duty: 'dap', homeVat: VAT.GB, tier: 4, styles: ['minimal'], shipping: ver('CHF', 15, 220, [5, 7]), certifications: ['bcorp'] },
  { id: 'jumper1234', name: 'Jumper 1234', domain: 'jumper1234.com', country: 'GB', currency: 'GBP', duty: 'dap', homeVat: VAT.GB, tier: 4, styles: ['classic', 'minimal'], shipping: est('GBP', 25, undefined, [3, 7]) },
  { id: 'uskees', name: 'Uskees', domain: 'uskees.co.uk', country: 'GB', currency: 'GBP', duty: 'dap', homeVat: VAT.GB, tier: 3, styles: ['workwear'], shipping: est('GBP', 15, undefined, [3, 7]) },
  { id: 'trickers', name: "Tricker's", domain: 'trickers.com', country: 'GB', currency: 'GBP', duty: 'dap', homeVat: VAT.GB, tier: 5, styles: ['classic', 'workwear'], shipping: ver('GBP', 25, 100, [3, 7], 'Gratis ab GBP 100 (Rest of World)', 'courier') },
  { id: 'goodhood', name: 'Goodhood', domain: 'goodhoodstore.com', country: 'GB', currency: 'GBP', duty: 'dap', homeVat: VAT.GB, tier: 3, styles: ['streetwear', 'casual'], multiBrand: true, shipping: est('GBP', 20, 200, [3, 6]), cap: 1500 },

  // ---------- USA / Kanada ----------
  { id: 'taylorstitch', name: 'Taylor Stitch', domain: 'taylorstitch.com', country: 'US', currency: 'USD', duty: 'dap', homeVat: VAT.US, tier: 4, styles: ['workwear', 'casual'], gender: 'men', shipping: est('USD', 25, undefined, [5, 10]), perks: ['Restitch: Reparatur & Wiederverkauf'], cap: 1200 },
  { id: 'outerknown', name: 'Outerknown', domain: 'outerknown.com', country: 'US', currency: 'USD', duty: 'dap', homeVat: VAT.US, tier: 3, styles: ['casual', 'minimal'], shipping: est('USD', 25, undefined, [5, 10]), certifications: ['fairtrade'] },
  { id: 'naadam', name: 'NAADAM', domain: 'naadam.co', country: 'US', currency: 'USD', duty: 'dap', homeVat: VAT.US, tier: 4, styles: ['minimal', 'classic'], shipping: est('USD', 20, undefined, [5, 10]) },
  { id: 'kotn', name: 'Kotn', domain: 'kotn.com', country: 'CA', currency: 'CAD', duty: 'dap', homeVat: VAT.CA, tier: 3, styles: ['minimal', 'casual'], shipping: est('CAD', 30, undefined, [5, 10]), certifications: ['bcorp'] },
  { id: 'unboundmerino', name: 'Unbound Merino', domain: 'unboundmerino.com', country: 'CA', currency: 'USD', duty: 'dap', homeVat: VAT.US, tier: 3, styles: ['minimal', 'outdoor'], gender: 'men', shipping: est('USD', 20, undefined, [5, 10]) },
  { id: 'alexmill', name: 'Alex Mill', domain: 'alexmill.com', country: 'US', currency: 'USD', duty: 'dap', homeVat: VAT.US, tier: 4, styles: ['classic', 'casual'], shipping: est('USD', 25, undefined, [5, 10]) },
  { id: 'wooland', name: 'wool&', domain: 'wooland.com', country: 'US', currency: 'USD', duty: 'dap', homeVat: VAT.US, tier: 3, styles: ['minimal'], shipping: est('USD', 20, undefined, [5, 10]) },
  { id: 'freenote', name: 'Freenote Cloth', domain: 'freenotecloth.com', country: 'US', currency: 'USD', duty: 'dap', homeVat: VAT.US, tier: 5, styles: ['workwear', 'classic'], gender: 'men', shipping: est('USD', 30, undefined, [5, 10]) },
  { id: 'thursday', name: 'Thursday Boot Company', domain: 'thursdayboots.com', country: 'US', currency: 'USD', duty: 'dap', homeVat: VAT.US, tier: 3, styles: ['classic', 'casual'], shipping: est('USD', 25, undefined, [5, 10]), cap: 800 },
  { id: 'acemarks', name: 'Ace Marks', domain: 'acemarks.com', country: 'US', currency: 'USD', duty: 'dap', homeVat: VAT.US, tier: 4, styles: ['classic', 'elegant'], gender: 'men', shipping: est('USD', 25, undefined, [5, 10]) },
  { id: 'koio', name: 'KOIO', domain: 'koio.co', country: 'US', currency: 'USD', duty: 'dap', homeVat: VAT.US, tier: 4, styles: ['minimal', 'casual'], shipping: est('USD', 25, undefined, [5, 10]) },
  { id: 'stag', name: 'STAG Provisions', domain: 'stagprovisions.com', country: 'US', currency: 'USD', duty: 'dap', homeVat: VAT.US, tier: 4, styles: ['workwear', 'classic'], gender: 'men', multiBrand: true, shipping: est('USD', 30, undefined, [5, 10]), cap: 1500 },
  { id: 'kith', name: 'Kith', domain: 'kith.com', country: 'US', currency: 'USD', duty: 'dap', homeVat: VAT.US, tier: 3, styles: ['streetwear', 'casual'], multiBrand: true, shipping: est('USD', 30, undefined, [5, 10]), cap: 1000 },

  // ---------- Secondhand & Vintage ----------
  { id: 'reawake', name: 'REAWAKE', domain: 'reawake.ch', country: 'CH', currency: 'CHF', duty: 'domestic', homeVat: VAT.CH, segment: 'secondhand', tier: 4, styles: ['elegant', 'classic'], multiBrand: true, shipping: ver('CHF', 11, 300, [2, 4], 'Gratis ab CHF 300'), cap: 2500, note: 'Kuratierte High-End-Secondhand, Zürich' },
  { id: 'thrifted', name: 'Thrifted', domain: 'thrifted.com', country: 'GB', currency: 'GBP', duty: 'dap', homeVat: VAT.GB, segment: 'secondhand', tier: 2, styles: ['vintage', 'casual'], multiBrand: true, shipping: est('GBP', 15, undefined, [4, 8]), cap: 2000, note: 'Vintage aus UK' },
  { id: 'hewi', name: 'HEWI', domain: 'hardlyeverwornit.com', country: 'GB', currency: 'GBP', duty: 'dap', homeVat: VAT.GB, segment: 'secondhand', tier: 4, styles: ['elegant', 'classic'], multiBrand: true, shipping: est('GBP', 20, undefined, [4, 8], 'Versicherter Versand'), cap: 2000, note: 'Designer-Secondhand (oft Neu mit Etikett)' },
  { id: 'labellov', name: 'Labellov', domain: 'labellov.com', country: 'BE', currency: 'EUR', duty: 'dap', homeVat: VAT.BE, segment: 'secondhand', tier: 4, styles: ['elegant', 'classic'], multiBrand: true, shipping: est('EUR', 25, undefined, [3, 7], 'Versicherter Versand'), cap: 1500, note: 'Luxus-Secondhand mit Echtheitsprüfung' },
];

export const SHOPS: Shop[] = RAW.map((s) => ({
  ...s,
  segment: s.segment ?? 'new',
  // Annahme: EU/UK-Shops ziehen bei Lieferung in die Schweiz ihre MWST ab (Export ist MWST-frei)
  exportVatRemoved: s.exportVatRemoved ?? (s.duty === 'dap' && s.homeVat > 0),
  cap: s.cap ?? 800,
  // Neueste Produkte zuerst: so viele Feed-Seiten, wie für das Katalog-Limit nötig (+1 Reserve für Nicht-Kleidung)
  maxPages: s.maxPages ?? Math.ceil((s.cap ?? 800) / 250) + 1,
}));

export const SHOP_BY_ID = Object.fromEntries(SHOPS.map((s) => [s.id, s]));
