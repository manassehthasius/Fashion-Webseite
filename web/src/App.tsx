import { lazy, Suspense, useState, type ReactNode } from 'react';
import { href, navigate, useRoute } from './lib/router';
import { useUser } from './lib/store';
import { Icon } from './components/Icon';
import { Panel, Toaster } from './components/ui';
import { ProductDetailHost } from './components/ProductDetail';
import { SearchBar } from './components/SearchBar';
import { Home } from './pages/Home';
import { Shop } from './pages/Shop';
import { Favorites } from './pages/Favorites';
import { Alerts } from './pages/Alerts';
import { Profile } from './pages/Profile';
import { Compare } from './pages/Compare';
import { Outfits } from './pages/Outfits';
import { Settings } from './pages/Settings';
import { About } from './pages/About';
import { useAlertCount } from './lib/alerts';
import { useData } from './lib/data';
import { ago } from './lib/format';

const ImageSearch = lazy(() => import('./pages/ImageSearch'));

const NAV: [string, string][] = [
  ['/neu', 'Neue Kleidung'],
  ['/secondhand', 'Secondhand'],
  ['/bildsuche', 'KI-Bildsuche'],
  ['/outfits', 'Outfits'],
  ['/vergleich', 'Preisvergleich'],
];

export function App() {
  const route = useRoute();
  const user = useUser();
  const alertCount = useAlertCount();
  const data = useData();
  const [more, setMore] = useState(false);
  const path = route.path;

  let page: ReactNode;
  switch (path) {
    case '/neu':
      page = <Shop segment="new" />;
      break;
    case '/secondhand':
      page = <Shop segment="secondhand" />;
      break;
    case '/suche':
      page = <Shop segment="all" />;
      break;
    case '/bildsuche':
      page = (
        <Suspense fallback={<div className="container"><div className="empty"><div className="spinner" /></div></div>}>
          <ImageSearch />
        </Suspense>
      );
      break;
    case '/outfits':
      page = <Outfits />;
      break;
    case '/vergleich':
      page = <Compare />;
      break;
    case '/favoriten':
      page = <Favorites />;
      break;
    case '/alarme':
      page = <Alerts />;
      break;
    case '/profil':
      page = <Profile />;
      break;
    case '/einstellungen':
      page = <Settings />;
      break;
    case '/info':
      page = <About />;
      break;
    default:
      page = <Home />;
  }

  return (
    <div className="app">
      <header className="header">
        <div className="container header-inner">
          <a href="#/" className="logo" aria-label="Stilkompass Startseite">
            <b>Stilkompass</b>
            <span>Schweiz</span>
          </a>
          <nav className="nav" aria-label="Hauptnavigation">
            {NAV.map(([p, label]) => (
              <a key={p} href={`#${p}`} className={path === p ? 'active' : ''}>
                {label}
              </a>
            ))}
          </nav>
          <div className="header-search">
            {!['/', '/neu', '/secondhand', '/suche'].includes(path) && <SearchBar compact onSubmit={(q) => navigate('/suche', { q })} />}
          </div>
          <div className="header-actions">
            <a className="icon-btn" href="#/favoriten" aria-label="Favoriten">
              <Icon name="heart" />
              {user.favorites.length > 0 && <span className="dot">{user.favorites.length}</span>}
            </a>
            <a className="icon-btn" href="#/alarme" aria-label="Preisalarme">
              <Icon name="bell" />
              {alertCount > 0 && <span className="dot">{alertCount}</span>}
            </a>
            <a className="icon-btn" href="#/profil" aria-label="Style-Profil">
              <Icon name="user" />
            </a>
            <a className="icon-btn desktop-only" href="#/einstellungen" aria-label="Einstellungen">
              <Icon name="settings" />
            </a>
          </div>
        </div>
      </header>

      <main>{page}</main>

      <footer className="footer">
        <div className="container stack" style={{ gap: 6 }}>
          <div>
            Stilkompass ist kostenlos und werbefrei. Produktdaten aus den öffentlichen Feeds von {data.shops.length || 50}+ Shops
            {data.generatedAt ? `, aktualisiert ${ago(Date.parse(data.generatedAt) / 1000)}` : ''}. Preise ohne Gewähr – verbindlich ist der Shop.
          </div>
          <div className="row" style={{ gap: 16 }}>
            <a href="#/info">Methode & Transparenz</a>
            <a href="#/einstellungen">Einstellungen & Sync</a>
          </div>
        </div>
      </footer>

      <nav className="bottom-nav" aria-label="Navigation">
        <a href="#/" className={path === '/' ? 'active' : ''}>
          <Icon name="home" size={22} />
          Entdecken
        </a>
        <a href="#/neu" className={path === '/neu' || path === '/suche' ? 'active' : ''}>
          <Icon name="tag" size={22} />
          Neu
        </a>
        <a href="#/secondhand" className={path === '/secondhand' ? 'active' : ''}>
          <Icon name="recycle" size={22} />
          Secondhand
        </a>
        <a href="#/favoriten" className={path === '/favoriten' || path === '/alarme' ? 'active' : ''}>
          <Icon name="heart" size={22} />
          Merkliste
          {alertCount > 0 && <span className="badge">{alertCount}</span>}
        </a>
        <button onClick={() => setMore(true)} className={['/bildsuche', '/outfits', '/vergleich', '/profil', '/einstellungen', '/info'].includes(path) ? 'active' : ''}>
          <Icon name="menu" size={22} />
          Mehr
        </button>
      </nav>

      <Panel open={more} onClose={() => setMore(false)} side="bottom" title="Mehr">
        <div className="more-menu" onClick={() => setMore(false)}>
          <a href={href('/bildsuche')}><Icon name="camera" /> <div>KI-Bildsuche<small>Foto hochladen, ähnliche Teile finden</small></div></a>
          <a href={href('/outfits')}><Icon name="layers" /> <div>Outfit-Empfehlungen<small>Komplette Looks in deinem Stil und Budget</small></div></a>
          <a href={href('/vergleich')}><Icon name="scale" /> <div>Preisvergleich<small>Gesamtpreise & Warenkorb-Rechner</small></div></a>
          <a href={href('/alarme')}><Icon name="bell" /> <div>Preisalarme & Watchlist<small>Preisstürze, Wunschpreise, Verfügbarkeit</small></div></a>
          <a href={href('/profil')}><Icon name="user" /> <div>Style-Profil<small>Marken, Grössen, Farben, Budget</small></div></a>
          <a href={href('/einstellungen')}><Icon name="settings" /> <div>Einstellungen<small>Benachrichtigungen, Sync, Daten</small></div></a>
          <a href={href('/info')}><Icon name="info" /> <div>Methode & Transparenz<small>Quellen, Qualitätsscore, Grenzen</small></div></a>
        </div>
      </Panel>

      <ProductDetailHost id={route.params.get('p')} />
      <Toaster />
    </div>
  );
}
