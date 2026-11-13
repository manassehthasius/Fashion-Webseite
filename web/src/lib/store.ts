// Nutzerzustand: Favoriten, Watchlist, gespeicherte Suchen, Style-Profil – dauerhaft im Browser (+ optionale Synchronisierung).
import { useSyncExternalStore } from 'react';
import type { Product, SavedSearch, SearchFilters, StyleProfile, UserState, WatchItem } from '@shared/types';
import { DEFAULT_PROFILE } from '@shared/personalize';
import { uid } from './format';
import { emptyInterests, learnImage, learnProduct, learnSearch, SIGNAL, type Dim, type Interests } from '@shared/interests';

const KEY = 'stilkompass:user:v1';
const COMPARE_KEY = 'stilkompass:compare:v1';

function initial(): UserState {
  return { v: 1, updatedAt: 0, favorites: [], favSnapshots: {}, watch: [], searches: [], profile: { ...DEFAULT_PROFILE } };
}

function load(): UserState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial();
    const s = JSON.parse(raw) as UserState;
    return { ...initial(), ...s, profile: { ...DEFAULT_PROFILE, ...s.profile } };
  } catch {
    return initial();
  }
}

let state: UserState = load();
const subs = new Set<() => void>();
const changeListeners = new Set<(s: UserState) => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* Speicher voll oder privat */
  }
}

export function getUser(): UserState {
  return state;
}

export function setUser(next: UserState, opts: { silent?: boolean } = {}) {
  state = next;
  persist();
  subs.forEach((f) => f());
  if (!opts.silent) changeListeners.forEach((f) => f(state));
}

function update(fn: (s: UserState) => UserState) {
  setUser({ ...fn(state), updatedAt: Date.now() });
}

export function onUserChange(f: (s: UserState) => void) {
  changeListeners.add(f);
  return () => changeListeners.delete(f);
}

export function useUser(): UserState {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
  );
}

const snap = (p: Product) => ({ t: p.t, b: p.b, img: p.img, u: p.u, s: p.s, seg: p.seg, tot: p.tot });

// ---------- Favoriten ----------
export function isFavorite(id: string) {
  return state.favorites.includes(id);
}
export function toggleFavorite(p: Product): boolean {
  const on = !state.favorites.includes(p.id);
  learn((i) => learnProduct(i, p, on ? SIGNAL.favorite : SIGNAL.unfavorite));
  update((s) => ({
    ...s,
    favorites: on ? [p.id, ...s.favorites] : s.favorites.filter((x) => x !== p.id),
    favSnapshots: on ? { ...s.favSnapshots, [p.id]: snap(p) } : Object.fromEntries(Object.entries(s.favSnapshots ?? {}).filter(([k]) => k !== p.id)),
  }));
  return on;
}

// ---------- Watchlist / Preisalarme ----------
export function getWatch(id: string): WatchItem | undefined {
  return state.watch.find((w) => w.id === id);
}
export function upsertWatch(p: Product, opts: Partial<Pick<WatchItem, 'target' | 'size' | 'notifyDrop' | 'notifyStock'>>) {
  if (!state.watch.some((w) => w.id === p.id)) learn((i) => learnProduct(i, p, SIGNAL.watch));
  update((s) => {
    const existing = s.watch.find((w) => w.id === p.id);
    const item: WatchItem = {
      id: p.id,
      addedAt: existing?.addedAt ?? Date.now(),
      priceAtAdd: existing?.priceAtAdd ?? p.tot,
      notifyDrop: opts.notifyDrop ?? existing?.notifyDrop ?? true,
      notifyStock: opts.notifyStock ?? existing?.notifyStock ?? true,
      target: 'target' in opts ? opts.target : existing?.target,
      size: 'size' in opts ? opts.size : existing?.size,
      sizeAvailAtAdd: (() => {
        const sz = 'size' in opts ? opts.size : existing?.size;
        return sz ? p.sz.includes(sz) : undefined;
      })(),
      snapshot: { t: p.t, b: p.b, img: p.img, u: p.u, s: p.s, seg: p.seg },
    };
    return { ...s, watch: existing ? s.watch.map((w) => (w.id === p.id ? item : w)) : [item, ...s.watch] };
  });
}
export function removeWatch(id: string) {
  update((s) => ({ ...s, watch: s.watch.filter((w) => w.id !== id) }));
}

