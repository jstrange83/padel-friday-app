import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { generateRound } from './pairing.js';
import { FAQ } from './faq.js';

const sb = createClient('https://mxdgspfhakomblprhvto.supabase.co', 'sb_publishable_0ZKQoqCX5a6okJl_Lh0Leg_URrexVdI', {
  auth: { persistSession: true, storageKey: 'fredagspadel-auth' },
});

const S = { session: null, me: null, profiles: {}, centers: [], courts: [], filter: 'alle', recovery: false };
let pollTimer = null, tickTimer = null;

const app = document.getElementById('app');
const navEl = document.getElementById('nav');
const SIDE = { venstre: 'Venstre', hojre: 'Højre', begge: 'Begge sider' };
const SIDE_SHORT = { venstre: 'V', hojre: 'H', begge: 'V/H' };
const GENDER = { mand: 'Mand', kvinde: 'Kvinde' };
const FORMAT = { rotation: 'Rotation på tid', saet: 'Ét sæt pr. runde', americano: 'Americano', klassisk: 'Klassisk' };
const ROLE = { bruger: 'Bruger', superbruger: 'Superbruger', admin: 'Admin' };
const roleOf = (p) => p?.role || (p?.is_admin ? 'admin' : 'bruger');
const MODE = { aaben: 'Åben', mix: 'Mix', herre: 'Herre', dame: 'Dame' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nameOf = (id) => S.profiles[id]?.name || 'Ukendt';
const first = (id) => nameOf(id).split(' ')[0];
const fmtDate = (d, opts = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) =>
  new Intl.DateTimeFormat('da-DK', { ...opts, timeZone: 'Europe/Copenhagen' }).format(new Date(d));
const courtById = (id) => S.courts.find((c) => c.id === id);
const centerById = (id) => S.centers.find((c) => c.id === id);

function toast(msg, bad = false) {
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
async function q(p) {
  const { data, error } = await p;
  if (error) { toast(niceError(error), true); throw error; }
  return data;
}
function busy(btn, on) {
  if (!btn) return;
  btn.disabled = on;
  if (on) { btn._t = btn.textContent; btn.textContent = '…'; } else if (btn._t) btn.textContent = btn._t;
}

// ---------- Opstart og navigation ----------
sb.auth.onAuthStateChange((ev, session) => {
  S.session = session;
  if (ev === 'PASSWORD_RECOVERY') S.recovery = true;
  if (['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT', 'PASSWORD_RECOVERY'].includes(ev)) setTimeout(boot, 0);
});
window.addEventListener('hashchange', () => { if (S.me) route(); });

let booting = false;
async function boot() {
  if (booting) return;
  booting = true;
  try {
    stopTimers();
    if (S.recovery && S.session) return renderNewPassword();
    // Husk et delt fredagslink, så man lander der efter login/oprettelse
    if (location.hash.startsWith('#/fredag/')) { try { localStorage.setItem('fp-next', location.hash); } catch {} }
    if (!S.session) { navEl.innerHTML = ''; return renderAuth(location.hash === '#/velkommen' ? 'signup' : 'login'); }
    await loadBase();
    if (!S.me) { navEl.innerHTML = ''; return renderProfileForm(true); }
    let next = null;
    try { next = localStorage.getItem('fp-next'); localStorage.removeItem('fp-next'); } catch {}
    if (next && next !== location.hash) { location.hash = next; }
    else if (location.hash === '#/velkommen') { location.hash = '#/fredage'; }
    renderNav();
    await route();
  } finally { booting = false; }
}

async function loadBase() {
  const [profiles, centers, courts] = await Promise.all([
    q(sb.from('padel_profiles').select('*')),
    q(sb.from('padel_centers').select('*').order('name')),
    q(sb.from('padel_courts').select('*').order('sort')),
  ]);
  S.profiles = Object.fromEntries(profiles.map((p) => [p.id, p]));
  S.centers = centers;
  S.courts = courts;
  S.me = S.profiles[S.session.user.id] || null;
}

function renderNav() {
  const items = [['#/rangliste', '🏆', 'Rangliste'], ['#/fredage', '🎾', 'Fredage'], ['#/profil', '👤', 'Profil']];
  if (S.me.is_admin) items.push(['#/admin', '⚙️', 'Admin']);
  const cur = location.hash || '#/fredage';
  navEl.innerHTML = items.map(([h, i, t]) => `<a href="${h}" class="${cur.startsWith(h) || (h === '#/fredage' && cur.startsWith('#/fredag')) ? 'on' : ''}"><span>${i}</span>${t}</a>`).join('');
}

let channel = null;
function stopTimers() {
  clearInterval(pollTimer); clearInterval(tickTimer);
  pollTimer = tickTimer = null;
  if (channel) { sb.removeChannel(channel); channel = null; }
}

async function share(url, text) {
  if (navigator.share) { try { await navigator.share({ title: 'Fredagspadel', text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); toast('Linket er kopieret'); }
  catch { prompt('Kopiér linket', url); }
}

async function route() {
  stopTimers();
  const h = location.hash || '#/fredage';
  renderNav();
  window.scrollTo(0, 0);
  const [, page, id] = h.split('/');
  try {
    if (page === 'rangliste') return await viewRanking();
    if (page === 'fredag' && id) return await viewEvent(id);
    if (page === 'ny-fredag') return viewNewEvent();
    if (page === 'profil') return renderProfileForm(false);
    if (page === 'faq') return viewFaq();
    if (page === 'spiller' && id) return await viewPlayer(id);
    if (page === 'admin' && S.me.is_admin) return await viewAdmin();
    return await viewEvents();
  } catch (e) { console.error(e); }
}

// ---------- Login ----------
function renderAuth(mode = 'login') {
  const signup = mode === 'signup';
  app.innerHTML = `
  <div class="auth">
    <div class="logo">🎾</div>
    <h1>Fredagspadel</h1>
    <p class="muted">${signup && location.hash === '#/velkommen'
      ? 'Du er inviteret med til fredagspadel! Opret en konto, så kan du tilmelde dig og komme på ranglisten.'
      : 'Rangliste, hold og resultater til fredagspadel.'}</p>
    <form class="card" id="authForm">
      <label>E-mail<input type="email" name="email" required autocomplete="email"></label>
      <label>Adgangskode<input type="password" name="password" required minlength="6" autocomplete="${signup ? 'new-password' : 'current-password'}"></label>
      <button class="btn primary" type="submit">${signup ? 'Opret konto' : 'Log ind'}</button>
      ${signup ? '' : '<button class="link" type="button" id="forgot">Glemt adgangskode?</button>'}
    </form>
    <p class="center">${signup ? 'Har du allerede en konto?' : 'Ny spiller?'}
      <button class="link" id="switch">${signup ? 'Log ind' : 'Opret konto'}</button></p>
  </div>`;
  document.getElementById('switch').onclick = () => renderAuth(signup ? 'login' : 'signup');
  const f = document.getElementById('authForm');
  document.getElementById('forgot')?.addEventListener('click', async () => {
    const email = f.email.value.trim();
    if (!email) return toast('Skriv din e-mail først', true);
    await q(sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin }));
    toast('Vi har sendt en mail med et link til ny adgangskode');
  });
  f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button[type=submit]');
    busy(btn, true);
    try {
      const creds = { email: f.email.value.trim(), password: f.password.value };
      if (signup) {
        const data = await q(sb.auth.signUp({ ...creds, options: { emailRedirectTo: location.origin } }));
        if (!data.session) {
          app.innerHTML = `<div class="auth"><div class="logo">📬</div><h1>Tjek din mail</h1>
          <p class="muted">Vi har sendt et link til ${esc(creds.email)}. Klik på det for at bekræfte din konto, og log så ind her.</p>
          <button class="btn" onclick="location.reload()">Til login</button></div>`;
        }
      } else {
        await q(sb.auth.signInWithPassword(creds));
      }
    } catch {} finally { busy(btn, false); }
  };
}

function renderNewPassword() {
  app.innerHTML = `<div class="auth"><h1>Ny adgangskode</h1>
    <form class="card" id="pw"><label>Ny adgangskode<input type="password" name="pw" minlength="6" required autocomplete="new-password"></label>
    <button class="btn primary">Gem</button></form></div>`;
  document.getElementById('pw').onsubmit = async (e) => {
    e.preventDefault();
    await q(sb.auth.updateUser({ password: e.target.pw.value }));
    S.recovery = false;
    toast('Adgangskoden er ændret');
    boot();
  };
}

// ---------- Profil ----------
function radios(name, opts, val) {
  return `<div class="seg">${Object.entries(opts).map(([k, v]) =>
    `<label><input type="radio" name="${name}" value="${k}" ${k === val ? 'checked' : ''} required><span>${v}</span></label>`).join('')}</div>`;
}

function renderProfileForm(isNew) {
  const p = S.me || { name: '', gender: '', side: 'begge' };
  app.innerHTML = `
  <div class="page">
    <h1>${isNew ? 'Velkommen 👋' : 'Din profil'}</h1>
    ${isNew ? '<p class="muted">Fortæl lidt om dig selv, så appen kan sætte gode hold.</p>' : ''}
    <form class="card" id="pf">
      <label>Navn<input name="name" value="${esc(p.name)}" required maxlength="60" autocomplete="name"></label>
      <div class="lbl">Køn</div>${radios('gender', GENDER, p.gender)}
      <div class="lbl">Foretrukken side</div>${radios('side', SIDE, p.side)}
      <button class="btn primary">${isNew ? 'Kom i gang' : 'Gem'}</button>
    </form>
    ${isNew ? '' : `
      <a class="btn" href="#/spiller/${S.me.id}">Se min statistik</a>
      <a class="btn" href="#/faq">❓ Spørgsmål og svar</a>
      <div class="card tip"><b>Tip:</b> Åbn appen i Safari eller Chrome og vælg "Føj til hjemmeskærm", så ligger den som en app på telefonen.</div>
      <button class="btn ghost" id="logout">Log ud</button>`}
  </div>`;
  document.getElementById('pf').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('button');
    busy(btn, true);
    try {
      await q(sb.rpc('padel_save_profile', { p_name: f.name.value, p_gender: f.gender.value, p_side: f.side.value }));
      toast('Profilen er gemt');
      if (isNew) { if (!location.hash.startsWith('#/fredag/')) location.hash = '#/fredage'; return boot(); }
      await loadBase();
    } catch {} finally { busy(btn, false); }
  };
  document.getElementById('logout')?.addEventListener('click', () => sb.auth.signOut());
}

