import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { SearchFilters } from '@shared/types';
import { CATEGORY_LABELS, COLOR_BY_KEY, CONDITION_LABELS, MATERIAL_BY_KEY, STYLE_LABELS } from '@shared/taxonomy';
import { platformLinks } from '@shared/platforms';
import { isPersonalized } from '@shared/personalize';
import { useData } from '../lib/data';
import { activeFilterCount, filtersFromParams, filtersToParams, runQuery, SORT_LABELS, type Sort } from '../lib/query';
import { setParams, useRoute } from '../lib/router';
import { recordSearch, saveSearch, useUser } from '../lib/store';
import { Filters } from '../components/Filters';
import { ProductCompareBox } from '../components/ProductCompareBox';
import { ProductGrid } from '../components/ProductGrid';
import { SearchBar } from '../components/SearchBar';
import { Icon } from '../components/Icon';
import { Empty, Loading, Panel, Switch, toast } from '../components/ui';

const TITLES = {
  new: ['Neue Kleidung', 'Qualitätsmarken mit Lieferung in die Schweiz – sortiert nach echtem Gesamtpreis inklusive Versand und Importkosten.'],
  secondhand: ['Secondhand & Vintage', 'Geprüfte Secondhand-, Vintage- und Designer-Resale-Shops mit Lieferung in die Schweiz, dazu Direktsuche auf Ricardo, tutti, Vestiaire & Co.'],
  all: ['Suche', 'Neue Kleidung und Secondhand in einer Ansicht.'],
} as const;

const GENDER_LABEL: Record<string, string> = { women: 'Damen', men: 'Herren', unisex: 'Unisex', kids: 'Kinder' };

