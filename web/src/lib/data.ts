// Katalog laden (kompaktes Format), Hilfsindizes, Details & Preisverlauf bei Bedarf.
import { useSyncExternalStore } from 'react';
import type { Catalog, Category, Product, Shop } from '@shared/types';
import { unpackCatalog, type PackedCatalog } from '@shared/catalog';
import { haystack } from '@shared/search';
import { valueScore } from '@shared/quality';

export type Item = Product & { h: string; v: number };

export interface DataState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  generatedAt?: string;
  fx?: Catalog['fx'];
  shops: Shop[];
  shopById: Record<string, Shop>;
  items: Item[];
  byId: Map<string, Item>;
  catMedian: Partial<Record<Category, number>>;
  brands: { name: string; count: number }[];
  meta?: { durationS: number; failed: { id: string; error?: string }[] };
}

let state: DataState = { status: 'idle', shops: [], shopById: {}, items: [], byId: new Map(), catMedian: {}, brands: [] };
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
    set({ status: 'ready', generatedAt: cat.generatedAt, fx: cat.fx, shops: cat.shops, shopById, items, byId: new Map(items.map((p) => [p.id, p])), catMedian, brands, error: undefined });
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
