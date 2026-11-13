import { useEffect, useMemo, useState } from 'react';
import { useData, type Item } from '../lib/data';
import { useUser } from '../lib/store';
import { href, navigate } from '../lib/router';
import { SearchBar } from '../components/SearchBar';
import { Rail } from '../components/ProductGrid';
import { Empty, Loading } from '../components/ui';
import { combinedMatch, isPersonalized, rankValue, type Match } from '@shared/personalize';
import { totalSignal } from '@shared/interests';
import { getEmbIndex, loadEmbIndex, nearest, vectorOf } from '../lib/clipIndex';
import { ago } from '../lib/format';

function topBy(items: Item[], score: (p: Item) => number, n = 16, perShop = 3): Item[] {
  const sorted = items.map((p) => ({ p, s: score(p) })).filter((x) => Number.isFinite(x.s)).sort((a, b) => b.s - a.s);
  const out: Item[] = [];
  const shopCount = new Map<string, number>();
  for (const { p } of sorted) {
    const c = shopCount.get(p.s) ?? 0;
    if (c >= perShop) continue;
    shopCount.set(p.s, c + 1);
    out.push(p);
    if (out.length >= n) break;
  }
  return out;
}

export function Home() {
  const data = useData();
  const user = useUser();
  // Interessen beim Öffnen der Startseite einfrieren (kein Umsortieren beim Ansehen von Produkten)
  const [interests] = useState(() => user.interests);
  const personal = isPersonalized(user.profile, interests);
  const learned = totalSignal(interests) >= 3;

  const rails = useMemo(() => {
    if (data.status !== 'ready') return null;
    let avail = data.items.filter((p) => p.av);
    const now = Date.now() / 1000;
    const matches = new Map<string, Match>();
    if (personal) {
      for (const p of avail) matches.set(p.id, combinedMatch(p, user.profile, interests));
      // Unpassendes (z. B. falsches Geschlecht, ausgeblendete Marken) überall ausblenden
      avail = avail.filter((p) => !matches.get(p.id)!.blocked && matches.get(p.id)!.score >= 25);
    }
    const forYou = personal
      ? topBy(avail, (p) => {
          const m = matches.get(p.id)!;
          return rankValue(p, p.v, m, user.profile.priority) + m.score * 0.6;
        })
      : [];
    const drops = topBy(avail.filter((p) => p.q >= 58 && ((p.drop ?? 0) >= 5 || (p.chfWas && p.chfWas > p.chf * 1.15))), (p) => (p.drop ?? 0) * 2 + (p.chfWas ? (1 - p.chf / p.chfWas) * 100 : 0) + p.q * 0.3 + (matches.get(p.id)?.score ?? 50) * 0.3);
    const value = topBy(avail.filter((p) => p.seg === 'new' && p.qc >= 0.5), (p) => p.v + p.q * 0.2 + (matches.get(p.id)?.score ?? 50) * 0.3);
    const fresh = topBy(avail.filter((p) => now - p.first < 3 * 86400 && p.q >= 60), (p) => p.q + p.v * 0.3 - (now - p.first) / 86400 + (matches.get(p.id)?.score ?? 50) * 0.3);
    const treasures = topBy(avail.filter((p) => p.seg === 'secondhand' && p.q >= 70), (p) => p.v + (p.cond === 'nwt' || p.cond === 'excellent' ? 8 : 0) + (matches.get(p.id)?.score ?? 50) * 0.3);
    const swiss = topBy(avail.filter((p) => data.shopById[p.s]?.country === 'CH' && p.seg === 'new'), (p) => p.q + p.v * 0.5, 16, 5);
    const seen = (interests?.seen ?? []).map((id) => data.byId.get(id)).filter((p): p is Item => !!p).slice(0, 16);
    return { forYou, drops, value, fresh, treasures, swiss, seen };
  }, [data.status, data.items, data.shopById, data.byId, personal, user.profile, interests]);

  const nNew = data.items.filter((p) => p.seg === 'new').length;
  const nSecond = data.items.length - nNew;

  return (
    <div className="container">
      <section className="hero">
        <div className="eyebrow">Persönlicher AI Fashion Finder · Schweiz</div>
        <h1>
          Hochwertige Kleidung.<br />
          Zum <em>besten Gesamtpreis</em>.
        </h1>
        <p className="hero-sub">
          Neue Mode und Secondhand aus {data.shops.length || '50+'} geprüften Shops mit Lieferung in die Schweiz. Mit echtem Gesamtpreis inkl. Versand, MWST und Verzollung, Qualitätsscore und Preisalarmen.
        </p>
        <SearchBar large onSubmit={(q) => navigate('/suche', { q })} />
        <div className="hero-stats">
          <span><b>{nNew.toLocaleString('de-CH')}</b> neue Produkte</span>
          <span><b>{nSecond.toLocaleString('de-CH')}</b> Secondhand & Vintage</span>
          <span><b>{data.shops.length}</b> Shops</span>
          {data.generatedAt && <span>Aktualisiert {ago(Date.parse(data.generatedAt) / 1000)}</span>}
        </div>
        <div className="quick">
          <a href={href('/neu')}><b>Neue Kleidung</b><span>Qualitätsmarken mit CH-Versand</span></a>
          <a href={href('/secondhand')}><b>Secondhand</b><span>Vintage, Designer & Plattformen</span></a>
          <a href={href('/bildsuche')}><b>KI-Bildsuche</b><span>Foto hochladen, Ähnliches finden</span></a>
          <a href={href('/outfits')}><b>Outfits</b><span>Komplette Looks für dein Budget</span></a>
        </div>
      </section>

      {data.status === 'loading' && <Loading />}
      {data.status === 'error' && <Empty title="Daten nicht verfügbar">{data.error}</Empty>}

      {rails && (
        <>
          {personal ? (
            rails.forYou.length > 0 && (
              <RailSection
                title="Für dich ausgewählt"
                sub={learned ? 'Gelernt aus dem, was du ansiehst, merkst und suchst – plus deinem Style-Profil' : 'Passend zu deinem Style-Profil, deinen Grössen und deinem Budget'}
                link={href('/suche', { sort: 'relevance' })}
                items={rails.forYou}
              />
            )
          ) : (
            <section className="section">
              <div className="notice">
                <span>✦</span>
                <div>
                  <b>Personalisiere deine Empfehlungen.</b> Lege im <a href={href('/profil')} style={{ textDecoration: 'underline' }}>Style-Profil</a> Marken, Grössen, Farben, Materialien und Budget fest. Dann zeigt Stilkompass passende Teile in deiner Grösse zuerst.
                </div>
              </div>
            </section>
          )}
          <ImageRecs />
          {rails.drops.length > 0 && <RailSection title="Preisstürze & Sale" sub="Echte Preissenkungen bei hochwertigen Teilen" link={href('/suche', { sale: 1, sort: 'drop' })} items={rails.drops} />}
          <RailSection title="Beste Preis-Leistung" sub="Hohe, datenbasierte Qualität zu einem Preis unter dem Kategorie-Durchschnitt" link={href('/neu', { sort: 'value' })} items={rails.value} />
          {rails.treasures.length > 0 && <RailSection title="Secondhand-Schätze" sub="Top-Zustand und Qualität, oft zu einem Bruchteil des Neupreises" link={href('/secondhand', { sort: 'value' })} items={rails.treasures} />}
          {rails.fresh.length > 0 && <RailSection title="Neu eingetroffen" sub="Seit den letzten Tagen in den Shops" link={href('/neu', { sort: 'new' })} items={rails.fresh} />}
          {rails.seen.length > 0 && <RailSection title="Zuletzt angesehen" items={rails.seen} />}
          {rails.swiss.length > 0 && <RailSection title="Aus Schweizer Shops" sub="Keine Importkosten, schnelle Lieferung" link={href('/neu', { shop: data.shops.filter((s) => s.country === 'CH' && s.segment === 'new').map((s) => s.id).join('~') })} items={rails.swiss} />}
        </>
      )}
    </div>
  );
}