// ---------- Rangliste ----------
async function viewRanking() {
  const changes = await q(sb.from('padel_elo_changes').select('player_id,delta,created_at').eq('active', true).order('created_at', { ascending: false }));
  const stats = {};
  for (const c of changes) {
    const s = (stats[c.player_id] ||= { n: 0, form: [] });
    s.n++;
    if (s.form.length < 5) s.form.push(c.delta);
  }
  let list = Object.values(S.profiles);
  if (S.filter === 'mand') list = list.filter((p) => p.gender === 'mand');
  if (S.filter === 'kvinde') list = list.filter((p) => p.gender === 'kvinde');
  list.sort((a, b) => b.elo - a.elo || a.name.localeCompare(b.name));
  const active = list.filter((p) => stats[p.id]?.n);
  const fresh = list.filter((p) => !stats[p.id]?.n);
  const row = (p, i) => {
    const s = stats[p.id] || { n: 0, form: [] };
    const medal = ['🥇', '🥈', '🥉'][i] || `<span class="rk">${i + 1}</span>`;
    const form = s.form.map((d) => `<i class="${d > 0 ? 'up' : d < 0 ? 'dn' : 'eq'}"></i>`).join('');
    return `<a class="row ${p.id === S.me.id ? 'me' : ''}" href="#/spiller/${p.id}">
      <div class="pos">${medal}</div>
      <div class="grow"><b>${esc(p.name)}</b><small>${s.n} kampe ${form ? `<span class="form">${form}</span>` : ''}</small></div>
      <div class="elo">${p.elo}</div></a>`;
  };
  app.innerHTML = `
  <div class="page">
    <h1>Rangliste</h1>
    <div class="chips">${[['alle', 'Alle'], ['mand', 'Mænd'], ['kvinde', 'Kvinder']].map(([k, v]) =>
      `<button class="chip ${S.filter === k ? 'on' : ''}" data-f="${k}">${v}</button>`).join('')}</div>
    <div class="list">${active.map(row).join('') || '<p class="muted pad">Ingen kampe spillet endnu.</p>'}</div>
    ${fresh.length ? `<h3>Ikke spillet endnu</h3><div class="list">${fresh.map((p) =>
      `<a class="row" href="#/spiller/${p.id}"><div class="grow"><b>${esc(p.name)}</b></div><div class="elo muted">${p.elo}</div></a>`).join('')}</div>` : ''}
    <p class="muted small">Alle starter på 1000 point. Slår man et stærkere hold, giver det flere point. <a class="link" href="#/faq">Læs hvordan point fungerer</a></p>
  </div>`;
  app.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { S.filter = b.dataset.f; viewRanking(); }));
}

// ---------- Spillerstatistik ----------
async function viewPlayer(id) {
  const p = S.profiles[id];
  if (!p) { app.innerHTML = '<div class="page"><p>Spilleren findes ikke.</p></div>'; return; }
  const ms = await q(sb.from('padel_matches').select('*, padel_events(starts_at,format)')
    .or(`a_left.eq.${id},a_right.eq.${id},b_left.eq.${id},b_right.eq.${id}`).eq('status', 'bekraeftet').order('created_at', { ascending: false }));
  const ch = await q(sb.from('padel_elo_changes').select('match_id,delta').eq('player_id', id).eq('active', true));
  const delta = Object.fromEntries(ch.map((c) => [c.match_id, c.delta]));
  let w = 0, d = 0, l = 0, gf = 0, ga = 0;
  const partners = {};
  const rows = ms.map((m) => {
    const onA = [m.a_left, m.a_right].includes(id);
    const mine = onA ? m.score_a : m.score_b, theirs = onA ? m.score_b : m.score_a;
    const mate = onA ? (m.a_left === id ? m.a_right : m.a_left) : (m.b_left === id ? m.b_right : m.b_left);
    const opps = onA ? [m.b_left, m.b_right] : [m.a_left, m.a_right];
    partners[mate] = (partners[mate] || 0) + 1;
    if (mine > theirs) w++; else if (mine < theirs) l++; else d++;
    gf += mine; ga += theirs;
    const dl = delta[m.id] ?? 0;
    return `<div class="row"><div class="grow"><b>${mine}–${theirs}</b> med ${esc(first(mate))} mod ${esc(first(opps[0]))} & ${esc(first(opps[1]))}
      <small>${m.padel_events ? fmtDate(m.padel_events.starts_at, { day: 'numeric', month: 'short' }) : ''}</small></div>
      <div class="delta ${dl > 0 ? 'up' : dl < 0 ? 'dn' : ''}">${dl > 0 ? '+' : ''}${dl}</div></div>`;
  });
  const topMate = Object.entries(partners).sort((a, b) => b[1] - a[1])[0];
  app.innerHTML = `
  <div class="page">
    <button class="back" onclick="history.back()">‹ Tilbage</button>
    <h1>${esc(p.name)}</h1>
    <p class="muted">${GENDER[p.gender]} · ${SIDE[p.side]}${roleOf(p) !== 'bruger' ? ` · ${ROLE[roleOf(p)]}` : ''}</p>
    <div class="stats">
      <div><b>${p.elo}</b><span>Point</span></div>
      <div><b>${ms.length}</b><span>Kampe</span></div>
      <div><b>${w}/${d}/${l}</b><span>V/U/T</span></div>
      <div><b>${gf - ga > 0 ? '+' : ''}${gf - ga}</b><span>Score</span></div>
    </div>
    ${topMate ? `<div class="card">🤝 Oftest makker: <b>${esc(nameOf(topMate[0]))}</b> (${topMate[1]} kampe)</div>` : ''}
    <h3>Seneste kampe</h3>
    <div class="list">${rows.slice(0, 15).join('') || '<p class="muted pad">Ingen kampe endnu.</p>'}</div>
  </div>`;
}

