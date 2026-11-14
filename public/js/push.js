// Notifikationer på telefonen.
// I Android- og iPhone-appen bruges telefonens egen notifikationstjeneste (Firebase / Apple).
// I browseren bruges web push. På iPhone virker web push kun, når siden er lagt på hjemmeskærmen.
import { sb, q, toast, hooks } from './core.js';

const Cap = () => window.Capacitor;
export const isNativeApp = () => !!Cap()?.isNativePlatform?.();
const nativePush = () => (isNativeApp() && Cap().isPluginAvailable?.('PushNotifications') ? Cap().Plugins.PushNotifications : null);
const platform = () => Cap()?.getPlatform?.() || 'web';

export const pushSupported = () => !!nativePush() || (!isNativeApp() && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const standalone = () => isNativeApp() || window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

const b64 = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))); };
const NKEY = 'fp-native-push';
const store = { get: () => { try { return localStorage.getItem(NKEY); } catch { return null; } }, set: (v) => { try { v ? localStorage.setItem(NKEY, v) : localStorage.removeItem(NKEY); } catch {} } };

async function currentSub() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

// Har brugeren endnu ikke svaret på, om appen må sende notifikationer?
export async function pushUndecided() {
  const np = nativePush();
  if (np) { try { const p = await np.checkPermissions(); return p.receive === 'prompt' || p.receive === 'prompt-with-rationale'; } catch { return false; } }
  return pushSupported() && Notification.permission === 'default';
}

// Er notifikationer slået til på denne enhed?
export async function pushOn() {
  const np = nativePush();
  if (np) { try { return (await np.checkPermissions()).receive === 'granted' && !!store.get(); } catch { return false; } }
  try { return Notification.permission === 'granted' && !!(await currentSub()); } catch { return false; }
}

// Hent telefonens token fra Firebase/Apple og gem det hos os
function nativeRegister(np) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Telefonen svarede ikke. Prøv igen om lidt.')), 20000);
    np.addListener('registration', async ({ value }) => {
      clearTimeout(t);
      try { await q(sb.rpc('padel_save_native_push_v2', { p_platform: platform(), p_token: value })); store.set(value); resolve(); } catch (e) { reject(e); }
    });
    np.addListener('registrationError', (e) => { clearTimeout(t); reject(new Error('Notifikationer kunne ikke slås til: ' + (e?.error || 'ukendt fejl'))); });
    np.register().catch((e) => { clearTimeout(t); reject(e); });
  });
}

let nativeReady = false;
async function setupNative(np) {
  await np.removeAllListeners().catch(() => {});
  if (platform() === 'android') await np.createChannel?.({ id: 'padel', name: 'Padelklubben', description: 'Beskeder fra dine grupper og klubber', importance: 4, visibility: 1, vibration: true }).catch(() => {});
  // Kommer der en notifikation, mens appen er åben: vis den som en lille besked i appen
  np.addListener('pushNotificationReceived', (n) => {
    const t = [n?.title, n?.body].filter(Boolean).join(': ');
    if (t) toast('🔔 ' + t);
    hooks.refreshUnread?.();
  });
  // Tryk på en notifikation: åbn den side, den handler om
  np.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const url = notification?.data?.url;
    if (url && typeof url === 'string') location.href = url.startsWith('http') ? url : new URL(url, location.origin).href;
  });
}

export async function enablePush() {
  const np = nativePush();
  if (np) {
    let p = await np.checkPermissions();
    if (p.receive !== 'granted') p = await np.requestPermissions();
    if (p.receive !== 'granted') throw new Error('Du sagde nej til notifikationer. Det kan ændres under telefonens Indstillinger → Apps → Padelklubben → Notifikationer.');
    await setupNative(np); nativeReady = true;
    await nativeRegister(np);
    return;
  }
  if (isNativeApp()) throw new Error('Opdater appen for at få notifikationer.');
  if (!pushSupported()) throw new Error(isIOS() && !standalone() ? 'Læg appen på hjemmeskærmen først, så kan iPhone vise notifikationer.' : 'Din browser kan ikke vise notifikationer.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Du sagde nej til notifikationer. Det kan ændres i telefonens indstillinger.');
  const key = await q(sb.rpc('padel_vapid_public'));
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
  const j = sub.toJSON();
  // mobile = notifikationer i telefonens browser. Har man også appen på telefonen, sendes beskeden kun til appen (ingen dobbelte)
  await q(sb.rpc('padel_save_push_v2', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_mobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) }));
}

export async function disablePush() {
  const np = nativePush();
  if (np) {
    const tok = store.get();
    if (tok) { try { await q(sb.rpc('padel_disable_native_push_v2', { p_platform: platform(), p_token: tok })); } catch {} }
    store.set(null);
    await np.unregister().catch(() => {});
    return;
  }
  const sub = await currentSub();
  if (!sub) return;
  try { await q(sb.rpc('padel_disable_push', { p_endpoint: sub.endpoint })); } catch {}
  await sub.unsubscribe().catch(() => {});
}

// Kaldes når man er logget ind: i appen fornys token stille og roligt (det kan skifte), og tryk på notifikationer virker.
let webRefreshed = false;
export async function refreshNativePush() {
  const np = nativePush();
  // Browser: gem abonnementet igen én gang pr. åbning (så det ved, om det er en telefon, og ingen beskeder kommer dobbelt)
  if (!np && !webRefreshed && !isNativeApp() && pushSupported() && Notification.permission === 'granted') {
    webRefreshed = true;
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (sub) { const j = sub.toJSON(); await q(sb.rpc('padel_save_push_v2', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_mobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) })); }
    } catch {}
    return;
  }
  if (!np || nativeReady) return;
  try {
    if ((await np.checkPermissions()).receive !== 'granted' || !store.get()) { await setupNative(np); nativeReady = true; return; }
    await setupNative(np); nativeReady = true;
    await nativeRegister(np);
  } catch {}
}
