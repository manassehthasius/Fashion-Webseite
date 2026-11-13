import { useState } from 'react';
import type { Category, Condition, Gender, SearchFilters, Style } from '@shared/types';
import { CATEGORY_GROUPS, CATEGORY_LABELS, COLOR_BY_KEY, CONDITION_LABELS, MATERIAL_BY_KEY, STYLE_LABELS } from '@shared/taxonomy';
import type { Facets } from '../lib/query';
import { getData } from '../lib/data';

const GENDER_LABELS: Record<Gender, string> = { women: 'Damen', men: 'Herren', unisex: 'Unisex', kids: 'Kinder' };

type ListKey = 'categories' | 'genders' | 'brands' | 'colors' | 'materials' | 'styles' | 'sizes' | 'shops' | 'conditions';

export function Filters({ filters, onChange, facets, segment }: { filters: SearchFilters; onChange: (f: SearchFilters) => void; facets: Facets; segment: 'new' | 'secondhand' | 'all' }) {
  const toggle = (key: ListKey, value: string) => {
    const cur = (filters[key] as string[] | undefined) ?? [];
    const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
    onChange({ ...filters, [key]: next.length ? next : undefined });
  };
  const has = (key: ListKey, v: string) => ((filters[key] as string[] | undefined) ?? []).includes(v);
  const count = <K extends string>(list: [K, number][], k: K) => list.find((x) => x[0] === k)?.[1] ?? 0;
  const { shopById } = getData();
  const [brandQ, setBrandQ] = useState('');
  const [showAllBrands, setShowAllBrands] = useState(false);
  const brands = facets.brands.filter(([b]) => !brandQ || b.toLowerCase().includes(brandQ.toLowerCase()));
  const sizesOrdered = [...facets.sizes].filter(([, n]) => n > 2);

  return (
    <div>
      <div className="fgroup">
        <div className="ftitle">Gesamtpreis (CHF)</div>
        <div className="fbody">
          <div className="range-row">
            <input className="input" inputMode="numeric" placeholder="von" value={filters.minPrice ?? ''} onChange={(e) => onChange({ ...filters, minPrice: e.target.value ? Number(e.target.value) : undefined })} aria-label="Mindestpreis" />
            <span className="faint">–</span>
            <input className="input" inputMode="numeric" placeholder="bis" value={filters.maxPrice ?? ''} onChange={(e) => onChange({ ...filters, maxPrice: e.target.value ? Number(e.target.value) : undefined })} aria-label="Höchstpreis" />
          </div>
          <div className="tiny faint">inkl. Versand, Schweizer MWST & Verzollung</div>
        </div>
      </div>

      <div className="fgroup">
        <div className="ftitle">Qualität & Versand</div>
        <div className="fbody">
          <div className="chips">
            {[0, 60, 70, 80].map((q) => (
              <button key={q} className={`chip${(filters.minQuality ?? 0) === q ? ' on' : ''}`} onClick={() => onChange({ ...filters, minQuality: q || undefined })}>
                {q ? `ab ${q}` : 'alle'}
              </button>
            ))}
          </div>
          <label className="check"><input type="checkbox" checked={!!filters.freeShipping} onChange={(e) => onChange({ ...filters, freeShipping: e.target.checked || undefined })} /> Gratisversand in die Schweiz</label>
          <label className="check"><input type="checkbox" checked={!!filters.noImportFees} onChange={(e) => onChange({ ...filters, noImportFees: e.target.checked || undefined })} /> Ohne Zoll-/Importkosten</label>
          <label className="check"><input type="checkbox" checked={filters.maxDays === 5} onChange={(e) => onChange({ ...filters, maxDays: e.target.checked ? 5 : undefined })} /> Lieferung ≤ 5 Werktage</label>
          <label className="check"><input type="checkbox" checked={!!filters.onSale} onChange={(e) => onChange({ ...filters, onSale: e.target.checked || undefined })} /> Reduziert / Preissturz</label>
          <label className="check"><input type="checkbox" checked={filters.onlyAvailable === false} onChange={(e) => onChange({ ...filters, onlyAvailable: e.target.checked ? false : undefined })} /> Auch Ausverkauftes zeigen</label>
        </div>
      </div>

      <div className="fgroup">
        <div className="ftitle">Für</div>
        <div className="fbody chips" style={{ flexDirection: 'row' }}>
          {(['women', 'men', 'unisex', 'kids'] as Gender[]).map((g) => (
            <button key={g} className={`chip${has('genders', g) ? ' on' : ''}`} onClick={() => toggle('genders', g)}>
              {GENDER_LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      <details className="fgroup" open>
        <summary>Kategorie</summary>
        <div className="fbody">
          {CATEGORY_GROUPS.map((grp) => {
            const cats = grp.cats.filter((c) => count(facets.categories, c) > 0 || has('categories', c));
            if (!cats.length) return null;
            return (
              <div key={grp.label} style={{ marginBottom: 6 }}>
                <div className="tiny faint" style={{ margin: '4px 0' }}>{grp.label}</div>
                {cats.map((c: Category) => (
                  <label key={c} className="check">
                    <input type="checkbox" checked={has('categories', c)} onChange={() => toggle('categories', c)} /> {CATEGORY_LABELS[c]}
                    <span className="count">{count(facets.categories, c)}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      </details>

      {segment !== 'new' && facets.conditions.length > 0 && (
        <details className="fgroup" open>
          <summary>Zustand</summary>
          <div className="fbody">
            {(['nwt', 'excellent', 'very_good', 'good', 'fair'] as Condition[]).map((c) => (
              <label key={c} className="check">
                <input type="checkbox" checked={has('conditions', c)} onChange={() => toggle('conditions', c)} /> {CONDITION_LABELS[c]}
                <span className="count">{count(facets.conditions, c)}</span>
              </label>
            ))}
          </div>
        </details>
      )}

      <details className="fgroup" open={!!filters.sizes?.length}>
        <summary>Grösse</summary>
        <div className="fbody chips" style={{ flexDirection: 'row' }}>
          {sizesOrdered.slice(0, 40).map(([s]) => (
            <button key={s} className={`chip${has('sizes', s) ? ' on' : ''}`} onClick={() => toggle('sizes', s)}>
              {s}
            </button>
          ))}
        </div>
      </details>

      <details className="fgroup" open={!!filters.colors?.length}>
        <summary>Farbe</summary>
        <div className="fbody chips" style={{ flexDirection: 'row' }}>
          {facets.colors.map(([c, n]) => (
            <button key={c} className={`chip${has('colors', c) ? ' on' : ''}`} onClick={() => toggle('colors', c)} title={`${n} Produkte`}>
              <span className="swatch" style={{ background: COLOR_BY_KEY[c]?.hex }} /> {COLOR_BY_KEY[c]?.label ?? c}
            </button>
          ))}
        </div>
      </details>

      <details className="fgroup" open={!!filters.materials?.length}>
        <summary>Material</summary>
        <div className="fbody">
          {facets.materials.map(([m, n]) => (
            <label key={m} className="check">
              <input type="checkbox" checked={has('materials', m)} onChange={() => toggle('materials', m)} /> {MATERIAL_BY_KEY[m]?.label ?? m}
              <span className="count">{n}</span>
            </label>
          ))}
        </div>
      </details>

      <details className="fgroup" open={!!filters.styles?.length}>
        <summary>Stil</summary>
        <div className="fbody chips" style={{ flexDirection: 'row' }}>
          {facets.styles.map(([s]) => (
            <button key={s} className={`chip${has('styles', s) ? ' on' : ''}`} onClick={() => toggle('styles', s as Style)}>
              {STYLE_LABELS[s as Style]}
            </button>
          ))}
        </div>
      </details>

      <details className="fgroup" open={!!filters.brands?.length}>
        <summary>Marke</summary>
        <div className="fbody">
          <input className="input" placeholder="Marke suchen" value={brandQ} onChange={(e) => setBrandQ(e.target.value)} style={{ height: 36 }} />
          {(showAllBrands || brandQ ? brands : brands.slice(0, 12)).map(([b, n]) => (
            <label key={b} className="check">
              <input type="checkbox" checked={has('brands', b)} onChange={() => toggle('brands', b)} /> {b}
              <span className="count">{n}</span>
            </label>
          ))}
          {!brandQ && brands.length > 12 && (
            <button className="btn ghost sm" onClick={() => setShowAllBrands((x) => !x)}>
              {showAllBrands ? 'Weniger' : `Alle ${brands.length} Marken`}
            </button>
          )}
        </div>
      </details>

      <details className="fgroup" open={!!filters.shops?.length}>
        <summary>Shop</summary>
        <div className="fbody">
          {facets.shops.map(([s, n]) => (
            <label key={s} className="check">
              <input type="checkbox" checked={has('shops', s)} onChange={() => toggle('shops', s)} /> {shopById[s]?.name ?? s}
              <span className="count">{n}</span>
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
