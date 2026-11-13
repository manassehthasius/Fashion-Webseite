// Text-Hilfen: Normalisierung, Wortgrenzen-Suche, HTML entfernen.

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
  '&#160;': ' ', '&euro;': '€', '&pound;': '£', '&ndash;': '–', '&mdash;': '—', '&uuml;': 'ü', '&ouml;': 'ö',
  '&auml;': 'ä', '&Uuml;': 'Ü', '&Ouml;': 'Ö', '&Auml;': 'Ä', '&szlig;': 'ß', '&eacute;': 'é', '&egrave;': 'è',
  '&agrave;': 'à', '&ccedil;': 'ç', '&rsquo;': '’', '&lsquo;': '‘', '&rdquo;': '”', '&ldquo;': '“', '&bull;': '•',
  '&hellip;': '…', '&deg;': '°', '&reg;': '®', '&trade;': '™', '&copy;': '©', '&times;': '×',
};

export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/p>|<\/li>|<\/div>|<\/h\d>/gi, '. ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-zA-Z]+;|&#\d+;/g, (e) => ENTITIES[e] ?? ' ')
    .replace(/\s*\.\s*(\.\s*)+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Kleinschreibung, Satzzeichen → Leerzeichen; Umlaute bleiben erhalten */
export function norm(s: string | null | undefined): string {
  return ` ${(s ?? '')
    .toLowerCase()
    .replace(/[’'`´]/g, "'")
    .replace(/[^a-z0-9äöüßéèêàâçñåøæ%'&./+-]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

/** Diakritika entfernen (für tolerante Suche) */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae');
}

const reCache = new Map<string, RegExp>();
const B = "[^a-z0-9äöüßéèêàâçñåøæ]";

/** Findet ein Wort/eine Phrase mit Wortgrenzen (optional Plural-s) */
export function wordRegex(word: string): RegExp {
  let re = reCache.get(word);
  if (!re) {
    const esc = word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s-]+');
    re = new RegExp(`(?:^|${B})(${esc})(?:s|es)?(?=$|${B})`, 'i');
    reCache.set(word, re);
  }
  return re;
}

export function hasWord(text: string, word: string): boolean {
  return wordRegex(word).test(text);
}

/** Endposition des letzten Vorkommens eines Wortes (-1 wenn nicht vorhanden) */
export function lastEndOfWord(text: string, word: string): number {
  const re = new RegExp(wordRegex(word).source, 'gi');
  let m: RegExpExecArray | null;
  let last = -1;
  while ((m = re.exec(text))) {
    last = m.index + m[0].length;
    re.lastIndex = m.index + 1;
  }
  return last;
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s\-/&.(])([a-zäöüéèàç])/g, (_, a, b) => a + b.toUpperCase())
    .replace(/\b(Ii|Iii|Iv)\b/g, (x) => x.toUpperCase());
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Rundung auf 5 Rappen */
export function round05(n: number): number {
  return Math.round(n * 20) / 20;
}

export function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
