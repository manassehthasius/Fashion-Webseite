// Gesamtsortiment ("Tiefensuche"): alle Produkte der Shops, nicht nur die neuesten.
// Aufgeteilt in Kategorie-Gruppen, damit die App nur lädt, was zur Suche passt.
import type { Category } from './types';

export const DEEP_GROUPS: Record<string, Category[]> = {
  tops: ['tshirt', 'top', 'shirt', 'polo'],
  strick: ['knit', 'sweat'],
  jacken: ['jacket', 'coat', 'blazer', 'suit', 'vest'],
  hosen: ['trousers', 'jeans', 'shorts', 'skirt'],
  kleider: ['dress', 'jumpsuit'],
  schuhe: ['shoes', 'boots', 'sneakers', 'sandals'],
  taschen: ['bag', 'accessory'],
  basics: ['underwear', 'socks', 'swim', 'other'],
};

const GROUP_OF = new Map<Category, string>(Object.entries(DEEP_GROUPS).flatMap(([g, cats]) => cats.map((c) => [c, g] as [Category, string])));

export function deepGroupOf(cat: Category): string {
  return GROUP_OF.get(cat) ?? 'basics';
}

/** Gruppen, die für die gewählten Kategorien geladen werden müssen (leer = alle) */
export function deepGroupsFor(cats: Category[] | undefined): string[] {
  if (!cats?.length) return Object.keys(DEEP_GROUPS);
  return [...new Set(cats.map(deepGroupOf))];
}

export interface DeepIndex {
  v: 1;
  generatedAt: string;
  total: number;
  groups: Record<string, { n: number; bytes: number }>;
  /** Produkte im Gesamtsortiment pro Shop und Zeitpunkt des letzten vollständigen Abrufs */
  shops: Record<string, { n: number; at?: string }>;
}

export interface PackedDeep {
  v: 2;
  generatedAt: string;
  fields: readonly string[];
  rows: unknown[][];
}
