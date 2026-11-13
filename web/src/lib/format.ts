export function chf(n: number | undefined, opts: { decimals?: boolean } = {}): string {
  if (n === undefined || !Number.isFinite(n)) return '–';
  const decimals = opts.decimals ?? true;
  const v = decimals ? n.toFixed(2) : Math.round(n).toString();
  const [i, d] = v.split('.');
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, '’');
  return `CHF ${int}${d !== undefined ? '.' + d : '.–'}`;
}

export function money(n: number, cur: string): string {
  return `${cur} ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '’')}`;
}

export function pct(n: number): string {
  return `${Math.round(n)} %`;
}

export function ago(unixSec: number): string {
  const s = Math.max(0, Date.now() / 1000 - unixSec);
  if (s < 90) return 'gerade eben';
  if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.round(s / 3600)} Std.`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'gestern' : `vor ${d} Tagen`;
}

export function dateShort(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function days([a, b]: [number, number]): string {
  return a === b ? `${a} Werktage` : `${a}–${b} Werktage`;
}

export function qualityColor(q: number): string {
  if (q >= 80) return 'var(--good)';
  if (q >= 65) return '#5e7f4a';
  if (q >= 50) return 'var(--warn)';
  return 'var(--bad)';
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
