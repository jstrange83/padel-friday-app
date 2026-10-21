// Opstart, login-tilstand og navigation mellem skærme.
import { sb, S, app, navEl, hooks, q, isAdmin, leavePage } from './core.js';
import { renderAuth, renderNewPassword } from './views/auth.js';
import { renderProfile } from './views/profile.js';
import { viewRanking, viewPlayer } from './views/ranking.js';
import { viewEvents, viewEventForm } from './views/events.js';
import { viewEvent } from './views/event.js';
import { viewAdmin } from './views/admin.js';
import { viewFaq } from './views/faq.js';
import { readViewAs, renderViewAsBar } from './viewas.js';

async function loadBase() {
  const [profiles, centers, courts] = await Promise.all([
    q(sb.from('padel_profiles').select('*')),
    q(sb.from('padel_centers').select('*').order('name')),
    q(sb.from('padel_courts').select('*').order('sort')),
  ]);
  S.profiles = Object.fromEntries(profiles.map((p) => [p.id, p]));
  S.centers = centers;
  S.courts = courts;
  S.realMe = S.profiles[S.session.user.id] || null;
  S.viewAs = readViewAs();
  S.me = S.viewAs ? S.profiles[S.viewAs] : S.realMe;
  renderViewAsBar();
}

let booting = false;
async function boot() {
  if (booting) return;
  booting = true;
  try {
    leavePage();
    if (S.recovery && S.session) return renderNewPassword();
    // Husk et delt fredagslink, så man lander der efter login/oprettelse
    if (location.hash.startsWith('#/fredag/')) { try { localStorage.setItem('fp-next', location.hash); } catch {} }
    if (!S.session) { navEl.innerHTML = ''; return renderAuth(location.hash === '#/velkommen' ? 'signup' : 'login'); }
    await loadBase();
    if (!S.me) { navEl.innerHTML = ''; return renderProfile(true); }
    let next = null;
    try { next = localStorage.getItem('fp-next'); localStorage.removeItem('fp-next'); } catch {}
    if (next && next !== location.hash) location.hash = next;
    else if (location.hash === '#/velkommen') location.hash = '#/fredage';
    await route();
  } finally { booting = false; }
}

hooks.boot = boot;
hooks.loadBase = loadBase;

function renderNav() {
  const items = [['#/fredage', '🎾', 'Fredage'], ['#/rangliste', '🏆', 'Rangliste'], ['#/profil', '👤', 'Profil']];
  if (isAdmin()) items.push(['#/admin', '⚙️', 'Admin']);
  const cur = location.hash || '#/fredage';
  const active = (h) => cur.startsWith(h) || (h === '#/fredage' && /^#\/(fredag|ny-fredag|ret-fredag)/.test(cur)) ||
    (h === '#/profil' && cur.startsWith('#/faq')) || (h === '#/rangliste' && cur.startsWith('#/spiller'));
  navEl.innerHTML = items.map(([h, i, t]) => `<a href="${h}" class="${active(h) ? 'on' : ''}"><span>${i}</span>${t}</a>`).join('');
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
  admin: () => (isAdmin() ? viewAdmin() : viewEvents()),
};

async function route() {
  leavePage();
  renderNav();
  window.scrollTo(0, 0);
  const [, page, id] = (location.hash || '#/fredage').split('/');
  try { await (ROUTES[page] || ROUTES.fredage)(id); } catch (e) { console.error(e); }
}

sb.auth.onAuthStateChange((ev, session) => {
  S.session = session;
  if (ev === 'PASSWORD_RECOVERY') S.recovery = true;
  if (['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT', 'PASSWORD_RECOVERY'].includes(ev)) setTimeout(boot, 0);
});
window.addEventListener('hashchange', () => { if (S.me) route(); });
