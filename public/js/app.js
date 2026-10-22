// Opstart, login-tilstand, valgt gruppe og navigation mellem skærme.
import { sb, S, app, navEl, hooks, q, isAdmin, isSuper, myGroups, setGroup, group, esc, toast, leavePage } from './core.js';
import { renderAuth, renderNewPassword } from './views/auth.js';
import { renderProfile } from './views/profile.js';
import { viewRanking, viewPlayer } from './views/ranking.js';
import { viewEvents, viewEventForm } from './views/events.js';
import { viewEvent } from './views/event.js';
import { viewAdmin } from './views/admin.js';
import { viewFaq } from './views/faq.js';
import { viewFines } from './views/fines.js';
import { readViewAs, renderViewAsBar } from './viewas.js';
import { shouldShowInstall, renderInstall } from './install.js';

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
  S.profiles = Object.fromEntries(profiles.map((p) => [p.id, p]));
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
    await handleJoin();
    let next = null;
    try { next = localStorage.getItem('fp-next'); localStorage.removeItem('fp-next'); } catch {}
    if (next && next !== location.hash) location.hash = next;
    else if (location.hash.startsWith('#/velkommen')) location.hash = '#/fredage';
    // Første gang: tilbyd at lægge appen på hjemmeskærmen
    if (!S.viewAs && !S.installShown && shouldShowInstall()) {
      S.installShown = true;
      navEl.innerHTML = '';
      return renderInstall(() => route());
    }
    await route();
  } finally { booting = false; }
}

hooks.boot = boot;
hooks.loadBase = loadBase;
hooks.renderNav = () => renderNav();

function renderNav() {
  if (!S.groupId) { navEl.innerHTML = ''; return; }
  const items = [['#/fredage', '🎾', 'Spilledage'], ['#/rangliste', '🏆', 'Rangliste']];
  // Bødekassen vises kun i grupper, hvor admin har slået den til
  if (group()?.fines_enabled) items.push(['#/boeder', '💸', 'Bøder']);
  items.push(['#/profil', '👤', 'Profil']);
  if (isAdmin()) items.push(['#/admin', '⚙️', 'Admin']);
  const cur = location.hash || '#/fredage';
  const active = (h) => cur.startsWith(h) || (h === '#/fredage' && /^#\/(fredag|ny-fredag|ret-fredag)/.test(cur)) ||
    (h === '#/profil' && cur.startsWith('#/faq')) || (h === '#/rangliste' && cur.startsWith('#/spiller'));
  navEl.innerHTML = items.map(([h, i, t]) => `<a href="${h}" class="${active(h) ? 'on' : ''}"><span>${i}</span>${t}</a>`).join('');
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
