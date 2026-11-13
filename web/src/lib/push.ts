// Web-Push (Browser-Standard, kostenlos): Abo anlegen und im Nutzerzustand speichern.
import { getUser, setPushSubscriptions } from './store';
import type { PushSubscriptionJSONLike } from '@shared/types';

export async function pushSupported(): Promise<boolean> {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function getPublicKey(): Promise<string | null> {
  try {
    const r = await fetch('./push-config.json', { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j.publicKey === 'string' && j.publicKey.length > 40 ? j.publicKey : null;
  } catch {
    return null;
  }
}

function urlB64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!(await pushSupported())) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function enablePush(): Promise<PushSubscriptionJSONLike> {
  if (!(await pushSupported())) throw new Error('Dieser Browser unterstützt keine Web-Push-Benachrichtigungen. Auf dem iPhone: Seite zum Home-Bildschirm hinzufügen (iOS 16.4+).');
  const key = await getPublicKey();
  if (!key) throw new Error('Kein VAPID-Schlüssel gefunden. Bitte einmalig "npm run setup" ausführen (siehe Anleitung).');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Benachrichtigungen wurden im Browser nicht erlaubt.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(key) });
  const json = sub.toJSON() as PushSubscriptionJSONLike;
  const existing = (getUser().push ?? []).filter((s) => s.endpoint !== json.endpoint);
  setPushSubscriptions([...existing, json]);
  return json;
}

export async function disablePush() {
  const sub = await currentSubscription();
  const endpoint = sub?.endpoint;
  await sub?.unsubscribe();
  setPushSubscriptions((getUser().push ?? []).filter((s) => s.endpoint !== endpoint));
}

/** Lokale Testbenachrichtigung über den Service Worker (ohne Server) */
export async function localTestNotification() {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('Stilkompass – Test', { body: 'So sehen deine Preisalarme aus.', icon: './icon-192.png', badge: './icon-192.png', tag: 'test' });
}
