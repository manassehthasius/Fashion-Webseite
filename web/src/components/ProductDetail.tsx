import { useEffect, useMemo, useState } from 'react';
import { getData, loadDetails, loadHistory, useData, type Item } from '../lib/data';
import { imgUrl, productUrl } from '@shared/media';
import { landedCost } from '@shared/pricing';
import { qualityLabel, qualityScore } from '@shared/quality';
import { CATEGORY_LABELS, COLOR_BY_KEY, CONDITION_LABELS, FIT_LABELS, MATERIAL_BY_KEY, ORIGINS, STYLE_LABELS } from '@shared/taxonomy';
import { sameProductOffers, similarProducts } from '@shared/similar';
import { combinedMatch, hasMySize, profileSizesFor } from '@shared/personalize';
import { chf, days } from '../lib/format';
import { href, setParam } from '../lib/router';
import { getWatch, recordClick, recordView, removeWatch, toggleCompare, toggleFavorite, upsertWatch, useCompare, useUser } from '../lib/store';
import { Icon } from './Icon';
import { PriceChart } from './PriceChart';
import { ExtShopLinks } from './ExtShopLinks';
import { Panel, QualityRing, Switch, toast } from './ui';
import { imageSimFor } from '../lib/clipIndex';

const GENDER: Record<string, string> = { women: 'Damen', men: 'Herren', unisex: 'Unisex', kids: 'Kinder' };

export function ProductDetailHost({ id }: { id: string | null }) {
  const data = useData();
  const p = id ? data.byId.get(id) : undefined;
  return (
    <Panel open={!!id} onClose={() => setParam('p', null)} title={p ? `${p.b}` : 'Produkt'}>
      {id && !p && data.status === 'ready' && <div className="empty">Dieses Produkt ist nicht mehr im Katalog (ausverkauft oder entfernt).</div>}
      {p && <ProductDetail p={p} key={p.id} />}
    </Panel>
  );
}

