// Egen profil: overblik øverst, ret oplysninger i en fold-ud. Første gang: velkomstformular.
import { installHow, renderInstall } from '../install.js';
import { unseenReplies } from './suggest.js';
import { latestNewsId } from '../news.js';
import { showQR } from '../qr.js';
import { sb, S, app, hooks, hasSuggest, GENDER, SIDE, roleNames, roleIn, groupElo, group, isSuper, isClub, phoneOf, fmtPhone, esc, toast, q, busy, radios, viewMode, setViewMode, hasElevated, nameOf, first, fmtDate } from '../core.js';
import { myKidsSection, bindMyKids, showCalendar, discoverRow } from './club.js';
import { editBtn, setEditMode } from '../editmode.js';
import { msgRowLabel, unreadThreads } from './messages.js';
// Barn uden e-mail: koden til login (gemt på telefonen ved login)
const kidCodeTxt = () => { try { const c = localStorage.getItem('fp-kidcode'); return c ? c.toUpperCase().replace(/(.{4})(?=.)/g, '$1-') : ''; } catch { return ''; } };

const initials = (name) => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

// Forælder i en juniorklub: siden på banen er ligegyldig
const parentOnly = () => ['klub', 'foraelder'].includes(S.joinInfo?.kind);

function form(p, isNew) {
  const parent = isNew && parentOnly();
  return `<form class="card" id="pf">
    <label>${parent ? 'Dit navn (forælder)' : 'Navn'}<input name="name" value="${esc(p.name || '')}" required maxlength="60" autocomplete="name"></label>
    <label>Telefonnummer<input name="phone" type="tel" inputmode="tel" value="${esc(p.id ? fmtPhone(phoneOf(p.id)) : '')}" required autocomplete="tel" placeholder="Fx 12 34 56 78">
      <small class="muted">${parent ? 'Kun trænerne kan se det.' : 'Kun admins i dine grupper kan se det.'}</small></label>
    <div class="lbl">Køn</div>${radios('gender', GENDER, p.gender)}
    ${parent ? '<input type="hidden" name="side" value="begge">' : `<div class="lbl">Foretrukken side</div>${radios('side', SIDE, p.side)}`}
    <button class="btn primary">${isNew ? 'Kom i gang' : 'Gem'}</button>
  </form>`;
}

export function renderProfile(isNew) {
  const p = S.me || { name: '', gender: '', side: 'begge' };
  if (isNew) {
    const ji = S.joinInfo;
    const intro = ji?.kind === 'klub' ? `Først lidt om dig. Bagefter melder du ${ji.audience === 'voksne' ? 'dig' : ji.audience === 'begge' ? 'dig selv eller dit barn' : 'dit barn'} ind i <b>${esc(ji.name)}</b>.`
      : ji?.kind === 'foraelder' ? `Først lidt om dig. Så får du adgang til <b>${esc(ji.kid)}</b>s træninger i ${esc(ji.name)}.`
      : ji?.kind === 'barn' ? `Fortæl lidt om dig selv. Så kan du se dine træninger i <b>${esc(ji.name)}</b>.`
      : 'Fortæl lidt om dig selv, så appen kan sætte gode hold.';
    app.innerHTML = `<div class="page"><h1>Velkommen 👋</h1>
      <p class="muted">${intro}</p>${form(p, true)}</div>`;
    return bind(true);
  }
  return renderMyPadel();
}

