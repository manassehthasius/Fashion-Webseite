// Direktsuche bei grossen Mode-Shops ohne offenen Feed (Zalando, Zara, H&M, Bershka, Pull&Bear …).
import { useState } from 'react';
import { DEFAULT_EXT_SHOPS, EXT_BY_ID, EXT_SHOPS } from '@shared/mainstream';
import { useUser } from '../lib/store';
import { href } from '../lib/router';
import { ShopTiles } from './ShopTiles';

export function ExtShopLinks({ query, title = 'Bei deinen Lieblingsshops suchen' }: { query: string; title?: string }) {
  const { profile } = useUser();
  const [all, setAll] = useState(false);
  const fav = (profile.extShops?.length ? profile.extShops : DEFAULT_EXT_SHOPS).map((id) => EXT_BY_ID[id]).filter(Boolean);
  const q = query.trim();
  if (!q) return null;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row between">
        <span className="label">{title}</span>
        <a className="tiny faint" href={href('/profil')} style={{ textDecoration: 'underline' }}>Shops wählen</a>
      </div>
      <ShopTiles query={q} tiles={(all ? EXT_SHOPS : fav).map((x) => ({ id: x.id, name: x.name, url: x.url(q), domain: x.domain, sub: all ? x.group : undefined, warn: x.warn }))} />
      <div>
        <button className="btn sm" onClick={() => setAll((x) => !x)}>{all ? 'Nur Lieblingsshops' : `Alle ${EXT_SHOPS.length} Shops zeigen`}</button>
      </div>
      <div className="tiny faint">Produktfotos und Preise dieser Shops kann Stilkompass nicht anzeigen (sie verbieten das automatische Auslesen). Ein Klick öffnet ihre Ergebnisse für „{q}“.</div>
    </div>
  );
}