function ProductDetail({ p }: { p: Item }) {
  const { shopById, items, fx } = getData();
  const shop = shopById[p.s];
  const user = useUser();
  const compare = useCompare();
  const [details, setDetails] = useState<[string[], string] | null>(null);
  const [hist, setHist] = useState<[number, number, number][] | null>(null);
  const [watchOpen, setWatchOpen] = useState(false);
  useEffect(() => {
    recordView(p);
    loadDetails(p.s).then((d) => setDetails(d[p.id] ?? [[], '']));
    loadHistory().then((h) => setHist(h[p.id] ?? []));
  }, [p.id, p.s]);

  const cost = useMemo(() => landedCost(p.p, shop, fx!, { compareAt: p.pc }), [p, shop, fx]);
  const quality = useMemo(() => qualityScore(p, shop), [p, shop]);
  const offers = useMemo(() => sameProductOffers(p, items), [p, items]);
  const cheaper = useMemo(() => similarProducts(p, items, { cheaper: true, limit: 6, imageSim: imageSimFor(p.id) }), [p, items]);
  const similar = useMemo(() => similarProducts(p, items, { limit: 8, imageSim: imageSimFor(p.id) }), [p, items]);
  const match = combinedMatch(p, user.profile, user.interests);
  const mySizes = profileSizesFor(p.cat, user.profile);
  const sizeOk = hasMySize(p, user.profile);
  const fav = user.favorites.includes(p.id);
  const watch = getWatch(p.id);
  const url = productUrl(p, shop);
  const imgs = [p.img, ...(details?.[0] ?? [])];
  const origin = ORIGINS.find(([c]) => p.fx.includes(`o:${c}`));

  return (
    <div>
      <div className={`gallery${imgs.length === 1 ? ' single' : ''}`}>
        {imgs.map((src, i) => (
          <img key={src + i} src={imgUrl(src, shop, 900)} alt={`${p.t} – Bild ${i + 1}`} loading={i ? 'lazy' : 'eager'} referrerPolicy="no-referrer" />
        ))}
      </div>
      <div className="detail">
        <div className="titleblock">
          <div className="row" style={{ gap: 6 }}>
            <span className="eyebrow">{p.b}</span>
            {p.seg === 'secondhand' && <span className="tag neutral">Secondhand{p.cond ? ` · ${CONDITION_LABELS[p.cond]}` : ''}</span>}
            {!p.av && <span className="tag bad">Ausverkauft</span>}
          </div>
          <h2>{p.t}</h2>
          <div className="small muted" style={{ marginTop: 6 }}>
            bei <b>{shop.name}</b> · {shop.country} · Lieferung {days(cost.days)}
            {shop.health && !shop.health.ok && <span className="tag warn" style={{ marginLeft: 6 }}>Daten evtl. veraltet</span>}
          </div>
          {shop.trust && (
            <div className="small" style={{ marginTop: 6 }}>
              {shop.trust.level === 'verified' ? (
                <span className="tag good" title={shop.trust.basis}>✓ Geprüfter Shop · {shop.trust.basis}</span>
              ) : (
                <span className="tag warn" title={shop.trust.basis}>⚠ {shop.trust.note ?? 'Gemischte Bewertungen'} ({shop.trust.basis})</span>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="row" style={{ alignItems: 'baseline', gap: 12 }}>
            <span className="price-big">{chf(cost.total)}</span>
            {cost.itemWas && <s className="faint">{chf(cost.itemWas)}</s>}
            {cost.discountPct ? <span className="tag dark">−{cost.discountPct}%</span> : null}
            {p.drop && <span className="tag good">Preissturz −{p.drop}%</span>}
          </div>
          <div className="small muted">Gesamtpreis in die Schweiz bei Einzelbestellung{cost.estimated ? ' · enthält Schätzungen' : ''}</div>
        </div>

        <div className="actions">
          <a className="btn primary" href={url} target="_blank" rel="noopener noreferrer" onClick={() => recordClick(p)}>
            Zum Shop <Icon name="external" size={16} />
          </a>
          <button className="btn" onClick={() => toast(toggleFavorite(p) ? 'Zu Favoriten hinzugefügt' : 'Aus Favoriten entfernt')} aria-label="Favorit">
            <Icon name="heart" size={18} fill={fav ? 'currentColor' : 'none'} />
          </button>
          <button className={`btn${watch ? ' primary' : ''}`} onClick={() => setWatchOpen((x) => !x)} aria-label="Preisalarm">
            <Icon name="bell" size={18} />
          </button>
        </div>
        <div className="row">
          <button className="btn sm" onClick={() => toast(toggleCompare(p.id) ? 'Zum Vergleich hinzugefügt' : 'Aus Vergleich entfernt')}>
            <Icon name="scale" size={16} /> {compare.includes(p.id) ? 'Im Vergleich' : 'Vergleichen'}
          </button>
          <a className="btn sm" href={href('/outfits', { anchor: p.id })}>
            <Icon name="layers" size={16} /> Outfits damit
          </a>
          <a className="btn sm" href={href('/bildsuche', { from: p.id })}>
            <Icon name="camera" size={16} /> Ähnliche per Bild
          </a>
        </div>

        {watchOpen && <WatchForm p={p} onDone={() => setWatchOpen(false)} />}

        <section className="panel">
          <div className="label" style={{ marginBottom: 6 }}>Preisaufschlüsselung</div>
          <table className="breakdown">
            <tbody>
              <tr><td>Artikel{shop.market ? ' (CHF-Preis des Shops)' : shop.currency !== 'CHF' ? ` (${p.cur} ${p.p.toFixed(2)})` : ''}</td><td>{chf(cost.item)}</td></tr>
              <tr><td>Versand in die Schweiz{shop.shipping.verified ? '' : ' (geschätzt)'}</td><td>{cost.shippingFree ? 'gratis' : chf(cost.shipping)}</td></tr>
              <tr><td>Zoll (seit 2024 auf Kleidung abgeschafft)</td><td>{chf(0)}</td></tr>
              <tr><td>Einfuhr-MWST 8,1 %</td><td>{cost.vat ? chf(cost.vat) : '–'}</td></tr>
              <tr><td>Verzollungsgebühr (Post-Tarif)</td><td>{cost.clearance ? chf(cost.clearance) : '–'}</td></tr>
              <tr className="total"><td>Total</td><td>{chf(cost.total)}</td></tr>
            </tbody>
          </table>
          <ul className="notes">
            {cost.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
            {shop.shipping.note && <li>{shop.shipping.note}</li>}
          </ul>
        </section>

        {p.sza.length > 0 && !(p.sza.length === 1 && p.sza[0] === 'ONE SIZE') && (
          <section>
            <div className="row between" style={{ marginBottom: 8 }}>
              <span className="label">Grössen</span>
              {sizeOk !== null && <span className={`tag ${sizeOk ? 'good' : 'warn'}`}>{sizeOk ? 'Deine Grösse verfügbar' : 'Deine Grösse nicht verfügbar'}</span>}
            </div>
            <div className="sizes">
              {p.sza.map((s) => (
                <span key={s} className={`size${p.sz.includes(s) ? '' : ' off'}${mySizes.includes(s.toUpperCase()) ? ' mine' : ''}`}>{s}</span>
              ))}
            </div>
          </section>
        )}

        <section className="panel">
          <div className="row" style={{ gap: 16, alignItems: 'center' }}>
            <QualityRing q={quality.score} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Qualität: {qualityLabel(quality.score)}</div>
              <div className="small muted">
                {quality.estimated ? (
                  <>
                    <span className="tag warn">Schätzung</span> Wenig Produktdaten ({Math.round(quality.confidence * 100)} % datenbasiert)
                  </>
                ) : (
                  <>
                    <span className="tag good">Datenbasiert</span> {Math.round(quality.confidence * 100)} % aus Produktangaben
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="qbars" style={{ marginTop: 14 }}>
            {quality.parts.map((part) => (
              <div key={part.key} className="qbar">
                <span>{part.label} <span className="tiny faint">{part.source === 'data' ? '· Daten' : part.source === 'curated' ? '· kuratiert' : '· Schätzung'}</span></span>
                <span className="num small">{Math.round(part.points)}/{part.max}</span>
                <div className="track">
                  <div className={`fill${part.source === 'estimate' ? ' estimate' : part.source === 'curated' ? ' curated' : ''}`} style={{ width: `${(part.points / part.max) * 100}%` }} />
                </div>
                <span className="d">{part.detail}</span>
              </div>
            ))}
          </div>
          <div className="tiny faint" style={{ marginTop: 10 }}>
            Score aus Material, Verarbeitung, Markenruf, Herkunft und Langlebigkeit/Zustand. Gestreifte Balken = Schätzung. <a href={href('/info')} style={{ textDecoration: 'underline' }}>Methode</a>
          </div>
        </section>

        <section>
          <dl className="kv">
            <dt>Kategorie</dt><dd>{CATEGORY_LABELS[p.cat]} · {GENDER[p.g]}</dd>
            {p.col.length > 0 && (<><dt>Farbe</dt><dd>{p.col.map((c) => COLOR_BY_KEY[c]?.label ?? c).join(', ')}</dd></>)}
            {p.mat.length > 0 && (<><dt>Material</dt><dd>{p.mat.map((m) => `${m.pct !== undefined ? m.pct + '% ' : ''}${MATERIAL_BY_KEY[m.k]?.label ?? m.k}`).join(', ')}</dd></>)}
            {p.fit && (<><dt>Passform</dt><dd>{FIT_LABELS[p.fit] ?? p.fit}</dd></>)}
            {origin && (<><dt>Herkunft</dt><dd>{origin[1]}</dd></>)}
            {p.era && (<><dt>Ära</dt><dd>{p.era}</dd></>)}
            {p.st.length > 0 && (<><dt>Stil</dt><dd>{p.st.map((s) => STYLE_LABELS[s]).join(', ')}</dd></>)}
            {match.reasons.length > 0 && (<><dt>Passt zu dir</dt><dd style={{ color: 'var(--good)' }}>{match.reasons.join(' · ')}</dd></>)}
          </dl>
        </section>

        <section>
          <div className="label" style={{ marginBottom: 8 }}>Preisverlauf</div>
          {hist ? <PriceChart points={hist} current={p.tot} /> : <div className="skeleton" style={{ height: 120 }} />}
        </section>

        {offers.length > 0 && (
          <section>
            <div className="label" style={{ marginBottom: 8 }}>Gleiches Produkt in anderen Shops</div>
            <MiniList items={offers.slice(0, 6)} base={p} />
          </section>
        )}
        {cheaper.length > 0 && (
          <section>
            <div className="label" style={{ marginBottom: 8 }}>Günstigere Alternativen mit ähnlicher Qualität</div>
            <MiniList items={cheaper.map((x) => x.p)} base={p} />
          </section>
        )}
        {similar.length > 0 && (
          <section>
            <div className="label" style={{ marginBottom: 8 }}>Ähnliche Teile</div>
            <MiniList items={similar.map((x) => x.p)} base={p} />
          </section>
        )}
        <section>
          <ExtShopLinks
            title="Ähnliches bei deinen Lieblingsshops"
            query={[p.col[0] ? COLOR_BY_KEY[p.col[0]]?.label : '', CATEGORY_LABELS[p.cat], p.g === 'men' ? 'Herren' : p.g === 'women' ? 'Damen' : ''].filter(Boolean).join(' ')}
          />
        </section>
        {details?.[1] && (
          <section>
            <div className="label" style={{ marginBottom: 6 }}>Beschreibung des Shops</div>
            <p className="small muted" style={{ margin: 0, whiteSpace: 'pre-line' }}>{details[1]}</p>
          </section>
        )}
        <p className="tiny faint">Angaben ohne Gewähr. Verbindlich sind Preis, Versand und Verfügbarkeit im Shop. Daten aus dem öffentlichen Produkt-Feed von {shop.name}.</p>
      </div>
    </div>
  );
}

function MiniList({ items, base }: { items: Item[] | import('@shared/types').Product[]; base: Item }) {
  const { shopById } = getData();
  return (
    <div className="mini-list">
      {items.map((o) => {
        const shop = shopById[o.s];
        const diff = o.tot - base.tot;
        return (
          <div key={o.id} className="mini" onClick={() => setParam('p', o.id)} role="button">
            <img src={imgUrl(o.img, shop, 160)} alt="" loading="lazy" referrerPolicy="no-referrer" />
            <div style={{ minWidth: 0 }}>
              <div className="tiny faint">{o.b} · {shop?.name}</div>
              <div className="t">{o.t}</div>
              <div className="tiny faint">Q {o.q}{o.cond ? ` · ${CONDITION_LABELS[o.cond]}` : ''}</div>
            </div>
            <div className="p">
              {chf(o.tot)}
              <div className="tiny" style={{ color: diff < 0 ? 'var(--good)' : 'var(--ink-3)', fontWeight: 600 }}>{diff < 0 ? `−${chf(-diff)}` : `+${chf(diff)}`}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WatchForm({ p, onDone }: { p: Item; onDone: () => void }) {
  const existing = getWatch(p.id);
  const user = useUser();
  const mine = profileSizesFor(p.cat, user.profile).find((s) => p.sza.includes(s));
  const [target, setTarget] = useState<string>(existing?.target ? String(existing.target) : String(Math.floor(p.tot * 0.85)));
  const [size, setSize] = useState<string>(existing?.size ?? mine ?? '');
  const [drop, setDrop] = useState(existing?.notifyDrop ?? true);
  const [stock, setStock] = useState(existing?.notifyStock ?? true);
  return (
    <section className="panel stack">
      <div className="label">Preisalarm & Watchlist</div>
      <div className="form-grid">
        <div className="field">
          <label>Wunschpreis (Gesamt, CHF)</label>
          <input className="input" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
          <span className="hint">Aktuell {chf(p.tot)}</span>
        </div>
        {p.sza.length > 0 && (
          <div className="field">
            <label>Grösse</label>
            <select className="input" value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="">egal</option>
              {p.sza.map((s) => (
                <option key={s} value={s}>
                  {s} {p.sz.includes(s) ? '' : '(ausverkauft)'}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="row between"><span className="small">Bei jedem Preissturz benachrichtigen</span><Switch checked={drop} onChange={setDrop} /></div>
      <div className="row between"><span className="small">Wenn wieder verfügbar</span><Switch checked={stock} onChange={setStock} /></div>
      <div className="row">
        <button
          className="btn primary"
          onClick={() => {
            upsertWatch(p, { target: target ? Number(target) : undefined, size: size || undefined, notifyDrop: drop, notifyStock: stock });
            toast('Preisalarm gespeichert');
            onDone();
          }}
        >
          Speichern
        </button>
        {existing && (
          <button className="btn ghost" onClick={() => { removeWatch(p.id); toast('Alarm entfernt'); onDone(); }}>
            Entfernen
          </button>
        )}
        <a className="small muted" href={href('/alarme')} style={{ marginLeft: 'auto', textDecoration: 'underline' }}>Benachrichtigungen einrichten</a>
      </div>
    </section>
  );
}
