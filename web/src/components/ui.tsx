// Kleine UI-Bausteine: Toast, Sheet/Drawer, Schalter, Qualitäts-Pill.
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Icon } from './Icon';
import { qualityColor } from '../lib/format';

// ---------- Toast ----------
let toastMsg: { text: string; id: number } | null = null;
const tsubs = new Set<() => void>();
export function toast(text: string) {
  toastMsg = { text, id: Date.now() };
  tsubs.forEach((f) => f());
  const id = toastMsg.id;
  setTimeout(() => {
    if (toastMsg?.id === id) {
      toastMsg = null;
      tsubs.forEach((f) => f());
    }
  }, 2600);
}
export function Toaster() {
  const t = useSyncExternalStore(
    (f) => {
      tsubs.add(f);
      return () => tsubs.delete(f);
    },
    () => toastMsg,
  );
  return t ? (
    <div className="toast" role="status" aria-live="polite">
      {t.text}
    </div>
  ) : null;
}

// ---------- Responsive Panel: Drawer (Desktop) / Sheet (Mobil) ----------
export function useIsDesktop(min = 900) {
  const [d, setD] = useState(() => window.matchMedia(`(min-width: ${min}px)`).matches);
  useEffect(() => {
    const m = window.matchMedia(`(min-width: ${min}px)`);
    const f = () => setD(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [min]);
  return d;
}

export function Panel({ open, onClose, title, children, side = 'right', footer }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; side?: 'right' | 'bottom'; footer?: ReactNode }) {
  const desktop = useIsDesktop();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  const asSheet = side === 'bottom' || !desktop;
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className={asSheet ? 'sheet' : 'drawer'} role="dialog" aria-modal="true" style={asSheet && side === 'right' ? { maxHeight: '94dvh', height: '94dvh' } : undefined}>
        {asSheet && <div className="grip" />}
        <div className="drawer-head">
          <div style={{ fontWeight: 650, fontSize: 15, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Schliessen">
            <Icon name="close" />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>{footer}</div>}
      </div>
    </>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="switch" aria-label={label}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

export function QualityPill({ q, qc, showLabel = false }: { q: number; qc: number; showLabel?: boolean }) {
  const est = qc < 0.5;
  return (
    <span className={`qpill${est ? ' est' : ''}`} title={est ? 'Qualitätsscore – Schätzung (wenig Produktdaten)' : 'Qualitätsscore aus Produktdaten'}>
      <i style={{ background: qualityColor(q) }} />
      {showLabel ? 'Qualität ' : 'Q '}
      {q}
    </span>
  );
}

export function QualityRing({ q }: { q: number }) {
  return (
    <div className="qring" style={{ ['--p' as string]: q, ['--qc' as string]: qualityColor(q) }}>
      <span>{q}</span>
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <div style={{ maxWidth: 480 }}>{children}</div>}
      {action}
    </div>
  );
}

export function Loading({ label = 'Lade Produkte …' }: { label?: string }) {
  return (
    <div className="empty">
      <div className="spinner" />
      <div className="small muted">{label}</div>
    </div>
  );
}
