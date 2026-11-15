// Grössen-Abgleich über alle Schreibweisen der Shops: "S", "ADULT | M", "4/S", "30 / 32", "W32L32", "EU 41",
// "41 1/3", "UK8", "8 (US) / 41 (EU)" … Ohne Abhängigkeiten, im Browser und in der Engine nutzbar.
import type { Category } from './types';

export type SizeGroup = 'top' | 'bottom' | 'shoes';

const WORDS: [RegExp, string][] = [[/\bX{0,1}SMALL\b/, 'S'], [/\bMEDIU/, 'M'], [/\bLARGE\b/, 'L']];
const LETTER = /(?<![A-Z0-9])(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-6]XL|[1-6]X)(?![A-Z0-9])/g;

function letters(raw: string): string[] {
  const out = new Set<string>();
  for (const m of raw.matchAll(LETTER)) out.add(m[1]);
  for (const [re, v] of WORDS) if (re.test(raw)) out.add(v);
  return [...out];
}

/** Zahlen inkl. Brüchen/Dezimalen: "41 1/3" → 41.33, "42,5" → 42.5 */
function numbers(raw: string): number[] {
  const out: number[] = [];
  const re = /(\d{1,2})(?:[.,](\d))?(?:\s+([12])\/3)?/g;
  for (const m of raw.matchAll(re)) {
    let n = Number(m[1]);
    if (m[2]) n += Number(m[2]) / 10;
    if (m[3]) n += Number(m[3]) / 3;
    out.push(n);
  }
  return out;
}

export interface SizeCheck {
  /** null = Schreibweise nicht erkannt */
  fits: boolean | null;
}

/**
 * Passt die Shop-Grösse `raw` zu einer der gewünschten Grössen?
 * wanted: Buchstaben (S, M), Bundweite (30, 32), EU-Konfektion (46, 48) bzw. EU-Schuhgrösse (41, 42).
 */
export function sizeFits(rawIn: string, group: SizeGroup, wanted: string[], cat?: Category): boolean | null {
  const raw = rawIn.toUpperCase();
  const wl = new Set(wanted.map((w) => w.toUpperCase()).filter((w) => /^[A-Z0-9]*[A-Z]$/.test(w)));
  const wn = wanted.map((w) => Number(w.replace(',', '.').replace(/^W/i, ''))).filter((n) => Number.isFinite(n) && n > 0);

  if (group === 'shoes') {
    const nums = numbers(raw);
    if (!nums.length) return letters(raw).length ? letters(raw).some((l) => wl.has(l)) : null;
    const eu = nums.filter((n) => n >= 34 && n <= 50);
    if (eu.length) return eu.some((n) => wn.some((w) => Math.floor(n + 0.01) === w));
    const small = nums.filter((n) => n >= 3 && n < 20);
    if (!small.length) return null;
    const uk = wn.map((w) => w - 34);
    const us = wn.map((w) => w - 33);
    const test = (n: number, list: number[]) => list.some((w) => Math.floor(n) === w);
    if (/UK/.test(raw)) return small.some((n) => test(n, uk));
    if (/US/.test(raw)) return small.some((n) => test(n, us));
    return small.some((n) => test(n, uk) || test(n, us));
  }

  const ls = letters(raw);
  if (ls.length) return ls.some((l) => wl.has(l));
  const nums = numbers(raw);
  if (!nums.length) return null;
  if (group === 'bottom') {
    const waist = nums[0];
    if (waist >= 24 && waist <= 42 && (nums.length > 1 || /W/.test(raw) || waist <= 40)) {
      if (waist <= 40) return wn.some((w) => w <= 42 && Math.floor(waist) === w);
    }
    if (nums[0] >= 42 && nums[0] <= 64) return wn.some((w) => w >= 42 && Math.floor(nums[0]) === w);
    return null;
  }
  // Oberteile: EU-Konfektion (46/48) bzw. Hemd-Kragenweite (cm)
  const n = nums[0];
  if (n >= 42 && n <= 64) return wn.some((w) => w >= 42 && Math.floor(n) === w);
  if (cat === 'shirt' && n >= 35 && n <= 46) {
    const collar: Record<string, number[]> = { XS: [35, 36], S: [37, 38], M: [39, 40], L: [41, 42], XL: [43, 44], XXL: [45, 46] };
    return [...wl].some((l) => (collar[l] ?? []).includes(Math.floor(n)));
  }
  return null;
}

/** Wird das Produkt in einer der Grössen angeboten? null = keine/unbekannte Grössenangabe */
export function offeredIn(sizes: string[], group: SizeGroup, wanted: string[], cat?: Category): boolean | null {
  if (!sizes.length || !wanted.length) return null;
  let known = false;
  for (const s of sizes) {
    const r = sizeFits(s, group, wanted, cat);
    if (r) return true;
    if (r === false) known = true;
  }
  return known ? false : null;
}
