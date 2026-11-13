// Zusammenführen: Preise (CHF, Gesamtpreis), Qualität, Verlauf, Preissenkungen.
import type { FxRates, Product, Shop } from '../shared/types';
import { landedCost } from '../shared/pricing';
import { qualityScore } from '../shared/quality';
import type { EngineState, History, HistoryPoint } from './store';
import type { NormProduct } from './normalize';

const DAY = 86400;

export function enrich(n: NormProduct, shop: Shop, fx: FxRates, state: EngineState, history: History, now: number): Product {
  const cost = landedCost(n.p, shop, fx, { compareAt: n.pc });
  const q = qualityScore({ cat: n.cat, mat: n.mat, fx: n.fx, b: n.b, seg: n.seg, cond: n.cond }, shop);
  const prev = state.products[n.id];
  const tot = cost.total;
  const changed = !prev || Math.abs(prev.tot - tot) >= 0.05 || prev.av !== n.av;
  const upd = changed ? now : prev.upd;
  const first = prev?.first ?? now;

  // Verlauf
  const h = (history.h[n.id] ??= []);
  const minute = Math.floor(now / 60);
  const last = h[h.length - 1];
  if (!last || Math.abs(last[1] - tot) >= 0.05 || last[2] !== (n.av ? 1 : 0)) h.push([minute, tot, n.av ? 1 : 0]);
  const cutoff = minute - 120 * 24 * 60;
  while (h.length > 2 && h[0][0] < cutoff) h.shift();
  if (h.length > 80) h.splice(1, h.length - 80);

  const recent = h.filter((x) => x[0] >= minute - 90 * 24 * 60).map((x) => x[1]);
  const low = Math.min(...recent, tot);
  const drop = dropPct(h, minute);

  const { published: _p, ...rest } = n;
  void _p;
  const out: Product = {
    ...rest,
    chf: cost.item,
    chfWas: cost.itemWas,
    tot,
    q: q.score,
    qc: q.confidence,
    first,
    upd,
  };
  if (low < tot - 0.05) out.low = low;
  if (drop) out.drop = drop;
  state.products[n.id] = { first, seen: now, tot, av: n.av, sz: n.sz, upd };
  return out;
}

/** Preissenkung in % gegenüber dem vorherigen Preis, wenn die Senkung in den letzten 14 Tagen war */
export function dropPct(h: HistoryPoint[], nowMinute: number): number | undefined {
  if (h.length < 2) return undefined;
  const cur = h[h.length - 1];
  // letzter Punkt mit anderem Preis
  for (let i = h.length - 2; i >= 0; i--) {
    if (Math.abs(h[i][1] - cur[1]) >= 0.05) {
      if (cur[1] < h[i][1] && nowMinute - cur[0] <= 14 * 24 * 60) {
        const pct = Math.round((1 - cur[1] / h[i][1]) * 100);
        return pct >= 3 ? pct : undefined;
      }
      return undefined;
    }
  }
  return undefined;
}

/** Entfernt Verlauf von Produkten, die seit über 30 Tagen nicht mehr gesehen wurden */
export function pruneState(state: EngineState, history: History, now: number) {
  for (const [id, ps] of Object.entries(state.products)) {
    if (now - ps.seen > 30 * DAY) {
      delete state.products[id];
      delete history.h[id];
    }
  }
}
