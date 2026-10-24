// Opstart, login-tilstand, valgt gruppe og navigation mellem skærme.
import { sb, S, app, navEl, hooks, q, isAdmin, isSuper, myGroups, setGroup, group, pendingForMe, hasSuggest, esc, toast, busy, leavePage } from './core.js';
import { renderAuth, renderNewPassword } from './views/auth.js';
import { renderProfile } from './views/profile.js';
import { viewRanking, viewPlayer } from './views/ranking.js';
import { viewEvents, viewEventForm } from './views/events.js';
import { viewEvent } from './views/event.js';
import { viewAdmin } from './views/admin.js';
import { viewFaq } from './views/faq.js';
import { viewFines, newFines, renderFineGate } from './views/fines.js';
import { viewSuggest, maybeAskFeedback } from './views/suggest.js';
import { readViewAs, renderViewAsBar } from './viewas.js';
import { shouldShowInstall, renderInstall } from './install.js';
import { renderEditBar } from './editmode.js';

async function loadBase() {
  const [profiles, centers, courts, groups, groupCenters, members, settings, contacts] = await Promise.all([
    q(sb.from('padel_profiles').select('*')),
    q(sb.from('padel_centers').select('*').order('name')),
    q(sb.from('padel_courts').select('*').order('sort')),
    q(sb.from('padel_groups').select('*').order('name')),
    q(sb.from('padel_group_centers').select('*')),
    q(sb.from('padel_group_members').select('*')),
    q(sb.from('padel_settings').select('*')),
    q(sb.from('padel_contacts').select('player_id,phone')),
  ]);
  S.contacts = Object.fromEntries(contacts.map((c) => [c.player_id, c.phone]));
  Object.assign(S, { centers, courts, groups, groupCenters, members, settings: settings[0] || {} });
  // Spillere uden login, der er overtaget af en rigtig bruger, skjules
  S.profiles = Object.fromEntries(profiles.filter((p) => !p.merged_into).map((p) => [p.id, p]));
  S.realMe = S.profiles[S.session.user.id] || null;
  S.viewAs = readViewAs();
  S.me = S.viewAs ? S.profiles[S.viewAs] : S.realMe;
  // Valgt gruppe: den man sidst brugte, ellers den første man er med i
  let g = S.groupId;
  try { g ||= localStorage.getItem('fp-group'); } catch {}
  const gs = myGroups();
  if (!gs.some((x) => x.id === g)) g = gs[0]?.id || null;
  S.groupId = g;
  renderViewAsBar();
  renderEditBar();
}

