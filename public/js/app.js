// Opstart, login-tilstand, valgt gruppe og navigation mellem skærme.
import { sb, S, app, navEl, hooks, q, isAdmin, isSuper, canRun, isClub, myGroups, setGroup, group, pendingForMe, hasSuggest, esc, toast, busy, leavePage } from './core.js';
import { viewTraining, viewPosts, viewClubJoin, loadClubPending, isTreasurer } from './views/club.js';
import { viewPrivacy } from './views/privacy.js';
import { renderAuth, renderNewPassword } from './views/auth.js';
import { renderProfile } from './views/profile.js';
import { viewRanking, viewPlayer } from './views/ranking.js';
import { viewEvents, viewEventForm } from './views/events.js';
import { viewEvent } from './views/event.js';
import { viewAdmin } from './views/admin.js';
import { viewFaq } from './views/faq.js';
import { viewFines, newFines, renderFineGate } from './views/fines.js';
import { viewSuggest, maybeAskFeedback } from './views/suggest.js';
import { viewNotices, loadUnread } from './views/notify.js';
import { viewTheme, applyTheme } from './theme.js';
import { maybeShowNews, viewNews } from './news.js';
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
  if (S.realMe) applyTheme(S.realMe.theme);
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
  // Beskeder til superadmin (fx når en slettet spiller kommer igen)
  S.notices = [];
  if (S.realMe?.is_superadmin) { try { S.notices = await q(sb.from('padel_admin_notices').select('*').eq('seen', false).order('created_at')); } catch {} }
  if (S.realMe) await Promise.all([loadUnread(), loadClubPending()]);
}

