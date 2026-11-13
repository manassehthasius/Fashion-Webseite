// Hash-Router (funktioniert auf GitHub Pages ohne Server-Konfiguration).
import { useSyncExternalStore } from 'react';

export interface Route {
  path: string;
  params: URLSearchParams;
}

function parse(): Route {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  return { path: path || '/', params: new URLSearchParams(qs ?? '') };
}

let current = parse();
const subs = new Set<() => void>();
window.addEventListener('hashchange', () => {
  const prevPath = current.path;
  current = parse();
  subs.forEach((f) => f());
  if (prevPath !== current.path) window.scrollTo({ top: 0 });
});

export function useRoute(): Route {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => current,
  );
}

export function href(path: string, params?: Record<string, string | number | undefined | null | false>): string {
  const sp = new URLSearchParams();
  if (params) for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== false) sp.set(k, String(v));
  const qs = sp.toString();
  return `#${path}${qs ? '?' + qs : ''}`;
}

export function navigate(path: string, params?: Record<string, string | number | undefined | null | false>, replace = false) {
  const h = href(path, params);
  if (replace) history.replaceState(null, '', h);
  else history.pushState(null, '', h);
  current = parse();
  subs.forEach((f) => f());
}

/** Einzelnen Parameter auf der aktuellen Route setzen (z. B. Produktdetail ?p=) */
export function setParam(key: string, value: string | null, replace = false) {
  const r = parse();
  if (value === null) r.params.delete(key);
  else r.params.set(key, value);
  const qs = r.params.toString();
  const h = `#${r.path}${qs ? '?' + qs : ''}`;
  if (replace) history.replaceState(null, '', h);
  else history.pushState(null, '', h);
  current = parse();
  subs.forEach((f) => f());
}

export function setParams(updates: Record<string, string | null>, replace = true) {
  const r = parse();
  for (const [k, v] of Object.entries(updates)) {
    if (v === null || v === '') r.params.delete(k);
    else r.params.set(k, v);
  }
  const qs = r.params.toString();
  const h = `#${r.path}${qs ? '?' + qs : ''}`;
  if (replace) history.replaceState(null, '', h);
  else history.pushState(null, '', h);
  current = parse();
  subs.forEach((f) => f());
}
