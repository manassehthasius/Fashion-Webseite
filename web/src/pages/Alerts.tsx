import { useEffect, useMemo, useState } from 'react';
import { useData } from '../lib/data';
import { removeSearch, removeWatch, updateSearch, useUser } from '../lib/store';
import { newMatchesFor, useWatchStatus } from '../lib/alerts';
import { currentSubscription, disablePush, enablePush, localTestNotification, pushSupported } from '../lib/push';
import { useSyncStatus } from '../lib/sync';
import { href, setParam } from '../lib/router';
import { chf, ago } from '../lib/format';
import { imgUrl } from '@shared/media';
import { platformLinks } from '@shared/platforms';
import { Empty, Switch, toast } from '../components/ui';
import { Icon } from '../components/Icon';

export function Alerts() {
  const data = useData();
  const user = useUser();
  const watch = useWatchStatus();
  const sync = useSyncStatus();
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    void pushSupported().then(setSupported);
    void currentSubscription().then((s) => setPushOn(!!s));
  }, []);

  const searchMatches = useMemo(() => (data.status === 'ready' ? Object.fromEntries(user.searches.map((s) => [s.id, newMatchesFor(s, data.items, data.shopById)])) : {}), [data.status, data.items, data.shopById, user.searches]);

  const backendLabel = sync.backend === 'local' ? 'Lokaler Server' : sync.backend === 'github' ? 'GitHub (verschlüsselt)' : 'nicht verbunden';
  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1 style={{ fontSize: 'clamp(32px,4vw,46px)' }}>Preisalarme & Watchlist</h1>
          <p>Preisstürze, Wunschpreise, wieder verfügbare Grössen und neue Secondhand-Treffer – geprüft alle 30 Minuten.</p>
        </div>
      </div>

      <section className="panel stack" style={{ marginBottom: 28 }}>
        <div className="row between">
          <div>
            <div style={{ fontWeight: 650 }}>Benachrichtigungen bei geschlossener Seite</div>
            <div className="small muted">Web-Push (kostenlos, Browser-Standard) · Hintergrund-Dienst: <b>{backendLabel}</b>{sync.lastSync ? ` · synchronisiert ${ago(sync.lastSync / 1000)}` : ''}</div>
          </div>
          {supported ? (
            <Switch
              checked={!!pushOn}
              onChange={async (v) => {
                try {
                  if (v) {
                    await enablePush();
                    setPushOn(true);
                    toast('Push-Benachrichtigungen aktiviert');
                  } else {
                    await disablePush();
                    setPushOn(false);
                    toast('Push deaktiviert');
                  }
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            />
          ) : (
            <span className="tag warn">Nicht unterstützt</span>
          )}
        </div>
        {sync.backend === 'none' && (
          <div className="notice warn">
            <Icon name="info" />
            <div>
              Damit Alarme auch bei geschlossener Seite ankommen, braucht die Engine deine Watchlist. Verbinde unter <a href={href('/einstellungen')} style={{ textDecoration: 'underline' }}>Einstellungen → Synchronisierung</a> deinen lokalen Server oder dein GitHub-Repo (Ende-zu-Ende verschlüsselt). Ohne Verbindung siehst du Alarme hier, sobald du die Seite öffnest.
            </div>
          </div>
        )}
        {sync.state === 'error' && <div className="notice warn">Synchronisierung: {sync.message}</div>}
        {pushOn && (
          <div className="row">
            <button className="btn sm" onClick={() => localTestNotification().catch((e) => toast(e.message))}>Testbenachrichtigung</button>
          </div>
        )}
        {!supported && <div className="small muted">iPhone/iPad: Teilen → „Zum Home-Bildschirm“, dann die App von dort öffnen (iOS 16.4+). Android & Desktop: Chrome, Edge, Firefox, Safari.</div>}
      </section>

      <section>
        <div className="section-head"><h2>Watchlist ({user.watch.length})</h2></div>
        {!user.watch.length && (
          <Empty title="Noch keine beobachteten Produkte">
            Öffne ein Produkt und tippe auf die Glocke, um einen Wunschpreis oder eine Grösse zu beobachten.
          </Empty>
        )}
        <div className="list">
          {watch.map(({ w, p, reasons, diff }) => {
            const shop = data.shopById[w.snapshot?.s ?? p?.s ?? ''];
            return (
              <div key={w.id} className="list-row">
                <img src={imgUrl(p?.img ?? w.snapshot?.img, shop, 160)} alt="" style={{ width: 64, height: 80, objectFit: 'cover', borderRadius: 10, background: 'var(--surface-2)', cursor: 'pointer' }} onClick={() => p && setParam('p', p.id)} referrerPolicy="no-referrer" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tiny faint">{w.snapshot?.b} · {shop?.name}</div>
                  <div style={{ fontWeight: 550, cursor: 'pointer' }} onClick={() => p && setParam('p', p.id)}>{w.snapshot?.t}</div>
                  <div className="row small" style={{ gap: 8, marginTop: 4 }}>
                    {p ? <b className="num">{chf(p.tot)}</b> : <span className="tag bad">Nicht mehr verfügbar</span>}
                    {p && Math.abs(diff) >= 0.5 && <span style={{ color: diff < 0 ? 'var(--good)' : 'var(--bad)' }} className="num">{diff < 0 ? '−' : '+'}{chf(Math.abs(diff))} seit Speichern</span>}
                    {w.target && <span className="faint">Wunsch: {chf(w.target)}</span>}
                    {w.size && <span className="faint">Grösse {w.size}</span>}
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 6 }}>
                    {reasons.includes('target') && <span className="tag good">Wunschpreis erreicht</span>}
                    {reasons.includes('drop') && <span className="tag good">Preis gesunken</span>}
                    {reasons.includes('stock') && <span className="tag good">Grösse {w.size} wieder da</span>}
                  </div>
                </div>
                <button className="icon-btn" aria-label="Entfernen" onClick={() => { removeWatch(w.id); toast('Alarm entfernt'); }}>
                  <Icon name="trash" size={18} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>Gespeicherte Suchen ({user.searches.length})</h2></div>
        {!user.searches.length && (
          <Empty title="Keine gespeicherten Suchen">
            Suche z. B. „Barbour Wachsjacke“ unter <a href={href('/secondhand')} style={{ textDecoration: 'underline' }}>Secondhand</a> und tippe auf „Suche speichern“ – du wirst bei neuen Angeboten benachrichtigt.
          </Empty>
        )}
        <div className="list">
          {user.searches.map((s) => {
            const matches = searchMatches[s.id] ?? [];
            const path = s.segment === 'secondhand' ? '/secondhand' : s.segment === 'new' ? '/neu' : '/suche';
            return (
              <div key={s.id} className="list-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a href={href(path, { q: s.query })} style={{ fontWeight: 600 }}>{s.name}</a>
                  <div className="small muted">
                    {s.segment === 'secondhand' ? 'Secondhand' : s.segment === 'new' ? 'Neu' : 'Alle'} · „{s.query || 'alle'}“ · gespeichert {ago(s.createdAt / 1000)}
                  </div>
                  <div className="chips" style={{ marginTop: 8 }}>
                    <span className="tiny faint">Suchabo auch hier anlegen:</span>
                    {platformLinks({ q: s.query, maxPrice: s.filters.maxPrice }).filter((l) => ['ricardo', 'tutti', 'vestiaire', 'ebay'].includes(l.id)).map((l) => (
                      <a key={l.id} className="chip" style={{ height: 28, fontSize: 12 }} href={l.url} target="_blank" rel="noopener noreferrer" title={l.note}>
                        {l.name} <Icon name="external" size={12} />
                      </a>
                    ))}
                  </div>
                  {matches.length > 0 && (
                    <div className="row" style={{ marginTop: 8, gap: 6 }}>
                      <span className="tag good">{matches.length} neue Treffer</span>
                      {matches.slice(0, 5).map((m) => (
                        <img key={m.id} src={imgUrl(m.img, data.shopById[m.s], 120)} alt="" title={m.t} onClick={() => setParam('p', m.id)} style={{ width: 36, height: 45, objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }} referrerPolicy="no-referrer" />
                      ))}
                    </div>
                  )}
                </div>
                <label className="row tiny muted" style={{ gap: 6 }}>
                  <Switch checked={s.notifyNew} onChange={(v) => updateSearch(s.id, { notifyNew: v })} /> Push
                </label>
                <button className="icon-btn" aria-label="Suche löschen" onClick={() => { removeSearch(s.id); toast('Suche gelöscht'); }}>
                  <Icon name="trash" size={18} />
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
