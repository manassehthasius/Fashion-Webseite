// Gemeinsame Typen für Engine (Node) und Web-App (Browser).

export type Segment = 'new' | 'secondhand';
export type Gender = 'men' | 'women' | 'unisex' | 'kids';

export type Category =
  | 'tshirt' | 'top' | 'shirt' | 'polo' | 'knit' | 'sweat'
  | 'jacket' | 'coat' | 'blazer' | 'suit' | 'vest'
  | 'trousers' | 'jeans' | 'shorts' | 'dress' | 'skirt' | 'jumpsuit'
  | 'shoes' | 'boots' | 'sneakers' | 'sandals'
  | 'bag' | 'accessory' | 'underwear' | 'socks' | 'swim' | 'other';

export type Style =
  | 'minimal' | 'classic' | 'smart' | 'casual' | 'streetwear' | 'workwear'
  | 'outdoor' | 'sporty' | 'preppy' | 'elegant' | 'vintage' | 'boho' | 'avantgarde';

export type Condition = 'new' | 'nwt' | 'excellent' | 'very_good' | 'good' | 'fair';

export type DutyMode = 'domestic' | 'ddp' | 'dap';

export interface ShopShipping {
  /** Währung der Beträge unten */
  currency: string;
  /** Standardversand in die Schweiz */
  cost: number;
  /** Gratisversand ab Bestellwert (gleiche Währung) */
  freeFrom?: number;
  /** Lieferzeit in Werktagen */
  days: [number, number];
  /** true = aus den Versandbedingungen des Shops übernommen; false = Schätzung */
  verified: boolean;
  note?: string;
  /** Wer die Sendung verzollt: Post (Standard) oder Kurier (DHL/UPS/FedEx, oft teurer) */
  carrier?: 'post' | 'courier';
}

export interface Shop {
  id: string;
  name: string;
  domain: string;
  country: string; // ISO-2 Sitz/Versandland
  currency: string; // Basiswährung des Feeds
  segment: Segment;
  /** domestic = Schweizer Shop, ddp = Zoll/MWST bezahlt, dap = Empfänger zahlt MWST + Verzollung */
  duty: DutyMode;
  /** MWST-Satz, der im Feed-Preis enthalten ist (z. B. DE 0.19). 0 = netto (z. B. USA) */
  homeVat: number;
  /** true = Shop zieht Heimat-MWST für Schweizer Kunden ab (Annahme bei EU/UK-Shops) */
  exportVatRemoved: boolean;
  shipping: ShopShipping;
  /** Kuratierte Qualitätsreputation der Marke/des Shops 1–5 */
  tier: number;
  styles: Style[];
  /** Hauptzielgruppe, falls Produkte kein Geschlecht angeben */
  gender?: Gender;
  /** Multi-Brand-Shop: Marke aus vendor/Titel lesen */
  multiBrand?: boolean;
  certifications?: string[];
  perks?: string[];
  /** Max. Feed-Seiten (à 250 Produkte) pro Lauf */
  maxPages?: number;
  /** Max. Produkte im Katalog */
  cap?: number;
  /** Nur Produkte, deren product_type/Tags eines dieser Wörter enthalten */
  onlyTypes?: string[];
  note?: string;
  /** Laufzeit: Schweizer Shopify-Markt mit CHF-Preisen (von der Engine erkannt) */
  market?: ShopMarket | null;
  /** Laufzeit: letzter Abruf */
  health?: { ok: boolean; at: string; products: number; error?: string };
}

export interface ShopMarket {
  prefix: string; // z. B. "/de-ch"
  /** Median CH-Preis / (Basispreis × Kurs): ≥ 0.95 → Steuern inklusive */
  ratio: number;
  mode: 'ddp' | 'dap';
  checkedAt: string;
}

export interface Material {
  k: string; // Materialschlüssel
  pct?: number;
}