// ---------- Fredage ----------
async function viewEvents() {
  const evs = await q(sb.from('padel_events').select('*, padel_signups(player_id)').order('starts_at', { ascending: false }).limit(60));
  const now = Date.now() - 6 * 3600e3;
  const upcoming = evs.filter((e) => e.status !== 'afsluttet' && new Date(e.starts_at).getTime() >= now).reverse();
  const running = evs.filter((e) => e.status === 'igang' && !upcoming.includes(e));
  const past = evs.filter((e) => !upcoming.includes(e) && !running.includes(e));
  const card = (e) => {
    const n = e.padel_signups.length;
    const mine = e.padel_signups.some((s) => s.player_id === S.me.id);
    return `<a class="ev" href="#/fredag/${e.id}">
      <div class="when">${fmtDate(e.starts_at, { weekday: 'short', day: 'numeric', month: 'short' })}<b>${fmtDate(e.starts_at, { hour: '2-digit', minute: '2-digit' })}</b></div>
      <div class="grow"><b>${esc(e.title || 'Fredagspadel')}</b>
        <small>${esc(centerById(e.center_id)?.name || '')} · ${FORMAT[e.format]} · ${MODE[e.team_mode]}</small>
        <small>${n} tilmeldt${mine ? ' · <span class="ok">Du er med</span>' : ''}</small></div>
      ${e.status === 'igang' ? '<span class="badge live">I gang</span>' : ''}</a>`;
  };
  app.innerHTML = `
  <div class="page">
    <div class="head"><h1>Fredage</h1>${S.me.is_admin ? '<a class="btn primary sm" href="#/ny-fredag">+ Ny</a>' : ''}</div>
    ${[...running, ...upcoming].map(card).join('') || '<p class="muted pad">Ingen kommende fredage endnu.</p>'}
    ${past.length ? `<h3>Tidligere</h3>${past.map(card).join('')}` : ''}
  </div>`;
}

