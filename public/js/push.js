// Notifikationer på telefonen (web push). På iPhone virker det kun, når appen er lagt på hjemmeskærmen.
import { sb, q } from './core.js';

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

const b64 = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))); };

async function currentSub() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

// Er notifikationer slået til på denne enhed?
export async function pushOn() {
  try { return Notification.permission === 'granted' && !!(await currentSub()); } catch { return false; }
}

export async function enablePush() {
  if (!pushSupported()) throw new Error(isIOS() && !standalone() ? 'Læg appen på hjemmeskærmen først, så kan iPhone vise notifikationer.' : 'Din browser kan ikke vise notifikationer.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Du sagde nej til notifikationer. Det kan ændres i telefonens indstillinger.');
  const key = await q(sb.rpc('padel_vapid_public'));
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
  const j = sub.toJSON();
  await q(sb.rpc('padel_save_push', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth }));
}

export async function disablePush() {
  const sub = await currentSub();
  if (!sub) return;
  try { await q(sb.rpc('padel_disable_push', { p_endpoint: sub.endpoint })); } catch {}
  await sub.unsubscribe().catch(() => {});
}
