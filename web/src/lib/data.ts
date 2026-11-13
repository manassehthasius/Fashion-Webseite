// Katalog laden (kompaktes Format), Hilfsindizes, Details & Preisverlauf bei Bedarf.
import { useSyncExternalStore } from 'react';
import type { Catalog, Category, Product, Shop } from '@shared/types';
import { unpackCatalog, unpackProduct, type PackedCatalog } from '@shared/catalog';
import { deepGroupOf, type DeepIndex, type PackedDeep } from '@shared/deep';
import { haystack } from '@shared/search';
import { valueScore } from '@shared/quality';
import { packImg } from '@shared/media';
import { stripHtml } from '@shared/text';

/** dp = aus dem Gesamtsortiment (ältere Feed-Seiten, 1× täglich aktualisiert, ohne Preisverlauf) */
export type Item = Product & { h: string; v: number; dp?: 1 };

export interface DataState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  generatedAt?: string;
  fx?: Catalog['fx'];
  shops: Shop[];
  shopById: Record<string, Shop>;
  items: Item[];
  /** Hauptkatalog + geladene Teile des Gesamtsortiments */
  all: Item[];
  byId: Map<string, Item>;
  deep: DeepState;
  catMedian: Partial<Record<Category, number>>;
  brands: { name: string; count: number }[];
  meta?: { durationS: number; failed: { id: string; error?: string }[] };
}

export interface DeepState {
  index?: DeepIndex;
  loaded: string[];
  loading: string[];
  items: Item[];
}

let state: DataState = { status: 'idle', shops: [], shopById: {}, items: [], all: [], byId: new Map(), catMedian: {}, brands: [], deep: { loaded: [], loading: [], items: [] } };
const subs = new Set<() => void>();
const set = (s: Partial<DataState>) => {
  state = { ...state, ...s };
  subs.forEach((f) => f());
};

export const DATA_BASE = './data/';

export function useData(): DataState {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
  );
}

export function getData() {
  return state;
}

function median(a: number[]) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

