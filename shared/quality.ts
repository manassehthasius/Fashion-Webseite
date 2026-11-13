// Qualitätsscore 0–100 aus verfügbaren Daten. Jede Komponente ist als "Daten", "kuratiert" oder "Schätzung" markiert.
import type { Category, Condition, Material, QualityPart, QualityResult, Shop } from './types';
import { CERT_RULES, CONDITION_LABELS, CONDITION_POINTS, FEATURE_RULES, MATERIAL_BY_KEY, ORIGINS } from './taxonomy';
import { brandTier } from './classify';
import { clamp } from './text';

const OUTER: Category[] = ['jacket', 'coat', 'vest'];
const STRETCH_OK: Category[] = ['jeans', 'trousers', 'tshirt', 'top', 'socks', 'underwear', 'swim', 'dress', 'skirt', 'shorts'];
const PERFORMANCE: Category[] = ['swim', 'underwear', 'socks'];
const FOOTWEAR: Category[] = ['shoes', 'boots', 'sneakers', 'sandals'];

/** Materialwert je nach Einsatzzweck */
export function materialValue(key: string, cat: Category, pct = 100): number {
  const base = MATERIAL_BY_KEY[key]?.value ?? 50;
  if (OUTER.includes(cat)) {
    if (key === 'nylon' || key === 'recycled_nylon') return 74;
    if (key === 'polyester' || key === 'recycled_polyester') return 62;
    if (key === 'goretex') return 95;
  }
  if (PERFORMANCE.includes(cat) && ['nylon', 'recycled_nylon', 'polyester', 'recycled_polyester', 'elastane'].includes(key)) return 66;
  if (cat === 'socks' && (key === 'nylon' || key === 'recycled_nylon') && pct <= 35) return 78;
  if (cat === 'knit' && ['acrylic', 'polyester', 'recycled_polyester'].includes(key)) return Math.min(base, 18);
  if (cat === 'knit' && (key === 'nylon' || key === 'recycled_nylon') && pct <= 20) return 70; // Haltbarkeit bei Wollmischungen
  if (FOOTWEAR.includes(cat) && key === 'rubber') return 70;
  return base;
}

export interface QualityInput {
  cat: Category;
  mat: Material[];
  fx: string[];
  b: string;
  seg: 'new' | 'secondhand';
  cond?: Condition;
}

const TIER_POINTS = [0, 4, 8, 12, 16, 20];

