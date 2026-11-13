// Minimaler .env-Loader (ohne Abhängigkeit). Bereits gesetzte Umgebungsvariablen haben Vorrang.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './store';

let loaded = false;
export function loadEnv() {
  if (loaded) return;
  loaded = true;
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const v = m[2].replace(/^["']|["']$/g, '');
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
