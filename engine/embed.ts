// Bild-Embeddings (Marqo-FashionSigLIP, Open Source) für die KI-Bildsuche – lokal berechnet, keine API-Kosten.
// Ergebnis: data/emb.bin (Int8, L2-normalisiert) + data/emb-meta.json (IDs, Zero-Shot-Labels).
// Cache in state/emb-cache.* – pro Lauf werden nur neue Bilder berechnet (Budget begrenzt die Laufzeit).
import fs from 'node:fs';
import path from 'node:path';
import type { Catalog } from '../shared/types';
import { imgUrl } from '../shared/media';
import { COLORS } from '../shared/taxonomy';
import { fetchBuffer } from './http';
import { DATA_DIR, ROOT, STATE_DIR, readJson, writeJson } from './store';

export const MODEL_ID = 'Marqo/marqo-fashionSigLIP';
// Cache = data/emb.bin (in Reihenfolge von state/emb-keys.json) – keine doppelte Speicherung
const CACHE_BIN = path.join(DATA_DIR, 'emb.bin');
const CACHE_IDX = path.join(STATE_DIR, 'emb-keys.json');
const LABELS_FILE = path.join(STATE_DIR, 'emb-labels.json');

interface CacheIndex {
  model: string;
  dim: number;
  keys: string[]; // Bild-Schlüssel (gepackte URL)
}

const CAT_PROMPTS: Record<string, string> = {
  tshirt: 't-shirt', top: 'blouse or tank top', shirt: 'button-up shirt', polo: 'polo shirt', knit: 'knitted sweater', sweat: 'sweatshirt or hoodie',
  jacket: 'jacket', coat: 'long coat', blazer: 'tailored blazer', suit: 'suit', vest: 'vest or gilet', trousers: 'trousers', jeans: 'jeans',
  shorts: 'shorts', dress: 'dress', skirt: 'skirt', jumpsuit: 'jumpsuit', shoes: 'leather shoes', boots: 'boots', sneakers: 'sneakers',
  sandals: 'sandals', bag: 'bag', accessory: 'scarf, hat or belt', underwear: 'underwear', socks: 'socks', swim: 'swimwear',
};
const STYLE_PROMPTS: Record<string, string> = {
  minimal: 'minimalist clean', classic: 'classic timeless', smart: 'smart casual', casual: 'casual everyday', streetwear: 'streetwear',
  workwear: 'rugged workwear', outdoor: 'technical outdoor', sporty: 'sporty athletic', preppy: 'preppy', elegant: 'elegant evening',
  vintage: 'vintage retro', boho: 'bohemian', avantgarde: 'avant-garde designer',
};

type TF = typeof import('@huggingface/transformers');

async function loadTf(): Promise<TF> {
  const tf = await import('@huggingface/transformers');
  tf.env.cacheDir = process.env.STILKOMPASS_MODELS ?? path.join(ROOT, '.cache', 'models');
  tf.env.allowLocalModels = false;
  return tf;
}

function l2(v: Float32Array): Float32Array {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  const o = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) o[i] = v[i] / n;
  return o;
}

function quant(v: Float32Array): Int8Array {
  const o = new Int8Array(v.length);
  for (let i = 0; i < v.length; i++) o[i] = Math.max(-127, Math.min(127, Math.round(v[i] * 127)));
  return o;
}

async function computeLabels(tf: TF, dim: number, log: (...m: unknown[]) => void) {
  const prompts: { key: string; group: string; text: string }[] = [
    ...Object.entries(CAT_PROMPTS).map(([key, t]) => ({ key, group: 'category', text: `a photo of ${t}` })),
    ...COLORS.filter((c) => c.key !== 'multi').map((c) => ({ key: c.key, group: 'color', text: `a photo of a ${c.words[0]} clothing item` })),
    ...Object.entries(STYLE_PROMPTS).map(([key, t]) => ({ key, group: 'style', text: `a photo of ${t} fashion` })),
  ];
  const cached = readJson<{ model: string; labels: { key: string; group: string; text: string; vec: number[] }[] } | null>(LABELS_FILE, null);
  if (cached?.model === MODEL_ID && cached.labels.length === prompts.length && cached.labels.every((l, i) => l.text === prompts[i].text)) return cached.labels;
  log('  Berechne Text-Embeddings für Zero-Shot-Labels …');
  const tokenizer = await tf.AutoTokenizer.from_pretrained(MODEL_ID);
  const textModel = await tf.SiglipTextModel.from_pretrained(MODEL_ID, { dtype: 'q8' });
  const labels: { key: string; group: string; text: string; vec: number[] }[] = [];
  for (const p of prompts) {
    const inputs = tokenizer([p.text], { padding: 'max_length', truncation: true });
    const out = (await textModel(inputs)) as Record<string, { data: Float32Array }>;
    const v = l2(Float32Array.from((out.pooler_output ?? out.text_embeds).data));
    if (v.length !== dim) throw new Error(`Dimension Text ${v.length} ≠ Bild ${dim}`);
    labels.push({ ...p, vec: Array.from(v, (x) => Math.round(x * 1e4) / 1e4) });
  }
  writeJson(LABELS_FILE, { model: MODEL_ID, labels });
  return labels;
}

