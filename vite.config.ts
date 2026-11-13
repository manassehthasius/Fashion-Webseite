import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// Liefert im Entwicklungsmodus /data/* aus dem Projektordner data/ aus
function serveData(): Plugin {
  const dataDir = path.resolve(__dirname, 'data');
  return {
    name: 'stilkompass-data',
    configureServer(server) {
      server.middlewares.use('/data', (req, res, next) => {
        const file = path.join(dataDir, decodeURIComponent((req.url ?? '/').split('?')[0]));
        if (!file.startsWith(dataDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return next();
        res.setHeader('content-type', file.endsWith('.json') ? 'application/json' : 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  root: 'web',
  base: './',
  publicDir: 'public',
  plugins: [react(), serveData()],
  resolve: {
    alias: [
      { find: '@shared', replacement: path.resolve(__dirname, 'shared') },
      // ONNX-Runtime ohne eingebettete WASM-Datei (wird selbst gehostet unter ./ort/, kein externes CDN)
      { find: /^onnxruntime-web\/webgpu$/, replacement: path.resolve(__dirname, 'node_modules/onnxruntime-web/dist/ort.webgpu.min.mjs') },
    ],
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
  worker: { format: 'es' },
});