export function Shop({ segment }: { segment: 'new' | 'secondhand' | 'all' }) {
  const data = useData();
  const user = useUser();
  const route = useRoute();
  const q = route.params.get('q') ?? '';
  const sort = (route.params.get('sort') as Sort) || 'relevance';
  const canPersonalize = isPersonalized(user.profile, user.interests);
  const personalize = route.params.get('me') !== '0' && canPersonalize;
  // Schlüssel ohne Produktdetail-Parameter (?p=), damit das Öffnen eines Produkts keine neue Suche auslöst
  const paramKey = [...route.params.entries()].filter(([k]) => k !== 'p').map(([k, v]) => `${k}=${v}`).join('&');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filters = useMemo(() => filtersFromParams(route.params), [paramKey]);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  // Interessen pro Suche einfrieren, damit die Liste beim Ansehen von Produkten nicht umsortiert wird
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const interests = useMemo(() => (personalize ? user.interests : undefined), [paramKey, segment, personalize]);
  const input = useDeferredValue({ q, filters, segment, sort, profile: user.profile, personalize, interests });
  const result = useMemo(() => (data.status === 'ready' ? runQuery(input) : null), [data.status, data.items, input]);

  // Suchbegriffe fliessen in die gelernten Interessen ein
  useEffect(() => {
    if (q && result) recordSearch(q, result.effective);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, !!result]);

  const setFilters = (f: SearchFilters) => setParams(filtersToParams(f));
  const [title, sub] = TITLES[segment];
  const fcount = activeFilterCount(filters);
  const links = platformLinks({ q: q || [...(filters.categories ?? []).map((c) => CATEGORY_LABELS[c])].join(' '), maxPrice: filters.maxPrice });

  const chips: { label: string; remove: () => void }[] = [];
  const listChip = (key: keyof SearchFilters, label: (v: string) => string) =>
    ((filters[key] as string[] | undefined) ?? []).forEach((v) =>
      chips.push({ label: label(v), remove: () => setFilters({ ...filters, [key]: (filters[key] as string[]).filter((x) => x !== v) }) }),
    );
  listChip('categories', (v) => CATEGORY_LABELS[v as keyof typeof CATEGORY_LABELS] ?? v);
  listChip('genders', (v) => GENDER_LABEL[v] ?? v);
  listChip('colors', (v) => COLOR_BY_KEY[v]?.label ?? v);
  listChip('materials', (v) => MATERIAL_BY_KEY[v]?.label ?? v);
  listChip('styles', (v) => STYLE_LABELS[v as keyof typeof STYLE_LABELS] ?? v);
  listChip('sizes', (v) => `Grösse ${v}`);
  listChip('brands', (v) => v);
  listChip('shops', (v) => data.shopById[v]?.name ?? v);
  listChip('conditions', (v) => CONDITION_LABELS[v as keyof typeof CONDITION_LABELS] ?? v);
  if (filters.minPrice !== undefined) chips.push({ label: `ab CHF ${filters.minPrice}`, remove: () => setFilters({ ...filters, minPrice: undefined }) });
  if (filters.maxPrice !== undefined) chips.push({ label: `bis CHF ${filters.maxPrice}`, remove: () => setFilters({ ...filters, maxPrice: undefined }) });
  if (filters.minQuality !== undefined) chips.push({ label: `Qualität ≥ ${filters.minQuality}`, remove: () => setFilters({ ...filters, minQuality: undefined }) });
  if (filters.freeShipping) chips.push({ label: 'Gratisversand', remove: () => setFilters({ ...filters, freeShipping: undefined }) });
  if (filters.noImportFees) chips.push({ label: 'Ohne Importkosten', remove: () => setFilters({ ...filters, noImportFees: undefined }) });
  if (filters.onSale) chips.push({ label: 'Reduziert', remove: () => setFilters({ ...filters, onSale: undefined }) });
  if (filters.maxDays) chips.push({ label: `≤ ${filters.maxDays} Werktage`, remove: () => setFilters({ ...filters, maxDays: undefined }) });

  const filterPanel = result && <Filters filters={filters} onChange={setFilters} facets={result.facets} segment={segment} />;

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1 style={{ fontSize: 'clamp(32px,4vw,46px)' }}>{title}</h1>
          <p>{sub}</p>
        </div>
      </div>
      <div style={{ marginBottom: 22, maxWidth: 720 }}>
        <SearchBar initial={q} onSubmit={(nq) => setParams({ q: nq || null })} />
      </div>

      {segment === 'secondhand' && (
        <section style={{ marginBottom: 28 }}>
          <div className="row between" style={{ marginBottom: 10 }}>
            <div className="label">Auch auf Marktplätzen suchen{q ? ` nach „${q}“` : ''}</div>
            <span className="tiny faint">Direktlinks – keine freie API verfügbar</span>
          </div>
          <div className="chips scroll">
            {links.filter((l) => l.segment === 'secondhand').map((l) => (
              <a key={l.id} className="chip" href={l.url} target="_blank" rel="noopener noreferrer" title={l.note} style={l.shipsToCH ? undefined : { opacity: 0.6 }}>
                {l.name} {!l.shipsToCH && '· kein CH-Versand'} <Icon name="external" size={13} />
              </a>
            ))}
          </div>
        </section>
      )}

      <div className="shop-layout">
        <aside className="filters" aria-label="Filter">{filterPanel}</aside>
        <div>
          <div className="toolbar">
            <button className="btn sm mobile-only" onClick={() => setMobileFilters(true)}>
              <Icon name="filter" size={16} /> Filter{fcount ? ` (${fcount})` : ''}
            </button>
            <span className="count">{result ? `${result.items.length.toLocaleString('de-CH')} Produkte` : ''}</span>
            <span className="spacer" />
            {canPersonalize && (
              <label className="row small muted" style={{ gap: 8 }}>
                <Switch checked={personalize} onChange={(v) => setParams({ me: v ? null : '0' })} /> Für mich
              </label>
            )}
            <select className="input" style={{ width: 'auto', height: 36 }} value={sort} onChange={(e) => setParams({ sort: e.target.value === 'relevance' ? null : e.target.value })} aria-label="Sortierung">
              {Object.entries(SORT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button className="btn sm" onClick={() => setSaveOpen(true)} title="Suche speichern & bei neuen Treffern benachrichtigen">
              <Icon name="bell" size={16} /> Suche speichern
            </button>
          </div>
          {result && (result.understood.length > 0 || result.parsed.corrected.length > 0) && (
            <div className="understood small muted" style={{ marginTop: -6, marginBottom: 12 }}>
              <Icon name="sparkle" size={15} />
              {result.parsed.corrected.length > 0 && <span>Korrigiert: {result.parsed.corrected.map(([a, b]) => `„${a}“ → ${b}`).join(', ')} ·</span>}
              {result.understood.length > 0 && <span>Verstanden: {result.understood.join(' · ')}</span>}
            </div>
          )}
          {result && q && result.specific && <ProductCompareBox items={result.items} query={correctedQuery(q, result.parsed.corrected)} />}
          {chips.length > 0 && (
            <div className="chips" style={{ marginBottom: 18 }}>
              {chips.map((c) => (
                <button key={c.label} className="chip soft" onClick={c.remove}>
                  {c.label} <span className="x">✕</span>
                </button>
              ))}
              <button className="chip" onClick={() => setParams({ ...Object.fromEntries(Object.keys(filtersToParams({})).map((k) => [k, null])) })}>Alle zurücksetzen</button>
            </div>
          )}

          {data.status === 'loading' && <Loading />}
          {data.status === 'error' && <Empty title="Daten nicht verfügbar">{data.error}</Empty>}
          {result && result.items.length === 0 && !(q && result.specific) && (
            <Empty title="Keine Treffer" action={<button className="btn" onClick={() => setParams({ ...Object.fromEntries(Object.keys(filtersToParams({})).map((k) => [k, null])), q: null })}>Filter zurücksetzen</button>}>
              Versuche weniger Filter oder einen allgemeineren Begriff. {segment !== 'new' && 'Oder suche direkt auf den Marktplätzen oben.'}
            </Empty>
          )}
          {result && result.items.length > 0 && <ProductGrid items={result.items} profile={personalize ? user.profile : undefined} resetKey={`${q}|${sort}|${paramKey}`} />}

          {segment !== 'secondhand' && result && (
            <section className="section">
              <div className="label" style={{ marginBottom: 10 }}>Weitere Anbieter (Direktsuche)</div>
              <div className="chips">
                {links.filter((l) => l.segment === 'new').map((l) => (
                  <a key={l.id} className="chip" href={l.url} target="_blank" rel="noopener noreferrer" title={l.note}>
                    {l.name} <Icon name="external" size={13} />
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <Panel open={mobileFilters} onClose={() => setMobileFilters(false)} title="Filter" side="bottom" footer={<button className="btn primary block" onClick={() => setMobileFilters(false)}>{result?.items.length.toLocaleString('de-CH')} Produkte anzeigen</button>}>
        <div style={{ padding: 16 }}>{filterPanel}</div>
      </Panel>

      <SaveSearchPanel open={saveOpen} onClose={() => setSaveOpen(false)} q={q} filters={filters} segment={segment} />
    </div>
  );
}

function correctedQuery(q: string, fixes: [string, string][]): string {
  let out = q;
  for (const [a, b] of fixes) out = out.replace(new RegExp(a, 'i'), b);
  return out;
}

function SaveSearchPanel({ open, onClose, q, filters, segment }: { open: boolean; onClose: () => void; q: string; filters: SearchFilters; segment: 'new' | 'secondhand' | 'all' }) {
  const [name, setName] = useState('');
  const [notify, setNotify] = useState(true);
  return (
    <Panel open={open} onClose={onClose} title="Suche speichern" side="bottom">
      <div style={{ padding: 18 }} className="stack">
        <p className="small muted" style={{ margin: 0 }}>
          Stilkompass prüft alle 30 Minuten neue Produkte gegen diese Suche{segment === 'secondhand' ? ' (ideal für neue Secondhand-Angebote)' : ''} und benachrichtigt dich per Web-Push – auch wenn die Seite geschlossen ist (Einrichtung unter „Alarme“).
        </p>
        <div className="field">
          <label>Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={q || 'Meine Suche'} />
        </div>
        <div className="row between">
          <span className="small">Bei neuen Treffern benachrichtigen</span>
          <Switch checked={notify} onChange={setNotify} />
        </div>
        <button
          className="btn primary"
          onClick={() => {
            saveSearch(name || q, q, filters, segment, notify);
            toast('Suche gespeichert');
            onClose();
          }}
        >
          Speichern
        </button>
      </div>
    </Panel>
  );
}
