import { chf, dateShort } from '../lib/format';

/** Preisverlauf als schlichtes SVG (Treppenlinie) */
export function PriceChart({ points, current }: { points: [number, number, number][]; current: number }) {
  const now = Math.floor(Date.now() / 60000);
  const pts = points.length ? [...points, [now, current, 1] as [number, number, number]] : [[now - 60 * 24, current, 1], [now, current, 1]] as [number, number, number][];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const pad = (hi - lo) * 0.15 || hi * 0.05 || 1;
  const W = 560, H = 120, L = 4, R = 4, T = 10, B = 18;
  const sx = (x: number) => L + ((x - x0) / Math.max(1, x1 - x0)) * (W - L - R);
  const sy = (y: number) => T + (1 - (y - (lo - pad)) / (hi + pad - (lo - pad))) * (H - T - B);
  let d = '';
  pts.forEach((p, i) => {
    if (i === 0) d += `M${sx(p[0])},${sy(p[1])}`;
    else d += `H${sx(p[0])}V${sy(p[1])}`;
  });
  const area = `${d}V${H - B}H${sx(pts[0][0])}Z`;
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Preisverlauf">
        <path d={area} fill="var(--surface-2)" />
        <path d={d} fill="none" stroke="var(--ink)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <line x1={L} x2={W - R} y1={sy(lo)} y2={sy(lo)} stroke="var(--good)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
        <text x={L} y={H - 4} fontSize="11" fill="var(--ink-3)">{dateShort(x0 * 60)}</text>
        <text x={W - R} y={H - 4} fontSize="11" fill="var(--ink-3)" textAnchor="end">heute</text>
      </svg>
      <div className="row small muted" style={{ justifyContent: 'space-between' }}>
        <span>Tiefst: <b className="num" style={{ color: 'var(--good)' }}>{chf(lo)}</b></span>
        <span>Höchst: <b className="num">{chf(hi)}</b></span>
        <span>{points.length <= 1 ? 'Verlauf wird ab jetzt aufgezeichnet' : `${points.length} Preispunkte`}</span>
      </div>
    </div>
  );
}