// ---------- Min padel: dit spillerkort, sæsonen i tal, makkere og seneste kampe ----------
let page = 'mypadel';
const rerender = () => (page === 'settings' ? renderSettings() : renderMyPadel());
// Tal, der tæller op, når siden åbnes (ikke ved "mindre bevægelse")
function countUp(root) {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.querySelectorAll('[data-count]').forEach((el) => {
    const to = +el.dataset.count, pre = el.dataset.pre || '', suf = el.dataset.suf || '';
    if (calm || !Number.isFinite(to) || Math.abs(to) < 2) { el.textContent = pre + to + suf; return; }
    const from = Math.abs(to) > 200 ? Math.round(to * 0.9) : 0, t0 = performance.now(), dur = 900;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = pre + Math.round(from + (to - from) * e) + suf; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
const spark = (vals) => {
  if (vals.length < 2) return '';
  const W = 120, H = 36, lo = Math.min(...vals), hi = Math.max(...vals, lo + 1);
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - 3 - ((v - lo) / (hi - lo)) * (H - 6)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
};

export async function renderMyPadel() {
  page = 'mypadel';
  const p = S.me;
  const viewing = !!S.viewAs, club = isClub(), g = S.groupId;
  const phone = phoneOf(p.id);
  const head = `<div class="mphead"><h1>${viewing ? esc(p.name.split(' ')[0]) + 's padel' : 'Min padel'}</h1>
    <div class="tools"><a class="icon bell" href="#/beskeder" aria-label="Beskeder">🔔${S.unread && !viewing ? `<b class="navbadge">${S.unread}</b>` : ''}</a>
    <a class="icon" href="#/indstillinger" id="toSettings" aria-label="Indstillinger">⚙️</a></div></div>`;
  const links = `<div class="list links">
      ${viewing ? '' : `<a class="row" href="#/samtaler" id="msgRow"><span class="grow">💬 ${msgRowLabel()}</span><span class="muted">›</span></a>`}
      <a class="row" href="#/beskeder" id="notRow"><span class="grow">🔔 Beskeder og notifikationer</span>${S.unread && !viewing ? `<span class="badge new">${S.unread} nye</span>` : '<span class="muted">›</span>'}</a>
      ${club && !viewing ? '<a class="row" href="#" id="calRow"><span class="grow">📅 Træninger i min kalender</span><span class="muted">›</span></a>' : ''}
      ${hasSuggest() ? '<a class="row" href="#/forslag" id="sugRow"><span class="grow">💡 Forslagskasse</span><span class="muted">›</span></a>' : ''}
      <a class="row" href="#/nyt"><span class="grow">🆕 Nyt og på vej</span><span class="muted">›</span></a>
      <a class="row" href="#/faq"><span class="grow">❓ Spørgsmål og svar</span><span class="muted">›</span></a>
    </div>`;
  const tip = !phone ? `<a class="card warnbox" href="#/indstillinger">📱 ${viewing ? 'Spilleren mangler et telefonnummer ›' : 'Tilføj dit telefonnummer, så admin kan få fat i dig ›'}</a>` : '';
  const mine = S.members.filter((m) => m.player_id === p.id && m.status !== 'fjernet');
  const chips = mine.length ? `<div class="gchips">${mine.map((m) => `<span class="gchip">${esc(group(m.group_id)?.name || 'Gruppe')}${m.status === 'afventer' ? ' ⏳' : roleIn(p.id, m.group_id) && roleIn(p.id, m.group_id) !== 'bruger' ? ` · ${roleNames(m.group_id)[roleIn(p.id, m.group_id)]}` : ''}</span>`).join('')}</div>` : '';

  // Klub: dit kort og dine børn
  if (club || !g) {
    app.innerHTML = `<div class="page profile mypadel">${head}${tip}
      <div class="card me-card pcard"><div class="avatar">${esc(initials(p.name))}</div><div class="grow"><b class="pname">${esc(p.name)}</b>
        <small>${phone ? fmtPhone(phone) : ''}</small>${chips}</div></div>
      <div id="kidsBox"></div>${links}</div>`;
    return afterMyPadel();
  }

  app.innerHTML = `<div class="page profile mypadel">${head}${tip}<div class="card me-card pcard loading"><div class="avatar">${esc(initials(p.name))}</div><div class="grow"><b class="pname">${esc(p.name)}</b>${chips}</div></div><div id="mpStats"></div><div id="kidsBox"></div>${links}</div>`;
  afterMyPadel();
  // Tallene hentes bagefter, så siden kommer med det samme
  let rk = [], ms = [], ch = [], fines = [];
  try {
    [rk, ms, ch, fines] = await Promise.all([
      q(sb.rpc('padel_ranking', { g })).catch(() => []),
      q(sb.from('padel_matches').select('*, padel_events(starts_at,format,group_id)').or(`a_left.eq.${p.id},a_right.eq.${p.id},b_left.eq.${p.id},b_right.eq.${p.id}`).eq('status', 'bekraeftet').order('created_at', { ascending: true })).catch(() => []),
      q(sb.from('padel_elo_changes').select('match_id,delta,elo_before').eq('player_id', p.id).eq('active', true)).catch(() => []),
      group()?.fines_enabled ? q(sb.from('padel_fines').select('amount,status').eq('group_id', g).eq('player_id', p.id)).catch(() => []) : Promise.resolve([]),
    ]);
  } catch {}
  if (page !== 'mypadel' || !document.getElementById('mpStats')) return;
  const me = rk.find((r) => r.id === p.id);
  const sorted = rk.slice().sort((a, b) => b.elo - a.elo);
  const rank = sorted.findIndex((r) => r.id === p.id) + 1;
  const elo = me?.elo ?? groupElo(p.id);
  const chg = Object.fromEntries(ch.map((c) => [c.match_id, c]));
  const L = ms.filter((m) => m.padel_events?.group_id === g).map((m) => {
    const onA = [m.a_left, m.a_right].includes(p.id), c = chg[m.id];
    return { m, date: new Date(m.padel_events.starts_at), sc: onA ? m.score_a : m.score_b, th: onA ? m.score_b : m.score_a,
      mate: onA ? (m.a_left === p.id ? m.a_right : m.a_left) : (m.b_left === p.id ? m.b_right : m.b_left), opps: onA ? [m.b_left, m.b_right] : [m.a_left, m.a_right],
      d: c?.delta ?? 0, after: c ? (c.elo_before ?? 1000) + (c.delta ?? 0) : null };
  });
  const wins = L.filter((x) => x.sc > x.th).length, pct = L.length ? Math.round((wins / L.length) * 100) : 0;
  const hist = L.filter((x) => x.after != null).map((x) => x.after).slice(-20);
  const best = Math.max(elo, ...L.filter((x) => x.after != null).map((x) => x.after));
  // Næste milepæl: næste hele 50 point
  const goal = Math.floor(elo / 50) * 50 + 50, prog = Math.max(0, Math.min(100, Math.round(((elo - (goal - 50)) / 50) * 100)));
  const form = (me?.form || []).slice(0, 5).reverse();
  const sum = (key) => { const t = {}; for (const x of L) for (const o of key === 'mate' ? [x.mate] : x.opps) { const r = (t[o] ||= { n: 0, d: 0, w: 0 }); r.n++; r.d += x.d; if (x.sc > x.th) r.w++; } return Object.entries(t).sort((a, b) => b[1].d - a[1].d); };
  const mates = sum('mate'), opps = sum('opp');
  const bestMate = mates.find((x) => x[1].d > 0), nemesis = opps.slice().reverse().find((x) => x[1].d < 0);
  const owe = fines.filter((f) => f.status === 'ubetalt').reduce((a, f) => a + (+f.amount || 0), 0);
  const person = (x, lbl, cls) => x ? `<a class="card duo ${cls}" href="#/spiller/${x[0]}"><small>${lbl}</small><b>${esc(nameOf(x[0]))}</b><span>${x[1].n} ${x[1].n === 1 ? 'kamp' : 'kampe'} · <em class="${x[1].d > 0 ? 'up' : 'dn'}">${x[1].d > 0 ? '+' : ''}${x[1].d}</em></span></a>` : '';

  const card = document.querySelector('.pcard');
  card.classList.remove('loading');
  card.innerHTML = `<div class="avatar">${esc(initials(p.name))}</div><div class="grow"><b class="pname">${esc(p.name)}</b>
      <div class="pform">${form.map((d) => `<i class="${d > 0 ? 'w' : d < 0 ? 'l' : ''}" title="${d > 0 ? '+' : ''}${d}"></i>`).join('')}${me?.cur_streak > 1 ? `<span class="streak">🔥 ${me.cur_streak} i træk</span>` : ''}</div>${chips}</div>
    <div class="pts"><b data-count="${elo}">${elo}</b><small>point</small>${spark(hist)}</div>
    <a class="prank" href="#/rangliste"><b>#${rank || '–'}</b><small>af ${sorted.length || '–'}</small></a>`;
  document.getElementById('mpStats').innerHTML = `
    ${owe > 0 ? `<a class="card owe" href="#/boeder"><span>💸</span><div class="grow"><b>Dit udestående</b><small>Bødekassen</small></div><b class="amt">${owe} kr. ›</b></a>` : group()?.fines_enabled ? '<a class="card owe ok" href="#/boeder"><span>💸</span><div class="grow"><b>Bødekassen</b><small>Du skylder ingenting</small></div><b class="amt">›</b></a>' : ''}
    <div class="mtiles">
      <div><b data-count="${L.length}">${L.length}</b><span>Kampe</span></div>
      <div><b data-count="${pct}" data-suf="%">${pct}%</b><span>Vundet</span></div>
      <div><b class="${(me?.month_pts || 0) > 0 ? 'up' : (me?.month_pts || 0) < 0 ? 'dn' : ''}" data-count="${me?.month_pts || 0}" data-pre="${(me?.month_pts || 0) > 0 ? '+' : ''}">${me?.month_pts || 0}</b><span>Denne måned</span></div>
      <div><b data-count="${me?.best_streak || 0}">${me?.best_streak || 0}</b><span>Længste stime</span></div>
    </div>
    <div class="card goal"><div class="ghead"><b>🎯 Næste mål: ${goal} point</b><small>${goal - elo} point endnu · højeste ${best}</small></div><div class="bar"><i style="--w:${prog}%"></i></div></div>
    ${bestMate || nemesis ? `<div class="duos">${person(bestMate, '🤝 Bedste makker', 'mate')}${person(nemesis, '⚡ Nemesis', 'nem')}</div>` : ''}
    ${me?.eggs ? `<div class="card eggs">🥚 Du har givet <b>${me.eggs}</b> ${me.eggs === 1 ? 'æg' : 'æg'} (6–0)</div>` : ''}
    ${L.length ? `<h3>Seneste kampe</h3><div class="list">${L.slice().reverse().slice(0, 3).map((x) => `<div class="row"><div class="grow"><b>${x.sc}–${x.th}</b> med ${esc(first(x.mate))} <small>mod ${esc(first(x.opps[0]))} & ${esc(first(x.opps[1]))} · ${fmtDate(x.date, { day: 'numeric', month: 'short' })}</small></div><div class="delta ${x.d > 0 ? 'up' : x.d < 0 ? 'dn' : ''}">${x.d > 0 ? '+' : ''}${x.d}</div></div>`).join('')}</div>` : '<div class="card"><p class="muted">Når du har spillet din første kamp, kommer dine tal her. 🎾</p></div>'}
    <a class="btn allstats" href="#/spiller/${p.id}">📊 Al statistik og grafer ›</a>`;
  countUp(app);
  requestAnimationFrame(() => app.querySelector('.goal .bar')?.classList.add('go'));
}

function afterMyPadel() {
  bind(false);
  const viewing = !!S.viewAs;
  myKidsSection().then((h) => { const box = document.getElementById('kidsBox'); if (box && h) { box.innerHTML = h; bindMyKids(() => renderMyPadel()); } });
  discoverRow().then((h) => { const nr = document.getElementById('notRow'); if (nr && h && !document.getElementById('discRow')) nr.insertAdjacentHTML('afterend', h); });
  if (!viewing) unreadThreads().then((n) => { const r = document.getElementById('msgRow'); if (n && r) r.querySelector('.muted').outerHTML = `<span class="badge new">${n} ${n === 1 ? 'ny' : 'nye'}</span>`; });
  if (hasSuggest()) unseenReplies().then((n) => { const r = document.getElementById('sugRow'); if (n && r) r.querySelector('.muted').outerHTML = `<span class="badge new">${n === 1 ? 'Nyt svar' : `${n} nye svar`}</span>`; });
}

// ---------- Indstillinger (⚙️ på Min padel) ----------
export function renderSettings() {
  page = 'settings';
  const p = S.me;
  const mine = S.members.filter((m) => m.player_id === p.id && m.status !== 'fjernet');
  const phone = phoneOf(p.id);
  const viewing = !!S.viewAs;
  app.innerHTML = `
  <div class="page profile settings">
    <button class="back" onclick="location.hash='#/profil'">‹ ${viewing ? 'Tilbage' : 'Min padel'}</button>
    <h1>⚙️ Indstillinger</h1>
    <div class="card me-card">
      <div class="avatar">${esc(initials(p.name))}</div>
      <div class="grow">
        <b class="pname">${esc(p.name)}</b>${editBtn('padel_profiles', p.id)}
        <small>${isSuper() ? 'Superadmin · ' : ''}${GENDER[p.gender]} · ${SIDE[p.side]}${phone ? ` · ${fmtPhone(phone)}` : ''}</small>
        ${mine.length ? `<div class="gchips">${mine.map((m) => `<span class="gchip">${esc(group(m.group_id)?.name || 'Gruppe')}${m.status === 'afventer' ? ' ⏳' : roleIn(p.id, m.group_id) && roleIn(p.id, m.group_id) !== 'bruger' ? ` · ${roleNames(m.group_id)[roleIn(p.id, m.group_id)]}` : ''}</span>`).join('')}</div>` : ''}
      </div>
    </div>
    ${!phone ? `<div class="card warnbox">📱 ${viewing ? 'Spilleren mangler et telefonnummer.' : 'Tilføj dit telefonnummer, så admin kan få fat i dig.'}</div>` : ''}
    <h3>Mig</h3>
    <details class="card editbox" ${phone ? '' : 'open'}><summary><b>✏️ ${viewing ? 'Ret oplysninger' : 'Navn, telefon, køn og side'}</b><span class="muted">›</span></summary>${form(p, false)}</details>
    <h3>Appen</h3>
    <div class="list links">
      <a class="row" href="#/beskeder"><span class="grow">🔔 Notifikationer og mails</span><span class="muted">›</span></a>
      ${viewing ? '' : '<a class="row" href="#/udseende"><span class="grow">🎨 Udseende</span><span class="muted">›</span></a>'}
      ${!viewing && installHow() ? '<a class="row" href="#" id="installRow"><span class="grow">📲 Læg på hjemmeskærmen</span><span class="muted">›</span></a>' : ''}
      ${!viewing && S.realMe?.is_superadmin ? '<a class="row" href="#" id="testAppRow"><span class="grow">🤖 Test-app til Android (QR)</span><span class="muted">›</span></a>' : ''}
      <a class="row" href="#/privatliv"><span class="grow">🔒 Privatliv</span><span class="muted">›</span></a>
    </div>
    ${!viewing && hasElevated() ? `<div class="card modecard"><b>👁 Visning</b>
      ${radios('vmode', S.realMe?.is_superadmin ? { super: 'Superadmin', mine: 'Mine roller', bruger: 'Bruger' } : { mine: 'Admin', bruger: 'Bruger' }, viewMode())}
      <p class="muted small">${S.realMe?.is_superadmin ? '<b>Superadmin</b>: alt i alle grupper. <b>Mine roller</b>: kun de grupper, du er med i, med den rolle du har dér. <b>Bruger</b>: som en almindelig spiller.' : '<b>Admin</b>: med dine admin- og trænerrettigheder. <b>Bruger</b>: som en almindelig spiller.'}</p>
      ${S.realMe?.is_superadmin ? `<label class="switch"><input type="checkbox" id="editMode" ${S.editMode ? 'checked' : ''}><span>✏️ Redigeringstilstand <small class="muted">(ret og slet alt, på denne enhed)</small></span></label>` : ''}</div>` : ''}
    <div class="pfoot">
      ${!viewing && S.isKid && kidCodeTxt() ? `<div class="card kidcodebox"><small>Din kode til login (fx når du åbner appen fra hjemmeskærmen):</small><b>${kidCodeTxt()}</b></div>` : ''}
      ${viewing ? '' : '<button class="btn" id="logout">↩️ Log ud</button>'}
      ${p.is_superadmin ? '' : `<button class="link sm dn" id="deleteMe">🗑 ${viewing ? 'Slet spilleren' : 'Slet min profil'}</button>`}
    </div>
  </div>`;
  bind(false);
}

function bind(isNew) {
  const f = document.getElementById('pf');
  if (f) f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button');
    busy(btn, true);
    try {
      if (S.viewAs) {
        // Admin retter spillerens oplysninger
        await q(sb.rpc('padel_admin_update_player', { p_user: S.viewAs, p_name: f.name.value, p_gender: f.gender.value, p_side: f.side.value }));
        await q(sb.rpc('padel_admin_set_phone', { p_user: S.viewAs, p_phone: f.phone.value }));
      } else {
        await q(sb.rpc('padel_save_profile', { p_name: f.name.value, p_gender: f.gender.value, p_side: f.side.value }));
        // Nye spillere skal ikke have gamle nyheder
        if (isNew) { try { await q(sb.rpc('padel_set_news_seen', { p_id: latestNewsId() })); } catch {} }
        const claimed = await q(sb.rpc('padel_set_phone_v2', { p_phone: f.phone.value }));
        if (claimed) {
          toast('Velkommen! Dine kampe og point fra før er flyttet over til dig');
          if (isNew) { location.hash = '#/fredage'; return hooks.boot(); }
          await hooks.loadBase(); return rerender();
        }
      }
      toast('Profilen er gemt');
      if (isNew) { if (!location.hash.startsWith('#/fredag/')) location.hash = '#/fredage'; return hooks.boot(); }
      await hooks.loadBase();
      rerender();
    } catch { busy(btn, false); }
  };
  document.getElementById('logout')?.addEventListener('click', () => {
    if (S.isKid && kidCodeTxt() && !confirm(`Log ud? Du kan logge ind igen med din kode ${kidCodeTxt()}`)) return;
    sb.auth.signOut();
  });
  const em = document.getElementById('editMode');
  if (em) em.onchange = () => { setEditMode(em.checked); toast(em.checked ? 'Redigering er slået til' : 'Redigering er slået fra'); };
  app.querySelectorAll('input[name=vmode]').forEach((r) => (r.onchange = () => { setViewMode(r.value); toast({ super: 'Du ser appen som superadmin', mine: 'Du ser appen med dine egne roller', bruger: 'Du ser appen som almindelig bruger' }[r.value]); hooks.boot(); }));
  document.getElementById('calRow')?.addEventListener('click', (e) => { e.preventDefault(); showCalendar(); });
  // Kun superadmin: QR-kode til test-appen, som en anden scanner med sin Android-telefon
  document.getElementById('testAppRow')?.addEventListener('click', (e) => { e.preventDefault(); showQR(location.origin + '/app/', 'Test-app til Android', 'Scan koden med Android-telefonens kamera. Siden viser, hvordan appen installeres.'); });
  document.getElementById('deleteMe')?.addEventListener('click', async (e) => {
    const who = S.viewAs ? S.me.name : 'din profil';
    if (!confirm(`Slet ${who}?\n\n${S.viewAs ? 'Spilleren' : 'Du'} forsvinder fra grupperne og ranglisten. Point og kampe gemmes: ${S.viewAs ? 'kommer spilleren' : 'kommer du'} igen (samme mail eller telefonnummer), er pointene de samme.`)) return;
    busy(e.currentTarget, true);
    try {
      await q(sb.rpc('padel_delete_player', { p_user: S.me.id }));
      if (S.viewAs) { toast('Spilleren er slettet'); const { stopViewAs } = await import('../viewas.js'); return stopViewAs(); }
      toast('Din profil er slettet'); await sb.auth.signOut();
    } catch { busy(e.currentTarget, false); }
  });
  document.getElementById('installRow')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('nav').innerHTML = '';
    renderInstall(() => hooks.boot());
  });
}
