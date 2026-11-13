// Shop-Kacheln: grosse Mode-Shops und Plattformen als Bild-Kachel mit Logo und Suchbegriff.
// Produktfotos dieser Shops sind nicht verfügbar (sie verbieten das Auslesen) – ein Klick öffnet ihre Ergebnisse.
// Bewusst ohne fremde Logos: lädt nichts von Drittservern und sieht einheitlich aus.
import { Icon } from './Icon';

export interface Tile {
  id: string;
  name: string;
  url: string;
  domain?: string;
  sub?: string; // z. B. Gruppe oder Hinweis
  warn?: string; // Warnhinweis
  muted?: boolean;
}

function hue(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function ShopTiles({ tiles, query }: { tiles: Tile[]; query: string }) {
  return (
    <div className="tiles">
      {tiles.map((t) => (
        <a key={t.id} className={`tile${t.muted ? ' muted' : ''}`} href={t.url} target="_blank" rel="noopener noreferrer" style={{ ['--h' as string]: hue(t.id) }} title={`„${query}“ bei ${t.name} ansehen`}>
          <div className="tile-top">
            <span className="tile-mark">{t.name}</span>
          </div>
          <div className="tile-body">
            <span className="tile-q">„{query}“</span>
            {t.sub && <span className="tile-sub">{t.sub}</span>}
            {t.warn && <span className="tile-warn">⚠ {t.warn}</span>}
            <span className="tile-go">
              Ergebnisse ansehen <Icon name="external" size={12} />
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}