function nextFriday() {
  const d = new Date();
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
  d.setHours(19, 0, 0, 0);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T19:00`;
}

function viewNewEvent() {
  if (!S.me.is_admin) return (location.hash = '#/fredage');
  const c0 = S.centers[0]?.id;
  app.innerHTML = `
  <div class="page">
    <button class="back" onclick="history.back()">‹ Tilbage</button>
    <h1>Ny fredag</h1>
    <form class="card" id="nf">
      <label>Center<select name="center">${S.centers.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
      <div class="lbl">Baner</div><div id="courts" class="checks"></div>
      <label>Dato og tid<input type="datetime-local" name="when" value="${nextFriday()}" required></label>
      <label>Titel (valgfri)<input name="title" placeholder="Fredagspadel" maxlength="60"></label>
      <div class="lbl">Format</div>${radios('format', FORMAT, 'rotation')}
      <label>Varighed<select name="duration">${[60, 90, 120, 150, 180].map((v) =>
        `<option value="${v}" ${v === 120 ? 'selected' : ''}>${v % 60 ? `${Math.floor(v / 60)}½ time` : `${v / 60} ${v === 60 ? 'time' : 'timer'}`}</option>`).join('')}</select></label>
      <label id="ptsWrap" style="display:none">Point pr. kamp<select name="points">${[16, 21, 24, 32].map((v) => `<option value="${v}" ${v === 24 ? 'selected' : ''}>${v} point</option>`).join('')}</select>
        <small class="muted">Americano tæller ikke på ranglisten, før en admin tilføjer dagen bagefter.</small></label>
      <label id="minWrap">Minutter pr. runde<input type="number" name="minutes" value="30" min="5" max="180" inputmode="numeric"><small id="roundsHint" class="muted"></small></label>
      <div class="lbl">Hold</div>${radios('mode', MODE, 'aaben')}
      <button class="btn primary">Opret fredag</button>
    </form>
  </div>`;
  const f = document.getElementById('nf');
  const drawCourts = () => {
    document.getElementById('courts').innerHTML = S.courts.filter((c) => c.center_id === f.center.value)
      .map((c) => `<label><input type="checkbox" name="court" value="${c.id}" checked><span>${esc(c.name)}</span></label>`).join('');
  };
  f.center.value = c0; drawCourts();
  f.center.onchange = drawCourts;
  const hint = () => {
    const n = Math.floor(+f.duration.value / (+f.minutes.value || 30));
    document.getElementById('roundsHint').textContent = n ? `Giver ${n} runder` : '';
  };
  f.duration.onchange = hint; f.minutes.oninput = hint; hint();
  const fmt = () => {
    document.getElementById('minWrap').style.display = f.format.value === 'rotation' ? '' : 'none';
    document.getElementById('ptsWrap').style.display = f.format.value === 'americano' ? '' : 'none';
  };
  f.querySelectorAll('[name=format]').forEach((r) => (r.onchange = fmt));
  f.onsubmit = async (e) => {
    e.preventDefault();
    const courts = [...f.querySelectorAll('[name=court]:checked')].map((x) => x.value);
    if (!courts.length) return toast('Vælg mindst én bane', true);
    const btn = f.querySelector('button.primary');
    busy(btn, true);
    try {
      const ev = await q(sb.from('padel_events').insert({
        center_id: f.center.value, starts_at: new Date(f.when.value).toISOString(), title: f.title.value.trim() || null,
        format: f.format.value, team_mode: f.mode.value, round_minutes: +f.minutes.value || 30, points_per_match: f.format.value === 'americano' ? +f.points.value : null,
        ranked: f.format.value !== 'americano', duration_minutes: +f.duration.value || 120, court_ids: courts, created_by: S.me.id,
      }).select().single());
      location.hash = '#/fredag/' + ev.id;
    } catch {} finally { busy(btn, false); }
  };
}

// ---------- En fredag ----------
async function loadEvent(id) {
  const [ev, signups, matches] = await Promise.all([
    q(sb.from('padel_events').select('*').eq('id', id).single()),
    q(sb.from('padel_signups').select('*').eq('event_id', id).order('created_at')),
    q(sb.from('padel_matches').select('*').eq('event_id', id).order('round_no', { ascending: false }).order('created_at')),
  ]);
  const ids = matches.map((m) => m.id);
  const changes = ids.length ? await q(sb.from('padel_elo_changes').select('*').in('match_id', ids).eq('active', true)) : [];
  return { ev, signups, matches, changes };
}

async function viewEvent(id) {
  const data = await loadEvent(id);
  renderEvent(data);

  // Live opdatering: genindlæs når kampe, tilmeldinger eller dagen ændres.
  // Er man i gang med at skrive et resultat eller rette hold, venter vi til man er færdig.
  let timer = null, pending = false;
  const busyTyping = () => {
    const a = document.activeElement;
    return (a && app.contains(a) && ['INPUT', 'SELECT'].includes(a.tagName)) || !!app.querySelector('form.enter:not([hidden]), form.editteams:not([hidden])');
  };
  const refresh = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!location.hash.startsWith('#/fredag/' + id)) return;
      if (busyTyping()) { pending = true; return; }
      pending = false;
      try { await loadBase(); renderEvent(await loadEvent(id)); } catch {}
    }, 400);
  };
  app.onfocusout = () => { if (pending) setTimeout(refresh, 300); };
  channel = sb.channel('fredag-' + id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'padel_matches', filter: `event_id=eq.${id}` }, refresh)
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'padel_matches' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'padel_signups', filter: `event_id=eq.${id}` }, refresh)
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'padel_signups' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'padel_events', filter: `id=eq.${id}` }, refresh)
    .subscribe();
  // Sikkerhedsnet hvis live-forbindelsen falder ud (fx når telefonen har været låst)
  pollTimer = setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  document.onvisibilitychange = () => { if (!document.hidden && location.hash.startsWith('#/fredag/' + id)) refresh(); };
}

function teamHtml(l, r, me) {
  const n = (pid, s) => `<span class="${pid === me ? 'meName' : ''}">${esc(nameOf(pid))}<em>${s}</em></span>`;
  return `<div class="team">${n(l, 'V')}${n(r, 'H')}</div>`;
}

function renderEvent({ ev, signups, matches, changes }) {
  // admin = må køre dagen (superbruger eller admin). isAdmin = kun admin (slette dagen, rangliste for Americano)
  const me = S.me.id, isAdmin = S.me.is_admin, admin = isAdmin || roleOf(S.me) === 'superbruger';
  const signed = signups.map((s) => s.player_id);
  const iAmIn = signed.includes(me);
  const rounds = {};
  for (const m of matches) (rounds[m.round_no] ||= []).push(m);
  const cur = rounds[ev.current_round] || [];
  const curAllPlanned = cur.length && cur.every((m) => m.status === 'planlagt');
  const delta = {};
  for (const c of changes) delta[c.match_id + c.player_id] = c.delta;
  const center = centerById(ev.center_id);
  const courts = ev.court_ids.map(courtById).filter(Boolean).sort((a, b) => a.sort - b.sort);
  const isRot = ev.format === 'rotation';
  const totalRounds = isRot ? Math.max(1, Math.floor(ev.duration_minutes / ev.round_minutes)) : null;
  const lastDone = isRot && ev.current_round >= totalRounds;
  const endsAt = new Date(new Date(ev.starts_at).getTime() + ev.duration_minutes * 60e3);
  const hm = (d) => fmtDate(d, { hour: '2-digit', minute: '2-digit' });
  const isAm = ev.format === 'americano';
  const isSet = ev.format === 'saet';
  const isShare = isRot || isAm || isSet;
  const unit = isRot || isSet ? 'partier' : isAm ? 'point' : 'sæt';

  const canGender = ev.team_mode === 'aaben' || ev.team_mode === 'mix' || (ev.team_mode === 'herre' ? S.me.gender === 'mand' : S.me.gender === 'kvinde');

  const matchCard = (m) => {
    const onA = [m.a_left, m.a_right].includes(me), onB = [m.b_left, m.b_right].includes(me);
    const mine = onA || onB;
    const myTeam = onA ? 'a' : onB ? 'b' : null;
    const court = courtById(m.court_id)?.name || '';
    let status = '', actions = '';
    if (m.status === 'planlagt') {
      if (mine || admin) actions = `<button class="btn sm primary" data-act="enter" data-id="${m.id}">Indtast resultat</button>${SR ? `<button class="btn sm" data-act="voice" data-id="${m.id}">🎤 Sig resultat</button>` : ''}`;
      if (admin) actions += `<button class="btn sm" data-act="teams" data-id="${m.id}">Ret hold</button>`;
    } else if (m.status === 'indtastet') {
      status = `<span class="badge wait">Afventer godkendelse</span>`;
      const opponent = myTeam && myTeam !== m.reported_team;
      if (opponent || admin) actions = `<button class="btn sm primary" data-act="confirm" data-id="${m.id}">Godkend</button><button class="btn sm" data-act="reject" data-id="${m.id}">Afvis</button>`;
      if (myTeam === m.reported_team) actions += `<button class="btn sm" data-act="enter" data-id="${m.id}">Ret</button>${SR ? `<button class="btn sm" data-act="voice" data-id="${m.id}">🎤</button>` : ''}`;
    } else {
      const d = delta[m.id + m.a_left];
      if (d !== undefined) status = `<span class="badge">Point ${d > 0 ? '+' : ''}${d} / ${-d > 0 ? '+' : ''}${-d}</span>`;
      if (admin) actions = `<button class="btn sm" data-act="enter" data-id="${m.id}">Ret</button><button class="btn sm" data-act="reset" data-id="${m.id}">Nulstil</button>`;
    }
    const score = m.score_a != null ? `<div class="score">${m.score_a}<span>–</span>${m.score_b}</div>` : '<div class="score muted">vs</div>';
    return `<div class="match ${mine ? 'mine' : ''}" id="m-${m.id}">
      <div class="mhead"><b>${esc(court)}</b>${status}</div>
      <div class="mbody">${teamHtml(m.a_left, m.a_right, me)}${score}${teamHtml(m.b_left, m.b_right, me)}</div>
      ${actions ? `<div class="mact">${actions}</div>` : ''}
      <form class="enter" hidden data-id="${m.id}">
        <input type="number" name="a" min="0" max="99" inputmode="numeric" value="${m.score_a ?? ''}" required aria-label="Score hold 1">
        <span>–</span>
        <input type="number" name="b" min="0" max="99" inputmode="numeric" value="${m.score_b ?? ''}" required aria-label="Score hold 2">
        <button class="btn sm primary">Gem</button>
        <small class="muted">${isAm ? `Point til hvert hold (spil til ${ev.points_per_match} i alt)` : isSet ? 'Antal partier i sættet, fx 6‑4 eller 7‑6' : `Antal ${unit}`}</small>
      </form>
      ${admin && m.status === 'planlagt' ? teamForm(m) : ''}
    </div>`;
  };

  // Admin: ret hold. Spillere der vælges fra en anden kamp i runden bytter automatisk plads.
  const inRound = (r) => new Set((rounds[r] || []).flatMap((x) => [x.a_left, x.a_right, x.b_left, x.b_right]));
  const teamForm = (m) => {
    const used = inRound(m.round_no);
    const pool = [...new Set([...signed, m.a_left, m.a_right, m.b_left, m.b_right])]
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
    const sel = (name, label, val) => `<label>${label}<select name="${name}">${pool.map((p) =>
      `<option value="${p}" ${p === val ? 'selected' : ''}>${esc(nameOf(p))}${used.has(p) ? '' : ' (pause)'}</option>`).join('')}</select></label>`;
    return `<form class="editteams" hidden data-id="${m.id}">
      <div class="tgrid">
        ${sel('al', 'Hold 1 venstre', m.a_left)}${sel('ar', 'Hold 1 højre', m.a_right)}
        ${sel('bl', 'Hold 2 venstre', m.b_left)}${sel('br', 'Hold 2 højre', m.b_right)}
      </div>
      <label>Bane<select name="court">${courts.map((c) => `<option value="${c.id}" ${c.id === m.court_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <div class="mact"><button class="btn sm primary">Gem hold</button><button type="button" class="btn sm" data-cancel>Annuller</button></div>
      <small class="muted">Vælger du en spiller fra en anden kamp, bytter de plads. Vælger du en bane der er i brug, bytter kampene bane.</small>
    </form>`;
  };

  // Hvem sidder over i den aktuelle runde
  const playingNow = new Set(cur.flatMap((m) => [m.a_left, m.a_right, m.b_left, m.b_right]));
  const sittingNow = cur.length ? signed.filter((p) => !playingNow.has(p)) : [];

  // Dagens stilling
  const table = {};
  for (const m of matches.filter((x) => x.status === 'bekraeftet')) {
    for (const [pl, f, a] of [[m.a_left, m.score_a, m.score_b], [m.a_right, m.score_a, m.score_b], [m.b_left, m.score_b, m.score_a], [m.b_right, m.score_b, m.score_a]]) {
      const t = (table[pl] ||= { n: 0, w: 0, f: 0, a: 0, elo: 0 });
      t.n++; t.f += f; t.a += a; if (f > a) t.w++;
      t.elo += delta[m.id + pl] || 0;
    }
  }
  // Americano der ikke er på ranglisten endnu: beregn cirka hvad pointene ville blive
  const preview = {};
  const unranked = isAm && !ev.ranked;
  const confirmedCount = matches.filter((m) => m.status === 'bekraeftet').length;
  if (unranked) {
    const elo = Object.fromEntries(Object.values(S.profiles).map((p) => [p.id, p.elo]));
    const done = matches.filter((m) => m.status === 'bekraeftet').sort((x, y) => x.round_no - y.round_no || x.created_at.localeCompare(y.created_at));
    for (const m of done) {
      if (m.score_a + m.score_b === 0) continue;
      const ra = (elo[m.a_left] + elo[m.a_right]) / 2, rb = (elo[m.b_left] + elo[m.b_right]) / 2;
      const d = Math.round(32 * (m.score_a / (m.score_a + m.score_b) - 1 / (1 + 10 ** ((rb - ra) / 400))));
      for (const p of [m.a_left, m.a_right]) { elo[p] += d; preview[p] = (preview[p] || 0) + d; }
      for (const p of [m.b_left, m.b_right]) { elo[p] -= d; preview[p] = (preview[p] || 0) - d; }
    }
    for (const [pid, t] of Object.entries(table)) t.elo = preview[pid] || 0;
  }
  const standings = Object.entries(table).sort((x, y) => (isShare ? y[1].f - x[1].f || (y[1].f - y[1].a) - (x[1].f - x[1].a) : y[1].w - x[1].w || (y[1].f - y[1].a) - (x[1].f - x[1].a)));

  const roundNos = Object.keys(rounds).map(Number).sort((a, b) => b - a);
  const timer = isRot && ev.status === 'igang' && ev.round_started_at
    ? `<div class="timer card"><small>Runde ${ev.current_round} af ${totalRounds}</small><div id="clock">--:--</div><small id="clockSub">tilbage</small></div>` : '';

  app.innerHTML = `
  <div class="page">
    <button class="back" onclick="location.hash='#/fredage'">‹ Fredage</button>
    <h1>${esc(ev.title || 'Fredagspadel')}</h1>
    <p class="muted cap">${fmtDate(ev.starts_at, { weekday: 'long', day: 'numeric', month: 'long' })} · ${hm(ev.starts_at)}–${hm(endsAt)} · ${esc(center?.name || '')}</p>
    <div class="chips static"><span class="chip">${FORMAT[ev.format]}${isRot ? ` · ${ev.round_minutes} min` : isAm ? ` · ${ev.points_per_match} point` : ''}</span><span class="chip">${MODE[ev.team_mode]}</span>
      <span class="chip">${courts.length} baner</span>${ev.status === 'igang' ? '<span class="chip live">I gang</span>' : ev.status === 'afsluttet' ? '<span class="chip">Afsluttet</span>' : ''}</div>
    ${isAdmin && ev.status !== 'afsluttet' ? '<button class="btn sm" id="shareEvent">📤 Del fredagen</button>' : ''}

    ${timer}

    ${admin && ev.status !== 'afsluttet' ? `<div class="card adminbar">
      ${lastDone && ev.status === 'igang' ? '<button class="btn primary" id="finish">Afslut dagen</button>' : ''}
      <button class="btn ${lastDone ? '' : 'primary'}" id="nextRound">${!ev.current_round ? 'Start første runde'
        : lastDone ? 'Spil en ekstra runde' : `Start runde ${ev.current_round + 1}${isRot ? ` af ${totalRounds}` : ''}`}</button>
      ${curAllPlanned ? `<button class="btn" id="redoRound">Lav runde ${ev.current_round} om</button>` : ''}
      ${ev.status === 'igang' && !lastDone ? '<button class="btn ghost" id="finish">Afslut dagen</button>' : ''}
      ${isAdmin && !matches.length ? '<button class="btn ghost danger" id="delEvent">Slet fredag</button>' : ''}
    </div>` : ''}
    ${admin && ev.status === 'afsluttet' ? '<button class="btn ghost" id="reopen">Genåbn dagen</button>' : ''}

    ${sittingNow.length ? `<div class="card sit">☕ Pause i runde ${ev.current_round}: <b>${sittingNow.map((p) => esc(first(p))).join(', ')}</b></div>` : ''}

    ${roundNos.map((r) => `<h3>Runde ${r}</h3>${rounds[r].map(matchCard).join('')}`).join('')}

    ${standings.length ? `<h3>Dagens stilling</h3><div class="list table">
      <div class="row th"><div class="pos">#</div><div class="grow">Spiller</div><div>K</div><div>${isRot || isSet ? 'Partier' : isAm ? 'Score' : 'Sejre'}</div><div>Point</div></div>
      ${standings.map(([pid, t], i) => `<div class="row ${pid === me ? 'me' : ''}"><div class="pos">${i === 0 ? '👑' : i + 1}</div>
        <div class="grow">${esc(nameOf(pid))}</div><div>${t.n}</div><div>${isShare ? `${t.f}–${t.a}` : t.w}</div>
        <div class="delta ${t.elo > 0 ? 'up' : t.elo < 0 ? 'dn' : ''}">${unranked ? '≈' : ''}${t.elo > 0 ? '+' : ''}${t.elo}</div></div>`).join('')}
    </div>` : ''}

    ${isAm ? `<div class="card ranked">${ev.ranked
      ? `✅ Dagen tæller på den officielle rangliste.${isAdmin ? '<button class="btn sm" id="unrank">Fjern fra ranglisten</button>' : ''}`
      : `ℹ️ Americano tæller ikke på ranglisten, før en admin tilføjer dagen. ${confirmedCount ? 'Kolonnen "Point" viser cirka, hvad hver spiller ville få.' : ''}
         ${isAdmin && confirmedCount ? '<button class="btn primary" id="rank">Tilføj til officiel rangliste</button>' : ''}`}</div>` : ''}

    <h3>Tilmeldte (${signed.length})</h3>
    ${ev.status === 'planlagt' ? (iAmIn
      ? '<button class="btn" id="signoff">Afmeld mig</button>'
      : canGender ? '<button class="btn primary" id="signon">Tilmeld mig</button>' : `<p class="muted">Denne dag er kun for ${MODE[ev.team_mode].toLowerCase()}.</p>`) : ''}
    <div class="people">${signed.map((pid) => {
      const p = S.profiles[pid] || {};
      return `<div class="person"><span>${p.gender === 'kvinde' ? '♀' : '♂'}</span>${esc(p.name)}<em>${SIDE_SHORT[p.side] || ''}</em>
      ${admin ? `<button class="x" data-unsign="${pid}" aria-label="Afmeld">×</button>` : ''}</div>`;
    }).join('') || '<p class="muted">Ingen endnu.</p>'}</div>
    ${admin ? `<div class="addp"><select id="addPlayer"><option value="">Tilmeld en spiller…</option>${Object.values(S.profiles)
      .filter((p) => !signed.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>` : ''}
  </div>`;

  const reload = async () => { await loadBase(); renderEvent(await loadEvent(ev.id)); };

  // Timer
  if (timer) {
    const end = new Date(ev.round_started_at).getTime() + ev.round_minutes * 60e3;
    const flag = `beeped-${ev.id}-${ev.current_round}`;
    const tick = () => {
      const left = Math.round((end - Date.now()) / 1000);
      const el = document.getElementById('clock');
      if (!el) return;
      const a = Math.abs(left);
      el.textContent = `${left < 0 ? '+' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
      el.parentElement.classList.toggle('over', left <= 0);
      document.getElementById('clockSub').textContent = left <= 0 ? 'Tiden er gået – skift makker!' : 'tilbage';
      let beeped = false;
      try { beeped = !!sessionStorage.getItem(flag); } catch {}
      if (left <= 0 && left > -60 && !beeped) {
        try { sessionStorage.setItem(flag, '1'); } catch {}
        beep();
      }
    };
    tick();
    clearInterval(tickTimer);
    tickTimer = setInterval(tick, 1000);
  }

  // Tilmelding
  document.getElementById('signon')?.addEventListener('click', async (e) => {
    busy(e.target, true);
    try { await q(sb.from('padel_signups').insert({ event_id: ev.id, player_id: me })); await reload(); } catch { busy(e.target, false); }
  });
  document.getElementById('signoff')?.addEventListener('click', async (e) => {
    busy(e.target, true);
    try { await q(sb.from('padel_signups').delete().eq('event_id', ev.id).eq('player_id', me)); await reload(); } catch { busy(e.target, false); }
  });
  app.querySelectorAll('[data-unsign]').forEach((b) => (b.onclick = async () => {
    if (!confirm(`Afmeld ${nameOf(b.dataset.unsign)}?`)) return;
    await q(sb.from('padel_signups').delete().eq('event_id', ev.id).eq('player_id', b.dataset.unsign));
    await reload();
  }));
  document.getElementById('addPlayer')?.addEventListener('change', async (e) => {
    if (!e.target.value) return;
    await q(sb.from('padel_signups').insert({ event_id: ev.id, player_id: e.target.value }));
    await reload();
  });

  // Runder
  const makeRound = async (roundNo, btn) => {
    busy(btn, true);
    try {
      const players = signed.map((pid) => S.profiles[pid]).filter(Boolean);
      const history = await q(sb.from('padel_matches').select('event_id,round_no,a_left,a_right,b_left,b_right,court_id,created_at')
        .order('created_at', { ascending: false }).limit(800));
      const res = generateRound({ players, courts, history, eventId: ev.id, mode: ev.team_mode, roundNo });
      if (res.error) { toast(res.error, true); return; }
      await q(sb.from('padel_matches').insert(res.matches.map((m) => ({ ...m, event_id: ev.id, round_no: roundNo }))));
      await q(sb.rpc('padel_start_round', { p_event: ev.id, p_round: roundNo }));
      await reload();
    } catch (e) { console.error(e); } finally { busy(btn, false); }
  };
  document.getElementById('nextRound')?.addEventListener('click', async (e) => {
    const open = cur.filter((m) => m.status !== 'bekraeftet').length;
    if (open && !confirm(`${open} kamp(e) i runde ${ev.current_round} mangler godkendt resultat. Start næste runde alligevel?`)) return;
    if (signed.length < 4) return toast('Der skal være mindst 4 tilmeldte', true);
    makeRound(ev.current_round + 1, e.target);
  });
  document.getElementById('redoRound')?.addEventListener('click', async (e) => {
    if (!confirm(`Lav runde ${ev.current_round} om med nye hold?`)) return;
    busy(e.target, true);
    try {
      await q(sb.from('padel_matches').delete().eq('event_id', ev.id).eq('round_no', ev.current_round).eq('status', 'planlagt'));
      await makeRound(ev.current_round, e.target);
    } catch { busy(e.target, false); }
  });
  document.getElementById('finish')?.addEventListener('click', async () => {
    if (!confirm('Afslut dagen? Tilmelding og nye runder lukkes.')) return;
    await q(sb.rpc('padel_set_event_status', { p_event: ev.id, p_status: 'afsluttet' }));
    await reload();
  });
  document.getElementById('reopen')?.addEventListener('click', async () => {
    await q(sb.rpc('padel_set_event_status', { p_event: ev.id, p_status: matches.length ? 'igang' : 'planlagt' }));
    await reload();
  });
  document.getElementById('delEvent')?.addEventListener('click', async () => {
    if (!confirm('Slet denne fredag?')) return;
    await q(sb.from('padel_events').delete().eq('id', ev.id));
    location.hash = '#/fredage';
  });

  // Resultater
  app.querySelectorAll('[data-act]').forEach((b) => (b.onclick = async () => {
    const id = b.dataset.id, act = b.dataset.act;
    if (act === 'voice') {
      const m = matches.find((x) => x.id === id);
      const team = [m.a_left, m.a_right].includes(me) ? 'a' : [m.b_left, m.b_right].includes(me) ? 'b' : null;
      const f = app.querySelector(`form.enter[data-id="${id}"]`);
      f.hidden = false;
      listenScore(b, f, team);
      return;
    }
    if (act === 'teams') {
      const f = app.querySelector(`form.editteams[data-id="${id}"]`);
      f.hidden = !f.hidden;
      return;
    }
    if (act === 'enter') {
      const f = app.querySelector(`form.enter[data-id="${id}"]`);
      f.hidden = !f.hidden;
      if (!f.hidden) f.a.focus();
      return;
    }
    busy(b, true);
    try {
      if (act === 'confirm') await q(sb.rpc('padel_confirm_result', { p_match: id }));
      if (act === 'reject') { if (!confirm('Afvis resultatet? Det skal så indtastes igen.')) return busy(b, false); await q(sb.rpc('padel_reject_result', { p_match: id })); }
      if (act === 'reset') { if (!confirm('Nulstil kampen? Pointene rulles tilbage.')) return busy(b, false); await q(sb.rpc('padel_admin_reset_match', { p_match: id })); }
      await reload();
    } catch { busy(b, false); }
  }));
  app.querySelectorAll('form.editteams').forEach((f) => {
    f.querySelector('[data-cancel]').onclick = () => { f.hidden = true; reload(); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const m = matches.find((x) => x.id === f.dataset.id);
      const nv = [f.al.value, f.ar.value, f.bl.value, f.br.value];
      if (new Set(nv).size < 4) return toast('En spiller kan kun stå ét sted i kampen', true);
      const roundMs = rounds[m.round_no];
      const state = Object.fromEntries(roundMs.map((x) => [x.id, { p: [x.a_left, x.a_right, x.b_left, x.b_right], court: x.court_id, status: x.status }]));
      const old = state[m.id].p.slice();
      const leavers = old.filter((p) => !nv.includes(p));
      const joiners = nv.filter((p) => !old.includes(p));
      state[m.id].p = nv;
      // Spillere hentet fra en anden kamp bytter plads med dem der forlader denne kamp
      for (const j of joiners) {
        for (const [mid, s] of Object.entries(state)) {
          if (mid === m.id) continue;
          const k = s.p.indexOf(j);
          if (k < 0) continue;
          if (s.status !== 'planlagt') return toast(`${nameOf(j)} spiller i en kamp der allerede har resultat`, true);
          s.p[k] = leavers.shift();
        }
      }
      // Bane: er den i brug af en anden kamp i runden, bytter de
      const newCourt = f.court.value;
      if (newCourt !== m.court_id) {
        for (const [mid, s] of Object.entries(state)) {
          if (mid !== m.id && s.court === newCourt) {
            if (s.status !== 'planlagt') return toast('Banen bruges af en kamp der allerede har resultat', true);
            s.court = m.court_id;
          }
        }
        state[m.id].court = newCourt;
      }
      const btn = f.querySelector('button.primary');
      busy(btn, true);
      try {
        for (const x of roundMs) {
          const s = state[x.id];
          const changed = s.court !== x.court_id || s.p.join() !== [x.a_left, x.a_right, x.b_left, x.b_right].join();
          if (changed) await q(sb.rpc('padel_admin_set_teams', { p_match: x.id, p_al: s.p[0], p_ar: s.p[1], p_bl: s.p[2], p_br: s.p[3], p_court: s.court }));
        }
        toast('Holdene er rettet');
        f.hidden = true;
        await reload();
      } catch { busy(btn, false); }
    };
  });

  document.getElementById('shareEvent')?.addEventListener('click', () =>
    share(`${location.origin}/#/fredag/${ev.id}`, `${ev.title || 'Fredagspadel'} ${fmtDate(ev.starts_at)} i ${center?.name || ''}. Tilmeld dig her:`));

  document.getElementById('rank')?.addEventListener('click', async (e) => {
    if (!confirm('Tilføj dagen til den officielle rangliste? Pointene beregnes kamp for kamp.')) return;
    busy(e.target, true);
    try { await q(sb.rpc('padel_admin_set_ranked', { p_event: ev.id, p_ranked: true })); toast('Dagen tæller nu på ranglisten'); await reload(); } catch { busy(e.target, false); }
  });
  document.getElementById('unrank')?.addEventListener('click', async (e) => {
    if (!confirm('Fjern dagen fra ranglisten? Pointene rulles tilbage.')) return;
    busy(e.target, true);
    try { await q(sb.rpc('padel_admin_set_ranked', { p_event: ev.id, p_ranked: false })); await reload(); } catch { busy(e.target, false); }
  });

  app.querySelectorAll('form.enter').forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault();
    if (isAm && ev.points_per_match && +f.a.value + +f.b.value !== ev.points_per_match &&
      !confirm(`Det giver ${+f.a.value + +f.b.value} point i alt, men I spiller til ${ev.points_per_match}. Gem alligevel?`)) return;
    const btn = f.querySelector('button');
    busy(btn, true);
    try {
      await q(sb.rpc('padel_report_result', { p_match: f.dataset.id, p_a: +f.a.value, p_b: +f.b.value }));
      toast(admin ? 'Resultatet er gemt' : 'Gemt. Modstanderne skal godkende');
      await reload();
    } catch { busy(btn, false); }
  }));
}

// ---------- Sig resultatet ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const NUMW = (() => {
  const u = ['nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti', 'elleve', 'tolv', 'tretten', 'fjorten', 'femten', 'seksten', 'sytten', 'atten', 'nitten'];
  const m = {};
  u.forEach((w, i) => (m[w] = i));
  Object.assign(m, { et: 1, 'én': 1, een: 1, nul: 0, tyve: 20, tredive: 30 });
  for (let i = 1; i < 10; i++) { m[u[i] + 'ogtyve'] = 20 + i; m[u[i] + 'ogtredive'] = 30 + i; }
  m.etogtyve = 21; m.etogtredive = 31;
  return m;
})();

// Fortolker fx "seks fire", "6-4", "vi vandt 6 4", "vi tabte 3 til 9", "otte otte", "uafgjort 12"
export function parseScore(text, myTeam) {
  const t = text.toLowerCase();
  const nums = [];
  for (const tok of t.split(/[^a-zæøåé0-9]+/)) {
    if (!tok) continue;
    if (/^\d+$/.test(tok)) nums.push(+tok);
    else if (tok in NUMW) nums.push(NUMW[tok]);
  }
  const draw = /uafgjort|lige/.test(t);
  if (nums.length === 1 && draw) nums.push(nums[0]);
  if (nums.length === 1 && /^\d\d$/.test(String(nums[0]))) { const d = String(nums[0]); nums.splice(0, 1, +d[0], +d[1]); }
  if (nums.length < 2) return null;
  let [x, y] = nums;
  const we = /\b(vi|os)\b/.test(t) && myTeam;
  if (!we) return { a: x, b: y };
  if (/vandt|vinder/.test(t)) [x, y] = [Math.max(x, y), Math.min(x, y)];
  else if (/tabte|taber/.test(t)) [x, y] = [Math.min(x, y), Math.max(x, y)];
  return myTeam === 'a' ? { a: x, b: y } : { a: y, b: x };
}

function listenScore(btn, form, myTeam) {
  if (!SR) return toast('Din browser kan ikke tale-genkendelse. Skriv resultatet i stedet.', true);
  const rec = new SR();
  rec.lang = 'da-DK';
  rec.interimResults = false;
  rec.maxAlternatives = 5;
  const label = btn.textContent;
  btn.textContent = '🎙️ Lytter…';
  btn.classList.add('listening');
  const done = () => { btn.textContent = label; btn.classList.remove('listening'); };
  rec.onresult = (e) => {
    const alts = [...e.results[0]].map((r) => r.transcript);
    const hit = alts.map((a) => ({ a, r: parseScore(a, myTeam) })).find((x) => x.r);
    if (!hit) return toast(`Hørte "${alts[0]}", men fandt ikke et resultat. Prøv fx "seks fire".`, true);
    form.a.value = hit.r.a;
    form.b.value = hit.r.b;
    form.querySelector('button').focus();
    toast(`Hørte "${hit.a}" → ${hit.r.a}–${hit.r.b}. Tjek og tryk Gem.`);
  };
  rec.onerror = (e) => {
    done();
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Giv appen adgang til mikrofonen for at bruge det', true);
    else if (e.error !== 'aborted') toast('Kunne ikke høre dig. Prøv igen, eller skriv resultatet.', true);
  };
  rec.onend = done;
  try { rec.start(); } catch { done(); }
}

function beep() {
  try { navigator.vibrate?.([400, 200, 400, 200, 400]); } catch {}
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.5, 1].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.4, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.4);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.4);
    });
  } catch {}
}