export async function runEmbeddings(cat: Catalog, opts: { budget?: number; log?: (...m: unknown[]) => void } = {}) {
  const log = opts.log ?? console.log;
  const budget = opts.budget ?? 1500;
  const t0 = Date.now();
  const shopById = Object.fromEntries(cat.shops.map((s) => [s.id, s]));

  // Cache laden
  let idx = readJson<CacheIndex | null>(CACHE_IDX, null);
  let bin: Int8Array = new Int8Array(0);
  if (idx && idx.model === MODEL_ID && fs.existsSync(CACHE_BIN)) {
    const b = fs.readFileSync(CACHE_BIN);
    bin = new Int8Array(b.buffer, b.byteOffset, b.byteLength);
    if (bin.length !== idx.keys.length * idx.dim) {
      idx = null;
      bin = new Int8Array(0);
    }
  } else idx = null;
  const keyPos = new Map((idx?.keys ?? []).map((k, i) => [k, i]));

  const todo = cat.products
    .filter((p) => !keyPos.has(p.img))
    .sort((a, b) => Number(b.av) - Number(a.av) || b.first - a.first)
    .slice(0, budget);
  log(`Embeddings: ${keyPos.size} im Cache, ${todo.length} neu (Budget ${budget}) …`);

  const tf = await loadTf();
  const processor = await tf.AutoProcessor.from_pretrained(MODEL_ID);
  const vision = await tf.SiglipVisionModel.from_pretrained(MODEL_ID, { dtype: 'q8' });
  const newKeys: string[] = [];
  const newVecs: Int8Array[] = [];
  let dim = idx?.dim ?? 0;

  // Bilder parallel laden, Inferenz nacheinander
  const queue = [...todo];
  const buffers = new Map<string, Buffer | null>();
  const fetchAhead = async () => {
    while (queue.length) {
      const p = queue.shift()!;
      buffers.set(p.id, await fetchBuffer(imgUrl(p.img, shopById[p.s], 448)));
    }
  };
  const fetchers = Array.from({ length: 8 }, fetchAhead);
  let done = 0;
  let failed = 0;
  for (const p of todo) {
    while (!buffers.has(p.id)) await new Promise((r) => setTimeout(r, 20));
    const buf = buffers.get(p.id);
    buffers.delete(p.id);
    if (!buf) {
      failed++;
      continue;
    }
    try {
      const image = await tf.RawImage.fromBlob(new Blob([new Uint8Array(buf)]));
      const inputs = await processor(image);
      const out = (await vision(inputs)) as Record<string, { data: Float32Array }>;
      const v = l2(Float32Array.from((out.pooler_output ?? out.image_embeds).data));
      dim ||= v.length;
      newKeys.push(p.img);
      newVecs.push(quant(v));
      done++;
      if (done % 250 === 0) log(`  … ${done}/${todo.length} (${((Date.now() - t0) / done).toFixed(0)} ms/Bild)`);
    } catch {
      failed++;
    }
  }
  await Promise.all(fetchers);

  // Cache zusammenführen (nur Bilder, die noch im Katalog sind)
  const live = new Set(cat.products.map((p) => p.img));
  const keys: string[] = [];
  const chunks: Int8Array[] = [];
  (idx?.keys ?? []).forEach((k, i) => {
    if (live.has(k)) {
      keys.push(k);
      chunks.push(bin.subarray(i * dim, (i + 1) * dim));
    }
  });
  newKeys.forEach((k, i) => {
    keys.push(k);
    chunks.push(newVecs[i]);
  });
  if (!dim || !keys.length) {
    log('Embeddings: nichts zu speichern.');
    return;
  }
  const all = new Int8Array(keys.length * dim);
  chunks.forEach((c, i) => all.set(c, i * dim));

  // Ausgabe für die App in Katalog-Reihenfolge; gleichzeitig Cache (Schlüssel = Bild) für den nächsten Lauf
  const pos = new Map(keys.map((k, i) => [k, i]));
  const ids: string[] = [];
  const outKeys: string[] = [];
  const outVecs: Int8Array[] = [];
  for (const p of cat.products) {
    const i = pos.get(p.img);
    if (i === undefined) continue;
    ids.push(p.id);
    outKeys.push(p.img);
    outVecs.push(all.subarray(i * dim, (i + 1) * dim));
  }
  const outBin = new Int8Array(ids.length * dim);
  outVecs.forEach((v, i) => outBin.set(v, i * dim));
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CACHE_BIN, Buffer.from(outBin.buffer));
  writeJson(CACHE_IDX, { model: MODEL_ID, dim, keys: outKeys } satisfies CacheIndex);
  let labels: { key: string; group: string; vec: number[] }[] = [];
  try {
    labels = (await computeLabels(tf, dim, log)).map(({ key, group, vec }) => ({ key, group, vec }));
  } catch (e) {
    log(`  Zero-Shot-Labels übersprungen: ${(e as Error).message}`);
  }
  writeJson(path.join(DATA_DIR, 'emb-meta.json'), { model: MODEL_ID, dim, ids, labels, generatedAt: new Date().toISOString() });
  log(`Embeddings fertig: ${done} neu, ${failed} Fehler, ${ids.length} im Index (${(outBin.length / 1e6).toFixed(1)} MB) in ${Math.round((Date.now() - t0) / 1000)}s`);
}

// Direkter Aufruf: npx tsx engine/embed.ts [budget]
const isMain = process.argv[1] && /embed\.(ts|js)$/.test(process.argv[1]);
if (isMain) {
  const { loadCatalog } = await import('./store');
  const cat = loadCatalog();
  if (!cat) {
    console.error('Kein Katalog – zuerst npm run update');
    process.exit(1);
  }
  await runEmbeddings(cat, { budget: Number(process.argv[2] ?? 1500) });
}
