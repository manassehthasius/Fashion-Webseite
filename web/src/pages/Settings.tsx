import { useRef, useState } from 'react';
import { exportState, importState, useUser } from '../lib/store';
import { loadSyncConfig, saveSyncConfig, syncNow, triggerGithubUpdate, useSyncStatus, type SyncConfig } from '../lib/sync';
import { ago } from '../lib/format';
import { href } from '../lib/router';
import { toast } from '../components/ui';
import { Icon } from '../components/Icon';

export function Settings() {
  const sync = useSyncStatus();
  const user = useUser();
  const [cfg, setCfg] = useState<SyncConfig>(loadSyncConfig());
  const gh = cfg.github ?? { owner: '', repo: '', token: '', passphrase: '', branch: 'userstate' };
  const fileRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState(localStorage.getItem('stilkompass:theme') ?? 'auto');

  const applyTheme = (t: string) => {
    setTheme(t);
    localStorage.setItem('stilkompass:theme', t);
    if (t === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  };

  return (
    <div className="container" style={{ maxWidth: 900 }}>
      <div className="page-head">
        <div>
          <h1 style={{ fontSize: 'clamp(32px,4vw,46px)' }}>Einstellungen</h1>
          <p>Darstellung, Synchronisierung für Hintergrund-Alarme, Datensicherung.</p>
        </div>
      </div>
      <div className="stack" style={{ gap: 18 }}>
        <section className="panel">
          <h3 style={{ marginBottom: 12 }}>Darstellung</h3>
          <div className="seg">
            {[['auto', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([k, l]) => (
              <button key={k} className={theme === k ? 'on' : ''} onClick={() => applyTheme(k)}>{l}</button>
            ))}
          </div>
        </section>

        <section className="panel stack">
          <div className="row between">
            <h3>Synchronisierung & Hintergrund-Alarme</h3>
            <span className={`tag ${sync.state === 'ok' ? 'good' : sync.state === 'error' ? 'bad' : 'neutral'}`}>
              {sync.backend === 'local' ? 'Lokaler Server' : sync.backend === 'github' ? 'GitHub' : 'Nur dieser Browser'}
              {sync.lastSync ? ` · ${ago(sync.lastSync / 1000)}` : ''}
            </span>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Favoriten, Watchlist und Profil liegen immer in deinem Browser. Damit die Engine dich auch bei geschlossener Seite per Push benachrichtigen kann, braucht sie deine Watchlist:
          </p>
          <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
            <li><b>Lokal</b> (npm start): wird automatisch erkannt – nichts zu tun.</li>
            <li><b>GitHub</b> (kostenloses Hosting): Watchlist wird im Browser mit deiner Passphrase verschlüsselt (AES-256) und im Branch <code>userstate</code> deines Repos gespeichert. Die Engine entschlüsselt sie mit dem gleichen Secret <code>STATE_PASSPHRASE</code>.</li>
          </ul>
          {sync.state === 'error' && <div className="notice warn">{sync.message}</div>}
          <div className="seg">
            {(['auto', 'github', 'off'] as const).map((m) => (
              <button key={m} className={cfg.mode === m ? 'on' : ''} onClick={() => setCfg({ ...cfg, mode: m })}>{m === 'auto' ? 'Automatisch (lokal)' : m === 'github' ? 'GitHub' : 'Aus'}</button>
            ))}
          </div>
          {cfg.mode === 'github' && (
            <div className="form-grid">
              <div className="field"><label>GitHub-Benutzer/Organisation</label><input className="input" value={gh.owner} onChange={(e) => setCfg({ ...cfg, github: { ...gh, owner: e.target.value.trim() } })} placeholder="dein-name" /></div>
              <div className="field"><label>Repository</label><input className="input" value={gh.repo} onChange={(e) => setCfg({ ...cfg, github: { ...gh, repo: e.target.value.trim() } })} placeholder="stilkompass" /></div>
              <div className="field">
                <label>Fine-grained Token</label>
                <input className="input" type="password" value={gh.token} onChange={(e) => setCfg({ ...cfg, github: { ...gh, token: e.target.value.trim() } })} placeholder="github_pat_…" autoComplete="off" />
                <span className="hint">Nur dieses Repo · Contents: Read & write (optional Actions: Read & write für „Jetzt aktualisieren“). Bleibt nur in diesem Browser.</span>
              </div>
              <div className="field">
                <label>Passphrase (= Secret STATE_PASSPHRASE)</label>
                <input className="input" type="password" value={gh.passphrase} onChange={(e) => setCfg({ ...cfg, github: { ...gh, passphrase: e.target.value } })} autoComplete="new-password" />
                <span className="hint">Mindestens 12 Zeichen. Ohne sie kann niemand deine Watchlist lesen.</span>
              </div>
            </div>
          )}
          <div className="row">
            <button
              className="btn primary"
              onClick={() => {
                if (cfg.mode === 'github' && (gh.passphrase?.length ?? 0) < 12) return toast('Passphrase: mindestens 12 Zeichen');
                saveSyncConfig(cfg);
                toast('Gespeichert – synchronisiere …');
              }}
            >
              Speichern & verbinden
            </button>
            <button className="btn" onClick={() => syncNow().then(() => toast('Synchronisiert'))}><Icon name="refresh" size={16} /> Jetzt synchronisieren</button>
            {sync.backend === 'github' && (
              <button className="btn" onClick={() => triggerGithubUpdate().then(() => toast('Aktualisierung gestartet (ca. 3–5 Min.)')).catch((e) => toast(e.message))}>Daten jetzt aktualisieren</button>
            )}
            {sync.backend === 'local' && (
              <button className="btn" onClick={() => fetch('./api/refresh', { method: 'POST' }).then((r) => toast(r.ok ? 'Aktualisierung gestartet' : 'Fehler')).catch(() => toast('Server nicht erreichbar'))}>Daten jetzt aktualisieren</button>
            )}
          </div>
        </section>

        <section className="panel stack">
          <h3>Datensicherung</h3>
          <p className="small muted" style={{ margin: 0 }}>{user.favorites.length} Favoriten · {user.watch.length} Alarme · {user.searches.length} Suchen. Exportiere deine Daten als Datei, um sie auf ein anderes Gerät zu übertragen.</p>
          <div className="row">
            <button
              className="btn"
              onClick={() => {
                const blob = new Blob([exportState()], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `stilkompass-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              <Icon name="arrowDown" size={16} /> Exportieren
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}><Icon name="upload" size={16} /> Importieren</button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  importState(await f.text());
                  toast('Daten importiert');
                } catch (err) {
                  toast((err as Error).message);
                }
              }}
            />
          </div>
        </section>

        <section className="panel">
          <h3 style={{ marginBottom: 8 }}>Über Stilkompass</h3>
          <p className="small muted" style={{ margin: 0 }}>
            Open Source, kostenlos, ohne Konto, ohne Tracking, ohne KI-Abo. Mehr zu Quellen, Qualitätsscore und Grenzen unter <a href={href('/info')} style={{ textDecoration: 'underline' }}>Methode & Transparenz</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
