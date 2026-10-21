// "Læg på hjemmeskærmen": knap på Android/Chrome, vejledning på iPhone, hjælp hvis linket er åbnet i en anden app.
import { app, toast, esc } from './core.js';

const UA = navigator.userAgent || '';
const isIOS = /iPhone|iPad|iPod/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const inAppBrowser = /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|Snapchat|TikTok|LinkedInApp/.test(UA);
const iosNonSafari = isIOS && /CriOS|FxiOS|EdgiOS|OPiOS/.test(UA);
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
let deferred = null;
let onChange = () => {};

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; onChange(); });
window.addEventListener('appinstalled', () => { deferred = null; skip(365); toast('Padel er lagt på hjemmeskærmen'); onChange(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

// Hvordan kan man installere her? null = allerede installeret eller ikke muligt
export function installHow() {
  if (isStandalone()) return null;
  if (inAppBrowser) return 'inapp';
  if (deferred) return 'prompt';
  if (isIOS) return iosNonSafari ? 'ios-other' : 'ios';
  return 'other';
}
const KEY = 'fp-install-skip';
const skip = (days) => { try { localStorage.setItem(KEY, String(Date.now() + days * 864e5)); } catch {} };
const skipped = () => { try { return +(localStorage.getItem(KEY) || 0) > Date.now(); } catch { return false; } };

// Skal velkomstsiden vises? (efter oprettelse/login, indtil man har installeret eller sprunget over)
export const shouldShowInstall = () => { const h = installHow(); return h && h !== 'other' && !skipped(); };

const SHARE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" style="vertical-align:-3px"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';

export function renderInstall(done) {
  onChange = () => renderInstall(done);
  const how = installHow();
  if (!how) return done();
  const why = (i, t) => `<div class="gwhy"><i>${i}</i><span>${t}</span></div>`;
  const step = (n, t) => `<div class="gst"><span class="gn">${n}</span><span>${t}</span></div>`;
  let lead = '', body = '';
  if (how === 'prompt') {
    lead = 'Så åbner den som en rigtig app med ét tryk.';
    body = `${why('⚡', 'Åbner med ét tryk, ligesom andre apps')}${why('🎾', 'Se din aften, bane og makker med det samme')}${why('📦', 'Ingen App Store, fylder næsten ingenting')}
      <button class="btn primary gbig" id="doInstall">Læg på hjemmeskærmen</button>`;
  } else if (how === 'ios') {
    lead = 'Det tager 10 sekunder. Gør sådan her:';
    body = `<div class="gsteps">${step(1, `Tryk på <span class="gpill">${SHARE} Del</span> i Safari`)}${step(2, `Vælg <span class="gpill">${PLUS} Føj til hjemmeskærm</span>`)}${step(3, 'Tryk <b>Tilføj</b>, og åbn Padel fra hjemmeskærmen')}</div>
      <p class="muted small">Første gang du åbner den fra hjemmeskærmen, skal du logge ind igen.</p>`;
  } else if (how === 'ios-other' || how === 'inapp') {
    lead = 'Det kan ikke lade sig gøre herfra. Gør sådan her:';
    body = `<div class="gsteps">${step(1, how === 'inapp' ? `Tryk på <b>•••</b> eller "Åbn i browser" og vælg <b>${isIOS ? 'Safari' : 'Chrome'}</b>` : 'Åbn linket i <b>Safari</b>')}${step(2, 'Læg Padel på hjemmeskærmen derfra')}</div>
      <button class="btn" id="copyLink">Kopiér linket</button>`;
  } else {
    lead = 'Åbn appen i Chrome eller Safari på din telefon, og vælg "Føj til hjemmeskærm" i menuen.';
  }
  app.innerHTML = `
  <div class="gate">
    <div class="gtop"><button class="gskip" id="skipInstall">Spring over</button>
      <img src="icon-180.png" alt="" class="gicon"><h1>Læg Padel på din hjemmeskærm</h1><p>${lead}</p></div>
    <div class="gbody">${body}</div>
  </div>`;
  document.getElementById('skipInstall').onclick = () => { skip(14); done(); };
  document.getElementById('doInstall')?.addEventListener('click', async () => {
    deferred.prompt();
    const r = await deferred.userChoice.catch(() => null);
    deferred = null;
    if (r?.outcome === 'accepted') { skip(365); done(); } else renderInstall(done);
  });
  document.getElementById('copyLink')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.origin); toast('Linket er kopieret'); } catch { prompt('Kopiér linket', location.origin); }
  });
}
