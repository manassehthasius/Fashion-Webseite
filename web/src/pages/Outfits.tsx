import { useMemo, useState } from 'react';
import type { Style } from '@shared/types';
import { STYLE_LABELS } from '@shared/taxonomy';
import { buildOutfits, season, type Role } from '@shared/outfits';
import { imgUrl } from '@shared/media';
import { useData } from '../lib/data';
import { useUser } from '../lib/store';
import { setParams, setParam, useRoute, href } from '../lib/router';
import { chf } from '../lib/format';
import { Empty, Loading } from '../components/ui';

const ROLE_LABEL: Record<Role, string> = { top: 'Oberteil', bottom: 'Unterteil', outer: 'Jacke/Mantel', shoes: 'Schuhe', onepiece: 'Kleid/Anzug', acc: 'Accessoire' };
const SEASON_LABEL = { winter: 'Winter', summer: 'Sommer', mid: 'Übergang' };

export function Outfits() {
  const data = useData();
  const user = useUser();
  const route = useRoute();
  const anchorId = route.params.get('anchor');
  const anchor = anchorId ? data.byId.get(anchorId) ?? null : null;
  const [budget, setBudget] = useState<string>(route.params.get('budget') ?? '');
  const [styles, setStyles] = useState<Style[]>(user.profile.styles);
  const [segment, setSegment] = useState<'all' | 'new' | 'secondhand'>('all');
  const [seed, setSeed] = useState(0);

  const outfits = useMemo(() => {
    if (data.status !== 'ready') return [];
    const pool = seed ? data.items.filter((_, i) => (i + seed) % 3 !== 0) : data.items;
    return buildOutfits(pool, { anchor, profile: user.profile, budget: budget ? Number(budget) : undefined, styles, count: 6, segment });
  }, [data.status, data.items, anchor, user.profile, budget, styles, segment, seed]);

  const needsGender = !anchor && !user.profile.genders.length;
  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1 style={{ fontSize: 'clamp(32px,4vw,46px)' }}>Outfit-Empfehlungen</h1>
          <p>Komplette Looks aus echten, verfügbaren Teilen: harmonische Farben, stimmiger Stil, passend zur Saison ({SEASON_LABEL[season()]}), in deiner Grösse und deinem Budget.</p>
        </div>
      </div>

      <section className="panel stack" style={{ marginBottom: 24 }}>
        {anchor && (
          <div className="row" style={{ gap: 12 }}>
            <img src={imgUrl(anchor.img, data.shopById[anchor.s], 120)} alt="" style={{ width: 48, height: 60, objectFit: 'cover', borderRadius: 8 }} referrerPolicy="no-referrer" />
            <div style={{ flex: 1 }}>
              <div className="tiny faint">Outfits rund um</div>
              <div style={{ fontWeight: 600 }}>{anchor.b} – {anchor.t}</div>
            </div>
            <button className="btn sm" onClick={() => setParams({ anchor: null })}>Ohne Basisteil</button>
          </div>
        )}
        <div className="row" style={{ gap: 14, alignItems: 'end' }}>
          <div className="field" style={{ width: 180 }}>
            <label>Budget gesamt (CHF)</label>
            <input className="input" inputMode="numeric" placeholder="ohne Limit" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </div>
          <div className="field">
            <label>Quelle</label>
            <div className="seg">
              {(['all', 'new', 'secondhand'] as const).map((s) => (
                <button key={s} className={segment === s ? 'on' : ''} onClick={() => setSegment(s)}>{s === 'all' ? 'Alle' : s === 'new' ? 'Neu' : 'Secondhand'}</button>
              ))}
            </div>
          </div>
          <button className="btn" onClick={() => setSeed((x) => x + 1)}>Neue Vorschläge</button>
        </div>
        <div className="chips">
          {(['minimal', 'classic', 'smart', 'casual', 'workwear', 'streetwear', 'outdoor', 'preppy', 'elegant'] as Style[]).map((s) => (
            <button key={s} className={`chip${styles.includes(s) ? ' on' : ''}`} onClick={() => setStyles(styles.includes(s) ? styles.filter((x) => x !== s) : [...styles, s])}>{STYLE_LABELS[s]}</button>
          ))}
        </div>
        {needsGender && <div className="notice">Tipp: Wähle im <a href={href('/profil')} style={{ textDecoration: 'underline' }}>Style-Profil</a> „Damen“ oder „Herren“ und deine Grössen, damit die Outfits passen.</div>}
      </section>

      {data.status === 'loading' && <Loading />}
      {data.status === 'ready' && !outfits.length && <Empty title="Keine passenden Outfits">Erhöhe das Budget oder wähle weniger Stilrichtungen.</Empty>}
      <div className="grid-2">
        {outfits.map((o, i) => {
          const roles = (['outer', 'top', 'onepiece', 'bottom', 'shoes', 'acc'] as Role[]).filter((r) => o.items[r]);
          return (
            <article key={i} className="card outfit">
              <div className="row between">
                <h3>Look {i + 1}</h3>
                <b className="num">{chf(o.total)}</b>
              </div>
              <div className="outfit-items">
                {roles.map((r) => {
                  const p = o.items[r]!;
                  return (
                    <div key={r} className="oi" onClick={() => setParam('p', p.id)}>
                      <img src={imgUrl(p.img, data.shopById[p.s], 320)} alt={p.t} loading="lazy" referrerPolicy="no-referrer" />
                      <span className="role">{ROLE_LABEL[r]}</span>
                      <span className="tiny" style={{ lineHeight: 1.3 }}>{p.b}</span>
                      <span className="tiny num" style={{ fontWeight: 650 }}>{chf(p.tot)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="small muted">{o.why.join(' · ')}</div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
