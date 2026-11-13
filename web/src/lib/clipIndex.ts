// Bild-Embeddings des Katalogs (Marqo-FashionSigLIP, von der Engine vorberechnet) – nur bei Bedarf geladen.
import { DATA_BASE } from './data';

export interface EmbIndex {
  ids: string[];
  dim: number;
  vecs: Int8Array; // ids.length × dim, L2-normalisiert × 127
  pos: Map<string, number>;
  model: string;
  labels?: { key: string; group: string; vec: number[] }[];
}

let index: EmbIndex | null = null;
let loading: Promise<EmbIndex | null> | null = null;

export function getEmbIndex() {
  return index;
}

export async function loadEmbIndex(onProgress?: (p: number) => void): Promise<EmbIndex | null> {
  if (index) return index;
  loading ??= (async () => {
    const metaRes = await fetch(`${DATA_BASE}emb-meta.json`);
    if (!metaRes.ok) return null;
    const meta = (await metaRes.json()) as { ids: string[]; dim: number; model: string; labels?: EmbIndex['labels'] };
    const res = await fetch(`${DATA_BASE}emb.bin`);
    if (!res.ok || !res.body) return null;
    const total = Number(res.headers.get('content-length')) || meta.ids.length * meta.dim;
    const reader = res.body.getReader();
    const buf = new Uint8Array(meta.ids.length * meta.dim);
    let off = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf.set(value.subarray(0, Math.max(0, buf.length - off)), off);
      off += value.length;
      onProgress?.(Math.min(1, off / total));
    }
    index = { ids: meta.ids, dim: meta.dim, vecs: new Int8Array(buf.buffer), pos: new Map(meta.ids.map((id, i) => [id, i])), model: meta.model, labels: meta.labels };
    return index;
  })();
  return loading;
}

/** Kosinus-Ähnlichkeit zweier Katalogprodukte (undefined, wenn Embeddings nicht geladen) */
export function imageSimFor(id: string): ((other: string) => number | undefined) | undefined {
  if (!index) return undefined;
  const i = index.pos.get(id);
  if (i === undefined) return undefined;
  const { vecs, dim, pos } = index;
  const a = i * dim;
  return (other: string) => {
    const j = pos.get(other);
    if (j === undefined) return undefined;
    const b = j * dim;
    let s = 0;
    for (let k = 0; k < dim; k++) s += vecs[a + k] * vecs[b + k];
    return s / (127 * 127);
  };
}

/** Top-k ähnlichste Katalogbilder zu einem Query-Vektor (Float32, normalisiert) */
export function nearest(q: Float32Array, k = 200, filter?: (id: string) => boolean): { id: string; sim: number }[] {
  if (!index) return [];
  const { vecs, dim, ids } = index;
  const out: { id: string; sim: number }[] = [];
  let minKept = -Infinity;
  for (let i = 0; i < ids.length; i++) {
    if (filter && !filter(ids[i])) continue;
    let s = 0;
    const o = i * dim;
    for (let d = 0; d < dim; d++) s += q[d] * vecs[o + d];
    s /= 127;
    if (out.length < k || s > minKept) {
      out.push({ id: ids[i], sim: s });
      if (out.length > k * 2) {
        out.sort((a, b) => b.sim - a.sim);
        out.length = k;
        minKept = out[out.length - 1].sim;
      }
    }
  }
  return out.sort((a, b) => b.sim - a.sim).slice(0, k);
}

export function vectorOf(id: string): Float32Array | null {
  if (!index) return null;
  const i = index.pos.get(id);
  if (i === undefined) return null;
  const v = new Float32Array(index.dim);
  for (let d = 0; d < index.dim; d++) v[d] = index.vecs[i * index.dim + d] / 127;
  return v;
}
