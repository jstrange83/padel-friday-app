// Fælles kerne: databaseforbindelse, tilstand, tekster og små hjælpere.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const sb = createClient('https://mxdgspfhakomblprhvto.supabase.co', 'sb_publishable_0ZKQoqCX5a6okJl_Lh0Leg_URrexVdI', {
  auth: { persistSession: true, storageKey: 'fredagspadel-auth' },
});

// S.me er den man ser appen som (kan være en anden spiller i "se som"), S.realMe er den der er logget ind.
export const S = { session: null, me: null, realMe: null, viewAs: null, profiles: {}, centers: [], courts: [], filter: 'alle', recovery: false };
export const app = document.getElementById('app');
export const navEl = document.getElementById('nav');

// Sættes af app.js, så skærme kan genstarte appen uden cirkulære imports
export const hooks = { boot: () => {}, loadBase: async () => {} };

// ---------- Tekster ----------
export const SIDE = { venstre: 'Venstre', hojre: 'Højre', begge: 'Begge sider' };
export const SIDE_SHORT = { venstre: 'V', hojre: 'H', begge: 'V/H' };
export const GENDER = { mand: 'Mand', kvinde: 'Kvinde' };
export const FORMAT = { rotation: 'Rotation på tid', saet: 'Ét sæt pr. runde', americano: 'Americano', klassisk: 'Klassisk' };
export const MODE = { aaben: 'Åben', mix: 'Mix', herre: 'Herre', dame: 'Dame' };
export const ROLE = { bruger: 'Bruger', superbruger: 'Superbruger', admin: 'Admin' };

// ---------- Roller ----------
export const roleOf = (p) => p?.role || (p?.is_admin ? 'admin' : 'bruger');
export const isAdmin = () => !!S.me?.is_admin;
// Må køre en fredag: starte runder, rette hold, til-/afmelde andre, godkende resultater
export const canRun = () => isAdmin() || roleOf(S.me) === 'superbruger';
// Må tilmelde sig en fredag ud fra herre/dame
export const canJoin = (ev) => ev.team_mode === 'aaben' || ev.team_mode === 'mix' ||
  (ev.team_mode === 'herre' ? S.me.gender === 'mand' : S.me.gender === 'kvinde');

// ---------- Små hjælpere ----------
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const nameOf = (id) => S.profiles[id]?.name || 'Ukendt';
// Fornavn, men fuldt navn hvis en anden spiller har samme fornavn
export const first = (id) => {
  const fn = nameOf(id).split(' ')[0];
  return Object.values(S.profiles).some((p) => p.id !== id && p.name.split(' ')[0] === fn) ? nameOf(id) : fn;
};
export const fmtDate = (d, opts = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) =>
  new Intl.DateTimeFormat('da-DK', { ...opts, timeZone: 'Europe/Copenhagen' }).format(new Date(d));
export const hm = (d) => fmtDate(d, { hour: '2-digit', minute: '2-digit' });
export const courtById = (id) => S.courts.find((c) => c.id === id);
export const centerById = (id) => S.centers.find((c) => c.id === id);
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function toast(msg, bad = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.className = ''), 3200);
}

function niceError(e) {
  const m = e?.message || String(e);
  if (/Invalid login credentials/i.test(m)) return 'Forkert e-mail eller adgangskode';
  if (/Email not confirmed/i.test(m)) return 'Bekræft din e-mail først (tjek din indbakke)';
  if (/already registered/i.test(m)) return 'E-mailen er allerede oprettet. Log ind i stedet';
  if (/Password should be/i.test(m)) return 'Adgangskoden skal være mindst 6 tegn';
  if (/violates foreign key/i.test(m)) return 'Kan ikke slettes, fordi den er brugt i kampe';
  if (/row-level security/i.test(m)) return 'Det har du ikke adgang til';
  return m;
}

// Kør et databasekald: viser fejl som besked og kaster videre
export async function q(p) {
  const { data, error } = await p;
  if (error) { toast(niceError(error), true); throw error; }
  return data;
}

// Knap viser "…" mens noget gemmes
export function busy(btn, on) {
  if (!btn) return;
  btn.disabled = on;
  if (on) { btn._t = btn.textContent; btn.textContent = '…'; } else if (btn._t) btn.textContent = btn._t;
}

export function radios(name, opts, val) {
  return `<div class="seg">${Object.entries(opts).map(([k, v]) =>
    `<label><input type="radio" name="${name}" value="${k}" ${k === val ? 'checked' : ''} required><span>${v}</span></label>`).join('')}</div>`;
}

export async function share(url, text) {
  if (navigator.share) { try { await navigator.share({ title: 'Fredagspadel', text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); toast('Linket er kopieret'); }
  catch { prompt('Kopiér linket', url); }
}

// ---------- Oprydning når man skifter skærm (timere, live-forbindelser) ----------
const cleanups = [];
export const onLeave = (fn) => cleanups.push(fn);
export function leavePage() {
  while (cleanups.length) { try { cleanups.pop()(); } catch {} }
}
