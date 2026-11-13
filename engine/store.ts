// Dateibasierter Speicher: data/ (öffentlich, wird ausgeliefert) und state/ (intern).
import fs from 'node:fs';
import path from 'node:path';
import type { Catalog, ShopMarket } from '../shared/types';
import { unpackCatalog, type PackedCatalog } from '../shared/catalog';

export const ROOT = process.env.STILKOMPASS_ROOT ? path.resolve(process.env.STILKOMPASS_ROOT) : process.cwd();
export const DATA_DIR = path.join(ROOT, 'data');
export const STATE_DIR = path.join(ROOT, 'state');

export interface ShopState {
  rotate: number;
  market?: ShopMarket | null;
  marketCheckedAt?: string;
  lastOkAt?: string;
  lastError?: string;
  totalPages?: number;
  shipsToCH?: boolean;
  products?: number;
}

export interface ProductState {
  first: number;
  seen: number;
  tot: number;
  av: boolean;
  sz: string[];
  upd: number;
}

export interface EngineState {
  v: 1;
  runs: number;
  lastRun?: string;
  shops: Record<string, ShopState>;
  products: Record<string, ProductState>;
}

/** Preisverlauf: [Minuten seit Epoch, Gesamtpreis CHF, verfügbar 1/0] */
export type HistoryPoint = [number, number, number];
export interface History {
  v: 1;
  h: Record<string, HistoryPoint[]>;
}

export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(file: string, data: unknown, pretty = false): number {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const txt = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, txt);
  fs.renameSync(tmp, file);
  return txt.length;
}

export const paths = {
  catalog: path.join(DATA_DIR, 'catalog.json'),
  history: path.join(DATA_DIR, 'history.json'),
  meta: path.join(DATA_DIR, 'meta.json'),
  details: path.join(DATA_DIR, 'details'),
  state: path.join(STATE_DIR, 'engine.json'),
  alertsLog: path.join(STATE_DIR, 'alerts-log.json'),
  userDir: path.join(STATE_DIR, 'user'),
};

export function loadState(): EngineState {
  return readJson<EngineState>(paths.state, { v: 1, runs: 0, shops: {}, products: {} });
}

export function loadCatalog(): Catalog | null {
  const raw = readJson<PackedCatalog | Catalog | null>(paths.catalog, null);
  return raw ? unpackCatalog(raw) : null;
}

export function loadHistory(): History {
  return readJson<History>(paths.history, { v: 1, h: {} });
}
