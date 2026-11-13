// Kopiert die ONNX-Runtime-WASM-Dateien in web/public/ort (Selbst-Hosting statt externem CDN).
import fs from 'node:fs';
import path from 'node:path';
const src = path.resolve('node_modules/onnxruntime-web/dist');
const dst = path.resolve('web/public/ort');
fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });
let n = 0;
for (const f of fs.readdirSync(src)) {
  if (/^ort-wasm-simd-threaded(\.asyncify)?\.(wasm|mjs)$/.test(f)) {
    fs.copyFileSync(path.join(src, f), path.join(dst, f));
    n++;
  }
}
console.log(`ONNX-Runtime: ${n} Dateien nach web/public/ort kopiert`);
