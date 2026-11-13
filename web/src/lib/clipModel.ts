// Marqo-FashionSigLIP im Browser (Transformers.js). Modell wird einmalig von Hugging Face geladen und gecacht.
// Keine KI-API, keine Kosten. WASM-Laufzeit wird selbst gehostet (./ort/).
export const MODEL_ID = 'Marqo/marqo-fashionSigLIP';

type Loaded = {
  processor: (img: unknown) => Promise<Record<string, unknown>>;
  model: (inputs: Record<string, unknown>) => Promise<Record<string, { data: Float32Array; dims: number[] }>>;
  RawImage: { fromBlob(b: Blob): Promise<unknown>; fromURL(u: string): Promise<unknown> };
};

let loaded: Promise<Loaded> | null = null;

export function loadModel(onProgress?: (p: { file: string; progress: number }) => void): Promise<Loaded> {
  loaded ??= (async () => {
    const t = await import('@huggingface/transformers');
    t.env.allowLocalModels = false;
    const onnx = t.env.backends.onnx as { wasm?: { wasmPaths?: string | { mjs: string; wasm: string }; numThreads?: number } };
    if (onnx.wasm) {
      // Selbst gehostete WASM-Laufzeit (sonst würde Transformers.js ein externes CDN nutzen)
      const ua = navigator.userAgent;
      const oldSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua) && Number(ua.match(/Version\/(\d+)/)?.[1] ?? 99) < 26 && !('gpu' in navigator);
      const v = oldSafari ? '' : '.asyncify';
      const base = new URL('./ort/', location.href).href;
      onnx.wasm.wasmPaths = { mjs: `${base}ort-wasm-simd-threaded${v}.mjs`, wasm: `${base}ort-wasm-simd-threaded${v}.wasm` };
      if (!crossOriginIsolated) onnx.wasm.numThreads = 1;
    }
    const progress_callback = (e: { status: string; file?: string; progress?: number }) => {
      if (e.status === 'progress' && e.file?.endsWith('.onnx')) onProgress?.({ file: e.file, progress: (e.progress ?? 0) / 100 });
    };
    const processor = await t.AutoProcessor.from_pretrained(MODEL_ID, { progress_callback });
    const model = await t.SiglipVisionModel.from_pretrained(MODEL_ID, { dtype: 'q8', device: 'wasm', progress_callback });
    return {
      processor: processor as unknown as Loaded['processor'],
      model: model as unknown as Loaded['model'],
      RawImage: t.RawImage as unknown as Loaded['RawImage'],
    };
  })();
  loaded.catch(() => (loaded = null));
  return loaded;
}

export async function embedImage(src: Blob | string, onProgress?: (p: { file: string; progress: number }) => void): Promise<Float32Array> {
  const { processor, model, RawImage } = await loadModel(onProgress);
  const image = typeof src === 'string' ? await RawImage.fromURL(src) : await RawImage.fromBlob(src);
  const inputs = await processor(image);
  const out = await model(inputs);
  const emb = (out.pooler_output ?? out.image_embeds ?? Object.values(out)[0]) as { data: Float32Array };
  const v = Float32Array.from(emb.data);
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= n;
  return v;
}

/** Fallback ohne Modell: dominante Farben per Canvas */
export async function dominantColors(blob: Blob): Promise<{ r: number; g: number; b: number; share: number }[]> {
  const bmp = await createImageBitmap(blob);
  const size = 64;
  const c = new OffscreenCanvas(size, size);
  const ctx = c.getContext('2d')!;
  // Mittelteil gewichten (Hintergrund an den Rändern ignorieren)
  ctx.drawImage(bmp, bmp.width * 0.15, bmp.height * 0.1, bmp.width * 0.7, bmp.height * 0.8, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const e = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    e.r += r; e.g += g; e.b += b; e.n++;
    buckets.set(key, e);
  }
  const total = size * size;
  return [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 4)
    .map((e) => ({ r: e.r / e.n, g: e.g / e.n, b: e.b / e.n, share: e.n / total }));
}

const PALETTE: [string, number, number, number][] = [
  ['black', 20, 20, 20], ['white', 245, 245, 245], ['ecru', 236, 228, 210], ['grey', 140, 140, 140], ['navy', 31, 42, 68],
  ['blue', 58, 110, 165], ['lightblue', 169, 198, 226], ['green', 63, 125, 88], ['olive', 107, 107, 58], ['brown', 107, 74, 50],
  ['beige', 200, 176, 140], ['red', 179, 38, 30], ['burgundy', 109, 31, 47], ['pink', 231, 161, 176], ['purple', 107, 76, 138],
  ['yellow', 226, 185, 59], ['orange', 224, 122, 47],
];

export function nearestColorKey(r: number, g: number, b: number): string {
  let best = 'grey', d = Infinity;
  for (const [k, pr, pg, pb] of PALETTE) {
    const dist = (r - pr) ** 2 * 0.3 + (g - pg) ** 2 * 0.59 + (b - pb) ** 2 * 0.11;
    if (dist < d) { d = dist; best = k; }
  }
  return best;
}
