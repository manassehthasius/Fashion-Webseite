import { useEffect, useMemo } from 'react';
import { ensureDeepFor, getData, useData, type Item } from '../lib/data';
import { clearCompare, toggleCompare, useCompare, useUser } from '../lib/store';
import { basketCost, landedCost } from '@shared/pricing';
import { sameProductOffers } from '@shared/similar';
import { imgUrl, productUrl } from '@shared/media';
import { CONDITION_LABELS, MATERIAL_BY_KEY } from '@shared/taxonomy';
import { chf, days } from '../lib/format';
import { href, setParam } from '../lib/router';
import { Empty, QualityPill } from '../components/ui';
import { Icon } from '../components/Icon';

export function Compare() {
  const data = useData();
  const ids = useCompare();
  const user = useUser();
  useEffect(() => {
    if (data.status === 'ready') ensureDeepFor(ids);
  }, [data.status, ids]);
  const items = useMemo(() => ids.map((id) => data.byId.get(id)).filter((p): p is Item => !!p), [ids, data.byId]);
  const rows = useMemo(() => items.map((p) => ({ p, c: landedCost(p.p, data.shopById[p.s], data.fx!, { compareAt: p.pc }) })), [items, data.shopById, data.fx]);
  const bestTotal = Math.min(...rows.map((r) => r.c.total));
  const bestQ = Math.max(...rows.map((r) => r.p.q));

  // Warenkorb-Rechner: Artikel pro Shop gemeinsam bestellen (ein Versand, eine Verzollung)
  const baskets = useMemo(() => {
    const byShop = new Map<string, Item[]>();
    for (const p of items) {
      if (!byShop.has(p.s)) byShop.set(p.s, []);
      byShop.get(p.s)!.push(p);
    }
    return [...byShop.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([s, list]) => {
        const shop = data.shopById[s];
        const together = basketCost(list.map((p) => p.p), shop, data.fx!);
        const separate = list.reduce((a, p) => a + landedCost(p.p, shop, data.fx!).total, 0);
        return { shop, list, together, separate };
      });
  }, [items, data.shopById, data.fx]);

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1 style={{ fontSize: 'clamp(32px,4vw,46px)' }}>Preisvergleich</h1>
          <p>Gesamtpreise inklusive Versand, Schweizer Einfuhr-MWST und Verzollung nebeneinander – plus Warenkorb-Rechner pro Shop.</p>
        </div>
        <div className="row">
          {user.favorites.length > 0 && (
            <button className="btn sm" onClick={() => user.favorites.slice(0, 6).forEach((id) => !ids.includes(id) && toggleCompare(id))}>Favoriten hinzufügen</button>
          )}
          {ids.length > 0 && <button className="btn sm ghost" onClick={clearCompare}>Leeren</button>}
        </div>
      </div>

      {!items.length && (
        <Empty title="Noch nichts zum Vergleichen" action={<a className="btn primary" href={href('/neu')}>Produkte finden</a>}>
          Öffne ein Produkt und tippe auf „Vergleichen“ (bis zu 6 Teile). Jede Produktansicht zeigt ausserdem automatisch das gleiche Produkt in anderen Shops und günstigere Alternativen.
        </Empty>
      )}

      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Produkt</th>
                <th>Artikel</th>
                <th>Versand</th>
                <th>MWST + Verzollung</th>
                <th>Gesamt</th>
                <th>Lieferung</th>
                <th>Qualität</th>
                <th>Material / Zustand</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, c }) => {
                const shop = data.shopById[p.s];
                return (
                  <tr key={p.id}>
                    <td style={{ minWidth: 220 }}>
                      <div className="row" style={{ gap: 10, flexWrap: 'nowrap', cursor: 'pointer' }} onClick={() => setParam('p', p.id)}>
                        <img src={imgUrl(p.img, shop, 120)} alt="" style={{ width: 44, height: 55, objectFit: 'cover', borderRadius: 6 }} referrerPolicy="no-referrer" />
                        <div>
                          <div className="tiny faint">{p.b} · {shop.name}</div>
                          <div style={{ fontWeight: 550, lineHeight: 1.3 }}>{p.t}</div>
                        </div>
                      </div>
                    </td>
                    <td className="num">{chf(c.item)}{c.discountPct ? <div className="tiny" style={{ color: 'var(--good)' }}>−{c.discountPct}%</div> : null}</td>
                    <td className="num">{c.shippingFree ? 'gratis' : chf(c.shipping)}</td>
                    <td className="num">{c.vat + c.clearance ? chf(c.vat + c.clearance) : '–'}</td>
                    <td className={`num${c.total === bestTotal ? ' best' : ''}`}><b>{chf(c.total)}</b>{c.estimated && <div className="tiny faint">enthält Schätzung</div>}</td>
                    <td className="small">{days(c.days)}</td>
                    <td className={p.q === bestQ ? 'best' : ''}><QualityPill q={p.q} qc={p.qc} /></td>
                    <td className="small">{p.mat.slice(0, 2).map((m) => `${m.pct ? m.pct + '% ' : ''}${MATERIAL_BY_KEY[m.k]?.label}`).join(', ') || '–'}{p.cond ? ` · ${CONDITION_LABELS[p.cond]}` : ''}</td>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
                        <a className="icon-btn" href={productUrl(p, shop)} target="_blank" rel="noopener noreferrer" aria-label="Zum Shop"><Icon name="external" size={17} /></a>
                        <button className="icon-btn" onClick={() => toggleCompare(p.id)} aria-label="Entfernen"><Icon name="close" size={17} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {baskets.length > 0 && (
        <section className="section">
          <h2 style={{ marginBottom: 12 }}>Warenkorb-Rechner</h2>
          <div className="stack">
            {baskets.map((b) => (
              <div key={b.shop.id} className="panel">
                <div className="row between">
                  <b>{b.list.length} Teile bei {b.shop.name}</b>
                  <span className="tag good">Ersparnis {chf(b.separate - b.together.total)}</span>
                </div>
                <div className="small muted" style={{ marginTop: 6 }}>
                  Zusammen bestellt: <b className="num">{chf(b.together.total)}</b> (Versand {b.together.shippingFree ? 'gratis' : chf(b.together.shipping)}, MWST {chf(b.together.vat)}, Verzollung {chf(b.together.clearance)}) statt einzeln {chf(b.separate)}.
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {items.length > 0 && <OffersSection items={items} />}
    </div>
  );
}

function OffersSection({ items }: { items: Item[] }) {
  const { items: all, shopById } = getData();
  const groups = items.map((p) => ({ p, offers: sameProductOffers(p, all) })).filter((g) => g.offers.length);
  if (!groups.length) return null;
  return (
    <section className="section">
      <h2 style={{ marginBottom: 12 }}>Gleiche Produkte in anderen Shops</h2>
      <div className="stack">
        {groups.map(({ p, offers }) => (
          <div key={p.id} className="panel">
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{p.b} – {p.t}</div>
            <div className="mini-list">
              {[p, ...offers].sort((a, b) => a.tot - b.tot).map((o) => (
                <div key={o.id} className="mini" onClick={() => setParam('p', o.id)}>
                  <img src={imgUrl(o.img, shopById[o.s], 120)} alt="" referrerPolicy="no-referrer" />
                  <div><div className="small">{shopById[o.s]?.name}</div><div className="tiny faint">{o.sz.length ? `Grössen: ${o.sz.join(', ')}` : 'Grössen siehe Shop'}</div></div>
                  <div className="p">{chf(o.tot)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