// ---------- Admin ----------
async function viewAdmin() {
  const players = Object.values(S.profiles).sort((a, b) => a.name.localeCompare(b.name));
  app.innerHTML = `
  <div class="page">
    <h1>Admin</h1>
    <div class="card">
      <b>Inviter spillere</b>
      <p class="muted small">Send linket i jeres gruppechat. Det åbner direkte på "Opret konto".</p>
      <div class="invite">${esc(location.origin)}/#/velkommen</div>
      <button class="btn primary" id="invite">📤 Del invitationslink</button>
    </div>
    <h3>Spillere (${players.length})</h3>
    <div class="list">${players.map((p) => `
      <div class="row wrap" id="p-${p.id}">
        <div class="grow"><b>${esc(p.name)}</b>${roleOf(p) !== 'bruger' ? ` <span class="badge role-${roleOf(p)}">${ROLE[roleOf(p)]}</span>` : ''}
          <small>${GENDER[p.gender]} · ${SIDE[p.side]} · ${p.elo} point</small></div>
        <button class="btn sm" data-edit="${p.id}">Ret</button>
        <select class="rolesel" data-role="${p.id}" aria-label="Rolle for ${esc(p.name)}">${Object.entries(ROLE).map(([k, v]) =>
          `<option value="${k}" ${roleOf(p) === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      </div>`).join('')}</div>

    <h3>Centre og baner</h3>
    ${S.centers.map((c) => `<div class="card">
      <div class="head"><b>${esc(c.name)}</b><button class="btn sm" data-rencenter="${c.id}">Omdøb</button></div>
      ${S.courts.filter((x) => x.center_id === c.id).map((x) => `<div class="row">
        <div class="grow">${esc(x.name)}</div>
        <button class="btn sm" data-rencourt="${x.id}">Omdøb</button>
        <button class="btn sm ghost" data-delcourt="${x.id}">Slet</button></div>`).join('')}
      <button class="btn sm" data-addcourt="${c.id}">+ Tilføj bane</button>
    </div>`).join('')}
    <button class="btn" id="addCenter">+ Nyt center</button>
  </div>`;

  const refresh = async () => { await loadBase(); viewAdmin(); };
  document.getElementById('invite').onclick = () =>
    share(`${location.origin}/#/velkommen`, 'Kom med til fredagspadel! Opret en profil her, så kan du tilmelde dig og komme på ranglisten:');
  app.querySelectorAll('[data-role]').forEach((sel) => (sel.onchange = async () => {
    const uid = sel.dataset.role, role = sel.value, prev = roleOf(S.profiles[uid]);
    const self = uid === S.me.id;
    if (!confirm(`${self ? 'Gør dig selv' : `Gør ${nameOf(uid)}`} til ${ROLE[role].toLowerCase()}?${self && role !== 'admin' ? ' Du mister selv adgangen til Admin.' : ''}`)) { sel.value = prev; return; }
    try { await q(sb.rpc('padel_set_role', { p_user: uid, p_role: role })); toast(`${nameOf(uid)} er nu ${ROLE[role].toLowerCase()}`); }
    catch { sel.value = prev; return; }
    if (self && role !== 'admin') { await loadBase(); location.hash = '#/profil'; return boot(); }
    refresh();
  }));
  app.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => {
    const p = S.profiles[b.dataset.edit];
    const row = document.getElementById('p-' + p.id);
    row.innerHTML = `<form class="grow editp"><input name="name" value="${esc(p.name)}" required>
      ${radios('gender', GENDER, p.gender)}${radios('side', SIDE, p.side)}
      <div class="mact"><button class="btn sm primary">Gem</button><button type="button" class="btn sm" id="cancel">Annuller</button></div></form>`;
    row.querySelector('#cancel').onclick = viewAdmin;
    row.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      await q(sb.rpc('padel_admin_update_player', { p_user: p.id, p_name: f.name.value, p_gender: f.gender.value, p_side: f.side.value }));
      refresh();
    };
  }));
  app.querySelectorAll('[data-rencenter]').forEach((b) => (b.onclick = async () => {
    const c = centerById(b.dataset.rencenter), n = prompt('Nyt navn', c.name);
    if (n?.trim()) { await q(sb.from('padel_centers').update({ name: n.trim() }).eq('id', c.id)); refresh(); }
  }));
  app.querySelectorAll('[data-rencourt]').forEach((b) => (b.onclick = async () => {
    const c = courtById(b.dataset.rencourt), n = prompt('Nyt navn', c.name);
    if (n?.trim()) { await q(sb.from('padel_courts').update({ name: n.trim() }).eq('id', c.id)); refresh(); }
  }));
  app.querySelectorAll('[data-delcourt]').forEach((b) => (b.onclick = async () => {
    const c = courtById(b.dataset.delcourt);
    if (!confirm(`Slet ${c.name}?`)) return;
    try { await q(sb.from('padel_courts').delete().eq('id', c.id)); refresh(); } catch {}
  }));
  app.querySelectorAll('[data-addcourt]').forEach((b) => (b.onclick = async () => {
    const n = prompt('Navn på banen');
    if (!n?.trim()) return;
    const sort = Math.max(0, ...S.courts.filter((x) => x.center_id === b.dataset.addcourt).map((x) => x.sort)) + 1;
    await q(sb.from('padel_courts').insert({ center_id: b.dataset.addcourt, name: n.trim(), sort }));
    refresh();
  }));
  document.getElementById('addCenter').onclick = async () => {
    const n = prompt('Navn på centret');
    if (n?.trim()) { await q(sb.from('padel_centers').insert({ name: n.trim() })); refresh(); }
  };
}