// Invitationslink til en gruppe: #/velkommen/<gruppe-id>. Huskes til man er logget ind og har en profil.
// Link til en juniorklub: forælderen melder bagefter sit barn ind. #/barn/<kode>: barnets eget login eller anden forælder.
function rememberJoin() {
  const m = location.hash.match(/^#\/velkommen\/([0-9a-f-]{36})/i);
  if (m) { try { localStorage.setItem('fp-join', m[1]); } catch {} }
  const c = location.hash.match(/^#\/barn\/([0-9a-f]{12})/i);
  if (c) { try { localStorage.setItem('fp-claim', c[1]); } catch {} }
}
// Hvad er man inviteret til (vises på login og velkomst)
async function loadJoinInfo() {
  S.joinInfo = null;
  let g = null, c = null;
  try { g = localStorage.getItem('fp-join'); c = localStorage.getItem('fp-claim'); } catch {}
  try {
    if (c) { const i = await q(sb.rpc('padel_club_code_info', { p_code: c })); if (i) S.joinInfo = { kind: i.kind, name: i.club, kid: i.kid }; }
    else if (g) { const kind = await q(sb.rpc('padel_group_kind', { g })); if (kind) S.joinInfo = { kind, name: await q(sb.rpc('padel_group_name', { g })) }; }
  } catch {}
}
async function handleJoin() {
  let g = null, c = null;
  try { g = localStorage.getItem('fp-join'); localStorage.removeItem('fp-join'); c = localStorage.getItem('fp-claim'); localStorage.removeItem('fp-claim'); } catch {}
  if (c) {
    try { const cg = await q(sb.rpc('padel_club_claim', { p_code: c })); await loadBase(); if (myGroups().some((x) => x.id === cg)) setGroup(cg); location.hash = '#/traening'; toast('Velkommen i klubben 🎾'); return true; } catch {}
  }
  if (!g) return false;
  try {
    const name = await q(sb.rpc('padel_group_name', { g }));
    // Juniorklub: forælderen melder sit barn ind (eller er allerede med)
    if ((await q(sb.rpc('padel_group_kind', { g }))) === 'klub') {
      if (myGroups().some((x) => x.id === g)) { setGroup(g); location.hash = '#/traening'; return true; }
      location.hash = `#/klub-ind/${g}`;
      return true;
    }
    const st = await q(sb.rpc('padel_request_join', { g }));
    await loadBase();
    if (st === 'aktiv') { setGroup(g); toast(`Du er med i ${name}`); }
    else toast(`Du har bedt om at komme med i ${name}. En admin godkender dig.`);
  } catch {}
  return false;
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
    if (!S.session) { navEl.innerHTML = ''; await loadJoinInfo(); return renderAuth(/^#\/(velkommen|barn)/.test(location.hash) ? 'signup' : 'login'); }
    await loadBase();
    if (!S.me) { navEl.innerHTML = ''; await loadJoinInfo(); return renderProfile(true); }
    if (S.realMe?.deleted_at && !S.viewAs) { navEl.innerHTML = ''; return viewDeleted(); }
    const joined = await handleJoin();
    let next = null;
    try { next = localStorage.getItem('fp-next'); localStorage.removeItem('fp-next'); } catch {}
    if (joined) { /* handleJoin har valgt siden */ }
    else if (next && next !== location.hash) location.hash = next;
    else if (/^#\/(velkommen|barn)/.test(location.hash)) location.hash = '#/fredage';
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
  // "Nyt i appen" først; ellers evt. spørgsmål om forslag (aldrig to popups på én gang)
  if (!S.viewAs && !S.newsChecked) { S.newsChecked = true; if (maybeShowNews()) return; }
  if (!S.viewAs && !S.feedbackChecked && S.groupId && hasSuggest()) { S.feedbackChecked = true; maybeAskFeedback(); }
}

hooks.boot = boot;
hooks.loadBase = loadBase;
hooks.renderNav = () => renderNav();
hooks.route = () => route();

function renderNav() {
  if (!S.groupId) { navEl.innerHTML = ''; return; }
  if (isClub()) return renderClubNav();
  const items = [['#/fredage', '🎾', 'Spilledage']];
  // Gruppens admin kan vælge ingen rangliste; så er den skjult for spillerne
  if (group()?.ranking_mode !== 'ingen' || isAdmin()) items.push(['#/rangliste', '🏆', 'Rangliste']);
  // Bødekassen vises kun i grupper, hvor admin har slået den til
  if (group()?.fines_enabled) items.push(['#/boeder', '💸', 'Bøder']);
  items.push(['#/profil', '👤', 'Profil']);
  if (isAdmin() || pendingForMe().length || S.notices?.length) items.push(['#/admin', '⚙️', 'Admin']);
  const cur = location.hash || '#/fredage';
  const active = (h) => cur.startsWith(h) || (h === '#/fredage' && /^#\/(fredag|ny-fredag|ret-fredag)/.test(cur)) ||
    (h === '#/profil' && (cur.startsWith('#/faq') || cur.startsWith('#/forslag') || cur.startsWith('#/beskeder') || cur.startsWith('#/udseende') || cur.startsWith('#/nyt'))) || (h === '#/rangliste' && cur.startsWith('#/spiller'));
  // Tal på Admin, når nogen venter på godkendelse
  const pend = S.viewAs ? 0 : pendingForMe().length + (S.notices?.length || 0);
  navEl.innerHTML = items.map(([h, i, t]) => `<a href="${h}" class="${active(h) ? 'on' : ''}"><span>${i}</span>${h === '#/admin' && pend ? `<b class="navbadge" aria-label="${pend} venter på godkendelse">${pend}</b>` : ''}${h === '#/profil' && S.unread && !S.viewAs ? `<b class="navbadge" aria-label="${S.unread} nye beskeder">${S.unread}</b>` : ''}${t}</a>`).join('');
}

// Juniorklub: Træning, Opslag, Profil og (for trænere) Admin
function renderClubNav() {
  const cur = location.hash || '#/traening';
  const pend = S.viewAs ? 0 : (S.clubPending || 0) + pendingForMe().length + (S.notices?.length || 0);
  const items = [['#/traening', '🎾', 'Træning'], ['#/opslag', '📣', 'Opslag'], ['#/profil', '👤', 'Profil']];
  if (canRun() || isTreasurer() || pend) items.push(['#/admin', '⚙️', 'Admin']);
  const page = cur.split('/')[1] || '';
  const active = (h) => cur.startsWith(h) || (h === '#/traening' && (!page || NOT_IN_CLUB.includes(page))) ||
    (h === '#/profil' && /^#\/(faq|forslag|beskeder|udseende|nyt|klub-ind|privatliv)/.test(cur));
  navEl.innerHTML = items.map(([h, i, t]) => `<a href="${h}" class="${active(h) ? 'on' : ''}"><span>${i}</span>${h === '#/admin' && pend ? `<b class="navbadge" aria-label="${pend} venter">${pend}</b>` : ''}${h === '#/profil' && S.unread && !S.viewAs ? `<b class="navbadge" aria-label="${S.unread} nye beskeder">${S.unread}</b>` : ''}${t}</a>`).join('');
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

// Ikke med i nogen gruppe endnu: vis status på anmodninger (og indmeldte børn i en klub)
async function viewNoGroup() {
  const mine = S.members.filter((m) => m.player_id === S.me.id);
  const nameOfGroup = (id) => S.groups.find((g) => g.id === id)?.name || 'en gruppe';
  let kids = [];
  try { kids = await q(sb.from('padel_club_kids').select('*').in('status', ['ansoegt', 'aktiv'])); } catch {}
  app.innerHTML = `
  <div class="auth">
    <div class="logo">🎾</div>
    <h1>Hej ${esc(S.me.name.split(' ')[0])}</h1>
    ${kids.length ? `<p>${kids.map((k) => `<b>${esc(k.name)}</b>`).join(' og ')} er meldt ind i <b>${esc([...new Set(kids.map((k) => nameOfGroup(k.group_id)))].join(', '))}</b>.</p>
         <p class="muted">Når en træner har godkendt indmeldelsen, kan du se træningerne og give afbud. Du får besked her i appen.</p>`
    : mine.some((m) => m.status === 'afventer')
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
  beskeder: () => viewNotices(),
  udseende: () => viewTheme(),
  nyt: () => viewNews(app),
  admin: () => (isAdmin() || isSuper() || (isClub() && (canRun() || isTreasurer())) ? viewAdmin() : ROUTES.fredage()),
  privatliv: () => viewPrivacy(),
  traening: () => (isClub() ? viewTraining() : viewEvents()),
  opslag: () => (isClub() ? viewPosts() : viewEvents()),
  'klub-ind': (g) => viewClubJoin(g),
};
// Sider der ikke findes i en klub (spilledage, rangliste, bøder) viser Træning
const NOT_IN_CLUB = ['fredage', 'fredag', 'ny-fredag', 'ret-fredag', 'rangliste', 'spiller', 'boeder'];

async function route() {
  leavePage();
  window.scrollTo(0, 0);
  let [, page, id] = (location.hash || '#/fredage').split('/');
  renderNav();
  if (!S.groupId && !['profil', 'faq', 'admin', 'klub-ind', 'beskeder', 'nyt', 'udseende', 'privatliv'].includes(page)) return viewNoGroup();
  if (isClub() && (!page || NOT_IN_CLUB.includes(page))) page = 'traening';
  try { await (ROUTES[page] || ROUTES.fredage)(id); } catch (e) { console.error(e); }
  renderNav();
}

sb.auth.onAuthStateChange((ev, session) => {
  S.session = session;
  if (ev === 'PASSWORD_RECOVERY') S.recovery = true;
  if (['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT', 'PASSWORD_RECOVERY'].includes(ev)) setTimeout(boot, 0);
});
window.addEventListener('hashchange', () => {
  if (/^#\/(velkommen|barn)\//.test(location.hash)) return boot();
  if (S.me) route();
});