export function qualityScore(p: QualityInput, shop: Shop): QualityResult {
  const parts: QualityPart[] = [];
  const tier = shop.multiBrand ? brandTier(p.b) : brandTier(p.b) ?? shop.tier;
  const tierKnown = tier !== undefined;
  const t = tier ?? 2.5;

  // 1) Material (max 35)
  const MAT_MAX = 35;
  let matPts: number;
  let matSource: QualityPart['source'];
  let matDetail: string;
  const withPct = p.mat.filter((m) => m.pct !== undefined);
  if (withPct.length) {
    let total = 0;
    let weight = 0;
    for (const m of withPct) {
      const pct = m.pct ?? 0;
      if (m.k === 'elastane' && pct <= 5 && STRETCH_OK.includes(p.cat)) continue;
      if (m.k === 'elastane' && pct <= 3) continue;
      total += materialValue(m.k, p.cat, pct) * pct;
      weight += pct;
    }
    let v = weight ? total / weight : 50;
    if (withPct.length === 1 && MAT_NATURAL(withPct[0].k) && (withPct[0].pct ?? 0) >= 98) v += 4;
    matPts = clamp((v / 100) * MAT_MAX, 0, MAT_MAX);
    matSource = 'data';
    matDetail = withPct.map((m) => `${m.pct}% ${MATERIAL_BY_KEY[m.k]?.label ?? m.k}`).join(', ');
  } else if (p.mat.length) {
    const vals = p.mat.map((m) => materialValue(m.k, p.cat));
    const v = vals[0] * 0.7 + (vals.reduce((a, b) => a + b, 0) / vals.length) * 0.3;
    matPts = clamp((v / 100) * MAT_MAX, 0, MAT_MAX);
    matSource = 'data';
    matDetail = `${p.mat.map((m) => MATERIAL_BY_KEY[m.k]?.label ?? m.k).join(', ')} (ohne Prozentangabe)`;
  } else {
    const v = 46 + t * 6;
    matPts = (v / 100) * MAT_MAX;
    matSource = 'estimate';
    matDetail = 'Keine Materialangabe – Schätzung aus Marke und Kategorie';
  }
  parts.push({ key: 'material', label: 'Material', points: matPts, max: MAT_MAX, source: matSource, detail: matDetail });

  // 2) Verarbeitung (max 20)
  const CON_MAX = 20;
  const feats = FEATURE_RULES.filter(([code]) => p.fx.includes(code));
  let conPts = feats.reduce((a, [, , pts]) => a + pts, 0);
  const gsm = Number(p.fx.find((f) => f.startsWith('gsm:'))?.slice(4) ?? 0);
  const oz = Number(p.fx.find((f) => f.startsWith('oz:'))?.slice(3) ?? 0);
  const details = feats.map(([, label]) => label);
  if (gsm) {
    const heavyCats: Category[] = ['tshirt', 'sweat', 'shirt', 'top'];
    if (heavyCats.includes(p.cat)) {
      if (gsm >= 280) conPts += 5;
      else if (gsm >= 220) conPts += 3;
      else if (gsm < 150) conPts -= 2;
    }
    details.push(`${gsm} g/m²`);
  }
  if (oz) {
    if (oz >= 13) conPts += 3;
    details.push(`${oz} oz Denim`);
  }
  let conSource: QualityPart['source'] = 'data';
  if (!feats.length && !gsm && !oz) {
    conPts = 2 + t * 2.6;
    conSource = 'estimate';
    details.push('Keine Verarbeitungsdetails – Schätzung aus Markenreputation');
  } else {
    conPts += t * 1.2;
  }
  parts.push({ key: 'construction', label: 'Verarbeitung', points: clamp(conPts, 0, CON_MAX), max: CON_MAX, source: conSource, detail: details.join(', ') });

  // 3) Marke & Ruf (max 20)
  const tierPts = TIER_POINTS[Math.round(clamp(t, 1, 5))] ?? 10;
  parts.push({
    key: 'brand',
    label: 'Marke & Ruf',
    points: tierPts,
    max: 20,
    source: tierKnown ? 'curated' : 'estimate',
    detail: tierKnown ? `${p.b}: Reputation ${Math.round(t)}/5 (kuratiert)` : `${p.b}: Marke nicht bewertet – neutral angesetzt`,
  });

  // 4) Herkunft & Transparenz (max 10)
  const origin = ORIGINS.find(([code]) => p.fx.includes(`o:${code}`));
  const certs = CERT_RULES.filter(([code]) => p.fx.includes(`cert:${code}`) || shop.certifications?.includes(code));
  let oPts = origin ? origin[2] : 0;
  oPts += Math.min(3, certs.length * 1.5);
  let oSource: QualityPart['source'] = origin || certs.some(([c]) => p.fx.includes(`cert:${c}`)) ? 'data' : 'estimate';
  const oDetail: string[] = [];
  if (origin) oDetail.push(`Hergestellt in ${origin[1]}`);
  if (certs.length) oDetail.push(certs.map(([, l]) => l).join(', '));
  if (!origin) {
    oPts += t >= 4 ? 4 : 3;
    if (!certs.length) oSource = 'estimate';
    oDetail.push('Herkunft nicht angegeben');
  }
  parts.push({ key: 'origin', label: 'Herkunft & Zertifikate', points: clamp(oPts, 0, 10), max: 10, source: oSource, detail: oDetail.join(' · ') });

  // 5) Langlebigkeit / Zustand (max 15)
  if (p.seg === 'secondhand') {
    if (p.cond) {
      parts.push({ key: 'condition', label: 'Zustand', points: CONDITION_POINTS[p.cond], max: 15, source: 'data', detail: CONDITION_LABELS[p.cond] });
    } else {
      parts.push({ key: 'condition', label: 'Zustand', points: 9, max: 15, source: 'estimate', detail: 'Zustand nicht angegeben' });
    }
  } else {
    let d = 8 + (t - 3) * 1.2;
    const det: string[] = ['Neuware'];
    let src: QualityPart['source'] = 'estimate';
    if (p.fx.includes('repair') || shop.perks?.some((x) => /reparatur|repair|garantie|warranty/i.test(x))) {
      d += 4;
      det.push('Reparatur/Garantie');
      src = p.fx.includes('repair') ? 'data' : 'curated';
    }
    if (p.fx.includes('resole')) {
      d += 3;
      det.push('neu besohlbar');
      src = 'data';
    }
    if (p.fx.includes('heavyweight') || gsm >= 260) d += 1.5;
    parts.push({ key: 'durability', label: 'Langlebigkeit', points: clamp(d, 0, 15), max: 15, source: src, detail: det.join(', ') });
  }

  for (const part of parts) part.points = Math.round(part.points * 10) / 10;
  const score = Math.round(clamp(parts.reduce((a, x) => a + x.points, 0), 0, 100));
  const denom = parts.filter((x) => x.key !== 'brand').reduce((a, x) => a + x.max, 0);
  const dataMax = parts.filter((x) => x.source === 'data').reduce((a, x) => a + x.max * (x.key === 'material' && !withPct.length ? 0.7 : 1), 0);
  const confidence = Math.round((dataMax / denom) * 100) / 100;
  return { score, confidence, parts, estimated: confidence < 0.5 };
}

function MAT_NATURAL(k: string) {
  return MATERIAL_BY_KEY[k]?.natural ?? false;
}

/** Preis-Leistung: Qualität relativ zum Kategorie-Median-Preis */
export function valueScore(quality: number, total: number, catMedian: number): number {
  if (!catMedian || !total) return quality;
  const f = clamp(Math.log2(catMedian / total), -1.5, 1.5);
  return Math.round(clamp(quality + f * 14, 0, 100));
}

export function qualityLabel(score: number): string {
  if (score >= 85) return 'Herausragend';
  if (score >= 72) return 'Sehr gut';
  if (score >= 60) return 'Gut';
  if (score >= 45) return 'Solide';
  return 'Einfach';
}
