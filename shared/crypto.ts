// Ende-zu-Ende-Verschlüsselung des Nutzerzustands (Watchlist, Push-Abos) für die GitHub-Synchronisierung.
// AES-GCM 256, Schlüssel per PBKDF2-SHA-256 (310’000 Iterationen) aus einer Passphrase. Läuft in Browser und Node ≥ 20.

export interface EncryptedBlob {
  v: 1;
  alg: 'AES-GCM-256/PBKDF2-SHA256';
  iter: number;
  salt: string; // base64
  iv: string; // base64
  data: string; // base64
}

const ITER = 310_000;

function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function key(passphrase: string, salt: Uint8Array<ArrayBuffer>, iter: number) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptJson(obj: unknown, passphrase: string): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await key(passphrase, salt, ITER);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(JSON.stringify(obj))));
  return { v: 1, alg: 'AES-GCM-256/PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), data: b64(data) };
}

export async function decryptJson<T>(blob: EncryptedBlob, passphrase: string): Promise<T> {
  const k = await key(passphrase, unb64(blob.salt), blob.iter || ITER);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, k, unb64(blob.data));
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

export function utf8ToB64(s: string): string {
  return b64(new TextEncoder().encode(s));
}
export function b64ToUtf8(s: string): string {
  return new TextDecoder().decode(unb64(s.replace(/\s/g, '')));
}