function RailSection({ title, sub, link, items }: { title: string; sub?: string; link?: string; items: Item[] }) {
  if (!items.length) return null;
  return (
    <section className="section">
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          {sub && <div className="small muted" style={{ marginTop: 4 }}>{sub}</div>}
        </div>
        {link && <a href={link}>Alle ansehen →</a>}
      </div>
      <Rail items={items} />
    </section>
  );
}

/** Vorschläge anhand deiner hochgeladenen Bilder und Favoriten (visuelle Ähnlichkeit, lokal berechnet) */
function ImageRecs() {
  const data = useData();
  const user = useUser();
  const [ready, setReady] = useState(!!getEmbIndex());
  const imgs = user.interests?.img ?? [];
  const favs = user.favorites.slice(0, 6);
  const wanted = imgs.length > 0 || favs.length > 0;
  useEffect(() => {
    if (!wanted || ready) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    loadEmbIndex().then((i) => setReady(!!i)).catch(() => {});
  }, [wanted, ready]);
  const items = useMemo(() => {
    if (!ready || data.status !== 'ready') return [];
    const queries: Float32Array[] = [
      ...imgs.slice(0, 4).map((x) => Float32Array.from(x.vec)),
      ...favs.map((id) => vectorOf(id)).filter((v): v is Float32Array => !!v).slice(0, 4),
    ];
    if (!queries.length) return [];
    const exclude = new Set(user.favorites);
    const lists = queries.map((q) => nearest(q, 12, (id) => !exclude.has(id) && !!data.byId.get(id)?.av));
    const out: Item[] = [];
    const seen = new Set<string>();
    for (let r = 0; r < 12 && out.length < 16; r++) {
      for (const l of lists) {
        const hit = l[r];
        if (hit && !seen.has(hit.id)) {
          seen.add(hit.id);
          const p = data.byId.get(hit.id);
          if (p) out.push(p);
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, data.status, data.byId, imgs.length, favs.join()]);
  if (!wanted || !items.length) return null;
  return (
    <RailSection
      title={imgs.length ? 'Passend zu deinen Bildern' : 'Ähnlich wie deine Favoriten'}
      sub={imgs.length ? 'Visuell ähnliche Teile zu den Fotos, die du in der KI-Bildsuche hochgeladen hast' : 'Visuell ähnliche Teile – lade Fotos in der KI-Bildsuche hoch, um das zu verfeinern'}
      link={href('/bildsuche')}
      items={items}
    />
  );
}
