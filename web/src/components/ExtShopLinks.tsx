// Direktsuche bei grossen Mode-Shops ohne offenen Feed (Zalando, Zara, H&M, Bershka, Pull&Bear …).
import { useState } from 'react';
import { DEFAULT_EXT_SHOPS, EXT_BY_ID, EXT_GROUPS, EXT_SHOPS } from '@shared/mainstream';
import { useUser } from '../lib/store';
import { href } from '../lib/router';
import { Icon } from './Icon';

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
      <div className="chips scroll">
        {fav.map((s) => (
          <a key={s.id} className="chip" href={s.url(q)} target="_blank" rel="noopener noreferrer" title={s.mode === 'site' ? `Sucht über Google nur auf ${s.name}` : `Öffnet die Suche von ${s.name}`}>
            {s.name} <Icon name="external" size={13} />
          </a>
        ))}
        <button className="chip soft" onClick={() => setAll((x) => !x)}>{all ? 'Weniger' : `Alle ${EXT_SHOPS.length} Shops`}</button>
      </div>
      {all && (
        <div className="stack" style={{ gap: 8 }}>
          {EXT_GROUPS.map((g) => (
            <div key={g}>
              <div className="tiny faint" style={{ marginBottom: 4 }}>{g}</div>
              <div className="chips">
                {EXT_SHOPS.filter((s) => s.group === g).map((s) => (
                  <a key={s.id} className="chip" href={s.url(q)} target="_blank" rel="noopener noreferrer">
                    {s.name} <Icon name="external" size={13} />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="tiny faint">Diese Shops erlauben kein automatisches Auslesen. Der Link öffnet deshalb ihre eigene Suche mit „{q}“. Preise und Qualität bitte dort prüfen. Für einen Preisvergleich über alle Shops: Google Shopping.</div>
    </div>
  );
}