// ---------- Gespeicherte Suchen ----------
export function saveSearch(name: string, query: string, filters: SearchFilters, segment: SavedSearch['segment'], notifyNew = true): SavedSearch {
  const s: SavedSearch = { id: uid(), name: name || query || 'Meine Suche', query, filters, segment, notifyNew, createdAt: Date.now() };
  update((st) => ({ ...st, searches: [s, ...st.searches] }));
  return s;
}
export function updateSearch(id: string, patch: Partial<SavedSearch>) {
  update((st) => ({ ...st, searches: st.searches.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
}
export function removeSearch(id: string) {
  update((st) => ({ ...st, searches: st.searches.filter((x) => x.id !== id) }));
}

// ---------- Profil ----------
export function updateProfile(patch: Partial<StyleProfile>) {
  update((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
}

// ---------- Push-Abos ----------
export function setPushSubscriptions(subs: UserState['push']) {
  update((s) => ({ ...s, push: subs }));
}

// ---------- Export / Import ----------
export function exportState(): string {
  return JSON.stringify(state, null, 2);
}
export function importState(json: string) {
  const s = JSON.parse(json) as UserState;
  if (!s || typeof s !== 'object' || !Array.isArray(s.favorites)) throw new Error('Ungültige Datei');
  setUser({ ...initial(), ...s, profile: { ...DEFAULT_PROFILE, ...s.profile }, updatedAt: Date.now() });
}

// ---------- Vergleichsliste (nur lokal) ----------
let compare: string[] = (() => {
  try {
    return JSON.parse(localStorage.getItem(COMPARE_KEY) ?? '[]');
  } catch {
    return [];
  }
})();
const csubs = new Set<() => void>();
export function useCompare(): string[] {
  return useSyncExternalStore(
    (f) => {
      csubs.add(f);
      return () => csubs.delete(f);
    },
    () => compare,
  );
}
export function toggleCompare(id: string): boolean {
  const on = !compare.includes(id);
  compare = on ? [...compare, id].slice(-6) : compare.filter((x) => x !== id);
  try {
    localStorage.setItem(COMPARE_KEY, JSON.stringify(compare));
  } catch {
    /* ignore */
  }
  csubs.forEach((f) => f());
  return on;
}
export function clearCompare() {
  compare = [];
  try {
    localStorage.setItem(COMPARE_KEY, '[]');
  } catch {
    /* ignore */
  }
  csubs.forEach((f) => f());
}

// ---------- Gelernte Interessen ----------
export function getInterests(): Interests {
  return state.interests ?? emptyInterests();
}
/** Interessen still aktualisieren (löst keine sofortige Synchronisierung aus) */
function learn(fn: (i: Interests) => Interests) {
  const cur = state.interests ?? emptyInterests();
  if (!cur.on) return;
  state = { ...state, interests: fn(cur) };
  persist();
  subs.forEach((f) => f());
}
export function recordView(p: Product) {
  if (state.interests?.seen?.[0] === p.id) return;
  learn((i) => learnProduct(i, p, SIGNAL.view));
}
export function recordClick(p: Product) {
  learn((i) => learnProduct(i, p, SIGNAL.click));
}
let lastSearch = '';
export function recordSearch(q: string, f: SearchFilters) {
  if (!q || q === lastSearch) return;
  lastSearch = q;
  learn((i) => learnSearch(i, f));
}
export function recordImage(vec: Float32Array, attrs: Parameters<typeof learnImage>[2], label?: string) {
  learn((i) => learnImage(i, vec, attrs, label));
}
export function setLearning(on: boolean) {
  update((s) => ({ ...s, interests: { ...(s.interests ?? emptyInterests()), on } }));
}
export function muteInterest(dim: Dim, key: string) {
  update((s) => {
    const i = s.interests ?? emptyInterests();
    return { ...s, interests: { ...i, muted: [...new Set([...i.muted, `${dim}:${key}`])] } };
  });
}
export function removeImageInterest(at: number) {
  update((s) => {
    const i = s.interests ?? emptyInterests();
    return { ...s, interests: { ...i, img: i.img.filter((x) => x.at !== at) } };
  });
}
export function resetInterests() {
  update((s) => ({ ...s, interests: { ...emptyInterests(), on: s.interests?.on ?? true } }));
}
