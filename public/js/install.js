// "Hent appen": Padelklubben findes nu i App Store og Google Play. Bruger man appen i browseren eller som
// genvej på hjemmeskærmen på en telefon, vises én gang en side med link til den rigtige app og besked om at
// slette den gamle genvej. I selve appen (iPhone/Android) vises den aldrig.
import { app, toast } from './core.js';

export const APP_STORE = 'https://apps.apple.com/dk/app/id6838013332';
export const GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=dk.padelklubben.app';

const UA = navigator.userAgent || '';
const isIOS = /iPhone|iPad|iPod/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(UA);
const isNative = () => !!window.Capacitor?.isNativePlatform?.();
export const isStandalone = () => isNative() || window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
// Genvej på hjemmeskærmen (web-app), ikke den rigtige app
const isHomeShortcut = () => !isNative() && (window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

// Hvilken butik? null = man er allerede i appen
export function installHow() {
  if (isNative()) return null;
  return isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';
}
const KEY = 'fp-store-skip';
const skip = (days) => { try { localStorage.setItem(KEY, String(Date.now() + days * 864e5)); } catch {} };
const skipped = () => { try { return +(localStorage.getItem(KEY) || 0) > Date.now(); } catch { return false; } };

// Vises efter login på telefoner (ikke computere), indtil man har trykket "Jeg har appen" eller "Senere"
export const shouldShowInstall = () => { const h = installHow(); return (h === 'ios' || h === 'android') && !skipped(); };

// Barn uden e-mail: koden, der skal skrives i den nye app
const kidCode = () => { try { const c = localStorage.getItem('fp-kidcode'); return c ? c.toUpperCase().replace(/(.{4})(?=.)/g, '$1-') : ''; } catch { return ''; } };

const storeBtn = (kind, primary) => kind === 'ios'
  ? `<a class="btn ${primary ? 'primary' : ''} gbig storebtn" href="${APP_STORE}" target="_blank" rel="noopener" data-store="ios"> Hent i App Store <small>iPhone og iPad</small></a>`
  : `<a class="btn ${primary ? 'primary' : ''} gbig storebtn" href="${GOOGLE_PLAY}" target="_blank" rel="noopener" data-store="android">▶ Hent i Google Play <small>Android</small></a>`;

export function renderInstall(done) {
  const how = installHow();
  if (!how) return done();
  const why = (i, t) => `<div class="gwhy"><i>${i}</i><span>${t}</span></div>`;
  const step = (n, t) => `<div class="gst"><span class="gn">${n}</span><span>${t}</span></div>`;
  const buttons = how === 'ios' ? storeBtn('ios', true) : how === 'android' ? storeBtn('android', true) : storeBtn('ios', true) + storeBtn('android', true);
  const other = how === 'ios' ? `<p class="muted small center">Har du Android? <a href="${GOOGLE_PLAY}" target="_blank" rel="noopener">Hent den i Google Play</a></p>`
    : how === 'android' ? `<p class="muted small center">Har du iPhone? <a href="${APP_STORE}" target="_blank" rel="noopener">Hent den i App Store</a></p>` : '';
  app.innerHTML = `
  <div class="gate storegate">
    <div class="gtop"><button class="gskip" id="skipInstall">Senere</button>
      <img src="icon-180.png" alt="" class="gicon"><h1>Padelklubben er nu en rigtig app</h1>
      <p>Hent den gratis i ${how === 'ios' ? 'App Store' : how === 'android' ? 'Google Play' : 'App Store og Google Play'}.</p></div>
    <div class="gbody">
      ${why('🔔', 'Få besked direkte på telefonen om spilledage, træning og nyt')}${why('⚡', 'Åbner hurtigere, og du kan bruge den på dit ur')}
      ${buttons}
      <div class="gsteps">
        ${step(1, 'Hent appen, og log ind med samme e-mail og adgangskode som nu. Du mister ikke noget')}
        ${step(2, 'Sig ja til notifikationer, første gang du åbner den')}
        ${step(3, `${isHomeShortcut() ? 'Slet så <b>denne</b> genvej' : 'Har du lagt Padelklubben på hjemmeskærmen fra browseren, så slet den genvej'}: hold fingeren på ikonet, og vælg <b>Fjern</b>, så du ikke har to`)}
      </div>
      ${kidCode() ? `<div class="kidcodebox"><small>I den nye app trykker du <b>Barn uden e-mail? Log ind med din kode</b> og skriver:</small><b>${kidCode()}</b><button class="btn sm" id="copyKid">Kopiér koden</button></div>` : ''}
      ${other}
      <button class="btn gbig" id="haveApp">Jeg har appen</button>
    </div>
  </div>`;
  document.getElementById('skipInstall').onclick = () => { skip(7); done(); };
  document.getElementById('haveApp').onclick = () => { skip(3650); done(); };
  app.querySelectorAll('[data-store]').forEach((a) => a.addEventListener('click', () => skip(3)));
  document.getElementById('copyKid')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(kidCode()); toast('Koden er kopieret'); } catch { toast(`Koden er ${kidCode()}`); } });
}
