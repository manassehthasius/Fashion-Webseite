import { memo } from 'react';
import type { Item } from '../lib/data';
import { getData } from '../lib/data';
import { imgUrl } from '@shared/media';
import { CONDITION_LABELS } from '@shared/taxonomy';
import { chf } from '../lib/format';
import { setParam } from '../lib/router';
import { toggleFavorite, useUser } from '../lib/store';
import { Icon } from './Icon';
import { QualityPill, toast } from './ui';
import type { Match } from '@shared/personalize';

function openDetail(id: string) {
  setParam('p', id);
}

export const ProductCard = memo(function ProductCard({ p, match, compact = false }: { p: Item; match?: Match | null; compact?: boolean }) {
  const user = useUser();
  const shop = getData().shopById[p.s];
  const fav = user.favorites.includes(p.id);
  const discount = p.chfWas && p.chfWas > p.chf ? Math.round((1 - p.chf / p.chfWas) * 100) : 0;
  const w = compact ? 360 : 480;
  return (
    <article className="pcard">
      <div className="media" onClick={() => openDetail(p.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openDetail(p.id)} aria-label={`${p.b} ${p.t} öffnen`}>
        <img src={imgUrl(p.img, shop, w)} alt={p.t} loading="lazy" decoding="async" width={w} height={w * 1.25} referrerPolicy="no-referrer" />
        <div className="badges">
          {discount >= 5 && <span className="tag dark">−{discount}%</span>}
          {p.drop && <span className="tag good">Preissturz −{p.drop}%</span>}
          {p.seg === 'secondhand' && <span className="tag neutral">{p.cond ? CONDITION_LABELS[p.cond] : 'Secondhand'}</span>}
          {p.low && !p.drop && p.tot <= p.low + 0.05 && <span className="tag accent">Tiefstpreis</span>}
        </div>
        <button
          className={`fav${fav ? ' on' : ''}`}
          aria-label={fav ? 'Aus Favoriten entfernen' : 'Zu Favoriten'}
          onClick={(e) => {
            e.stopPropagation();
            toast(toggleFavorite(p) ? 'Zu Favoriten hinzugefügt' : 'Aus Favoriten entfernt');
          }}
        >
          <Icon name="heart" size={17} fill={fav ? 'currentColor' : 'none'} />
        </button>
        {!p.av && <div className="soldout">Ausverkauft</div>}
      </div>
      <div className="info" onClick={() => openDetail(p.id)}>
        <div className="brand">{p.b}</div>
        <div className="title">{p.t}</div>
        <div className="price">
          <b>{chf(p.tot)}</b>
          {discount >= 5 && p.chfWas && <s>{chf(p.chfWas)}</s>}
        </div>
        <div className="meta">
          <QualityPill q={p.q} qc={p.qc} />
          <span className="sep" />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>{shop?.name}</span>
        </div>
        {match && match.reasons.length > 0 && !compact && <div className="match">✓ {match.reasons.slice(0, 2).join(' · ')}</div>}
      </div>
    </article>
  );
});
