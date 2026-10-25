// Klub (juniorklub): træningstider med afbud og fremmøde, opslag fra trænerne, indmeldelse af børn og kontingent.
// Forældre melder børn ind; større børn kan få eget login via et link. Trænere = admin og superbruger i klubben.
import { sb, S, app, hooks, esc, toast, q, busy, group, canRun, isAdmin, setGroup, groupBar, nameOf, share, fmtDate } from '../core.js';
import { showQR } from '../qr.js';

// ---------- Datoer (altid dansk tid) ----------
export const todayISO = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen' }).format(new Date());
export const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const isoDow = (d) => new Date(d + 'T12:00:00Z').getUTCDay() || 7;
const dayLabel = (d) => new Intl.DateTimeFormat('da-DK', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
const t5 = (t) => String(t || '').slice(0, 5);
export const WEEKDAY = { 1: 'Mandag', 2: 'Tirsdag', 3: 'Onsdag', 4: 'Torsdag', 5: 'Fredag', 6: 'Lørdag', 7: 'Søndag' };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const kr = (n) => `${Number(n).toLocaleString('da-DK')} kr.`;
// Tekst fra trænerne: linjeskift og links
const rich = (s) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');

// ---------- Indlæsning ----------
export async function loadClub(g = S.groupId, range = null) {
  const gr = group(g);
  const teams = await q(sb.from('padel_club_teams').select('*').eq('group_id', g).order('sort'));
  const tids = teams.map((t) => t.id);
  const [sessions, kids] = await Promise.all([
    tids.length ? q(sb.from('padel_club_sessions').select('*').in('team_id', tids)) : [],
    q(sb.from('padel_club_kids').select('*').eq('group_id', g).order('name')),
  ]);
  const sids = sessions.map((s) => s.id), kidIds = kids.map((k) => k.id);
  const inRange = (t) => sb.from(t).select('*').in('session_id', sids).gte('day', range.from).lte('day', range.to);
  const [absence, attendance, cancels, fees, guardians] = await Promise.all([
    sids.length && range ? q(inRange('padel_club_absence')) : [],
    sids.length && range ? q(inRange('padel_club_attendance')) : [],
    sids.length && range ? q(inRange('padel_club_cancellations')) : [],
    kidIds.length && gr?.club_fee_label ? q(sb.from('padel_club_fees').select('*').in('kid_id', kidIds).eq('label', gr.club_fee_label)) : [],
    kidIds.length ? q(sb.from('padel_club_guardians').select('*').in('kid_id', kidIds).eq('active', true)) : [],
  ]);
  S.club = { g, teams, sessions, kids, absence, attendance, cancels, fees, guardians };
  return S.club;
}

const C = () => S.club;
const team = (id) => C().teams.find((t) => t.id === id);
const session = (id) => C().sessions.find((s) => s.id === id);
// Mine børn: jeg er forælder, eller barnet er mig selv
export const isMine = (k) => k.player_id === S.me?.id || C().guardians.some((x) => x.kid_id === k.id && x.user_id === S.me?.id);
const myKids = () => C().kids.filter((k) => isMine(k) && ['ansoegt', 'aktiv'].includes(k.status));
const kidLabel = (k) => (k.player_id === S.me?.id ? `${esc(k.name)} <small class="muted">(dig)</small>` : esc(k.name));
const absOf = (sid, day, kid) => C().absence.find((a) => a.session_id === sid && a.day === day && a.kid_id === kid);
const coming = (sid, day, kid) => absOf(sid, day, kid)?.status !== 'afbud';
const cancelOf = (sid, day) => C().cancels.find((c) => c.session_id === sid && c.day === day && c.cancelled);
const present = (sid, day, kid) => C().attendance.find((a) => a.session_id === sid && a.day === day && a.kid_id === kid)?.present;
const feeOf = (kid) => C().fees.find((f) => f.kid_id === kid)?.status || 'ubetalt';
const guardianNames = (kid) => C().guardians.filter((x) => x.kid_id === kid).map((x) => nameOf(x.user_id)).join(', ');

// Alle træninger i perioden for de valgte hold
function occurrences(teamIds, from, to) {
  const out = [];
  const ss = C().sessions.filter((s) => s.active && teamIds.includes(s.team_id) && !team(s.team_id)?.archived);
  for (let d = from; d <= to; d = addDays(d, 1)) for (const s of ss) if (s.weekday === isoDow(d)) out.push({ s, day: d });
  return out.sort((a, b) => a.day.localeCompare(b.day) || t5(a.s.start_time).localeCompare(t5(b.s.start_time)));
}

// ---------- Træning ----------
export async function viewTraining() {
  const g = S.groupId, gr = group(), trainer = canRun();
  const today = todayISO();
  S.trWeeks ||= 2;
  const from = trainer && S.trPast ? addDays(today, -14) : today, to = addDays(today, S.trWeeks * 7 - 1);
  await loadClub(g, { from, to });
  const mine = myKids();
  const active = mine.filter((k) => k.status === 'aktiv');
  const liveTeams = C().teams.filter((t) => !t.archived);
  if (trainer && S.trTeam && !liveTeams.some((t) => t.id === S.trTeam)) S.trTeam = null;
  const teamIds = trainer ? (S.trTeam ? [S.trTeam] : liveTeams.map((t) => t.id)) : [...new Set(active.map((k) => k.team_id).filter(Boolean))];
  const occ = occurrences(teamIds, from, to);
  const unpaid = gr.club_fee_label && gr.club_fee ? active.filter((k) => feeOf(k.id) !== 'betalt') : [];

  app.innerHTML = `
  <div class="page club">
    <div class="head"><h1>Træning</h1></div>
    ${groupBar(viewTraining)}
    ${mine.filter((k) => k.status === 'ansoegt').map((k) => `<div class="card warnbox">⏳ <b>${esc(k.name)}</b> venter på, at en træner godkender indmeldelsen.</div>`).join('')}
    ${active.filter((k) => !k.team_id).map((k) => `<div class="card warnbox">👋 <b>${esc(k.name)}</b> er optaget. Træneren sætter snart ${k.player_id === S.me?.id ? 'dig' : 'barnet'} på et hold.</div>`).join('')}
    ${unpaid.length ? feeCard(gr, unpaid) : ''}
    ${trainer && liveTeams.length > 1 ? `<div class="chips"><button class="chip ${S.trTeam ? '' : 'on'}" data-trteam="">Alle hold</button>${liveTeams.map((t) => `<button class="chip ${S.trTeam === t.id ? 'on' : ''}" data-trteam="${t.id}">${esc(t.name)}</button>`).join('')}</div>` : ''}
    ${trainer ? `<div class="trtools"><button class="link sm" id="trPast">${S.trPast ? '↑ Skjul tidligere' : '↓ Vis de sidste 2 uger (fremmøde)'}</button></div>` : ''}
    ${occ.length ? occ.map((o) => (trainer ? trainerCard(o, today) : parentCard(o, active, today))).join('')
      : `<div class="card empty"><p class="muted">${trainer ? (liveTeams.length ? 'Ingen træninger i perioden. Træningstiderne sættes under Admin → Hold og tider.' : 'Opret hold og træningstider under <a href="#/admin">Admin → Hold og tider</a>.')
        : active.length ? 'Der er ingen træninger de næste uger.' : mine.length ? 'Træningerne kommer her, når barnet er godkendt og sat på et hold.' : 'Du har ikke meldt nogen ind endnu.'}</p></div>`}
    ${occ.length ? `<button class="btn ghost" id="trMore">Vis flere uger</button>` : ''}
    ${!trainer ? '<p class="center"><a class="link sm" href="#/profil">👧 Mine børn og indmeldelse ›</a></p>' : ''}
  </div>`;
  bindTraining();
}

function feeCard(gr, kids) {
  const waiting = kids.filter((k) => feeOf(k.id) === 'afventer');
  const due = kids.filter((k) => feeOf(k.id) === 'ubetalt');
  const ids = due.map((k) => k.id).join(',');
  return `<div class="card feecard">
    <b>💳 Kontingent ${esc(gr.club_fee_label)}</b>
    ${due.length ? `<p>${kr(gr.club_fee * due.length)}${due.length > 1 ? ` <small class="muted">(${due.length} × ${kr(gr.club_fee)})</small>` : ''} for ${due.map((k) => esc(k.name.split(' ')[0])).join(' og ')}</p>
      <div class="mact">${gr.club_fee_url ? `<a class="btn primary" href="${esc(gr.club_fee_url)}" target="_blank" rel="noopener" data-feepay="${ids}">💳 MobilePay</a>` : ''}
        <button class="btn ${gr.club_fee_url ? '' : 'primary'}" data-feepay="${ids}" data-only>Har betalt</button></div>` : ''}
    ${waiting.map((k) => `<p class="muted small">⏳ ${esc(k.name.split(' ')[0])}: venter på, at træneren bekræfter betalingen · <button class="link sm" data-feeundo="${k.id}">Fortryd</button></p>`).join('')}
  </div>`;
}

const head = (o) => `<div class="trhead"><b>${cap(dayLabel(o.day))}</b><span class="trtime">${t5(o.s.start_time)}–${t5(o.s.end_time)}</span></div>
  <small class="muted">${esc(team(o.s.team_id)?.name || '')}${o.s.place ? ` · ${esc(o.s.place)}` : ''}</small>`;
const cancelLine = (c) => (c ? `<div class="trcancel">❌ Aflyst${c.note ? `: ${esc(c.note)}` : ''}</div>` : '');

function parentCard(o, active, today) {
  const kids = active.filter((k) => k.team_id === o.s.team_id);
  const c = cancelOf(o.s.id, o.day);
  return `<div class="card tr ${c ? 'cancelled' : ''}">${head(o)}${cancelLine(c)}
    ${c ? '' : kids.map((k) => {
      const yes = coming(o.s.id, o.day, k.id), a = absOf(o.s.id, o.day, k.id);
      const key = `${o.s.id}|${o.day}|${k.id}`;
      return `<div class="krow"><span class="grow">${kidLabel(k)}${!yes && a?.reason ? `<small class="muted">${esc(a.reason)}</small>` : ''}</span>
        ${o.day < today ? `<span class="badge ${yes ? 'ok' : ''}">${yes ? 'Kom' : 'Afbud'}</span>`
          : `<div class="yesno"><button class="btn sm ${yes ? 'on yes' : ''}" data-abs="${key}|kommer" aria-pressed="${yes}">✓ Kommer</button><button class="btn sm ${yes ? '' : 'on no'}" data-abs="${key}|afbud" aria-pressed="${!yes}">Afbud</button></div>`}</div>`;
    }).join('')}
  </div>`;
}

function trainerCard(o, today) {
  const kids = C().kids.filter((k) => k.status === 'aktiv' && k.team_id === o.s.team_id);
  const c = cancelOf(o.s.id, o.day);
  const no = kids.filter((k) => !coming(o.s.id, o.day, k.id));
  const key = `${o.s.id}|${o.day}`;
  const canMark = o.day <= today;
  const met = kids.filter((k) => present(o.s.id, o.day, k.id)).length;
  const open = S.trOpen === key;
  return `<details class="card tr trainer ${c ? 'cancelled' : ''}" data-tr="${key}" ${open ? 'open' : ''}><summary>${head(o)}
      <div class="trcount">${c ? '' : `<span class="ok">✓ ${kids.length - no.length} kommer</span>${no.length ? `<span class="no">✗ ${no.length} afbud</span>` : ''}${canMark ? `<span class="muted">· ${met} mødt</span>` : ''}`}<span class="muted">›</span></div>
    </summary>${cancelLine(c)}
    <div class="trlist">${kids.map((k) => {
      const a = absOf(o.s.id, o.day, k.id), yes = coming(o.s.id, o.day, k.id);
      return `<div class="krow"><span class="grow">${esc(k.name)}${yes ? '' : `<small class="no">Afbud${a?.reason ? `: ${esc(a.reason)}` : ''}</small>`}</span>
        ${canMark && !c ? `<label class="present"><input type="checkbox" data-att="${key}|${k.id}" ${present(o.s.id, o.day, k.id) ? 'checked' : ''}><span>Mødt</span></label>` : ''}</div>`;
    }).join('') || '<p class="muted small">Ingen børn på holdet endnu.</p>'}</div>
    <div class="mact">${c ? `<button class="btn sm" data-cancel="${key}|0">↩️ Træningen er alligevel ikke aflyst</button>` : o.day >= today ? `<button class="btn sm ghost danger" data-cancel="${key}|1">Aflys træningen</button>` : ''}</div>
  </details>`;
}

function bindTraining() {
  app.querySelectorAll('[data-trteam]').forEach((b) => (b.onclick = () => { S.trTeam = b.dataset.trteam || null; viewTraining(); }));
  document.getElementById('trPast')?.addEventListener('click', () => { S.trPast = !S.trPast; viewTraining(); });
  document.getElementById('trMore')?.addEventListener('click', () => { S.trWeeks += 2; viewTraining(); });
  app.querySelectorAll('details[data-tr]').forEach((d) => d.querySelector('summary').addEventListener('click', () => { S.trOpen = d.open ? null : d.dataset.tr; }));
  app.querySelectorAll('[data-abs]').forEach((b) => (b.onclick = async () => {
    const [sid, day, kid, st] = b.dataset.abs.split('|');
    if (b.classList.contains('on')) return;
    busy(b, true);
    try {
      await q(sb.rpc('padel_club_set_absence', { p_session: sid, p_day: day, p_kid: kid, p_status: st, p_reason: null }));
      toast(st === 'afbud' ? 'Afbud er givet' : 'Godt, vi ses! 🎾');
      viewTraining();
    } catch { busy(b, false); }
  }));
  app.querySelectorAll('[data-att]').forEach((cb) => (cb.onchange = async () => {
    const [sid, day, kid] = cb.dataset.att.split('|');
    cb.disabled = true;
    try { await q(sb.rpc('padel_club_set_attendance', { p_session: sid, p_day: day, p_kid: kid, p_present: cb.checked })); } catch { cb.checked = !cb.checked; }
    cb.disabled = false;
    const a = C().attendance.find((x) => x.session_id === sid && x.day === day && x.kid_id === kid);
    if (a) a.present = cb.checked; else C().attendance.push({ session_id: sid, day, kid_id: kid, present: cb.checked });
  }));
  app.querySelectorAll('[data-cancel]').forEach((b) => (b.onclick = async () => {
    const [sid, day, on] = b.dataset.cancel.split('|');
    let note = null;
    if (on === '1') { note = prompt('Aflys træningen. Skriv evt. en besked til holdet (fx "Banen er lukket"):', ''); if (note === null) return; }
    busy(b, true);
    try { await q(sb.rpc('padel_club_cancel', { p_session: sid, p_day: day, p_cancelled: on === '1', p_note: note })); toast(on === '1' ? 'Træningen er aflyst. Holdet har fået besked' : 'Træningen er genoprettet'); viewTraining(); } catch { busy(b, false); }
  }));
  app.querySelectorAll('[data-feepay]').forEach((b) => (b.onclick = async (e) => {
    if (b.dataset.only !== undefined) e.preventDefault();
    try { for (const id of b.dataset.feepay.split(',')) await q(sb.rpc('padel_club_fee_paid', { p_kid: id })); } catch { return; }
    toast('Tak! Træneren bekræfter betalingen');
    setTimeout(viewTraining, b.tagName === 'A' ? 600 : 0);
  }));
  app.querySelectorAll('[data-feeundo]').forEach((b) => (b.onclick = async () => {
    try { await q(sb.rpc('padel_club_fee_set', { p_kid: b.dataset.feeundo, p_status: 'ubetalt' })); viewTraining(); } catch {}
  }));
}

// ---------- Opslag ----------
export async function viewPosts() {
  const g = S.groupId, gr = group(), trainer = canRun();
  const [teams, posts] = await Promise.all([
    q(sb.from('padel_club_teams').select('*').eq('group_id', g).order('sort')),
    q(sb.from('padel_club_posts').select('*').eq('group_id', g).eq('hidden', false).order('created_at', { ascending: false }).limit(60)),
  ]);
  const tname = (id) => teams.find((t) => t.id === id)?.name;
  const list = [...posts.filter((p) => p.pinned), ...posts.filter((p) => !p.pinned)];
  app.innerHTML = `
  <div class="page club">
    <h1>Opslag</h1>
    ${groupBar(viewPosts)}
    ${gr.club_info ? `<div class="card clubinfo"><b>ℹ️ Om ${esc(gr.name)}</b><p>${rich(gr.club_info)}</p></div>` : ''}
    ${trainer ? `<details class="card postnew" ${S.postOpen ? 'open' : ''}><summary><b>✏️ Skriv et opslag</b><span class="muted">›</span></summary>
      <form id="postForm">
        <label>Til<select name="team"><option value="">Hele klubben</option>${teams.filter((t) => !t.archived).map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
        <label>Overskrift <small class="muted">(valgfri)</small><input name="title" maxlength="100" placeholder="Fx Ingen træning i efterårsferien"></label>
        <label>Besked<textarea name="body" rows="5" maxlength="4000" required></textarea></label>
        <label class="switch"><input type="checkbox" name="pinned"><span>📌 Fastgør øverst</span></label>
        <p class="muted small">Alle forældre og børn på holdet får en notifikation.</p>
        <button class="btn primary">Send opslag</button>
      </form></details>` : ''}
    ${list.map((p) => `
      <div class="card post ${p.pinned ? 'pinned' : ''}">
        <div class="ftop"><span class="grow">${p.pinned ? '📌 ' : ''}${p.title ? `<b>${esc(p.title)}</b>` : ''}</span><span class="badge">${esc(tname(p.team_id) || 'Hele klubben')}</span></div>
        <p class="ptext">${rich(p.body)}</p>
        <small class="muted">${esc(nameOf(p.author).split(' ')[0])} · ${fmtDate(p.created_at, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
        ${trainer ? `<div class="ptools"><button class="link sm" data-ppin="${p.id}">${p.pinned ? 'Løsn' : '📌 Fastgør'}</button><button class="link sm dn" data-phide="${p.id}">Slet</button></div>` : ''}
      </div>`).join('') || `<div class="card empty"><p class="muted">Ingen opslag endnu.${trainer ? ' Skriv det første ovenfor.' : ' Her kommer beskeder fra trænerne.'}</p></div>`}
  </div>`;
  const f = document.getElementById('postForm');
  const det = app.querySelector('details.postnew');
  if (det) det.ontoggle = () => (S.postOpen = det.open);
  if (f) f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button.primary'); busy(btn, true);
    try {
      await q(sb.rpc('padel_club_post', { g, p_team: f.team.value || null, p_title: f.title.value, p_body: f.body.value, p_pinned: f.pinned.checked }));
      S.postOpen = false; toast('Opslaget er sendt 📣'); viewPosts();
    } catch { busy(btn, false); }
  };
  const upd = async (p, patch) => { await q(sb.rpc('padel_club_update_post', { p_id: p.id, p_title: p.title, p_body: p.body, p_pinned: p.pinned, p_hidden: false, ...patch })); viewPosts(); };
  app.querySelectorAll('[data-ppin]').forEach((b) => (b.onclick = () => { const p = posts.find((x) => x.id === b.dataset.ppin); upd(p, { p_pinned: !p.pinned }).catch(() => {}); }));
  app.querySelectorAll('[data-phide]').forEach((b) => (b.onclick = () => { if (confirm('Slet opslaget?')) upd(posts.find((x) => x.id === b.dataset.phide), { p_hidden: true }).catch(() => {}); }));
}

// ---------- Indmeldelse ----------
const kidFields = (i) => `<fieldset class="kidf"><legend>Barn ${i + 1}</legend>
  <label>Navn<input name="kname" required maxlength="60" autocomplete="off"></label>
  <label>Fødselsår<input name="kyear" type="number" inputmode="numeric" min="2000" max="2025" placeholder="Fx 2014"></label>
  <label>Besked til træneren <small class="muted">(valgfri)</small><input name="knote" maxlength="500" placeholder="Fx har spillet et år, vil gerne på hold med Oscar"></label></fieldset>`;

export async function viewClubJoin(g) {
  let name = group(g)?.name;
  if (!name) { try { name = await q(sb.rpc('padel_group_name', { g })); } catch {} }
  app.innerHTML = `
  <div class="page club">
    <button class="back" onclick="history.length > 1 ? history.back() : (location.hash = '#/profil')">‹ Tilbage</button>
    <h1>Meld ind i ${esc(name || 'klubben')}</h1>
    <p class="muted">Udfyld for hvert barn. En træner godkender indmeldelsen og sætter barnet på et hold, og du får besked her i appen.</p>
    <form id="joinForm" class="card">
      <div id="kidList">${kidFields(0)}</div>
      <div><button type="button" class="btn ghost" id="moreKid">➕ Tilføj et barn mere</button></div>
      <p class="muted small">Vi gemmer kun barnets navn og fødselsår, så trænerne kan sætte hold. Større børn kan senere få deres eget login.</p>
      <button class="btn primary">Send indmeldelse</button>
    </form>
  </div>`;
  const f = document.getElementById('joinForm');
  document.getElementById('moreKid').onclick = () => { const list = document.getElementById('kidList'); list.insertAdjacentHTML('beforeend', kidFields(list.children.length)); list.lastElementChild.querySelector('input').focus(); };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const kids = [...f.querySelectorAll('.kidf')].map((fs) => ({ name: fs.querySelector('[name=kname]').value, birth_year: fs.querySelector('[name=kyear]').value, note: fs.querySelector('[name=knote]').value }));
    const btn = f.querySelector('button.primary'); busy(btn, true);
    try {
      await q(sb.rpc('padel_club_apply', { g, p_kids: kids }));
      toast('Tak! En træner godkender indmeldelsen');
      await hooks.loadBase();
      if (S.groups.some((x) => x.id === g) && S.members.some((m) => m.group_id === g && m.player_id === S.me.id && m.status === 'aktiv')) setGroup(g);
      location.hash = '#/traening';
      hooks.route();
    } catch { busy(btn, false); }
  };
}

// ---------- Mine børn (på profilen) ----------
export async function myKidsSection() {
  let kids = [];
  try { kids = await q(sb.from('padel_club_kids').select('*').in('status', ['ansoegt', 'aktiv']).order('name')); } catch { return ''; }
  const gds = kids.length ? await q(sb.from('padel_club_guardians').select('*').in('kid_id', kids.map((k) => k.id)).eq('active', true)) : [];
  const mineK = kids.filter((k) => k.player_id !== S.me.id && gds.some((x) => x.kid_id === k.id && x.user_id === S.me.id));
  const clubs = S.groups.filter((x) => x.kind === 'klub' && !x.archived && (S.members.some((m) => m.group_id === x.id && m.player_id === S.me.id && m.status === 'aktiv') || kids.some((k) => k.group_id === x.id)));
  if (!mineK.length && !clubs.length) return '';
  S.myKids = mineK;
  return `<h3>Mine børn</h3>
    ${mineK.map((k) => `<details class="card kidcard"><summary><span class="grow"><b>${esc(k.name)}</b><small class="muted">${esc(group(k.group_id)?.name || 'Klub')}${k.status === 'ansoegt' ? ' · ⏳ venter på godkendelse' : ''}${k.player_id ? ' · har eget login' : ''}</small></span><span class="muted">›</span></summary>
      <div class="mact"><button class="btn sm" data-kidlogin="${k.id}">📱 ${k.player_id ? 'Nyt login' : 'Eget login'}</button><button class="btn sm" data-kidparent="${k.id}">👪 Forælder 2</button></div>
      <p class="muted small">Med eget login kan barnet selv se træninger og give afbud (vis koden, eller <button class="link sm" data-kidshare="${k.id}">send linket</button>). Den anden forælder får samme adgang som dig.</p>
      <div class="mact"><button class="link sm dn" data-kidleave="${k.id}">Meld ${esc(k.name.split(' ')[0])} ud</button></div>
    </details>`).join('')}
    ${clubs.map((c) => `<a class="btn ghost kidjoin" href="#/klub-ind/${c.id}">➕ Meld ${mineK.some((k) => k.group_id === c.id) ? 'et barn mere' : 'et barn'} ind${clubs.length > 1 ? ` (${esc(c.name)})` : ''}</a>`).join('')}`;
}

export function bindMyKids(rerender) {
  const link = (code) => `${location.origin}/#/barn/${code}`;
  const kid = (id) => S.myKids.find((x) => x.id === id);
  app.querySelectorAll('[data-kidlogin]').forEach((b) => (b.onclick = () => {
    const k = kid(b.dataset.kidlogin);
    showQR(link(k.login_code), `Eget login til ${k.name}`, `Lad ${k.name.split(' ')[0]} scanne koden med sin telefon og oprette sig. Koden virker én gang.`);
  }));
  app.querySelectorAll('[data-kidshare]').forEach((b) => (b.onclick = () => share(link(kid(b.dataset.kidshare).login_code), 'Her er dit eget login til padelklubben. Opret dig med linket:')));
  app.querySelectorAll('[data-kidparent]').forEach((b) => (b.onclick = () => {
    const k = kid(b.dataset.kidparent);
    share(link(k.guardian_code), `Få adgang til ${k.name}s træninger i padelklubben. Opret dig (eller log ind) med linket:`);
  }));
  app.querySelectorAll('[data-kidleave]').forEach((b) => (b.onclick = async () => {
    const k = S.myKids.find((x) => x.id === b.dataset.kidleave);
    if (!confirm(`Meld ${k.name} ud af klubben?`)) return;
    try { await q(sb.rpc('padel_club_leave', { p_kid: k.id })); toast(`${k.name} er meldt ud`); rerender(); } catch {}
  }));
}

// ---------- Admin: børn ----------
export function clubKidsTab() {
  const gr = group(), trainer = canRun();
  if (!trainer) return '';
  const kids = C().kids, teams = C().teams.filter((t) => !t.archived);
  const pend = kids.filter((k) => k.status === 'ansoegt');
  const act = kids.filter((k) => k.status === 'aktiv');
  const teamSel = (k, attr) => `<select class="sm" ${attr} aria-label="Hold"><option value="">Intet hold</option>${teams.map((t) => `<option value="${t.id}" ${k.team_id === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>`;
  const fee = gr.club_fee_label;
  const feeBadge = (k) => (fee ? { betalt: '<span class="badge ok">Betalt</span>', afventer: '<span class="badge warn">Afventer</span>', ubetalt: '<span class="badge">Ikke betalt</span>' }[feeOf(k.id)] : '');
  const byTeam = [...teams.map((t) => ({ t, ks: act.filter((k) => k.team_id === t.id) })), { t: null, ks: act.filter((k) => !k.team_id || !teams.some((t) => t.id === k.team_id)) }].filter((x) => x.ks.length);
  return `
    ${pend.length ? `<div class="card pendingbox"><b>⏳ Nye indmeldelser (${pend.length})</b>${pend.map((k) => `
      <div class="kpend"><div><b>${esc(k.name)}</b><small class="muted">${k.birth_year ? `Født ${k.birth_year} · ` : ''}Meldt ind af ${esc(guardianNames(k.id) || nameOf(k.created_by))}</small>${k.note ? `<small>"${esc(k.note)}"</small>` : ''}</div>
        <label class="kteam">Hold${teamSel(k, `data-pteam="${k.id}"`)}</label>
        <div class="mact"><button class="btn sm ghost" data-kno="${k.id}">Afvis</button><button class="btn sm primary" data-kok="${k.id}">Godkend</button></div></div>`).join('')}</div>` : ''}
    ${fee ? `<div class="card feesum"><b>💳 Kontingent ${esc(fee)}</b><small class="muted">${act.filter((k) => feeOf(k.id) === 'betalt').length} af ${act.length} har betalt${act.some((k) => feeOf(k.id) === 'afventer') ? ` · ${act.filter((k) => feeOf(k.id) === 'afventer').length} afventer` : ''}</small></div>` : ''}
    ${byTeam.map(({ t, ks }) => `<details class="card plist" ${S.kidsOpen?.[t?.id || 'none'] ? 'open' : ''} data-kt="${t?.id || 'none'}"><summary><b>${t ? esc(t.name) : 'Uden hold'} (${ks.length})</b></summary>
      <div class="list compact">${ks.map((k) => `<details class="prow"><summary><span class="grow"><b>${esc(k.name)}</b>${feeBadge(k)}<small>${k.birth_year ? `Født ${k.birth_year} · ` : ''}${esc(guardianNames(k.id) || '')}${k.player_id ? ' · eget login' : ''}</small></span><span class="muted">›</span></summary>
        <form class="ppanel kedit" data-kedit="${k.id}">
          <label>Navn<input name="name" value="${esc(k.name)}" required maxlength="60"></label>
          <div class="frow"><label class="grow">Fødselsår<input name="year" type="number" value="${k.birth_year || ''}"></label><label class="grow">Hold${teamSel(k, 'name="team"')}</label></div>
          ${fee ? `<div class="mact">${feeOf(k.id) === 'betalt' ? `<button type="button" class="btn sm" data-kfee="${k.id}|ubetalt">↩️ Ikke betalt</button>` : `<button type="button" class="btn sm" data-kfee="${k.id}|betalt">✓ Betalt</button>`}</div>` : ''}
          <div class="mact"><button type="button" class="btn sm ghost danger" data-kout="${k.id}">Meld ud</button><button class="btn sm primary">Gem</button></div>
        </form></details>`).join('')}</div></details>`).join('') || (pend.length ? '' : '<div class="card empty"><p class="muted">Ingen børn endnu. Del invitationslinket under fanen Medlemmer, så forældrene kan melde deres børn ind.</p></div>')}`;
}

export function bindClubKids(refresh) {
  const kid = (id) => C().kids.find((k) => k.id === id);
  app.querySelectorAll('details[data-kt]').forEach((d) => (d.ontoggle = () => { (S.kidsOpen ||= {})[d.dataset.kt] = d.open; }));
  app.querySelectorAll('[data-kok]').forEach((b) => (b.onclick = async () => {
    const team = app.querySelector(`[data-pteam="${b.dataset.kok}"]`)?.value || null;
    busy(b, true);
    try { await q(sb.rpc('padel_club_decide', { p_kid: b.dataset.kok, p_status: 'aktiv', p_team: team })); toast(`${kid(b.dataset.kok).name} er godkendt. Forældrene har fået besked`); await refresh(); } catch { busy(b, false); }
  }));
  app.querySelectorAll('[data-kno]').forEach((b) => (b.onclick = async () => {
    if (!confirm(`Afvis indmeldelsen af ${kid(b.dataset.kno).name}?`)) return;
    try { await q(sb.rpc('padel_club_decide', { p_kid: b.dataset.kno, p_status: 'afvist', p_team: null })); await refresh(); } catch {}
  }));
  app.querySelectorAll('form[data-kedit]').forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button.primary'); busy(btn, true);
    try { await q(sb.rpc('padel_club_set_kid', { p_kid: f.dataset.kedit, p_name: f.name.value, p_birth_year: f.year.value ? +f.year.value : null, p_team: f.team.value || null, p_status: 'aktiv' })); toast('Gemt'); await refresh(); } catch { busy(btn, false); }
  }));
  app.querySelectorAll('[data-kout]').forEach((b) => (b.onclick = async () => {
    const k = kid(b.dataset.kout);
    if (!confirm(`Meld ${k.name} ud af klubben?`)) return;
    try { await q(sb.rpc('padel_club_set_kid', { p_kid: k.id, p_name: k.name, p_birth_year: k.birth_year, p_team: k.team_id, p_status: 'udmeldt' })); toast(`${k.name} er meldt ud`); await refresh(); } catch {}
  }));
  app.querySelectorAll('[data-kfee]').forEach((b) => (b.onclick = async () => {
    const [id, st] = b.dataset.kfee.split('|');
    try { await q(sb.rpc('padel_club_fee_set', { p_kid: id, p_status: st })); await refresh(); } catch {}
  }));
}

// ---------- Admin: hold og træningstider ----------
const sessForm = (s, teamId) => `<form class="sform" data-sform="${s?.id || ''}" data-steam="${teamId}">
  <div class="frow"><label class="grow">Dag<select name="wd">${Object.entries(WEEKDAY).map(([k, v]) => `<option value="${k}" ${+k === (s?.weekday || 2) ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label>Fra<input name="st" type="time" value="${t5(s?.start_time) || '16:00'}" required></label><label>Til<input name="en" type="time" value="${t5(s?.end_time) || '17:00'}" required></label></div>
  <label>Sted <small class="muted">(valgfrit)</small><input name="place" value="${esc(s?.place || '')}" maxlength="80" placeholder="Fx Padelhuset Gilleleje, bane 1-2"></label>
  <div class="mact">${s ? '<button type="button" class="btn sm ghost danger" data-sdel>Fjern tiden</button>' : ''}<button class="btn sm primary">${s ? 'Gem' : 'Tilføj tid'}</button></div></form>`;

export function clubTeamsTab() {
  const teams = C().teams.filter((t) => !t.archived);
  const count = (t) => C().kids.filter((k) => k.status === 'aktiv' && k.team_id === t).length;
  return `
    ${teams.map((t) => {
      const ss = C().sessions.filter((s) => s.team_id === t.id && s.active).sort((a, b) => a.weekday - b.weekday || t5(a.start_time).localeCompare(t5(b.start_time)));
      return `<details class="card teamcard" data-team="${t.id}" ${S.teamOpen === t.id ? 'open' : ''}><summary><span class="grow"><b>${esc(t.name)}</b><small class="muted">${count(t.id)} børn · ${ss.length ? ss.map((s) => `${WEEKDAY[s.weekday].slice(0, 3).toLowerCase()} ${t5(s.start_time)}`).join(', ') : 'ingen tider'}</small></span><span class="muted">›</span></summary>
        ${ss.map((s) => `<details class="srow"><summary><span class="grow">${WEEKDAY[s.weekday]} ${t5(s.start_time)}–${t5(s.end_time)}${s.place ? `<small class="muted">${esc(s.place)}</small>` : ''}</span><span class="link sm">Ret</span></summary>${sessForm(s, t.id)}</details>`).join('')}
        <details class="srow new"><summary><span class="grow">➕ Tilføj træningstid</span></summary>${sessForm(null, t.id)}</details>
        <div class="mact"><button class="link sm" data-trename="${t.id}">Omdøb holdet</button><button class="link sm dn" data-tarch="${t.id}">Slet holdet</button></div>
      </details>`;
    }).join('')}
    <form class="card frow" id="newTeam"><input name="name" class="grow" placeholder="Nyt hold, fx U12 eller Begyndere" maxlength="60" required><button class="btn sm primary">Opret hold</button></form>`;
}

export function bindClubTeams(refresh) {
  const g = S.groupId;
  app.querySelectorAll('details[data-team]').forEach((d) => d.querySelector('summary').addEventListener('click', () => { S.teamOpen = d.open ? null : d.dataset.team; }));
  const nt = document.getElementById('newTeam');
  if (nt) nt.onsubmit = async (e) => {
    e.preventDefault();
    try { S.teamOpen = await q(sb.rpc('padel_club_save_team', { p_id: null, g, p_name: nt.name.value, p_archived: false })); toast('Holdet er oprettet. Tilføj træningstider'); await refresh(); } catch {}
  };
  app.querySelectorAll('[data-trename]').forEach((b) => (b.onclick = async () => {
    const t = team(b.dataset.trename), n = prompt('Holdets navn', t.name);
    if (n?.trim()) { try { await q(sb.rpc('padel_club_save_team', { p_id: t.id, g, p_name: n, p_archived: false })); await refresh(); } catch {} }
  }));
  app.querySelectorAll('[data-tarch]').forEach((b) => (b.onclick = async () => {
    const t = team(b.dataset.tarch);
    if (!confirm(`Slet holdet ${t.name}?\n\nBørnene på holdet bliver i klubben, men uden hold, indtil du sætter dem på et nyt.`)) return;
    try { await q(sb.rpc('padel_club_save_team', { p_id: t.id, g, p_name: t.name, p_archived: true })); await refresh(); } catch {}
  }));
  app.querySelectorAll('form[data-sform]').forEach((f) => {
    f.onsubmit = async (e) => {
      e.preventDefault();
      const btn = f.querySelector('button.primary'); busy(btn, true);
      try {
        await q(sb.rpc('padel_club_save_session', { p_id: f.dataset.sform || null, p_team: f.dataset.steam, p_weekday: +f.wd.value, p_start: f.st.value, p_end: f.en.value, p_place: f.place.value, p_active: true }));
        S.teamOpen = f.dataset.steam; toast('Træningstiden er gemt'); await refresh();
      } catch { busy(btn, false); }
    };
    f.querySelector('[data-sdel]')?.addEventListener('click', async () => {
      if (!confirm('Fjern træningstiden?')) return;
      try { await q(sb.rpc('padel_club_save_session', { p_id: f.dataset.sform, p_team: f.dataset.steam, p_weekday: +f.wd.value, p_start: f.st.value, p_end: f.en.value, p_place: f.place.value, p_active: false })); S.teamOpen = f.dataset.steam; await refresh(); } catch {}
    });
  });
}

// ---------- Admin: klubbens indstillinger (kontingent, info) ----------
export function clubSettingsCard() {
  if (!isAdmin()) return '';
  const gr = group();
  return `<details class="card gset" ${S.gsetOpen ? 'open' : ''}><summary><b>⚙️ Klubbens indstillinger</b><small class="muted">Kontingent: ${gr.club_fee ? `${kr(gr.club_fee)}${gr.club_fee_label ? ` · ${esc(gr.club_fee_label)}` : ''}` : 'ikke sat op'}</small></summary>
    <form id="clubSet">
      <div class="frow"><label class="grow">Kontingent (kr.)<input name="fee" type="number" min="0" value="${gr.club_fee || ''}" placeholder="Fx 600"></label><label class="grow">Periode<input name="label" maxlength="40" value="${esc(gr.club_fee_label || '')}" placeholder="Fx Efterår 2026"></label></div>
      <p class="muted small">Ny periode = alle skal betale igen. Forældrene ser kontingentet på Træning.</p>
      <label>Link til MobilePay Box <small class="muted">(valgfrit)</small><input name="url" type="url" value="${esc(gr.club_fee_url || '')}" placeholder="https://qr.mobilepay.dk/box/…"></label>
      <p class="muted small">Find linket i MobilePay: åbn boksen og tryk "Del boks".</p>
      <label>Om klubben <small class="muted">(vises øverst under Opslag)</small><textarea name="info" rows="4" maxlength="2000" placeholder="Fx kontaktinfo på trænerne, hvad man skal have med, regler ved afbud">${esc(gr.club_info || '')}</textarea></label>
      <button class="btn primary">Gem</button>
    </form></details>`;
}

export function bindClubSettings(refresh) {
  const f = document.getElementById('clubSet');
  if (!f) return;
  const d = f.closest('details'); d.ontoggle = () => (S.gsetOpen = d.open);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button'); busy(btn, true);
    try { await q(sb.rpc('padel_club_set_fee', { g: S.groupId, p_fee: f.fee.value ? +f.fee.value : null, p_label: f.label.value, p_url: f.url.value, p_info: f.info.value })); toast('Gemt'); await hooks.loadBase(); await refresh(); } catch { busy(btn, false); }
  };
}

// Antal børn der venter på godkendelse i klubber, hvor jeg er træner (til tallet på Admin)
export async function loadClubPending() {
  S.clubPending = 0;
  const clubs = S.groups.filter((x) => x.kind === 'klub' && !x.archived && canRun(x.id));
  if (!clubs.length) return;
  try { S.clubPending = (await q(sb.from('padel_club_kids').select('id').in('group_id', clubs.map((x) => x.id)).eq('status', 'ansoegt'))).length; } catch {}
}

// Invitationslink til klubben
export const clubInvite = (g) => ({
  qr: () => showQR(`${location.origin}/#/velkommen/${g}`, `Meld ind i ${group(g)?.name}`, 'Scan med telefonens kamera. Forældre opretter sig og melder deres barn ind.'),
  share: () => share(`${location.origin}/#/velkommen/${g}`, `Meld dit barn ind i ${group(g)?.name}! Opret dig (eller log ind) her, og udfyld indmeldelsen:`),
});