export async function loadCatalog(force = false) {
  if (state.status === 'loading' || (state.status === 'ready' && !force)) return;
  set({ status: state.status === 'ready' ? 'ready' : 'loading' });
  try {
    const res = await fetch(`${DATA_BASE}catalog.json`, { cache: force ? 'no-cache' : 'default' });
    if (!res.ok) throw new Error(`Katalog nicht gefunden (${res.status}). Bitte zuerst "npm run update" ausführen.`);
    const raw = (await res.json()) as PackedCatalog;
    const cat = unpackCatalog(raw);
    const shopById = Object.fromEntries(cat.shops.map((s) => [s.id, s]));
    const byCat = new Map<Category, number[]>();
    for (const p of cat.products) {
      if (!byCat.has(p.cat)) byCat.set(p.cat, []);
      byCat.get(p.cat)!.push(p.tot);
    }
    const catMedian: Partial<Record<Category, number>> = {};
    for (const [c, arr] of byCat) catMedian[c] = median(arr);
    const items: Item[] = cat.products.map((p) => ({ ...p, h: haystack(p, shopById[p.s]), v: valueScore(p.q, p.tot, catMedian[p.cat] ?? p.tot) }));
    const brandCount = new Map<string, number>();
    for (const p of items) brandCount.set(p.b, (brandCount.get(p.b) ?? 0) + 1);
    const brands = [...brandCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    const mainIds = new Set(items.map((p) => p.id));
    const deepItems = state.deep.items.filter((p) => !mainIds.has(p.id));
    const all = deepItems.length ? [...items, ...deepItems] : items;
    set({ status: 'ready', generatedAt: cat.generatedAt, fx: cat.fx, shops: cat.shops, shopById, items, all, byId: new Map(all.map((p) => [p.id, p])), catMedian, brands, error: undefined, deep: { ...state.deep, items: deepItems } });
    fetch(`${DATA_BASE}meta.json`).then((r) => (r.ok ? r.json() : null)).then((m) => m && set({ meta: m })).catch(() => {});
  } catch (e) {
    set({ status: 'error', error: (e as Error).message });
  }
}

/** Prüft die kleine meta.json und lädt den Katalog nur neu, wenn es neue Daten gibt */
export async function refreshIfStale() {
  if (state.status !== 'ready') return;
  try {
    const m = await (await fetch(`${DATA_BASE}meta.json`, { cache: 'no-cache' })).json();
    if (m?.generatedAt && m.generatedAt !== state.generatedAt) {
      await loadCatalog(true);
      // Gesamtsortiment neu laden, wenn es inzwischen aktualisiert wurde
      const old = state.deep.index?.generatedAt;
      deepIndexPromise = null;
      const idx = await loadDeepIndex();
      if (idx && old && idx.generatedAt !== old && state.deep.loaded.length) {
        const groups = state.deep.loaded;
        groupPromises.clear();
        set({ all: state.items, byId: new Map(state.items.map((p) => [p.id, p])), deep: { index: idx, loaded: [], loading: [], items: [] } });
        await ensureDeep(groups);
      }
    }
  } catch {
    /* offline */
  }
}

// ---------- Details (weitere Bilder, Beschreibung) ----------
const detailCache = new Map<string, Promise<Record<string, [string[], string]>>>();
export function loadDetails(shopId: string) {
  if (!detailCache.has(shopId)) {
    detailCache.set(
      shopId,
      fetch(`${DATA_BASE}details/${shopId}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    );
  }
  return detailCache.get(shopId)!;
}

// ---------- Preisverlauf ----------
let historyPromise: Promise<Record<string, [number, number, number][]>> | null = null;
export function loadHistory() {
  historyPromise ??= fetch(`${DATA_BASE}history.json`)
    .then((r) => (r.ok ? r.json() : { h: {} }))
    .then((j) => j.h ?? {})
    .catch(() => ({}));
  return historyPromise;
}

// ---------- Gesamtsortiment (bei Bedarf, nach Kategorie-Gruppen) ----------
let deepIndexPromise: Promise<DeepIndex | null> | null = null;
export function loadDeepIndex(): Promise<DeepIndex | null> {
  deepIndexPromise ??= fetch(`${DATA_BASE}deep/index.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? (r.json() as Promise<DeepIndex>) : null))
    .then((idx) => {
      if (idx) set({ deep: { ...state.deep, index: idx } });
      return idx;
    })
    .catch(() => null);
  return deepIndexPromise;
}

const groupPromises = new Map<string, Promise<void>>();

async function loadGroup(g: string, idx: DeepIndex): Promise<void> {
  if (state.deep.loaded.includes(g) || !idx.groups[g]) return;
  set({ deep: { ...state.deep, loading: [...state.deep.loading, g] } });
  try {
    const r = await fetch(`${DATA_BASE}deep/${g}.json?v=${encodeURIComponent(idx.generatedAt)}`);
    if (!r.ok) throw new Error(String(r.status));
    const packed = (await r.json()) as PackedDeep;
    const { shopById, fx, catMedian, byId } = state;
    const add: Item[] = [];
    if (fx) {
      for (const row of packed.rows) {
        const p = unpackProduct(row, shopById, fx);
        if (!p || byId.has(p.id)) continue;
        add.push({ ...p, h: haystack(p, shopById[p.s]), v: valueScore(p.q, p.tot, catMedian[p.cat] ?? p.tot), dp: 1 });
      }
    }
    const items = [...state.deep.items, ...add];
    const all = [...state.items, ...items];
    const map = new Map(state.byId);
    for (const p of add) map.set(p.id, p);
    set({ all, byId: map, deep: { ...state.deep, items, loaded: [...state.deep.loaded, g], loading: state.deep.loading.filter((x) => x !== g) } });
  } catch {
    set({ deep: { ...state.deep, loading: state.deep.loading.filter((x) => x !== g) } });
    groupPromises.delete(g);
  }
}

/** Lädt die Gruppen des Gesamtsortiments nacheinander (kleinste zuerst) */
export async function ensureDeep(groups: string[]): Promise<void> {
  if (state.status !== 'ready') return;
  const idx = await loadDeepIndex();
  if (!idx) return;
  const todo = groups.filter((g) => idx.groups[g] && !state.deep.loaded.includes(g)).sort((a, b) => idx.groups[a].n - idx.groups[b].n);
  for (const g of todo) {
    if (!groupPromises.has(g)) groupPromises.set(g, loadGroup(g, idx));
    await groupPromises.get(g);
  }
}

// Teile aus dem Gesamtsortiment merken (Favoriten, Watchlist, zuletzt angesehen), damit sie nach dem Neuladen
// gezielt wieder gefunden werden, ohne alles zu laden.
const REF_KEY = 'stilkompass.deepRefs';
function readRefs(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(REF_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}
export function rememberDeep(p: Pick<Item, 'id' | 'cat' | 'dp'>) {
  if (!p.dp) return;
  try {
    const refs = readRefs();
    if (refs[p.id]) return;
    refs[p.id] = deepGroupOf(p.cat);
    const keys = Object.keys(refs);
    if (keys.length > 400) for (const k of keys.slice(0, keys.length - 400)) delete refs[k];
    localStorage.setItem(REF_KEY, JSON.stringify(refs));
  } catch {
    /* Speicher nicht verfügbar */
  }
}
/** Lädt die Gruppen, in denen gemerkte, aber noch nicht geladene Teile liegen */
export function ensureDeepFor(ids: string[]) {
  if (state.status !== 'ready') return;
  const refs = readRefs();
  const groups = [...new Set(ids.filter((id) => !state.byId.has(id) && refs[id]).map((id) => refs[id]))];
  if (groups.length) void ensureDeep(groups);
}

/** Details (Bilder, Beschreibung) für Teile aus dem Gesamtsortiment direkt beim Shop (öffentliches Produkt-JSON) */
const liveDetailCache = new Map<string, Promise<[string[], string]>>();
export function loadLiveDetails(p: Pick<Item, 'id' | 'u'>, shop: Shop): Promise<[string[], string]> {
  if (!liveDetailCache.has(p.id)) {
    liveDetailCache.set(
      p.id,
      fetch(`https://${shop.domain}/products/${encodeURIComponent(p.u)}.json`, { credentials: 'omit', referrerPolicy: 'no-referrer' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { product?: { images?: { src: string }[]; body_html?: string } } | null) => {
          const imgs = (j?.product?.images ?? []).slice(1, 5).map((i) => packImg(i.src, shop.domain));
          const d = stripHtml(j?.product?.body_html ?? '');
          return [imgs, d.length > 700 ? d.slice(0, 697) + '…' : d] as [string[], string];
        })
        .catch(() => [[], ''] as [string[], string]),
    );
  }
  return liveDetailCache.get(p.id)!;
}