/** Kompakter Katalogeintrag (Schlüssel bewusst kurz für kleine JSON-Dateien) */
export interface Product {
  id: string; // `${shop}:${shopifyId}`
  s: string; // Shop-ID
  seg: Segment;
  t: string; // Titel
  b: string; // Marke
  u: string; // Produkt-Handle (URL via shared/media.productUrl)
  img: string; // Hauptbild
  imgs?: string[]; // weitere Bilder
  p: number; // Preis in Feed-Währung
  pc?: number; // Streichpreis in Feed-Währung
  cur: string;
  chf: number; // Artikelpreis CHF (umgerechnet, ggf. ohne Heimat-MWST)
  chfWas?: number; // Streichpreis CHF
  tot: number; // Gesamtpreis CHF bei Einzelbestellung (Versand, MWST, Verzollung)
  cat: Category;
  g: Gender;
  col: string[];
  mat: Material[];
  fx: string[]; // Qualitätsmerkmale (Codes)
  sz: string[]; // verfügbare Grössen
  sza: string[]; // alle Grössen
  av: boolean; // irgendeine Variante verfügbar
  q: number; // Qualitätsscore 0–100
  qc: number; // Datenabdeckung 0–1 (≥ 0.5 = belastbar, sonst Schätzung)
  st: Style[];
  cond?: Condition;
  era?: string;
  fit?: string;
  d?: string; // Kurzbeschreibung
  kw?: string; // Suchwörter (Tags/Typ)
  first: number; // zuerst gesehen (Unix s)
  upd: number; // letzte Preis-/Verfügbarkeitsänderung (Unix s)
  low?: number; // tiefster Gesamtpreis der letzten 90 Tage
  drop?: number; // Preissenkung in % seit letzter Änderung
}

export interface Catalog {
  v: number;
  generatedAt: string;
  fx: FxRates;
  shops: Shop[];
  products: Product[];
}

export interface FxRates {
  /** CHF pro 1 Einheit Fremdwährung */
  toCHF: Record<string, number>;
  source: 'shopify' | 'static';
  date: string;
}

export interface PriceBreakdown {
  item: number; // Artikel CHF
  itemWas?: number;
  discountPct?: number;
  shipping: number;
  shippingFree: boolean;
  vat: number; // Schweizer Einfuhr-MWST
  clearance: number; // Verzollungsgebühr Post/Kurier
  duty: number; // Zoll (seit 2024 auf Kleidung 0)
  total: number;
  days: [number, number];
  estimated: boolean;
  notes: string[];
}

export interface QualityPart {
  key: string;
  label: string;
  points: number;
  max: number;
  source: 'data' | 'estimate' | 'curated';
  detail: string;
}

export interface QualityResult {
  score: number;
  confidence: number;
  parts: QualityPart[];
  estimated: boolean;
}

// ---- Nutzerzustand (Favoriten, Watchlist, Profil) ----

export interface WatchItem {
  id: string; // Produkt-ID
  addedAt: number;
  priceAtAdd: number; // Gesamtpreis CHF beim Hinzufügen
  target?: number; // Wunschpreis CHF
  size?: string; // gewünschte Grösse (für "wieder verfügbar")
  sizeAvailAtAdd?: boolean; // war die Grösse beim Speichern verfügbar?
  notifyDrop: boolean;
  notifyStock: boolean;
  snapshot?: Pick<Product, 't' | 'b' | 'img' | 'u' | 's' | 'seg'>;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFilters;
  segment: Segment | 'all';
  notifyNew: boolean;
  createdAt: number;
  lastSeenIds?: string[];
}

export interface SearchFilters {
  categories?: Category[];
  genders?: Gender[];
  brands?: string[];
  colors?: string[];
  materials?: string[];
  styles?: Style[];
  sizes?: string[];
  shops?: string[];
  conditions?: Condition[];
  minPrice?: number;
  maxPrice?: number;
  minQuality?: number;
  freeShipping?: boolean;
  noImportFees?: boolean;
  maxDays?: number;
  onSale?: boolean;
  onlyAvailable?: boolean;
}

export interface StyleProfile {
  genders: Gender[];
  styles: Style[];
  brands: string[];
  avoidBrands: string[];
  colors: string[];
  avoidColors: string[];
  materials: string[];
  avoidMaterials: string[];
  fits: string[];
  sizes: Partial<Record<'top' | 'bottom' | 'shoes' | 'waist', string[]>>;
  budget: Partial<Record<Category | 'default', number>>;
  minQuality: number;
  priority: 'quality' | 'balanced' | 'price';
}

export interface UserState {
  v: number;
  updatedAt: number;
  favorites: string[];
  favSnapshots?: Record<string, Pick<Product, 't' | 'b' | 'img' | 'u' | 's' | 'seg' | 'tot'>>;
  watch: WatchItem[];
  searches: SavedSearch[];
  profile: StyleProfile;
  push?: PushSubscriptionJSONLike[];
  /** Automatisch gelernte Interessen (siehe shared/interests.ts) */
  interests?: import('./interests').Interests;
}

export interface PushSubscriptionJSONLike {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}

export interface AlertEvent {
  key: string;
  type: 'drop' | 'target' | 'stock' | 'new';
  productId: string;
  title: string;
  body: string;
  url: string;
  img?: string;
  at: number;
}
