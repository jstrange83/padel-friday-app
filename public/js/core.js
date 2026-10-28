// Fælles kerne: databaseforbindelse, tilstand, tekster og små hjælpere.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Login fra den gamle database (før flytningen) virker ikke længere: glem det, så man bare logger ind igen
try { localStorage.removeItem('fredagspadel-auth'); } catch {}
export const sb = createClient('https://jlstsyvhlzsbqymwiyzx.supabase.co', 'sb_publishable_rvPBZIkE1qhyrsq2o4EVYw_-afl7UyZ', {
  auth: { persistSession: true, storageKey: 'padel-auth' },
});

// S.me er den man ser appen som (kan være en anden spiller i "se som"), S.realMe er den der er logget ind.
export const S = {
  session: null, me: null, realMe: null, viewAs: null, profiles: {}, centers: [], courts: [], filter: 'alle', recovery: false,
  groups: [], groupCenters: [], members: [], settings: {}, groupId: null, contacts: {},
};
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
// I en klub (juniorklub) hedder rollerne noget andet: superbruger = træner
export const ROLE_CLUB = { bruger: 'Medlem', superbruger: 'Træner', admin: 'Admin' };
export const roleNames = (g = S.groupId) => (isClub(g) ? ROLE_CLUB : ROLE);
export const isClub = (g = S.groupId) => S.groups.find((x) => x.id === g)?.kind === 'klub';

