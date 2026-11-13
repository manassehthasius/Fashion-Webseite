// In-App-Alarme: vergleicht Watchlist & gespeicherte Suchen mit dem aktuellen Katalog (läuft im Browser).
// Hintergrund-Benachrichtigungen bei geschlossener Seite übernimmt die Engine (siehe engine/alerts.ts).
import { useEffect, useMemo } from 'react';
import type { SavedSearch, WatchItem } from '@shared/types';
import { matchesSearch } from '@shared/search';
import { ensureDeepFor, useData, type Item } from './data';
import { useUser } from './store';

export interface TriggeredWatch {
  w: WatchItem;
  p?: Item;
  reasons: ('target' | 'drop' | 'stock' | 'gone')[];
  diff: number;
}

export function evaluateWatch(w: WatchItem, p: Item | undefined): TriggeredWatch {
  const reasons: TriggeredWatch['reasons'] = [];
  if (!p) return { w, p, reasons: ['gone'], diff: 0 };
  const diff = p.tot - w.priceAtAdd;
  if (w.target && p.tot <= w.target && p.av) reasons.push('target');
  if (w.notifyDrop && diff <= -Math.max(1, w.priceAtAdd * 0.03)) reasons.push('drop');
  // "Wieder verfügbar": Grösse war beim Speichern ausverkauft und ist jetzt da
  if (w.notifyStock && w.size && w.sizeAvailAtAdd === false && p.sz.includes(w.size)) reasons.push('stock');
  return { w, p, reasons, diff };
}

export function newMatchesFor(s: SavedSearch, items: Item[], shopById: Record<string, import('@shared/types').Shop>): Item[] {
  const since = s.createdAt / 1000;
  return items.filter((p) => p.first > since && matchesSearch(p, s.query, s.filters, shopById[p.s], s.segment));
}

export function useWatchStatus(): TriggeredWatch[] {
  const user = useUser();
  const data = useData();
  useEffect(() => {
    if (data.status === 'ready') ensureDeepFor(user.watch.map((w) => w.id));
  }, [data.status, user.watch]);
  return useMemo(() => user.watch.map((w) => evaluateWatch(w, data.byId.get(w.id))), [user.watch, data.byId]);
}

export function useAlertCount(): number {
  const status = useWatchStatus();
  return status.filter((s) => s.reasons.some((r) => r === 'target' || r === 'drop' || r === 'stock')).length;
}
