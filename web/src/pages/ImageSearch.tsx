import { useEffect, useMemo, useRef, useState } from 'react';
import type { Category, Gender } from '@shared/types';
import { CATEGORY_LABELS, COLOR_BY_KEY, STYLE_LABELS } from '@shared/taxonomy';
import { imgUrl } from '@shared/media';
import { useData, type Item } from '../lib/data';
import { recordImage, useUser } from '../lib/store';
import { href, navigate, useRoute } from '../lib/router';
import { getEmbIndex, loadEmbIndex, nearest, vectorOf } from '../lib/clipIndex';
import { dominantColors, embedImage, nearestColorKey } from '../lib/clipModel';
import { ProductGrid } from '../components/ProductGrid';
import { Icon } from '../components/Icon';
import { Empty, toast } from '../components/ui';

type Phase = 'idle' | 'index' | 'model' | 'embed' | 'done' | 'fallback' | 'error';

interface Attr { group: string; key: string; label: string; p: number }

function softmax(xs: number[], t = 100) {
  const m = Math.max(...xs);
  const e = xs.map((x) => Math.exp((x - m) * t));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}

export default function ImageSearch() {
  const data = useData();
  const user = useUser();
  const route = useRoute();
  const fromId = route.params.get('from');
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [results, setResults] = useState<{ p: Item; sim: number }[]>([]);
  const [attrs, setAttrs] = useState<Attr[]>([]);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const [segment, setSegment] = useState<'all' | 'new' | 'secondhand'>('all');
  const [gender, setGender] = useState<Gender | ''>(user.profile.genders[0] ?? '');
  const [cat, setCat] = useState<Category | ''>('');
  const [maxPrice, setMaxPrice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const queryVec = useRef<Float32Array | null>(null);

  const rank = (q: Float32Array): Attr[] => {
    const idx = getEmbIndex();
    if (!idx) return [];
    const near = nearest(q, 400, (id) => {
      const p = data.byId.get(id);
      return !!p && p.av;
    });
    const out: { p: Item; sim: number }[] = [];
    for (const n of near) {
      const p = data.byId.get(n.id)!;
      if (segment !== 'all' && p.seg !== segment) continue;
      if (gender && p.g !== gender && p.g !== 'unisex') continue;
      if (cat && p.cat !== cat) continue;
      if (maxPrice && p.tot > Number(maxPrice)) continue;
      out.push({ p, sim: n.sim });
    }
    setResults(out.slice(0, 120));
    // Zero-shot-Attribute aus vorberechneten Text-Embeddings
    if (idx.labels?.length) {
      const groups = new Map<string, { key: string; s: number }[]>();
      for (const l of idx.labels) {
        let s = 0;
        for (let i = 0; i < q.length; i++) s += q[i] * l.vec[i];
        if (!groups.has(l.group)) groups.set(l.group, []);
        groups.get(l.group)!.push({ key: l.key, s });
      }
      const found: Attr[] = [];
      for (const [group, list] of groups) {
        const probs = softmax(list.map((x) => x.s));
        const i = probs.indexOf(Math.max(...probs));
        const key = list[i].key;
        const label = group === 'category' ? CATEGORY_LABELS[key as Category] : group === 'color' ? COLOR_BY_KEY[key]?.label : group === 'style' ? STYLE_LABELS[key as keyof typeof STYLE_LABELS] : key;
        found.push({ group, key, label: label ?? key, p: probs[i] });
      }
      setAttrs(found);
      return found;
    }
    return [];
  };

  useEffect(() => {
    if (queryVec.current) rank(queryVec.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, gender, cat, maxPrice, data.items]);

  const run = async (src: Blob | string) => {
    setError('');
    setResults([]);
    setAttrs([]);
    try {
      setPhase('index');
      setProgress(0);
      const idx = await loadEmbIndex((p) => setProgress(p));
      if (!idx) {
        // Fallback: Farbanalyse
        setPhase('fallback');
        if (typeof src !== 'string') {
          const cols = await dominantColors(src);
          const keys = [...new Set(cols.filter((c) => c.share > 0.12).map((c) => nearestColorKey(c.r, c.g, c.b)))];
          setAttrs(keys.map((k) => ({ group: 'color', key: k, label: COLOR_BY_KEY[k]?.label ?? k, p: 1 })));
        }
        return;
      }
      if (fromId && typeof src === 'string') {
        const v = vectorOf(fromId);
        if (v) {
          queryVec.current = v;
          rank(v);
          setPhase('done');
          return;
        }
      }
      setPhase('model');
      setProgress(0);
      const v = await embedImage(src, (p) => setProgress(p.progress));
      setPhase('embed');
      queryVec.current = v;
      const found = rank(v);
      // Bild-Interesse lernen (nur der Vektor und erkannte Merkmale werden gespeichert, nicht das Foto)
      if (typeof src !== 'string') {
        const get = (g: string) => found.find((a) => a.group === g && a.p >= 0.35)?.key;
        recordImage(v, { cat: get('category') as Category | undefined, color: get('color'), style: get('style') as never }, found.map((a) => a.label).slice(0, 2).join(' · '));
      }
      setPhase('done');
    } catch (e) {
      console.error(e);
      setError((e as Error).message || 'Unbekannter Fehler');
      setPhase('error');
    }
  };

  useEffect(() => {
    if (!fromId || data.status !== 'ready') return;
    const p = data.byId.get(fromId);
    if (!p) return;
    const url = imgUrl(p.img, data.shopById[p.s], 448);
    setPreview(url);
    setCat(p.cat);
    void run(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromId, data.status]);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast('Bitte ein Bild wählen');
    setPreview(URL.createObjectURL(f));
    void run(f);
  };

  const fallbackItems = useMemo(() => {
    if (phase !== 'fallback' || !attrs.length) return [];
    const cols = attrs.map((a) => a.key);
    return data.items.filter((p) => p.av && p.col.some((c) => cols.includes(c)) && (!cat || p.cat === cat) && (!gender || p.g === gender || p.g === 'unisex') && (segment === 'all' || p.seg === segment)).sort((a, b) => b.q - a.q).slice(0, 120);
  }, [phase, attrs, data.items, cat, gender, segment]);

  const busy = phase === 'index' || phase === 'model' || phase === 'embed';
  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1 style={{ fontSize: 'clamp(32px,4vw,46px)' }}>KI-Bildsuche</h1>
          <p>Lade ein Foto hoch (Screenshot, Instagram, Strassen-Look) – Stilkompass findet ähnliche Teile im Katalog und lernt deinen Stil für künftige Vorschläge. Die KI (Marqo-FashionSigLIP) läuft lokal in deinem Browser: kostenlos, privat, ohne Upload an einen Server. Gespeichert wird nur ein Zahlen-Fingerabdruck des Bildes, nie das Foto.</p>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div
          className={`drop-zone${over ? ' over' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files?.[0]); }}
          role="button"
          tabIndex={0}
        >
          {preview ? <img src={preview} alt="Dein Bild" style={{ maxHeight: 260, borderRadius: 12, objectFit: 'contain' }} /> : <Icon name="camera" size={40} stroke={1.3} />}
          <div style={{ fontWeight: 600 }}>{preview ? 'Anderes Bild wählen' : 'Foto hochladen oder hierher ziehen'}</div>
          <div className="small muted">JPG, PNG, HEIC/WebP · auf dem Handy auch direkt mit der Kamera</div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>

        <div className="panel stack">
          <div className="label">Ergebnisse eingrenzen</div>
          <div className="seg">
            {(['all', 'new', 'secondhand'] as const).map((s) => (
              <button key={s} className={segment === s ? 'on' : ''} onClick={() => setSegment(s)}>{s === 'all' ? 'Alle' : s === 'new' ? 'Neu' : 'Secondhand'}</button>
            ))}
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Für</label>
              <select className="input" value={gender} onChange={(e) => setGender(e.target.value as Gender | '')}>
                <option value="">alle</option><option value="women">Damen</option><option value="men">Herren</option><option value="kids">Kinder</option>
              </select>
            </div>
            <div className="field">
              <label>Kategorie</label>
              <select className="input" value={cat} onChange={(e) => setCat(e.target.value as Category | '')}>
                <option value="">automatisch</option>
                {Object.entries(CATEGORY_LABELS).filter(([k]) => k !== 'other').map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Max. Gesamtpreis</label>
              <input className="input" inputMode="numeric" placeholder="CHF" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
            </div>
          </div>
          {busy && (
            <div className="stack" style={{ gap: 6 }}>
              <div className="small">{phase === 'index' ? 'Lade Bild-Index des Katalogs …' : phase === 'model' ? 'Lade KI-Modell (einmalig ca. 94 MB, danach gecacht) …' : 'Analysiere Bild …'}</div>
              <div className="progress"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            </div>
          )}
          {attrs.length > 0 && (
            <div className="stack" style={{ gap: 8 }}>
              <div className="label">Erkannt</div>
              <div className="chips">
                {attrs.map((a) => (
                  <span key={a.group + a.key} className="chip soft">{a.group === 'color' && <span className="swatch" style={{ background: COLOR_BY_KEY[a.key]?.hex }} />}{a.label}{a.p < 1 && <span className="faint">{Math.round(a.p * 100)}%</span>}</span>
                ))}
              </div>
              <button
                className="btn sm"
                onClick={() => {
                  const c = attrs.find((a) => a.group === 'category')?.key;
                  const col = attrs.find((a) => a.group === 'color')?.key;
                  const st = attrs.find((a) => a.group === 'style')?.key;
                  navigate('/suche', { cat: c, col, st, g: gender || undefined, max: maxPrice || undefined });
                }}
              >
                Als Suchfilter verwenden
              </button>
            </div>
          )}
          {phase === 'fallback' && (
            <div className="notice warn">
              Der Bild-Index ist noch nicht berechnet (die Engine erstellt ihn beim nächsten Lauf mit <code>--embed</code>). Bis dahin sucht Stilkompass nach den erkannten Farben{cat ? ` in ${CATEGORY_LABELS[cat as Category]}` : ' – wähle oben eine Kategorie'}.
            </div>
          )}
          {phase === 'error' && <div className="notice warn">Fehler: {error}. Tipp: Seite neu laden oder ein anderes Bild versuchen. Ältere Geräte haben teils zu wenig Speicher für das Modell.</div>}
        </div>
      </div>

      <section className="section">
        {phase === 'done' && results.length > 0 && (
          <>
            <div className="section-head"><h2>Ähnliche Teile</h2><span className="small muted">{results.length} Treffer, sortiert nach visueller Ähnlichkeit</span></div>
            <ProductGrid items={results.map((r) => r.p)} resetKey={String(results[0]?.p.id) + results.length} />
          </>
        )}
        {phase === 'done' && !results.length && <Empty title="Keine ähnlichen Teile mit diesen Filtern">Filter lockern oder anderes Bild versuchen.</Empty>}
        {phase === 'fallback' && fallbackItems.length > 0 && <ProductGrid items={fallbackItems} />}
        {phase === 'idle' && !preview && (
          <div className="notice"><Icon name="info" /><div>Tipp: Jede Produktansicht hat „Ähnliche per Bild“. Für den besten Treffer zeige das Kleidungsstück möglichst formatfüllend. <a href={href('/info')} style={{ textDecoration: 'underline' }}>Wie funktioniert das?</a></div></div>
        )}
      </section>
    </div>
  );
}
