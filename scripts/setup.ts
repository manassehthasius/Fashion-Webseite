// Einmalige Einrichtung: VAPID-Schlüssel für Web-Push erzeugen (.env + web/public/push-config.json).
// Der private Schlüssel bleibt lokal (.env) bzw. kommt als GitHub-Secret VAPID_PRIVATE_KEY ins Repo.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import webpush from 'web-push';

const root = process.cwd();
const envFile = path.join(root, '.env');
const env = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
const has = (k: string) => new RegExp(`^${k}=.+`, 'm').test(env);

let out = env.trimEnd();
let pub = env.match(/^VAPID_PUBLIC_KEY=(.+)$/m)?.[1];
if (!has('VAPID_PUBLIC_KEY') || !has('VAPID_PRIVATE_KEY')) {
  const keys = webpush.generateVAPIDKeys();
  pub = keys.publicKey;
  out += `\n# Web-Push (VAPID) – privat halten!\nVAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\n`;
  console.log('✓ Neue VAPID-Schlüssel erzeugt.');
} else console.log('✓ VAPID-Schlüssel vorhanden.');
if (!has('VAPID_SUBJECT')) out += `VAPID_SUBJECT=mailto:stilkompass@example.invalid\n`;
if (!has('STATE_PASSPHRASE')) {
  out += `# Nur für GitHub-Sync nötig (gleicher Wert wie in der App und als GitHub-Secret)\nSTATE_PASSPHRASE=${crypto.randomBytes(18).toString('base64url')}\n`;
}
fs.writeFileSync(envFile, out.trimStart() + (out.endsWith('\n') ? '' : '\n'));
fs.mkdirSync(path.join(root, 'web/public'), { recursive: true });
fs.writeFileSync(path.join(root, 'web/public/push-config.json'), JSON.stringify({ publicKey: pub }, null, 2) + '\n');
console.log('✓ web/public/push-config.json geschrieben (öffentlicher Schlüssel).');
console.log('\nFür GitHub: Inhalt von .env als Repository-Secrets hinterlegen:');
console.log('  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, STATE_PASSPHRASE');
console.log('Danach: npm run build && npm start');
