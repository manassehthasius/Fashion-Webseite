// Grosse Mode-Shops ohne offenen Produkt-Feed (Zalando, Zara, H&M, Bershka …).
// Sie verbieten automatisches Auslesen – Stilkompass öffnet deshalb deren eigene Suche mit deiner Suchanfrage.
// mode "direct": eigene Suchseite des Shops · mode "site": Google-Suche nur innerhalb dieses Shops (funktioniert immer).

export type ExtGroup = 'Fast Fashion' | 'Online-Händler' | 'Marken' | 'Sport & Sneaker' | 'Schweizer Warenhäuser';

export interface ExtShop {
  id: string;
  name: string;
  group: ExtGroup;
  mode: 'direct' | 'site';
  url: (q: string) => string;
  /** Domain für das Shop-Logo (favicon) */
  domain?: string;
  note?: string;
}

const e = encodeURIComponent;
const site = (domain: string) => (q: string) => `https://www.google.com/search?q=${e(`site:${domain} ${q}`)}&hl=de&gl=ch`;

export const EXT_SHOPS: ExtShop[] = [
  // Fast Fashion
  { id: 'zara', name: 'Zara', group: 'Fast Fashion', domain: 'www.zara.com', mode: 'direct', url: (q) => `https://www.zara.com/ch/de/search?searchTerm=${e(q)}` },
  { id: 'hm', name: 'H&M', group: 'Fast Fashion', domain: 'www2.hm.com', mode: 'direct', url: (q) => `https://www2.hm.com/de_ch/search-results.html?q=${e(q)}` },
  { id: 'bershka', name: 'Bershka', group: 'Fast Fashion', domain: 'www.bershka.com', mode: 'direct', url: (q) => `https://www.bershka.com/ch/q/${e(q)}` },
  { id: 'pullandbear', name: 'Pull&Bear', group: 'Fast Fashion', domain: 'www.pullandbear.com', mode: 'site', url: site('pullandbear.com/ch') },
  { id: 'stradivarius', name: 'Stradivarius', group: 'Fast Fashion', domain: 'www.stradivarius.com', mode: 'site', url: site('stradivarius.com/ch') },
  { id: 'mango', name: 'Mango', group: 'Fast Fashion', domain: 'shop.mango.com', mode: 'direct', url: (q) => `https://shop.mango.com/ch/de/search?q=${e(q)}` },
  { id: 'massimodutti', name: 'Massimo Dutti', group: 'Fast Fashion', domain: 'www.massimodutti.com', mode: 'direct', url: (q) => `https://www.massimodutti.com/ch/search?q=${e(q)}` },
  { id: 'cos', name: 'COS', group: 'Fast Fashion', domain: 'www.cos.com', mode: 'site', url: site('cos.com') },
  { id: 'arket', name: 'Arket', group: 'Fast Fashion', domain: 'www.arket.com', mode: 'site', url: site('arket.com') },
  { id: 'stories', name: '& Other Stories', group: 'Fast Fashion', domain: 'www.stories.com', mode: 'site', url: site('stories.com') },
  { id: 'weekday', name: 'Weekday', group: 'Fast Fashion', domain: 'www.weekday.com', mode: 'site', url: site('weekday.com') },
  { id: 'ca', name: 'C&A', group: 'Fast Fashion', domain: 'www.c-and-a.com', mode: 'direct', url: (q) => `https://www.c-and-a.com/ch/de/shop/search?q=${e(q)}` },
  { id: 'tallyweijl', name: 'Tally Weijl', group: 'Fast Fashion', domain: 'www.tally-weijl.com', mode: 'site', url: site('tally-weijl.com') },
  { id: 'jackjones', name: 'Jack & Jones', group: 'Fast Fashion', domain: 'www.jackjones.com', mode: 'site', url: site('jackjones.com') },
  { id: 'only', name: 'ONLY / Vero Moda', group: 'Fast Fashion', domain: 'www.only.com', mode: 'site', url: (q) => `https://www.google.com/search?q=${e(`(site:only.com OR site:veromoda.com) ${q}`)}&hl=de&gl=ch` },
  { id: 'shein', name: 'SHEIN', group: 'Fast Fashion', domain: 'ch.shein.com', mode: 'direct', url: (q) => `https://ch.shein.com/pdsearch/${e(q)}/` },
  { id: 'boohoo', name: 'boohoo', group: 'Fast Fashion', domain: 'www.boohoo.com', mode: 'direct', url: (q) => `https://www.boohoo.com/search?q=${e(q)}` },
  // Online-Händler
  { id: 'zalando', name: 'Zalando', group: 'Online-Händler', domain: 'www.zalando.ch', mode: 'direct', url: (q) => `https://www.zalando.ch/katalog/?q=${e(q)}`, note: 'Gratisversand & -retouren in der Schweiz' },
  { id: 'aboutyou', name: 'About You', group: 'Online-Händler', domain: 'www.aboutyou.ch', mode: 'direct', url: (q) => `https://www.aboutyou.ch/suche?term=${e(q)}` },
  { id: 'asos', name: 'ASOS', group: 'Online-Händler', domain: 'www.asos.com', mode: 'direct', url: (q) => `https://www.asos.com/search/?q=${e(q)}` },
  { id: 'galaxus', name: 'Galaxus', group: 'Online-Händler', domain: 'www.galaxus.ch', mode: 'direct', url: (q) => `https://www.galaxus.ch/de/search?q=${e(q)}` },
  { id: 'bonprix', name: 'bonprix', group: 'Online-Händler', domain: 'www.bonprix.ch', mode: 'site', url: site('bonprix.ch') },
  // Schweizer Warenhäuser
  { id: 'manor', name: 'Manor', group: 'Schweizer Warenhäuser', domain: 'www.manor.ch', mode: 'direct', url: (q) => `https://www.manor.ch/de/search?text=${e(q)}` },
  { id: 'globus', name: 'Globus', group: 'Schweizer Warenhäuser', domain: 'www.globus.ch', mode: 'site', url: site('globus.ch') },
  { id: 'ochsnershoes', name: 'Ochsner Shoes', group: 'Schweizer Warenhäuser', domain: 'www.ochsner-shoes.ch', mode: 'direct', url: (q) => `https://www.ochsner-shoes.ch/de/search?text=${e(q)}` },
  // Marken
  { id: 'levis', name: "Levi's", group: 'Marken', domain: 'www.levi.com', mode: 'site', url: site('levi.com/CH') },
  { id: 'tommy', name: 'Tommy Hilfiger', group: 'Marken', domain: 'www.tommy.com', mode: 'site', url: site('tommy.com') },
  { id: 'calvinklein', name: 'Calvin Klein', group: 'Marken', domain: 'www.calvinklein.ch', mode: 'site', url: site('calvinklein.ch') },
  { id: 'lacoste', name: 'Lacoste', group: 'Marken', domain: 'www.lacoste.com', mode: 'site', url: site('lacoste.com/ch') },
  { id: 'hugoboss', name: 'BOSS', group: 'Marken', domain: 'www.hugoboss.com', mode: 'site', url: site('hugoboss.com/ch') },
  { id: 'esprit', name: 'Esprit', group: 'Marken', domain: 'www.esprit.ch', mode: 'site', url: site('esprit.ch') },
  { id: 'marcopolo', name: "Marc O'Polo", group: 'Marken', domain: 'www.marc-o-polo.com', mode: 'site', url: site('marc-o-polo.com') },
  // Sport & Sneaker
  { id: 'nike', name: 'Nike', group: 'Sport & Sneaker', domain: 'www.nike.com', mode: 'direct', url: (q) => `https://www.nike.com/ch/de/w?q=${e(q)}` },
  { id: 'adidas', name: 'adidas', group: 'Sport & Sneaker', domain: 'www.adidas.ch', mode: 'direct', url: (q) => `https://www.adidas.ch/de/search?q=${e(q)}` },
  { id: 'snipes', name: 'Snipes', group: 'Sport & Sneaker', domain: 'www.snipes.com', mode: 'site', url: site('snipes.com/de-ch') },
  { id: 'converse', name: 'Converse', group: 'Sport & Sneaker', domain: 'www.converse.com', mode: 'site', url: site('converse.com') },
];

export const EXT_GROUPS: ExtGroup[] = ['Fast Fashion', 'Online-Händler', 'Schweizer Warenhäuser', 'Marken', 'Sport & Sneaker'];

/** Standard-Lieblingsshops, solange im Profil nichts gewählt ist */
export const DEFAULT_EXT_SHOPS = ['zalando', 'zara', 'hm', 'bershka', 'pullandbear', 'aboutyou', 'mango', 'asos'];

export const EXT_BY_ID = Object.fromEntries(EXT_SHOPS.map((s) => [s.id, s]));
