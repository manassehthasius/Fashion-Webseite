// Preisvergleich für ein bestimmtes Produkt: gleiche Modelle aus allen Shops gruppiert + Links für alle weiteren Webseiten.
import { useMemo } from 'react';
import type { Item } from '../lib/data';
import { getData } from '../lib/data';
import { titleTokens, jaccard } from '@shared/similar';
import { platformLinks } from '@shared/platforms';
import { imgUrl } from '@shared/media';
import { fold } from '@shared/text';
import { CONDITION_LABELS } from '@shared/taxonomy';
import { hasMySize } from '@shared/personalize';
import { chf, days } from '../lib/format';
import { setParam } from '../lib/router';
import { useUser } from '../lib/store';
import { Icon } from './Icon';
import { QualityPill } from './ui';

interface Cluster {
  key: string;
  title: string;
  brand: string;
  offers: Item[];
}

export function clusterOffers(items: Item[], limit = 240): Cluster[] {
  const clusters: (Cluster & { tok: string[] })[] = [];
  for (const p of items.slice(0, limit)) {
    const tok = titleTokens(p);
    const b = fold(p.b.toLowerCase());
    const c = clusters.find((x) => fold(x.brand.toLowerCase()) === b && x.offers[0].cat === p.cat && jaccard(x.tok, tok) >= 0.55);
    if (c) c.offers.push(p);
    else clusters.push({ key: p.id, title: p.t, brand: p.b, offers: [p], tok });
  }
  for (const c of clusters) c.offers.sort((a, b) => a.tot - b.tot);
  // Modelle mit mehreren Shops zuerst, dann nach Relevanz (Reihenfolge der Suche)
  return clusters
    .map((c, i) => ({ c, i, shops: new Set(c.offers.map((o) => o.s)).size }))
    .sort((a, b) => (b.shops > 1 ? 1 : 0) - (a.shops > 1 ? 1 : 0) || a.i - b.i)
    .map((x) => x.c);
}

/** Pro Shop nur das günstigste Angebot (weitere Farben/Varianten werden gezählt) */
function perShop(offers: Item[]): { o: Item; variants: number }[] {
  const by = new Map<string, { o: Item; variants: number }>();
  for (const o of offers) {
    const cur = by.get(o.s);
    if (!cur) by.set(o.s, { o, variants: 1 });
    else {
      cur.variants++;
      if (o.tot < cur.o.tot) cur.o = o;
    }
  }
  return [...by.values()].sort((a, b) => a.o.tot - b.o.tot);
}

export function ProductCompareBox({ items, query }: { items: Item[]; query: string }) {
  const { shopById } = getData();
  const user = useUser();
  const clusters = useMemo(() => clusterOffers(items).slice(0, 4), [items]);
  const links = platformLinks({ q: query });
  const external = links.filter((l) => l.segment === 'compare' || ['zalando', 'galaxus', 'ricardo', 'ebay'].includes(l.id));
  const multi = clusters.filter((c) => new Set(c.offers.map((o) => o.s)).size > 1).length;

  return (
    <section className="panel stack" style={{ marginBottom: 24 }}>
      <div className="row between">
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Preisvergleich für „{query}“</div>
          <div className="small muted">
            {items.length ? `${items.length} passende Angebote in ${new Set(items.map((p) => p.s)).size} Shops${multi ? ` · ${multi} Modell${multi > 1 ? 'e' : ''} in mehreren Shops` : ''}` : 'Im Katalog nichts Passendes – vergleiche direkt bei allen Onlineshops:'}
          </div>
        </div>
      </div>
      {clusters.map((c) => (
        <div key={c.key} className="card" style={{ padding: 12 }}>
          <div className="row" style={{ gap: 10, flexWrap: 'nowrap', marginBottom: 8 }}>
            <img src={imgUrl(c.offers[0].img, shopById[c.offers[0].s], 120)} alt="" style={{ width: 44, height: 55, objectFit: 'cover', borderRadius: 6, flex: 'none' }} referrerPolicy="no-referrer" />
            <div style={{ minWidth: 0 }}>
              <div className="tiny faint">{c.brand}</div>
              <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{c.title}</div>
            </div>
          </div>
          <div className="mini-list">
            {perShop(c.offers).slice(0, 5).map(({ o, variants }, i, arr) => {
              const shop = shopById[o.s];
              const mine = hasMySize(o, user.profile);
              return (
                <div key={o.id} className="mini" style={{ gridTemplateColumns: '1fr auto' }} onClick={() => setParam('p', o.id)} role="button">
                  <div style={{ minWidth: 0 }}>
                    <div className="small" style={{ fontWeight: 600 }}>
                      {shop?.name} {i === 0 && arr.length > 1 && <span className="tag good">Bester Preis</span>}
                      {variants > 1 && <span className="tiny faint"> · {variants} Varianten ab</span>}
                    </div>
                    <div className="tiny faint">
                      {shop ? days(shop.shipping.days) : ''} · <QualityPill q={o.q} qc={o.qc} />
                      {o.cond ? ` · ${CONDITION_LABELS[o.cond]}` : ''}
                      {mine === true ? ' · deine Grösse ✓' : mine === false ? ' · deine Grösse fehlt' : ''}
                    </div>
                  </div>
                  <div className="p">{chf(o.tot)}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div>
        <div className="label" style={{ marginBottom: 8 }}>In allen anderen Onlineshops vergleichen</div>
        <div className="chips">
          {external.map((l) => (
            <a key={l.id} className="chip" href={l.url} target="_blank" rel="noopener noreferrer" title={l.note}>
              {l.name} <Icon name="external" size={13} />
            </a>
          ))}
        </div>
        <div className="tiny faint" style={{ marginTop: 6 }}>Google Shopping und toppreise.ch durchsuchen zusätzlich Shops ohne öffentlichen Feed (z. B. Zalando, Manor, Globus).</div>
      </div>
    </section>
  );
}