// Invitationslink til en gruppe: #/velkommen/<gruppe-id>. Huskes til man er logget ind og har en profil.
function rememberJoin() {
  const m = location.hash.match(/^#\/velkommen\/([0-9a-f-]{36})/i);
  if (m) { try { localStorage.setItem('fp-join', m[1]); } catch {} }
}
async function handleJoin() {
  let g = null;
  try { g = localStorage.getItem('fp-join'); localStorage.removeItem('fp-join'); } catch {}
  if (!g) return;
  try {
    const name = await q(sb.rpc('padel_group_name', { g }));
    const st = await q(sb.rpc('padel_request_join', { g }));
    await loadBase();
    if (st === 'aktiv') { setGroup(g); toast(`Du er med i ${name}`); }
    else toast(`Du har bedt om at komme med i ${name}. En admin godkender dig.`);
  } catch {}
}

let booting = false;
async function boot() {
  if (booting) return;
  booting = true;
  try {
    leavePage();
    if (S.recovery && S.session) return renderNewPassword();
    rememberJoin();
    // Husk et delt fredagslink, så man lander der efter login/oprettelse
    if (location.hash.startsWith('#/fredag/')) { try { localStorage.setItem('fp-next', location.hash); } catch {} }
    if (!S.session) { navEl.innerHTML = ''; return renderAuth(location.hash.startsWith('#/velkommen') ? 'signup' : 'login'); }
    await loadBase();
    if (!S.me) { navEl.innerHTML = ''; return renderProfile(true); }
    if (S.realMe?.deleted_at && !S.viewAs) { navEl.innerHTML = ''; return viewDeleted(); }
    await handleJoin();
    let next = null;
    try { next = localStorage.getItem('fp-next'); localStorage.removeItem('fp-next'); } catch {}
    if (next && next !== location.hash) location.hash = next;
    else if (location.hash.startsWith('#/velkommen')) location.hash = '#/fredage';
    await gates();
  } finally { booting = false; }
}

// Sider der vises én gang, før appen: nye bøder, og første gang tilbuddet om hjemmeskærmen
async function gates() {
  if (!S.viewAs && !S.fineGateShown) {
    S.fineGateShown = true;
    const fresh = await newFines();
    if (fresh.length) { navEl.innerHTML = ''; return renderFineGate(fresh, () => gates()); }
  }
  if (!S.viewAs && !S.installShown && shouldShowInstall()) {
    S.installShown = true;
    navEl.innerHTML = '';
    return renderInstall(() => route());
  }
  await route();
  // Én gang pr. åbning: spørg om forslag, når spilleren har spillet nok kampe
  if (!S.viewAs && !S.feedbackChecked && S.groupId && hasSuggest()) { S.feedbackChecked = true; maybeAskFeedback(); }
}

hooks.boot = boot;
hooks.loadBase = loadBase;
hooks.renderNav = () => renderNav();
hooks.route = () => route();

function renderNav() {
  if (!S.groupId) { navEl.innerHTML = ''; return; }
  const items = [['#/fredage', '🎾', 'Spilledage'], ['#/rangliste', '🏆', 'Rangliste']];
  // Bødekassen vises kun i grupper, hvor admin har slået den til
  if (group()?.fines_enabled) items.push(['#/boeder', '💸', 'Bøder']);
  items.push(['#/profil', '👤', 'Profil']);
  if (isAdmin() || pendingForMe().length) items.push(['#/admin', '⚙️', 'Admin']);
  const cur = location.hash || '#/fredage';
  const active = (h) => cur.startsWith(h) || (h === '#/fredage' && /^#\/(fredag|ny-fredag|ret-fredag)/.test(cur)) ||
    (h === '#/profil' && (cur.startsWith('#/faq') || cur.startsWith('#/forslag'))) || (h === '#/rangliste' && cur.startsWith('#/spiller'));
  // Tal på Admin, når nogen venter på godkendelse
  const pend = S.viewAs ? 0 : pendingForMe().length;
  navEl.innerHTML = items.map(([h, i, t]) => `<a href="${h}" class="${active(h) ? 'on' : ''}"><span>${i}</span>${h === '#/admin' && pend ? `<b class="navbadge" aria-label="${pend} venter på godkendelse">${pend}</b>` : ''}${t}</a>`).join('');
}

// Profilen er slettet: tilbyd at genaktivere (samme point som før; man skal godkendes i gruppen igen)
function viewDeleted() {
  app.innerHTML = `
  <div class="auth">
    <div class="logo">🎾</div>
    <h1>Din profil er slettet</h1>
    <p class="muted">Vil du være med igen? Så genaktiverer vi din profil med de point, du havde. Bagefter skal en admin godkende dig i gruppen igen.</p>
    <button class="btn primary" id="reactivate">Genaktivér min profil</button>
    <button class="btn ghost" id="outDel">Log ud</button>
  </div>`;
  document.getElementById('outDel').onclick = () => sb.auth.signOut();
  document.getElementById('reactivate').onclick = async (e) => {
    busy(e.currentTarget, true);
    try { await q(sb.rpc('padel_reactivate_me')); toast('Velkommen tilbage! Bed en admin om et invitationslink til gruppen'); await boot(); } catch { busy(e.currentTarget, false); }
  };
}

// Ikke med i nogen gruppe endnu: vis status på anmodninger
function viewNoGroup() {
  const mine = S.members.filter((m) => m.player_id === S.me.id);
  const nameOfGroup = (id) => S.groups.find((g) => g.id === id)?.name || 'en gruppe';
  app.innerHTML = `
  <div class="auth">
    <div class="logo">🎾</div>
    <h1>Hej ${esc(S.me.name.split(' ')[0])}</h1>
    ${mine.some((m) => m.status === 'afventer')
      ? `<p>Du har bedt om at komme med i <b>${mine.filter((m) => m.status === 'afventer').map((m) => esc(nameOfGroup(m.group_id))).join(', ')}</b>.</p>
         <p class="muted">Når en admin har godkendt dig, kan du se fredagene og tilmelde dig. Kig forbi igen senere.</p>`
      : '<p class="muted">Du er ikke med i en gruppe endnu. Bed en admin om et invitationslink til jeres gruppe.</p>'}
    <button class="btn" id="reload">Tjek igen</button>
    <a class="btn ghost" href="#/profil">Min profil</a>
  </div>`;
  document.getElementById('reload').onclick = () => boot();
}

const ROUTES = {
  fredage: () => viewEvents(),
  fredag: (id) => viewEvent(id),
  'ny-fredag': () => viewEventForm(null),
  'ret-fredag': async (id) => viewEventForm(await q(sb.from('padel_events').select('*').eq('id', id).single())),
  rangliste: () => viewRanking(),
  spiller: (id) => viewPlayer(id),
  profil: () => renderProfile(false),
  faq: () => viewFaq(),
  boeder: () => viewFines(),
  forslag: () => viewSuggest(),
  admin: () => (isAdmin() || isSuper() ? viewAdmin() : viewEvents()),
};

async function route() {
  leavePage();
  window.scrollTo(0, 0);
  const [, page, id] = (location.hash || '#/fredage').split('/');
  renderNav();
  if (!S.groupId && !['profil', 'faq', 'admin'].includes(page)) return viewNoGroup();
  try { await (ROUTES[page] || ROUTES.fredage)(id); } catch (e) { console.error(e); }
  renderNav();
}

sb.auth.onAuthStateChange((ev, session) => {
  S.session = session;
  if (ev === 'PASSWORD_RECOVERY') S.recovery = true;
  if (['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT', 'PASSWORD_RECOVERY'].includes(ev)) setTimeout(boot, 0);
});
window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#/velkommen/')) return boot();
  if (S.me) route();
});
