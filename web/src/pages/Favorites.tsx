import { useMemo } from 'react';
import { useData } from '../lib/data';
import { toggleFavorite, useUser } from '../lib/store';
import { ProductGrid } from '../components/ProductGrid';
import { Empty, Loading, toast } from '../components/ui';
import { href } from '../lib/router';
import { imgUrl, productUrl } from '@shared/media';
import { chf } from '../lib/format';

export function Favorites() {
  const data = useData();
  const user = useUser();
  const { live, gone } = useMemo(() => {
    const live = user.favorites.map((id) => data.byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
    const gone = user.favorites.filter((id) => !data.byId.has(id));
    return { live, gone };
  }, [user.favorites, data.byId]);
  const total = live.reduce((a, p) => a + p.tot, 0);

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1 style={{ fontSize: 'clamp(32px,4vw,46px)' }}>Favoriten</h1>
          <p>Deine gemerkten Teile – dauerhaft in diesem Browser gespeichert{user.favorites.length ? ` · Summe ${chf(total)}` : ''}.</p>
        </div>
        <div className="row">
          <a className="btn sm" href={href('/alarme')}>Preisalarme</a>
          <a className="btn sm" href={href('/vergleich')}>Vergleichen</a>
        </div>
      </div>
      {data.status === 'loading' && <Loading />}
      {data.status === 'ready' && !user.favorites.length && (
        <Empty title="Noch keine Favoriten" action={<a className="btn primary" href={href('/neu')}>Kleidung entdecken</a>}>
          Tippe auf das Herz bei einem Produkt, um es hier zu speichern.
        </Empty>
      )}
      {live.length > 0 && <ProductGrid items={live} />}
      {gone.length > 0 && (
        <section className="section">
          <div className="label" style={{ marginBottom: 10 }}>Nicht mehr im Katalog ({gone.length})</div>
          <div className="mini-list" style={{ maxWidth: 640 }}>
            {gone.map((id) => {
              const s = user.favSnapshots?.[id];
              const shop = s ? data.shopById[s.s] : undefined;
              return (
                <div key={id} className="mini" style={{ cursor: 'default' }}>
                  {s ? <img src={imgUrl(s.img, shop, 160)} alt="" referrerPolicy="no-referrer" /> : <div />}
                  <div style={{ minWidth: 0 }}>
                    <div className="tiny faint">{s?.b} · ausverkauft oder entfernt</div>
                    <div className="t">{s?.t ?? id}</div>
                    {s && shop && (
                      <a className="tiny" style={{ textDecoration: 'underline' }} href={productUrl(s, shop)} target="_blank" rel="noopener noreferrer">
                        Im Shop prüfen
                      </a>
                    )}
                  </div>
                  <button
                    className="btn sm ghost"
                    onClick={() => {
                      toggleFavorite({ id, ...(s ?? {}) } as never);
                      toast('Entfernt');
                    }}
                  >
                    Entfernen
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
