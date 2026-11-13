import { useState } from 'react';
import type { Category, Gender, Style, StyleProfile } from '@shared/types';
import { CATEGORY_LABELS, COLORS, FIT_LABELS, MATERIALS, STYLE_LABELS } from '@shared/taxonomy';
import { updateProfile, useUser } from '../lib/store';
import { useData } from '../lib/data';
import { href } from '../lib/router';
import { toast } from '../components/ui';

const GENDERS: [Gender, string][] = [['women', 'Damen'], ['men', 'Herren'], ['unisex', 'Unisex'], ['kids', 'Kinder']];
const TOP_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const BOTTOM_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '26', '27', '28', '29', '30', '31', '32', '33', '34', '36', '38', '40', '42', '44', '46', '48', '50', '52'];
const SHOE_SIZES = ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '6', '7', '8', '9', '10', '11', '12'];
const BUDGET_CATS: (Category | 'default')[] = ['default', 'tshirt', 'shirt', 'knit', 'sweat', 'trousers', 'jeans', 'jacket', 'coat', 'dress', 'shoes', 'boots', 'sneakers', 'bag', 'accessory'];
const PREF_MATERIALS = ['merino', 'cashmere', 'wool', 'alpaca', 'linen', 'silk', 'organic_cotton', 'supima', 'cotton', 'hemp', 'lyocell', 'fullgrain', 'leather', 'suede', 'down', 'goretex'];
const AVOID_MATERIALS = ['acrylic', 'polyester', 'viscose', 'pu', 'nylon', 'elastane', 'modal'];

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export function Profile() {
  const { profile } = useUser();
  const data = useData();
  const set = (patch: Partial<StyleProfile>) => updateProfile(patch);
  const [brandQ, setBrandQ] = useState('');
  const brandSuggestions = brandQ.length >= 2 ? data.brands.filter((b) => b.name.toLowerCase().includes(brandQ.toLowerCase()) && !profile.brands.includes(b.name)).slice(0, 8) : [];

  return (
    <div className="container" style={{ maxWidth: 980 }}>
      <div className="page-head">
        <div>
          <h1 style={{ fontSize: 'clamp(32px,4vw,46px)' }}>Style-Profil</h1>
          <p>Je genauer dein Profil, desto besser die Empfehlungen, Outfits und Alarme. Gespeichert nur in deinem Browser (optional verschlüsselt synchronisiert).</p>
        </div>
        <a className="btn primary" href={href('/suche', { sort: 'relevance' })}>Empfehlungen ansehen</a>
      </div>

      <div className="stack" style={{ gap: 18 }}>
        <Section title="Für wen?">
          <div className="chips">
            {GENDERS.map(([g, l]) => (
              <button key={g} className={`chip${profile.genders.includes(g) ? ' on' : ''}`} onClick={() => set({ genders: toggle(profile.genders, g) })}>{l}</button>
            ))}
          </div>
        </Section>

        <Section title="Dein Stil" hint="Mehrfachauswahl">
          <div className="chips">
            {(Object.keys(STYLE_LABELS) as Style[]).map((s) => (
              <button key={s} className={`chip${profile.styles.includes(s) ? ' on' : ''}`} onClick={() => set({ styles: toggle(profile.styles, s) })}>{STYLE_LABELS[s]}</button>
            ))}
          </div>
        </Section>

        <Section title="Grössen">
          <SizeRow label="Oberteile & Jacken" sizes={TOP_SIZES} value={profile.sizes.top ?? []} onChange={(v) => set({ sizes: { ...profile.sizes, top: v } })} />
          <SizeRow label="Hosen & Röcke (Buchstaben, EU oder Bundweite W)" sizes={BOTTOM_SIZES} value={profile.sizes.bottom ?? []} onChange={(v) => set({ sizes: { ...profile.sizes, bottom: v } })} />
          <SizeRow label="Schuhe (EU oder UK/US)" sizes={SHOE_SIZES} value={profile.sizes.shoes ?? []} onChange={(v) => set({ sizes: { ...profile.sizes, shoes: v } })} />
        </Section>

        <Section title="Passform">
          <div className="chips">
            {Object.entries(FIT_LABELS).map(([k, l]) => (
              <button key={k} className={`chip${profile.fits.includes(k) ? ' on' : ''}`} onClick={() => set({ fits: toggle(profile.fits, k) })}>{l}</button>
            ))}
          </div>
        </Section>

        <Section title="Lieblingsmarken">
          <div className="chips" style={{ marginBottom: 10 }}>
            {profile.brands.map((b) => (
              <button key={b} className="chip on" onClick={() => set({ brands: profile.brands.filter((x) => x !== b) })}>{b} <span className="x">✕</span></button>
            ))}
            {!profile.brands.length && <span className="small faint">Noch keine</span>}
          </div>
          <input className="input" placeholder="Marke suchen (z. B. Sunspel, Drake's, Norse Projects)" value={brandQ} onChange={(e) => setBrandQ(e.target.value)} style={{ maxWidth: 420 }} />
          {brandSuggestions.length > 0 && (
            <div className="chips" style={{ marginTop: 8 }}>
              {brandSuggestions.map((b) => (
                <button key={b.name} className="chip" onClick={() => { set({ brands: [...profile.brands, b.name] }); setBrandQ(''); }}>+ {b.name} <span className="faint">{b.count}</span></button>
              ))}
            </div>
          )}
          {profile.avoidBrands.length > 0 && (
            <div className="chips" style={{ marginTop: 10 }}>
              <span className="small faint">Ausgeblendet:</span>
              {profile.avoidBrands.map((b) => (
                <button key={b} className="chip" onClick={() => set({ avoidBrands: profile.avoidBrands.filter((x) => x !== b) })}>{b} ✕</button>
              ))}
            </div>
          )}
          {brandSuggestions.length > 0 && (
            <div className="tiny faint" style={{ marginTop: 6 }}>
              Marke ausblenden? <button style={{ textDecoration: 'underline' }} onClick={() => { set({ avoidBrands: [...profile.avoidBrands, brandSuggestions[0].name] }); setBrandQ(''); }}>„{brandSuggestions[0].name}“ nie zeigen</button>
            </div>
          )}
        </Section>

        <Section title="Farben" hint="Tippen = mag ich, nochmals = vermeiden">
          <div className="chips">
            {COLORS.map((c) => {
              const like = profile.colors.includes(c.key);
              const avoid = profile.avoidColors.includes(c.key);
              return (
                <button
                  key={c.key}
                  className={`chip${like ? ' on' : ''}`}
                  style={avoid ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}
                  onClick={() => {
                    if (!like && !avoid) set({ colors: [...profile.colors, c.key] });
                    else if (like) set({ colors: profile.colors.filter((x) => x !== c.key), avoidColors: [...profile.avoidColors, c.key] });
                    else set({ avoidColors: profile.avoidColors.filter((x) => x !== c.key) });
                  }}
                >
                  <span className="swatch" style={{ background: c.hex }} /> {c.label}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Materialien">
          <div className="label" style={{ marginBottom: 8 }}>Bevorzugt</div>
          <div className="chips" style={{ marginBottom: 14 }}>
            {PREF_MATERIALS.map((k) => (
              <button key={k} className={`chip${profile.materials.includes(k) ? ' on' : ''}`} onClick={() => set({ materials: toggle(profile.materials, k) })}>{MATERIALS.find((m) => m.key === k)?.label}</button>
            ))}
          </div>
          <div className="label" style={{ marginBottom: 8 }}>Vermeiden</div>
          <div className="chips">
            {AVOID_MATERIALS.map((k) => (
              <button key={k} className={`chip${profile.avoidMaterials.includes(k) ? ' on' : ''}`} onClick={() => set({ avoidMaterials: toggle(profile.avoidMaterials, k) })}>{MATERIALS.find((m) => m.key === k)?.label}</button>
            ))}
          </div>
        </Section>

        <Section title="Budget pro Teil (Gesamtpreis CHF)" hint="leer = kein Limit">
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
            {BUDGET_CATS.map((c) => (
              <div key={c} className="field">
                <label>{c === 'default' ? 'Allgemein' : CATEGORY_LABELS[c]}</label>
                <input
                  className="input"
                  inputMode="numeric"
                  placeholder="–"
                  value={profile.budget[c] ?? ''}
                  onChange={(e) => {
                    const b = { ...profile.budget };
                    if (e.target.value) b[c] = Number(e.target.value);
                    else delete b[c];
                    set({ budget: b });
                  }}
                />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Qualitätsanspruch & Priorität">
          <div className="field" style={{ maxWidth: 420 }}>
            <label>Mindestqualität: {profile.minQuality || 'keine'}</label>
            <input type="range" min={0} max={90} step={5} value={profile.minQuality} onChange={(e) => set({ minQuality: Number(e.target.value) })} />
          </div>
          <div className="seg" style={{ marginTop: 12 }}>
            {([['quality', 'Qualität zuerst'], ['balanced', 'Ausgewogen'], ['price', 'Preis zuerst']] as const).map(([k, l]) => (
              <button key={k} className={profile.priority === k ? 'on' : ''} onClick={() => set({ priority: k })}>{l}</button>
            ))}
          </div>
        </Section>

        <div className="row">
          <button className="btn primary" onClick={() => toast('Profil gespeichert')}>Gespeichert ✓</button>
          <span className="small faint">Änderungen werden automatisch gespeichert.</span>
        </div>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="row between" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 22 }}>{title}</h3>
        {hint && <span className="tiny faint">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function SizeRow({ label, sizes, value, onChange }: { label: string; sizes: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="label" style={{ marginBottom: 8 }}>{label}</div>
      <div className="chips">
        {sizes.map((s) => (
          <button key={s} className={`chip${value.includes(s) ? ' on' : ''}`} onClick={() => onChange(toggle(value, s))} style={{ minWidth: 44, justifyContent: 'center' }}>{s}</button>
        ))}
      </div>
    </div>
  );
}