// ---------- FAQ ----------
function viewFaq() {
  const norm = (t) => t.toLowerCase().replace(/<[^>]+>/g, ' ');
  app.innerHTML = `
  <div class="page">
    <button class="back" onclick="history.back()">‹ Tilbage</button>
    <h1>Spørgsmål og svar</h1>
    <input type="search" id="faqSearch" placeholder="Søg, fx americano, point, pause…" autocomplete="off">
    <div id="faqList"></div>
  </div>`;
  const list = document.getElementById('faqList');
  const draw = (term = '') => {
    const words = norm(term).split(/\s+/).filter(Boolean);
    const hits = FAQ.filter((f) => words.every((w) => norm(f.q + ' ' + f.a + ' ' + f.cat).includes(w)));
    if (!hits.length) { list.innerHTML = '<p class="muted pad">Ingen svar matcher. Prøv et andet ord, eller spørg en admin.</p>'; return; }
    const cats = [...new Set(hits.map((f) => f.cat))];
    list.innerHTML = cats.map((c) => `<h3>${esc(c)}</h3>${hits.filter((f) => f.cat === c).map((f) =>
      `<details class="faq" ${words.length ? 'open' : ''}><summary>${esc(f.q)}</summary><div>${f.a}</div></details>`).join('')}`).join('');
  };
  draw();
  document.getElementById('faqSearch').oninput = (e) => draw(e.target.value);
}