// ---------- Grupper og roller ----------
// Superadmin ser og styrer alt. Ellers gælder rollen i den valgte gruppe.
// Visning: superadmin kan se alt ("super"), kun med sine egne roller i hver gruppe ("mine") eller som almindelig bruger ("bruger").
// Admins kan vælge "mine" (med admin) eller "bruger". Det ændrer kun, hvad appen viser, ikke hvad man har lov til.
try { S.viewMode = localStorage.getItem('fp-mode') || ''; } catch { S.viewMode = ''; }
export const viewMode = () => {
  if (S.viewAs) return 'mine';
  if (S.realMe?.is_superadmin) return ['super', 'mine', 'bruger'].includes(S.viewMode) ? S.viewMode : 'super';
  return S.viewMode === 'bruger' ? 'bruger' : 'mine';
};
export function setViewMode(m) { S.viewMode = m; try { localStorage.setItem('fp-mode', m); } catch {} }
export const isSuper = () => !!S.me?.is_superadmin && viewMode() === 'super';
export const member = (pid, g = S.groupId) => S.members.find((m) => m.group_id === g && m.player_id === pid);
export const roleIn = (pid, g = S.groupId) => {
  const r = member(pid, g)?.status === 'aktiv' ? member(pid, g).role : null;
  return r && !S.viewAs && pid === S.realMe?.id && viewMode() === 'bruger' ? 'bruger' : r;
};
// Har jeg (rigtigt) nogen admin-, træner- eller superadmin-rolle et sted? Så kan jeg skifte visning
export const hasElevated = () => !!S.realMe?.is_superadmin || S.members.some((m) => m.player_id === S.realMe?.id && m.status === 'aktiv' && m.role !== 'bruger') || !!S.clubRights?.length;
export const roleOf = (p, g = S.groupId) => roleIn(p?.id, g) || 'bruger';
export const isAdmin = (g = S.groupId) => isSuper() || roleIn(S.me?.id, g) === 'admin';
// Må køre en fredag: starte runder, rette hold, til-/afmelde andre, godkende resultater
export const canRun = (g = S.groupId) => isSuper() || ['admin', 'superbruger'].includes(roleIn(S.me?.id, g));
// Spillere der venter på at komme med i en gruppe, jeg er admin for
// Forslagskassen vises først, når databasen har den (kolonnen findes i indstillingerne)
export const hasSuggest = () => S.settings && 'feedback_after_matches' in S.settings;
export const pendingForMe = () => S.members.filter((m) => m.status === 'afventer' && !S.groups.find((g) => g.id === m.group_id)?.archived && isAdmin(m.group_id) && S.profiles[m.player_id]);
// Grupper jeg kan vælge imellem
// Arkiverede grupper er væk for alle (superadmin kan hente dem tilbage under Admin → Grupper)
export const liveGroups = () => S.groups.filter((g) => !g.archived);
export const myGroups = () => liveGroups().filter((g) => isSuper() || member(S.me?.id, g.id)?.status === 'aktiv');
export const group = (g = S.groupId) => S.groups.find((x) => x.id === g);
export const activeMembers = (g = S.groupId) => S.members.filter((m) => m.group_id === g && m.status === 'aktiv');
// Point i gruppens egen rangliste
// Én fælles rangliste: samme point i alle grupper
export const groupElo = (pid) => S.profiles[pid]?.elo ?? 1000;
export const groupCenterIds = (g = S.groupId) => S.groupCenters.filter((c) => c.group_id === g && c.enabled).map((c) => c.center_id);
export function setGroup(g) {
  S.groupId = g;
  try { localStorage.setItem('fp-group', g); } catch {}
}
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
  if (navigator.share) { try { await navigator.share({ title: 'Padel', text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); toast('Linket er kopieret'); }
  catch { prompt('Kopiér linket', url); }
}

// ---------- Oprydning når man skifter skærm (timere, live-forbindelser) ----------
const cleanups = [];
export const onLeave = (fn) => cleanups.push(fn);
export function leavePage() {
  while (cleanups.length) { try { cleanups.pop()(); } catch {} }
}

// Vælger mellem grupper (vises kun hvis man har flere)
export function groupBar(onChange) {
  const gs = myGroups();
  if (gs.length < 2) return '';
  setTimeout(() => app.querySelectorAll('[data-group]').forEach((b) => (b.onclick = () => { setGroup(b.dataset.group); hooks.renderNav?.(); onChange(); })), 0);
  // Tal på gruppen, når nogen venter på godkendelse der (så man kan se, hvor tallet på Admin kommer fra)
  const waiting = (id) => (S.viewAs ? 0 : (S.clubPendingBy?.[id] || 0) + pendingForMe().filter((m) => m.group_id === id).length);
  // Mange grupper: én rullemenu i stedet for en knap pr. gruppe
  if (gs.length > 4) {
    setTimeout(() => { const sel = document.getElementById('groupSel'); if (sel) sel.onchange = () => { setGroup(sel.value); hooks.renderNav?.(); onChange(); }; }, 0);
    return `<label class="teamsel"><span>Gruppe</span><select id="groupSel">${gs.map((g) => `<option value="${g.id}" ${g.id === S.groupId ? 'selected' : ''}>${esc(g.name)}${waiting(g.id) ? ` (${waiting(g.id)} venter)` : ''}</option>`).join('')}</select></label>`;
  }
  return `<div class="chips groups">${gs.map((g) => `<button class="chip ${g.id === S.groupId ? 'on' : ''}" data-group="${g.id}">${esc(g.name)}${waiting(g.id) ? ` <b class="chipbadge">${waiting(g.id)}</b>` : ''}</button>`).join('')}</div>`;
}

// Telefonnummer (kun synligt for spilleren selv, gruppens admins/superbrugere og superadmin)
export const phoneOf = (pid) => S.contacts[pid] || '';
export const fmtPhone = (ph) => (ph.startsWith('+45') && ph.length === 11 ? ph.slice(3).replace(/(\d{2})(?=\d)/g, '$1 ').trim() : ph);
export const phoneLinks = (pid) => {
  const ph = phoneOf(pid);
  return ph ? `<span class="phone">📱 ${fmtPhone(ph)}</span><a class="btn sm" href="tel:${ph}">📞 Ring</a><a class="btn sm" href="sms:${ph}">💬 SMS</a>` : '<span class="muted small">Intet telefonnummer</span>';
};
