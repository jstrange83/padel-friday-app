// Klub (juniorklub): træningstider med afbud og fremmøde, opslag fra trænerne, indmeldelse af børn og kontingent.
// Forældre melder børn ind; større børn kan få eget login via et link. Trænere = admin og superbruger i klubben.
import { sb, S, app, hooks, esc, toast, q, busy, group, canRun, isAdmin, roleIn, setGroup, groupBar, nameOf, share, fmtDate, fmtPhone, radios, viewMode } from '../core.js';
import { showQR } from '../qr.js';
import { parseSession, SR, listen } from '../sessionvoice.js';

// ---------- Datoer (altid dansk tid) ----------
export const todayISO = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen' }).format(new Date());
export const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const isoDow = (d) => new Date(d + 'T12:00:00Z').getUTCDay() || 7;
const dayLabel = (d) => new Intl.DateTimeFormat('da-DK', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
const t5 = (t) => String(t || '').slice(0, 5);
export const WEEKDAY = { 1: 'Mandag', 2: 'Tirsdag', 3: 'Onsdag', 4: 'Torsdag', 5: 'Fredag', 6: 'Lørdag', 7: 'Søndag' };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// Starttid i ms for en dato + klokkeslæt i dansk tid
const startMs = (day, time) => {
  const guess = Date.parse(`${day}T${t5(time)}:00Z`);
  const off = new Date(guess).toLocaleString('sv-SE', { timeZone: 'Europe/Copenhagen' }).replace(' ', 'T') + 'Z';
  return guess - (Date.parse(off) - guess);
};
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
  const [absence, attendance, cancels, fees, guardians, teamTrainers, staff, certs, kidInfo, trainers] = await Promise.all([
    sids.length && range ? q(inRange('padel_club_absence')) : [],
    sids.length && range ? q(inRange('padel_club_attendance')) : [],
    sids.length && range ? q(inRange('padel_club_cancellations')) : [],
    kidIds.length && gr?.club_fee_label ? q(sb.from('padel_club_fees').select('*').in('kid_id', kidIds).eq('label', gr.club_fee_label)) : [],
    kidIds.length ? q(sb.from('padel_club_guardians').select('*').in('kid_id', kidIds).eq('active', true)) : [],
    tids.length ? q(sb.from('padel_club_team_trainers').select('*').in('team_id', tids).eq('active', true)) : [],
    q(sb.from('padel_club_staff').select('*').eq('group_id', g)).catch(() => []),
    isAdmin(g) ? q(sb.from('padel_club_certs').select('*').eq('group_id', g)).catch(() => []) : [],
    kidIds.length ? q(sb.from('padel_club_kid_info').select('*').in('kid_id', kidIds)).catch(() => []) : [],
    q(sb.rpc('padel_club_trainer_contacts', { g })).catch(() => []),
  ]);
  // Arrangementer fra perioden og frem (med tilmeldinger og hjælpeopgaver)
  const evFrom = range ? new Date(`${range.from}T00:00:00Z`).toISOString() : new Date(Date.now() - 864e5).toISOString();
  const events = await q(sb.from('padel_club_events').select('*').eq('group_id', g).gte('starts_at', evFrom).order('starts_at')).catch(() => []);
  const eids = events.map((e) => e.id);
  const [signups, tasks, counts] = await Promise.all([
    eids.length ? q(sb.from('padel_club_event_signups').select('*').in('event_id', eids)).catch(() => []) : [],
    eids.length ? q(sb.from('padel_club_tasks').select('*').in('event_id', eids).eq('active', true).order('sort')).catch(() => []) : [],
    eids.length ? q(sb.rpc('padel_club_event_counts', { g })).catch(() => []) : [],
  ]);
  const tids2 = tasks.map((t) => t.id);
  const helpers = tids2.length ? await q(sb.from('padel_club_task_helpers').select('*').in('task_id', tids2).eq('active', true)).catch(() => []) : [];
  S.club = { g, teams, sessions, kids, absence, attendance, cancels, fees, guardians, teamTrainers, staff, certs, kidInfo, trainers: trainers || [], events, signups, tasks, helpers, counts: counts || [] };
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
// Svar på en træning: 'kommer', 'afbud' eller null (ikke svaret). Ingen er meldt til automatisk.
const answer = (sid, day, kid) => absOf(sid, day, kid)?.status || null;
const cancelOf = (sid, day) => C().cancels.find((c) => c.session_id === sid && c.day === day && c.cancelled);
const present = (sid, day, kid) => C().attendance.find((a) => a.session_id === sid && a.day === day && a.kid_id === kid)?.present;
const feeOf = (kid) => C().fees.find((f) => f.kid_id === kid)?.status || 'ubetalt';
const guardianNames = (kid) => C().guardians.filter((x) => x.kid_id === kid).map((x) => nameOf(x.user_id)).join(', ');
const evCount = (e) => C().counts.find((x) => x.event_id === e)?.n ?? C().signups.filter((x) => x.event_id === e && x.status === 'tilmeldt').length;
const signOf = (e, kid) => C().signups.find((x) => x.event_id === e && x.kid_id === kid && x.status === 'tilmeldt');
const isEvManager = (e) => myRight('arrangementer') || (e.team_id ? isTeamTrainer(e.team_id) : canRun());
const evTime = (iso) => new Intl.DateTimeFormat('da-DK', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Copenhagen' }).format(new Date(iso));
const evDay = (iso) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen' }).format(new Date(iso));
const infoOf = (kid) => C().kidInfo.find((x) => x.kid_id === kid)?.info || '';
// Træner for et bestemt hold: admin, eller træner sat på holdet (en træner uden hold må alle hold)
const myAssigned = () => C().teamTrainers.filter((x) => x.user_id === S.me?.id && C().teams.some((t) => t.id === x.team_id && !t.archived));
export const isTeamTrainer = (t) => isAdmin() || (roleIn(S.me?.id) === 'superbruger' && (!myAssigned().length || myAssigned().some((x) => x.team_id === t)));
const myTeams = () => C().teams.filter((t) => !t.archived && isTeamTrainer(t.id));
// Rettigheder formanden har givet (bestyrelse m.fl.). Admin har alle. Visning "Bruger" slår dem fra.
const RIGHT_COL = { kontingent: 'treasurer', opslag: 'can_post', arrangementer: 'can_events', godkende: 'can_approve' };
export const myRight = (r, g = S.groupId) => isAdmin(g) || (!S.viewAs && viewMode() !== 'bruger' && !!S.clubRights?.find((x) => x.group_id === g)?.[RIGHT_COL[r]]);
export const isTreasurer = (g = S.groupId) => myRight('kontingent', g);
export const hasAnyRight = (g = S.groupId) => Object.keys(RIGHT_COL).some((r) => myRight(r, g));
const trainersOf = (t) => C().trainers.filter((x) => x.team_ids.includes(t));
const GENDER_KID = { pige: 'Pige', dreng: 'Dreng' };
const age = (k) => { if (!k.birth_date) return k.birth_year ? `født ${k.birth_year}` : ''; const b = new Date(k.birth_date), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return `${a} år`; };
const fmtDay = (d) => (d ? new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z')) : '');
// Små mærker til trænerne: må ikke fotograferes, og noget vigtigt at vide
const kidFlags = (k) => `${k.photo_ok === false ? ' <span class="badge nophoto" title="Må ikke være på billeder">🚫📷</span>' : ''}${infoOf(k.id) ? ' <span class="badge warn" title="Godt at vide om barnet">⚠️</span>' : ''}`;
const trainerLinks = (x) => `<div class="coachrow"><span class="grow"><b>${esc(x.name)}</b>${x.role ? `<small class="muted">${esc(x.role)}</small>` : ''}${x.phone ? `<small class="muted">${fmtPhone(x.phone)}</small>` : ''}</span>${x.phone ? `<a class="btn sm" href="tel:${esc(x.phone)}">📞</a><a class="btn sm" href="sms:${esc(x.phone)}">💬</a>` : ''}</div>`;

// Alle træninger i perioden for de valgte hold
function occurrences(teamIds, from, to) {
  const out = [];
  const ss = C().sessions.filter((s) => s.active && teamIds.includes(s.team_id) && !team(s.team_id)?.archived);
  const inRange = (s, d) => (!s.valid_from || d >= s.valid_from) && (!s.valid_to || d <= s.valid_to);
  for (let d = from; d <= to; d = addDays(d, 1)) for (const s of ss) if (s.weekday === isoDow(d) && inRange(s, d)) out.push({ s, day: d });
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
  const liveTeams = trainer ? myTeams() : C().teams.filter((t) => !t.archived);
  if (trainer && S.trTeam && !liveTeams.some((t) => t.id === S.trTeam)) S.trTeam = null;
  const teamIds = trainer ? (S.trTeam ? [S.trTeam] : liveTeams.map((t) => t.id)) : [...new Set(active.map((k) => k.team_id).filter(Boolean))];
  const occ = occurrences(teamIds, from, to);
  // Arrangementer: hele klubben eller mine hold (trænere: deres hold), flettet ind efter dato
  const evs = C().events.filter((e) => (trainer ? (!e.team_id || teamIds.includes(e.team_id) || isAdmin()) : (!e.team_id || teamIds.includes(e.team_id))) && (trainer || !e.cancelled || evDay(e.starts_at) >= today));
  const items = [...occ.map((o) => ({ day: o.day, t: t5(o.s.start_time), o })), ...evs.map((e) => ({ day: evDay(e.starts_at), t: evTime(e.starts_at), e }))]
    .sort((a, b) => a.day.localeCompare(b.day) || a.t.localeCompare(b.t));
  const unpaid = gr.club_fee_label && gr.club_fee ? active.filter((k) => !k.trial && feeOf(k.id) !== 'betalt') : [];

  app.innerHTML = `
  <div class="page club">
    <div class="head"><h1>Træning</h1></div>
    ${groupBar(viewTraining)}
    ${mine.filter((k) => k.status === 'ansoegt' && !k.waitlist).map((k) => `<div class="card warnbox">⏳ <b>${esc(k.name)}</b> venter på, at en træner godkender indmeldelsen.</div>`).join('')}
    ${active.filter((k) => !k.team_id).map((k) => `<div class="card warnbox">👋 <b>${esc(k.name)}</b> er optaget. Træneren sætter snart ${k.player_id === S.me?.id ? 'dig' : 'barnet'} på et hold.</div>`).join('')}
    ${unpaid.length ? feeCard(gr, unpaid) : ''}
    ${trainer && liveTeams.length > 1 ? `<label class="teamsel"><span>Hold</span><select id="trTeamSel"><option value="">Alle hold (${liveTeams.length})</option>${liveTeams.map((t) => `<option value="${t.id}" ${S.trTeam === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>` : ''}
    ${trainer ? `<div class="trtools"><button class="link sm" id="evNew">➕ Arrangement</button><button class="link sm" id="trPast">${S.trPast ? '↑ Skjul tidligere' : '↓ Sidste 2 uger'}</button></div>` : ''}
    ${!trainer && myRight('arrangementer') ? '<div class="trtools"><button class="link sm" id="evNew">➕ Arrangement</button></div>' : ''}
    ${(trainer || myRight('arrangementer')) && S.evEdit !== undefined ? eventForm(S.evEdit) : ''}
    ${mine.filter((k) => k.status === 'ansoegt' && k.waitlist).map((k) => `<div class="card warnbox">⏳ <b>${esc(k.name)}</b> er på venteliste${team(k.team_id) ? ` til ${esc(team(k.team_id).name)}` : ''}. Du får besked, når der er plads.</div>`).join('')}
    ${active.filter((k) => k.trial).map((k) => `<div class="card infobox">👋 <b>${esc(k.name)}</b> er til prøvetræning${team(k.team_id) ? ` på ${esc(team(k.team_id).name)}` : ''}. Træneren melder ${k.player_id === S.me?.id ? 'dig' : 'barnet'} ind, når I er klar.</div>`).join('')}
    ${!trainer && items.some((x) => x.o) ? '<p class="muted small trhint">Svar ved hver træning: tryk <b>✓ Kommer</b> eller <b>Afbud</b>. Træneren kan se, hvem der har svaret.</p>' : ''}
    ${items.length ? items.map((x) => (x.e ? eventCard(x.e, trainer || myRight('arrangementer'), active, today) : trainer ? trainerCard(x.o, today) : parentCard(x.o, active, today))).join('')
      : `<div class="card empty"><p class="muted">${trainer ? (liveTeams.length ? 'Ingen træninger i perioden. Træningstiderne sættes under Admin → Hold og tider.' : 'Opret hold og træningstider under <a href="#/admin">Admin → Hold og tider</a>.')
        : active.length ? 'Der er ingen træninger de næste uger.' : mine.length ? 'Træningerne kommer her, når barnet er godkendt og sat på et hold.' : 'Du har ikke meldt nogen ind endnu.'}</p></div>`}
    ${items.length ? `<button class="btn ghost" id="trMore">Vis flere uger</button>` : ''}
    ${!trainer ? trainersCard(teamIds) : ''}
    <p class="center"><button class="link sm" id="calLink">📅 Få træningerne i din kalender</button></p>
    ${!trainer ? `<div class="card mykids"><div class="ftop"><b>👧 Mine børn</b><a class="link sm" href="#/boern">Ret oplysninger ›</a></div>
      ${mine.map((k) => `<div class="krow"><span class="grow">${kidLabel(k)}<small class="muted">${esc([team(k.team_id)?.name, k.status === 'ansoegt' ? (k.waitlist ? 'venteliste' : 'venter på godkendelse') : k.trial ? 'prøvetræning' : ''].filter(Boolean).join(' · '))}</small></span></div>`).join('')}
      <div class="mact"><a class="btn" href="#/klub-ind/${g}">➕ Meld et barn ind</a></div></div>` : ''}
  </div>`;
  bindTraining();
}

// Forældre: hvem er trænere på mine børns hold
function trainersCard(teamIds) {
  const rows = teamIds.map((t) => ({ t: team(t), ts: trainersOf(t) })).filter((x) => x.t && x.ts.length);
  if (!rows.length) return '';
  return `<div class="card trainers"><b>👥 Trænere</b>${rows.map((x) => `<div class="lbl">${esc(x.t.name)}</div>${x.ts.map(trainerLinks).join('')}`).join('')}
    ${S.viewAs ? '' : '<a class="btn sm block" href="#/ny-besked?til=traenere">✉️ Skriv til trænerne</a>'}</div>`;
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
// Kun admin ser, hvem der har oprettet en træning eller et arrangement (og hvem der aflyste)
const who = (u) => (u && S.profiles[u] ? S.profiles[u].name : '');
const byLine = (u, at, verb = 'Oprettet') => (isAdmin() && who(u) ? `<small class="muted byline">${verb} af ${esc(who(u))}${at ? ` · ${fmtDate(at, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</small>` : '');
const cancelLine = (c) => (c ? `<div class="trcancel">❌ Aflyst${c.note ? `: ${esc(c.note)}` : ''}${byLine(c.set_by, c.updated_at, 'Aflyst')}</div>` : '');

function parentCard(o, active, today) {
  const kids = active.filter((k) => k.team_id === o.s.team_id);
  const c = cancelOf(o.s.id, o.day);
  return `<div class="card tr ${c ? 'cancelled' : ''}">${head(o)}${cancelLine(c)}
    ${c ? '' : kids.map((k) => {
      const ans = answer(o.s.id, o.day, k.id), a = absOf(o.s.id, o.day, k.id);
      const yes = ans === 'kommer', no = ans === 'afbud';
      const key = `${o.s.id}|${o.day}|${k.id}`;
      return `<div class="krow"><span class="grow">${kidLabel(k)}${no && a?.reason ? `<small class="muted">${esc(a.reason)}</small>` : ''}${!ans && o.day >= today ? '<small class="unans">Ikke svaret</small>' : ''}</span>
        ${o.day < today ? `<span class="badge ${yes ? 'ok' : ''}">${yes ? 'Kommer' : no ? 'Afbud' : 'Ikke svaret'}</span>`
          : `<div class="yesno"><button class="btn sm ${yes ? 'on yes' : ''}" data-abs="${key}|kommer" aria-pressed="${yes}">✓ Kommer</button><button class="btn sm ${no ? 'on no' : ''}" data-abs="${key}|afbud" aria-pressed="${no}">Afbud</button></div>`}</div>`;
    }).join('')}
  </div>`;
}

function trainerCard(o, today) {
  const kids = C().kids.filter((k) => k.status === 'aktiv' && k.team_id === o.s.team_id);
  const c = cancelOf(o.s.id, o.day);
  const yesN = kids.filter((k) => answer(o.s.id, o.day, k.id) === 'kommer').length;
  const no = kids.filter((k) => answer(o.s.id, o.day, k.id) === 'afbud');
  const unans = kids.length - yesN - no.length;
  const key = `${o.s.id}|${o.day}`;
  const canMark = o.day <= today;
  const met = kids.filter((k) => present(o.s.id, o.day, k.id)).length;
  const open = S.trOpen === key;
  return `<details class="card tr trainer ${c ? 'cancelled' : ''}" data-tr="${key}" ${open ? 'open' : ''}><summary>${head(o)}
      <div class="trcount">${c ? '' : `<span class="ok">✓ ${yesN} kommer</span>${no.length ? `<span class="no">✗ ${no.length} afbud</span>` : ''}${unans ? `<span class="unans">? ${unans} ikke svaret</span>` : ''}${canMark ? `<span class="muted">· ${met} mødt</span>` : ''}`}<span class="muted">›</span></div>
    </summary>${cancelLine(c)}
    <div class="trlist">${kids.map((k) => {
      const a = absOf(o.s.id, o.day, k.id), ans = answer(o.s.id, o.day, k.id);
      return `<div class="krow"><span class="grow">${esc(k.name)}${k.trial ? ' <span class="badge trial">Prøve</span>' : ''}${kidFlags(k)}${ans === 'afbud' ? `<small class="no">${a?.late ? 'Sent afbud' : 'Afbud'}${a?.reason ? `: ${esc(a.reason)}` : ''}</small>` : ans === 'kommer' ? '<small class="ok">Kommer</small>' : '<small class="unans">Ikke svaret</small>'}${infoOf(k.id) ? `<small class="muted">⚠️ ${esc(infoOf(k.id))}</small>` : ''}</span>
        ${canMark && !c ? `<label class="present"><input type="checkbox" data-att="${key}|${k.id}" ${present(o.s.id, o.day, k.id) ? 'checked' : ''}><span>Mødt</span></label>` : ''}</div>`;
    }).join('') || '<p class="muted small">Ingen børn på holdet endnu.</p>'}</div>
    ${byLine(o.s.created_by, o.s.created_at)}
    <div class="mact">${c ? `<button class="btn sm" data-cancel="${key}|0">↩️ Træningen er alligevel ikke aflyst</button>` : o.day >= today ? `<button class="btn sm ghost danger" data-cancel="${key}|1">Aflys træningen</button>` : ''}</div>
  </details>`;
}

function bindTraining() {
  bindEvents(viewTraining);
  const ts = document.getElementById('trTeamSel'); if (ts) ts.onchange = () => { S.trTeam = ts.value || null; viewTraining(); };
  document.getElementById('trPast')?.addEventListener('click', () => { S.trPast = !S.trPast; viewTraining(); });
  document.getElementById('trMore')?.addEventListener('click', () => { S.trWeeks += 2; viewTraining(); });
  document.getElementById('calLink')?.addEventListener('click', showCalendar);
  app.querySelectorAll('details[data-tr]').forEach((d) => d.querySelector('summary').addEventListener('click', () => { S.trOpen = d.open ? null : d.dataset.tr; }));
  app.querySelectorAll('[data-abs]').forEach((b) => (b.onclick = async () => {
    const [sid, day, kid, st] = b.dataset.abs.split('|');
    if (b.classList.contains('on')) {
      const nm = (C().kids.find((k) => k.id === kid)?.name || '').split(' ')[0];
      return toast(st === 'kommer' ? `${nm} er allerede meldt til` : `Der er allerede givet afbud for ${nm}`);
    }
    // Afbudsfrist: for sent er stadig muligt, men træneren får besked
    let reason = null;
    const hrs = group().club_absence_hours, s = session(sid);
    if (st === 'afbud' && hrs && s && Date.now() > startMs(day, s.start_time) - hrs * 3600e3) {
      reason = prompt(`Afbudsfristen er ${hrs} ${hrs === 1 ? 'time' : 'timer'} før træning, så træneren får besked om det sene afbud.\n\nSkriv evt. en kort grund:`, '');
      if (reason === null) return;
    }
    busy(b, true);
    try {
      await q(sb.rpc('padel_club_set_absence', { p_session: sid, p_day: day, p_kid: kid, p_status: st, p_reason: reason }));
      toast(st === 'afbud' ? (reason !== null ? 'Afbud er givet, og træneren har fået besked' : 'Afbud er givet') : 'Godt, vi ses! 🎾');
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

// ---------- Arrangementer ----------
const evWhen = (e) => `${cap(dayLabel(evDay(e.starts_at)))} kl. ${evTime(e.starts_at)}${e.ends_at ? `–${evTime(e.ends_at)}` : ''}`;
function eventCard(e, trainer, active, today) {
  const n = evCount(e.id), full = e.max_kids && n >= e.max_kids;
  const late = e.deadline && Date.now() > Date.parse(e.deadline);
  const kids = active.filter((k) => !e.team_id || k.team_id === e.team_id);
  const gr = group();
  const tasks = C().tasks.filter((t) => t.event_id === e.id);
  const helpersOf = (t) => C().helpers.filter((h) => h.task_id === t.id);
  const meta = [e.place, e.price ? kr(e.price) : 'Gratis', e.max_kids ? `${n}/${e.max_kids} pladser` : `${n} tilmeldt`, e.deadline ? `tilmelding senest ${fmtDate(e.deadline, { day: 'numeric', month: 'short' })}` : ''].filter(Boolean);
  const mgr = trainer && isEvManager(e);
  const open = S.evOpen === e.id;
  const body = `
    ${e.cancelled ? '<div class="trcancel">❌ Aflyst</div>' : ''}
    ${e.description ? `<p class="ptext">${rich(e.description)}</p>` : ''}
    ${byLine(e.created_by, e.created_at)}
    ${!e.cancelled ? kids.map((k) => {
      const sg = signOf(e.id, k.id);
      return `<div class="krow"><span class="grow">${kidLabel(k)}${sg && e.price ? `<small class="muted">${{ betalt: '✓ Betalt', afventer: '⏳ Betaling afventer', ubetalt: 'Ikke betalt' }[sg.paid]}</small>` : ''}</span>
        ${late && !sg ? '<span class="badge">Frist overskredet</span>' : `<div class="yesno"><button class="btn sm ${sg ? 'on yes' : ''}" data-evsign="${e.id}|${k.id}|tilmeldt" ${!sg && full ? 'disabled' : ''}>${sg ? '✓ Tilmeldt' : full ? 'Fuldt' : 'Tilmeld'}</button><button class="btn sm" data-evsign="${e.id}|${k.id}|afmeldt" ${sg ? '' : 'disabled'}>Afmeld</button></div>`}</div>
        ${sg && e.price && sg.paid === 'ubetalt' ? `<div class="mact">${gr.club_fee_url ? `<a class="btn sm primary" href="${esc(gr.club_fee_url)}" target="_blank" rel="noopener" data-evpay="${e.id}|${k.id}">💳 Betal ${kr(e.price)}</a>` : ''}<button class="btn sm" data-evpay="${e.id}|${k.id}" data-only>Har betalt</button></div>` : ''}`;
    }).join('') : ''}
    ${tasks.length && !e.cancelled ? `<div class="lbl">🙋 Forældrehjælp</div>${tasks.map((t) => {
      const hs = helpersOf(t), mineH = hs.some((h) => h.user_id === S.me?.id);
      return `<div class="krow task"><span class="grow"><b>${esc(t.title)}</b> <small class="muted">${hs.length}/${t.slots}</small>${hs.length ? `<small class="muted">${hs.map((h) => esc(nameOf(h.user_id).split(' ')[0])).join(', ')}</small>` : ''}</span>
        ${mineH ? `<button class="btn sm on yes" data-task="${t.id}|0">✓ Hjælper</button>` : `<button class="btn sm" data-task="${t.id}|1" ${hs.length >= t.slots ? 'disabled' : ''}>${hs.length >= t.slots ? 'Fyldt' : 'Jeg hjælper'}</button>`}</div>`;
    }).join('')}` : ''}
    ${mgr ? eventAdmin(e) : ''}`;
  return `<details class="card tr event ${e.cancelled ? 'cancelled' : ''}" data-ev="${e.id}" ${open || !trainer ? 'open' : ''}><summary>
      <div class="trhead"><b>📅 ${esc(e.title)}</b><span class="badge">${esc(team(e.team_id)?.name || 'Hele klubben')}</span></div>
      <small class="muted">${evWhen(e)}</small><small class="muted">${meta.map(esc).join(' · ')}</small></summary>${body}</details>`;
}

// Træneren: deltagerliste med betaling, rediger og aflys
function eventAdmin(e) {
  const list = C().signups.filter((x) => x.event_id === e.id && x.status === 'tilmeldt').map((x) => ({ x, k: C().kids.find((k) => k.id === x.kid_id) })).filter((y) => y.k).sort((a, b) => a.k.name.localeCompare(b.k.name));
  return `<div class="evadmin"><div class="lbl">Tilmeldte (${list.length})</div>
    ${list.map(({ x, k }) => `<div class="krow"><span class="grow">${esc(k.name)}${kidFlags(k)}</span>${e.price ? (x.paid === 'betalt' ? `<button class="btn sm on yes" data-evpaid="${e.id}|${k.id}|ubetalt">✓ Betalt</button>` : `<button class="btn sm" data-evpaid="${e.id}|${k.id}|betalt">${x.paid === 'afventer' ? '⏳ Bekræft' : 'Betalt?'}</button>`) : ''}</div>`).join('') || '<p class="muted small">Ingen tilmeldte endnu.</p>'}
    <div class="mact"><button class="btn sm" data-evedit="${e.id}">✏️ Ret</button>${e.cancelled ? `<button class="btn sm" data-evcancel="${e.id}|0">↩️ Genopret</button>` : `<button class="btn sm ghost danger" data-evcancel="${e.id}|1">Aflys</button>`}</div></div>`;
}

function eventForm(id) {
  const e = id ? C().events.find((x) => x.id === id) : null;
  const tasks = e ? C().tasks.filter((t) => t.event_id === e.id) : [];
  const dIn = (iso) => (iso ? evDay(iso) : ''), tIn = (iso) => (iso ? evTime(iso) : '');
  return `<form class="card evform" id="evForm" data-id="${e?.id || ''}"><b>${e ? '✏️ Ret arrangement' : '➕ Nyt arrangement'}</b>
    <label>Titel<input name="title" required maxlength="100" value="${esc(e?.title || '')}" placeholder="Fx Klubmesterskab eller sommerafslutning"></label>
    <label>For<select name="team"><option value="">Hele klubben</option>${(myRight('arrangementer') ? C().teams.filter((t) => !t.archived) : myTeams()).map((t) => `<option value="${t.id}" ${e?.team_id === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
    <div class="frow"><label class="grow">Dato<input name="day" type="date" required value="${dIn(e?.starts_at)}"></label><label>Fra<input name="st" type="time" required value="${tIn(e?.starts_at) || '10:00'}"></label><label>Til<input name="en" type="time" value="${tIn(e?.ends_at)}"></label></div>
    <label>Sted<input name="place" maxlength="100" value="${esc(e?.place || '')}" placeholder="Fx Padelhuset Gilleleje"></label>
    <label>Beskrivelse <small class="muted">(valgfri)</small><textarea name="desc" rows="3" maxlength="2000">${esc(e?.description || '')}</textarea></label>
    <div class="frow"><label class="grow">Pris (kr.)<input name="price" type="number" min="0" value="${e?.price || ''}" placeholder="0 = gratis"></label><label class="grow">Maks. antal<input name="max" type="number" min="0" value="${e?.max_kids || ''}" placeholder="Ingen grænse"></label></div>
    <label>Tilmelding senest <small class="muted">(valgfri)</small><input name="deadline" type="date" value="${dIn(e?.deadline)}"></label>
    <label>Forældrehjælp <small class="muted">(én opgave pr. linje: opgave, antal)</small><textarea name="tasks" rows="3" placeholder="Kørsel, 3&#10;Kage, 2">${tasks.map((t) => `${esc(t.title)}, ${t.slots}`).join('\n')}</textarea></label>
    <div class="mact"><button type="button" class="btn ghost" id="evCancel">Annuller</button><button class="btn primary">${e ? 'Gem' : 'Opret'}</button></div></form>`;
}

// Dato + klokkeslæt i dansk tid → ISO
const cphISO = (day, time) => new Date(startMs(day, time)).toISOString();

function bindEvents(rerender) {
  document.getElementById('evNew')?.addEventListener('click', () => { S.evEdit = null; rerender(); });
  document.getElementById('evCancel')?.addEventListener('click', () => { S.evEdit = undefined; rerender(); });
  app.querySelectorAll('details[data-ev]').forEach((d) => d.querySelector('summary').addEventListener('click', () => { S.evOpen = d.open ? null : d.dataset.ev; }));
  const f = document.getElementById('evForm');
  if (f) f.onsubmit = async (ev) => {
    ev.preventDefault();
    const old = f.dataset.id ? C().events.find((x) => x.id === f.dataset.id) : null;
    const oldTasks = old ? C().tasks.filter((t) => t.event_id === old.id) : [];
    const tasks = f.tasks.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const m = l.match(/^(.*?)[,;:]\s*(\d+)\s*$/); const title = (m ? m[1] : l).trim();
      return { id: oldTasks.find((t) => t.title.toLowerCase() === title.toLowerCase())?.id || null, title, slots: m ? +m[2] : 1 };
    });
    const btn = f.querySelector('button.primary'); busy(btn, true);
    try {
      const id = await q(sb.rpc('padel_club_save_event', { p_id: old?.id || null, g: S.groupId, p_team: f.team.value || null, p_title: f.title.value, p_desc: f.desc.value,
        p_starts: cphISO(f.day.value, f.st.value), p_ends: f.en.value ? cphISO(f.day.value, f.en.value) : null, p_place: f.place.value,
        p_deadline: f.deadline.value ? cphISO(f.deadline.value, '23:59') : null, p_price: +f.price.value || 0, p_max: +f.max.value || 0, p_cancelled: old?.cancelled || false, p_tasks: tasks }));
      S.evEdit = undefined; S.evOpen = id; toast(old ? 'Arrangementet er gemt' : 'Arrangementet er oprettet, og holdet har fået besked'); rerender();
    } catch { busy(btn, false); }
  };
  app.querySelectorAll('[data-evedit]').forEach((b) => (b.onclick = () => { S.evEdit = b.dataset.evedit; rerender(); window.scrollTo(0, 0); }));
  app.querySelectorAll('[data-evcancel]').forEach((b) => (b.onclick = async () => {
    const [id, on] = b.dataset.evcancel.split('|'), e = C().events.find((x) => x.id === id);
    if (on === '1' && !confirm(`Aflys ${e.title}? Alle får besked.`)) return;
    const tasks = C().tasks.filter((t) => t.event_id === id).map((t) => ({ id: t.id, title: t.title, slots: t.slots }));
    try { await q(sb.rpc('padel_club_save_event', { p_id: id, g: S.groupId, p_team: e.team_id, p_title: e.title, p_desc: e.description, p_starts: e.starts_at, p_ends: e.ends_at, p_place: e.place, p_deadline: e.deadline, p_price: e.price || 0, p_max: e.max_kids || 0, p_cancelled: on === '1', p_tasks: tasks })); rerender(); } catch {}
  }));
  app.querySelectorAll('[data-evsign]').forEach((b) => (b.onclick = async () => {
    const [e, k, st] = b.dataset.evsign.split('|');
    if (b.classList.contains('on')) return;
    busy(b, true);
    try { await q(sb.rpc('padel_club_event_signup', { p_event: e, p_kid: k, p_status: st })); S.evOpen = e; toast(st === 'tilmeldt' ? 'Tilmeldt 🎉' : 'Afmeldt'); rerender(); } catch { busy(b, false); }
  }));
  app.querySelectorAll('[data-evpay]').forEach((b) => (b.onclick = async (ev) => {
    if (b.dataset.only !== undefined) ev.preventDefault();
    const [e, k] = b.dataset.evpay.split('|');
    try { await q(sb.rpc('padel_club_event_paid', { p_event: e, p_kid: k, p_status: 'afventer' })); } catch { return; }
    S.evOpen = e; toast('Tak! Træneren bekræfter betalingen'); setTimeout(rerender, b.tagName === 'A' ? 600 : 0);
  }));
  app.querySelectorAll('[data-evpaid]').forEach((b) => (b.onclick = async () => {
    const [e, k, st] = b.dataset.evpaid.split('|');
    try { await q(sb.rpc('padel_club_event_paid', { p_event: e, p_kid: k, p_status: st })); S.evOpen = e; rerender(); } catch {}
  }));
  app.querySelectorAll('[data-task]').forEach((b) => (b.onclick = async () => {
    const [t, on] = b.dataset.task.split('|');
    busy(b, true);
    try { await q(sb.rpc('padel_club_task_help', { p_task: t, p_on: on === '1' })); S.evOpen = C().tasks.find((x) => x.id === t)?.event_id; toast(on === '1' ? 'Tak for hjælpen! 🙌' : 'Du er taget af opgaven'); rerender(); } catch { busy(b, false); }
  }));
}

// ---------- Opslag ----------
export async function viewPosts() {
  const g = S.groupId, gr = group(), trainer = canRun() || myRight('opslag');
  const [, posts, board] = await Promise.all([
    loadClub(g),
    q(sb.from('padel_club_posts').select('*').eq('group_id', g).eq('hidden', false).order('created_at', { ascending: false }).limit(60)),
    q(sb.rpc('padel_club_board_contacts', { g })).catch(() => []),
  ]);
  const teams = C().teams;
  const tname = (id) => teams.find((t) => t.id === id)?.name;
  const list = [...posts.filter((p) => p.pinned), ...posts.filter((p) => !p.pinned)];
  app.innerHTML = `
  <div class="page club">
    <h1>Opslag</h1>
    ${groupBar(viewPosts)}
    ${gr.club_info ? `<div class="card clubinfo"><b>ℹ️ Om ${esc(gr.name)}</b><p>${rich(gr.club_info)}</p></div>` : ''}
    ${(board || []).length || C().trainers.length ? `<details class="card people" ${S.peopleOpen ? 'open' : ''}><summary><b>👥 Bestyrelse og trænere</b><span class="muted">›</span></summary>
      ${(board || []).length ? `<div class="lbl">Bestyrelse</div>${board.map((x) => trainerLinks({ ...x, name: `${x.name}`, role: x.title })).join('')}` : ''}
      ${C().trainers.length ? `<div class="lbl">Trænere</div>${C().trainers.map((x) => trainerLinks({ ...x, role: x.team_ids.map((t) => team(t)?.name).filter(Boolean).join(', ') })).join('')}` : ''}
      ${S.viewAs ? '' : '<a class="btn sm block" href="#/ny-besked">✉️ Skriv til klubben</a>'}
    </details>` : ''}
    ${trainer ? `<details class="card postnew" ${S.postOpen ? 'open' : ''}><summary><b>✏️ Skriv et opslag</b><span class="muted">›</span></summary>
      <form id="postForm">
        <label>Til<select name="team"><option value="">Hele klubben</option>${(myRight('opslag') ? teams.filter((t) => !t.archived) : myTeams()).map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
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
  const ppl = app.querySelector('details.people');
  if (ppl) ppl.ontoggle = () => (S.peopleOpen = ppl.open);
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
// Felter om ét barn (bruges både ved indmeldelse og når forældre retter)
export const kidFormFields = (k = {}, i = 0, collect = false) => `
  <label>Navn<input name="kname" required maxlength="60" autocomplete="off" value="${esc(k.name || '')}"></label>
  <div class="frow"><label class="grow">Fødselsdato<input name="kbirth" type="date" required value="${k.birth_date || ''}" max="${todayISO()}"></label></div>
  <div class="lbl">Køn</div>${radios(`kgender${i}`, GENDER_KID, k.gender || '')}
  <div class="lbl">Må barnet være på billeder fra klubben?</div>${radios(`kphoto${i}`, { ja: 'Ja', nej: 'Nej' }, k.photo_ok === true ? 'ja' : k.photo_ok === false ? 'nej' : '')}
  <label>Godt at vide om barnet <small class="muted">(valgfri, fx allergi eller særlige behov. Gemmes, og kun barnets trænere kan se det)</small><textarea name="kinfo" class="kta" rows="2" maxlength="1000" placeholder="Fx astma, har inhalator med">${esc(k.info || '')}</textarea></label>
  ${collect ? `<label>Adresse <small class="muted">(bruges til kommunens tilskud)</small><input name="kaddr" required maxlength="200" autocomplete="street-address" value="${esc(k.address || '')}" placeholder="Vej og nr., postnr. og by"></label>` : ''}`;
const kidFields = (i, collect) => `<fieldset class="kidf"><legend>Barn ${i + 1}</legend>${kidFormFields({}, i, collect)}
  <label class="switch"><input type="checkbox" name="ktrial"><span>Vi vil gerne prøve 1-2 træninger først</span></label>
  <label>Ønsker til indmeldelsen <small class="muted">(valgfri, fx hold eller erfaring)</small><input name="knote" maxlength="500" placeholder="Fx har spillet et år, vil gerne på hold med Oscar"></label></fieldset>`;
const readKid = (root, i) => ({
  name: root.querySelector('[name=kname]').value, birth_date: root.querySelector('[name=kbirth]').value || null,
  gender: root.querySelector(`[name=kgender${i}]:checked`)?.value || null,
  photo_ok: root.querySelector(`[name=kphoto${i}]:checked`) ? root.querySelector(`[name=kphoto${i}]:checked`).value === 'ja' : null,
  info: root.querySelector('[name=kinfo]').value, address: root.querySelector('[name=kaddr]')?.value || null, note: root.querySelector('[name=knote]')?.value || null,
  trial: !!root.querySelector('[name=ktrial]')?.checked,
});

const myGroupsIds = () => S.members.filter((m) => m.player_id === S.me?.id && m.status === 'aktiv').map((m) => m.group_id);
export async function viewClubJoin(g) {
  // Uden klub i adressen: vælg blandt de klubber, der kan findes i appen
  const pick = !g;
  let clubs = [];
  if (!g) {
    const list = await joinableClubs();
    clubs = await Promise.all(list.map(async (c) => ({ id: c.id, ...(await q(sb.rpc('padel_club_join_info', { g: c.id })).catch(() => ({ name: c.name }))) })));
    if (!clubs.length) {
      app.innerHTML = `<div class="page club"><button class="back" onclick="history.back()">‹ Tilbage</button><h1>Meld et barn ind</h1>
        <div class="card empty"><p class="muted">Der er ingen klubber at vælge lige nu. Få et link fra klubbens trænere.</p></div></div>`;
      return;
    }
    g = S.joinClub && clubs.some((c) => c.id === S.joinClub) ? S.joinClub : clubs.length === 1 ? clubs[0].id : '';
  } else {
    let info = null;
    try { info = await q(sb.rpc('padel_club_join_info', { g })); } catch {}
    clubs = [{ id: g, name: info?.name || group(g)?.name, collect_address: !!(info?.collect_address ?? group(g)?.club_collect_address) }];
  }
  const fixed = !pick;
  const cur = clubs.find((c) => c.id === g);
  const collect = !!cur?.collect_address;
  app.innerHTML = `
  <div class="page club">
    <button class="back" onclick="history.length > 1 ? history.back() : (location.hash = '#/profil')">‹ Tilbage</button>
    <h1>${fixed && cur ? `Meld ind i ${esc(cur.name)}` : 'Meld et barn ind'}</h1>
    <p class="muted">Udfyld for hvert barn. En træner godkender indmeldelsen og sætter barnet på et hold, og du får besked her i appen.</p>
    <form id="joinForm" class="card">
      ${fixed ? '' : `<label>Klub<select name="club" required><option value="">Vælg klub…</option>${clubs.map((c) => `<option value="${c.id}" ${c.id === g ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>`}
      <div id="kidList">${kidFields(0, collect)}</div>
      <div><button type="button" class="btn ghost" id="moreKid">➕ Tilføj et barn mere</button></div>
      <p class="muted small">Oplysningerne bruges kun af klubben. Læs mere i <a href="#/privatliv">privatlivspolitikken</a>. Større børn kan senere få deres eget login.</p>
      <button class="btn primary">Send indmeldelse</button>
    </form>
    ${fixed && !myGroupsIds().includes(g) ? `<div class="card adultjoin"><b>Træner eller i bestyrelsen?</b>
      <p class="muted small">Skal du ikke melde et barn ind, men selv være med som træner, hjælper eller i bestyrelsen, så bed om adgang. Klubbens admin får besked og godkender dig.</p>
      <button class="btn" id="adultJoin">🙋 Bed om adgang</button></div>` : ''}
  </div>`;
  document.getElementById('adultJoin')?.addEventListener('click', async (e) => {
    busy(e.currentTarget, true);
    try {
      await q(sb.rpc('padel_request_join', { g }));
      toast('Du har bedt om adgang. Klubbens admin godkender dig');
      await hooks.loadBase(); location.hash = '#/profil';
    } catch { busy(e.currentTarget, false); }
  });
  const f = document.getElementById('joinForm');
  // Skift klub: tegn felterne igen (adresse kan være krævet i den ene klub)
  if (f.club) f.club.onchange = () => { S.joinClub = f.club.value; viewClubJoin(null); };
  document.getElementById('moreKid').onclick = () => { const list = document.getElementById('kidList'); list.insertAdjacentHTML('beforeend', kidFields(list.children.length, collect)); list.lastElementChild.querySelector('input').focus(); };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const gid = f.club ? f.club.value : g;
    if (!gid) return toast('Vælg en klub', true);
    const kids = [...f.querySelectorAll('.kidf')].map((fs, i) => readKid(fs, i));
    const btn = f.querySelector('button.primary'); busy(btn, true);
    try {
      await q(sb.rpc('padel_club_apply_v3', { g: gid, p_kids: kids }));
      toast('Tak! En træner godkender indmeldelsen');
      S.joinClub = null;
      await hooks.loadBase();
      if (S.groups.some((x) => x.id === gid) && S.members.some((m) => m.group_id === gid && m.player_id === S.me.id && m.status === 'aktiv')) setGroup(gid);
      location.hash = '#/traening';
      hooks.route();
    } catch { busy(btn, false); }
  };
}

// ---------- Find en klub: diskret linje under Profil (klubberne ses først på indmeldelsen) ----------
export async function discoverList() {
  if (!S.viewAs) { try { return (await q(sb.rpc('padel_discover_clubs'))) || []; } catch { return []; } }
  // "Se som": regn det ud for den viste person (samme regler som i databasen)
  const me = S.me, dismissed = me.dismissed_clubs || [];
  const cands = S.groups.filter((g) => g.kind === 'klub' && g.club_discoverable && !g.archived && !dismissed.includes(g.id)
    && !S.members.some((m) => m.group_id === g.id && m.player_id === me.id && ['aktiv', 'afventer'].includes(m.status)));
  if (!cands.length) return [];
  try {
    const gds = await q(sb.from('padel_club_guardians').select('kid_id').eq('user_id', me.id).eq('active', true));
    const kids = gds.length ? await q(sb.from('padel_club_kids').select('group_id,status').in('id', gds.map((x) => x.kid_id))) : [];
    return cands.filter((g) => !kids.some((k) => k.group_id === g.id && ['ansoegt', 'aktiv'].includes(k.status))).map((g) => ({ id: g.id, name: g.name }));
  } catch { return cands.map((g) => ({ id: g.id, name: g.name })); }
}
// Klubber man kan melde et barn ind i: dem der kan findes + dem man selv er med i
export async function joinableClubs() {
  const mine = S.groups.filter((g) => g.kind === 'klub' && !g.archived && S.members.some((m) => m.group_id === g.id && m.player_id === S.me?.id && m.status === 'aktiv')).map((g) => ({ id: g.id, name: g.name }));
  const disc = await discoverList();
  return [...mine, ...disc.filter((d) => !mine.some((m) => m.id === d.id))];
}
export async function discoverRow() {
  return (await joinableClubs()).length ? '<a class="row" href="#/klub-ind" id="discRow"><span class="grow">🧒 Meld et barn ind i en klub</span><span class="muted">›</span></a>' : '';
}

// ---------- Mine børn (på profilen) ----------
// Egen side: Mine børn (ret oplysninger, eget login, anden forælder, meld ind og ud)
export async function viewMyKids() {
  const h = await myKidsSection(true);
  app.innerHTML = `<div class="page club">
    <button class="back" onclick="history.length > 1 ? history.back() : (location.hash = '#/traening')">‹ Tilbage</button>
    <h1>👧 Mine børn</h1>
    ${h || '<div class="card empty"><p class="muted">Du har ikke meldt nogen børn ind endnu. Brug klubbens invitationslink for at melde dit barn ind.</p></div>'}
  </div>`;
  bindMyKids(viewMyKids);
}

export async function myKidsSection(page = false) {
  let kids = [];
  try { kids = await q(sb.from('padel_club_kids').select('*').in('status', ['ansoegt', 'aktiv']).order('name')); } catch { return ''; }
  const ids = kids.map((k) => k.id);
  const [gds, infos] = ids.length ? await Promise.all([
    q(sb.from('padel_club_guardians').select('*').in('kid_id', ids).eq('active', true)),
    q(sb.from('padel_club_kid_info').select('*').in('kid_id', ids)).catch(() => []),
  ]) : [[], []];
  const mineK = kids.filter((k) => k.player_id !== S.me.id && gds.some((x) => x.kid_id === k.id && x.user_id === S.me.id));
  // Kun klubber, man selv er med i eller har børn i (ikke alle klubber, superadmin kan se)
  const clubs = S.groups.filter((x) => x.kind === 'klub' && !x.archived && (S.members.some((m) => m.group_id === x.id && m.player_id === S.me.id && m.status === 'aktiv') || mineK.some((k) => k.group_id === x.id)));
  if (!mineK.length) return '';
  // Hold og trænere pr. klub
  const per = {};
  for (const g of [...new Set(mineK.map((k) => k.group_id))]) {
    const [teams, trainers] = await Promise.all([q(sb.from('padel_club_teams').select('*').eq('group_id', g)).catch(() => []), q(sb.rpc('padel_club_trainer_contacts', { g })).catch(() => [])]);
    per[g] = { teams, trainers: trainers || [] };
  }
  S.myKids = mineK.map((k) => ({ ...k, info: infos.find((x) => x.kid_id === k.id)?.info || '' }));
  return `${page ? '' : '<h3>Mine børn</h3>'}
    ${S.myKids.map((k, i) => {
      const tm = per[k.group_id]?.teams.find((t) => t.id === k.team_id);
      const ts = (per[k.group_id]?.trainers || []).filter((x) => x.team_ids.includes(k.team_id));
      return `<details class="card kidcard" ${page && S.myKids.length === 1 ? 'open' : ''}><summary><span class="grow"><b>${esc(k.name)}</b><small class="muted">${esc(group(k.group_id)?.name || 'Klub')}${tm ? ` · ${esc(tm.name)}` : ''}${k.status === 'ansoegt' ? ' · ⏳ venter på godkendelse' : ''}${k.player_id ? ' · har eget login' : ''}</small></span><span class="muted">›</span></summary>
      ${ts.length ? `<div class="lbl">Trænere</div>${ts.map(trainerLinks).join('')}` : ''}
      <details class="kidedit"><summary><span class="link sm">✏️ Ret ${esc(k.name.split(' ')[0])}s oplysninger</span></summary>
        <form data-kidform="${k.id}">${kidFormFields(k, 100 + i, !!group(k.group_id)?.club_collect_address || !!k.address)}<button class="btn primary">Gem</button></form></details>
      <div class="mact"><button class="btn sm" data-kidlogin="${k.id}">📱 ${k.player_id ? 'Nyt login' : 'Eget login'}</button><button class="btn sm" data-kidparent="${k.id}">👪 Forælder 2</button></div>
      <p class="muted small">Med eget login kan barnet selv se træninger og give afbud (vis koden, eller <button class="link sm" data-kidshare="${k.id}">send linket</button>). Den anden forælder får samme adgang som dig.</p>
      <div class="mact"><button class="link sm dn" data-kidleave="${k.id}">Meld ${esc(k.name.split(' ')[0])} ud</button></div>
    </details>`;
    }).join('')}
    ${page ? `<a class="btn ghost kidjoin" href="#/klub-ind">➕ Meld et barn mere ind</a>` : ''}`;
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
  app.querySelectorAll('form[data-kidform]').forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault();
    const i = S.myKids.findIndex((x) => x.id === f.dataset.kidform), k = readKid(f, 100 + i);
    const btn = f.querySelector('button.primary'); busy(btn, true);
    try { await q(sb.rpc('padel_club_update_kid', { p_kid: f.dataset.kidform, p_name: k.name, p_birth_date: k.birth_date, p_gender: k.gender, p_photo_ok: k.photo_ok, p_info: k.info, p_address: k.address })); toast('Oplysningerne er gemt'); rerender(); } catch { busy(btn, false); }
  }));
  app.querySelectorAll('[data-kidleave]').forEach((b) => (b.onclick = async () => {
    const k = S.myKids.find((x) => x.id === b.dataset.kidleave);
    if (!confirm(`Meld ${k.name} ud af klubben?`)) return;
    try { await q(sb.rpc('padel_club_leave', { p_kid: k.id })); toast(`${k.name} er meldt ud`); rerender(); } catch {}
  }));
}

// ---------- Admin: børn ----------
const feeBadge = (k) => (group().club_fee_label ? { betalt: '<span class="badge ok">💳 Betalt</span>', afventer: '<span class="badge warn">💳 Afventer</span>', ubetalt: '<span class="badge">💳 Mangler</span>' }[feeOf(k.id)] : '');
const kidMeta = (k) => [age(k), GENDER_KID[k.gender], guardianNames(k.id), k.player_id ? 'eget login' : ''].filter(Boolean).map(esc).join(' · ');

export function clubKidsTab() {
  if (!canRun() && !myRight('godkende')) return '';
  const kids = C().kids, teams = myTeams(), allTeams = C().teams.filter((t) => !t.archived);
  const pend = kids.filter((k) => k.status === 'ansoegt' && !k.waitlist);
  const wait = kids.filter((k) => k.status === 'ansoegt' && k.waitlist).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const act = kids.filter((k) => k.status === 'aktiv');
  const cnt = (t) => act.filter((k) => k.team_id === t).length;
  const fullT = (t) => { const tm = team(t); return tm?.max_kids && cnt(t) >= tm.max_kids; };
  const tLabel = (t) => `${esc(t.name)}${t.max_kids ? ` (${cnt(t.id)}/${t.max_kids}${cnt(t.id) >= t.max_kids ? ' fuldt' : ''})` : ''}`;
  const teamSel = (k, attr, list = allTeams) => `<select class="sm" ${attr} aria-label="Hold"><option value="">Intet hold</option>${list.map((t) => `<option value="${t.id}" ${k.team_id === t.id ? 'selected' : ''}>${tLabel(t)}</option>`).join('')}</select>`;
  const byTeam = [...teams.map((t) => ({ t, ks: act.filter((k) => k.team_id === t.id) })), { t: null, ks: act.filter((k) => !k.team_id || !allTeams.some((t) => t.id === k.team_id)) }].filter((x) => x.ks.length);
  const collect = !!group().club_collect_address;
  return `
    ${pend.length ? `<div class="card pendingbox"><b>⏳ Nye indmeldelser (${pend.length})</b>${pend.map((k) => `
      <div class="kpend"><div><b>${esc(k.name)}</b>${k.trial_requested ? ' <span class="badge trial">Ønsker prøvetræning</span>' : ''}${kidFlags(k)}<small class="muted">${esc([age(k), GENDER_KID[k.gender]].filter(Boolean).join(' · '))}${k.birth_date || k.gender ? ' · ' : ''}Meldt ind af ${esc(guardianNames(k.id) || nameOf(k.created_by))}</small>${k.note ? `<small>"${esc(k.note)}"</small>` : ''}${infoOf(k.id) ? `<small>⚠️ ${esc(infoOf(k.id))}</small>` : ''}</div>
        <label class="kteam">Hold${teamSel(k, `data-pteam="${k.id}"`)}</label>
        <div class="mact"><button class="btn sm ghost" data-kdo="${k.id}|afvist">Afvis</button><button class="btn sm" data-kdo="${k.id}|venteliste">Venteliste</button></div>
        <div class="mact"><button class="btn sm" data-kdo="${k.id}|proeve">Prøvetræning</button><button class="btn sm primary" data-kdo="${k.id}|aktiv">Godkend</button></div></div>`).join('')}</div>` : ''}
    ${wait.length ? `<div class="card waitbox"><b>⏳ Venteliste (${wait.length})</b>${wait.map((k, i) => `
      <div class="kpend"><div><b>${i + 1}. ${esc(k.name)}</b>${k.trial_requested ? ' <span class="badge trial">Ønsker prøvetræning</span>' : ''}<small class="muted">Venter på ${esc(team(k.team_id)?.name || 'et hold')}${fullT(k.team_id) ? ' (fuldt)' : ' · der er plads nu'} · ${esc(guardianNames(k.id))}</small></div>
        <div class="mact"><button class="btn sm ghost" data-kdo="${k.id}|afvist">Afvis</button><button class="btn sm" data-kdo="${k.id}|proeve">Prøve</button><button class="btn sm primary" data-kdo="${k.id}|aktiv">Optag</button></div></div>`).join('')}</div>` : ''}
    ${!isAdmin() && myAssigned().length ? `<p class="muted small">Du ser dine egne hold: ${teams.map((t) => esc(t.name)).join(', ')}.</p>` : ''}
    ${byTeam.map(({ t, ks }) => `<details class="card plist ${t ? '' : 'noteam'}" ${S.kidsOpen?.[t?.id || 'none'] ?? !t ? 'open' : ''} data-kt="${t?.id || 'none'}"><summary><b>${t ? esc(t.name) : '⚠️ Mangler hold'} (${ks.length})</b>${t ? '' : '<small class="muted">Tryk på barnet, vælg hold og tryk Gem</small>'}</summary>
      <div class="list compact">${ks.map((k, i) => `<details class="prow"><summary><span class="grow"><b>${esc(k.name)}</b>${k.trial ? ' <span class="badge trial">Prøve</span>' : ''}${kidFlags(k)}${k.trial ? '' : feeBadge(k)}<small>${kidMeta(k)}</small></span><span class="muted">›</span></summary>
        <form class="ppanel kedit" data-kedit="${k.id}">
          ${infoOf(k.id) ? `<div class="infobox">⚠️ ${esc(infoOf(k.id))}</div>` : ''}
          ${k.photo_ok === false ? '<div class="infobox">🚫📷 Må ikke være på billeder</div>' : ''}
          ${k.trial ? `<div class="mact"><button type="button" class="btn sm primary" data-kdo="${k.id}|aktiv">✓ Meld ind som medlem</button></div>` : ''}
          ${canRun() && !S.viewAs ? `<a class="btn sm block" href="#/ny-besked?barn=${k.id}">✉️ Skriv til forældrene</a>` : ''}
          ${kidFormFields({ ...k, info: infoOf(k.id) }, 200 + i, collect || !!k.address)}
          <label>Hold${teamSel(k, 'name="team"')}</label>
          <div class="mact"><button type="button" class="btn sm ghost danger" data-kout="${k.id}">Meld ud</button><button class="btn sm primary">Gem</button></div>
        </form></details>`).join('')}</div></details>`).join('') || (pend.length ? '' : '<div class="card empty"><p class="muted">Ingen børn endnu. Del invitationslinket under fanen Medlemmer, så forældrene kan melde deres børn ind.</p></div>')}`;
}

export function bindClubKids(refresh) {
  const kid = (id) => C().kids.find((k) => k.id === id);
  app.querySelectorAll('details[data-kt]').forEach((d) => (d.ontoggle = () => { (S.kidsOpen ||= {})[d.dataset.kt] = d.open; }));
  app.querySelectorAll('[data-kdo]').forEach((b) => (b.onclick = async () => {
    const [id, act] = b.dataset.kdo.split('|'), k = kid(id);
    const teamId = app.querySelector(`[data-pteam="${id}"]`)?.value || k.team_id || null;
    const tm = team(teamId), n = C().kids.filter((x) => x.status === 'aktiv' && x.team_id === teamId && x.id !== id).length;
    if (act === 'afvist' && !confirm(`Afvis ${k.name}?`)) return;
    if (act === 'venteliste' && !teamId) return toast('Vælg hvilket hold barnet skal vente på', true);
    if (['aktiv', 'proeve'].includes(act) && !teamId && C().teams.some((t) => !t.archived)) { app.querySelector(`[data-pteam="${id}"]`)?.focus(); return toast('Vælg et hold til barnet først', true); }
    const joining = k.status !== 'aktiv' || k.team_id !== teamId;
    if (['aktiv', 'proeve'].includes(act) && joining && tm?.max_kids && n >= tm.max_kids && !confirm(`${tm.name} er fuldt (${n}/${tm.max_kids}). Optag alligevel?`)) return;
    busy(b, true);
    try {
      await q(sb.rpc('padel_club_decide_v2', { p_kid: id, p_action: act, p_team: teamId }));
      toast({ aktiv: k.trial ? `${k.name} er nu medlem` : `${k.name} er godkendt. Forældrene har fået besked`, proeve: `${k.name} er velkommen til prøvetræning`, venteliste: `${k.name} er sat på venteliste`, afvist: `${k.name} er afvist` }[act]);
      await refresh();
    } catch { busy(b, false); }
  }));
  app.querySelectorAll('form[data-kedit]').forEach((f, n) => (f.onsubmit = async (e) => {
    e.preventDefault();
    const id = f.dataset.kedit, i = +f.querySelector('[name^=kgender]').name.replace('kgender', ''), k = readKid(f, i);
    const btn = f.querySelector('button.primary'); busy(btn, true);
    try {
      await q(sb.rpc('padel_club_update_kid', { p_kid: id, p_name: k.name, p_birth_date: k.birth_date, p_gender: k.gender, p_photo_ok: k.photo_ok, p_info: k.info, p_address: k.address }));
      if ((f.team.value || null) !== (kid(id).team_id || null)) await q(sb.rpc('padel_club_set_kid', { p_kid: id, p_name: k.name, p_birth_year: k.birth_date ? +k.birth_date.slice(0, 4) : kid(id).birth_year, p_team: f.team.value || null, p_status: 'aktiv' }));
      toast('Gemt'); await refresh();
    } catch { busy(btn, false); }
  }));
  app.querySelectorAll('[data-kout]').forEach((b) => (b.onclick = async () => {
    const k = kid(b.dataset.kout);
    if (!confirm(`Meld ${k.name} ud af klubben?`)) return;
    try { await q(sb.rpc('padel_club_set_kid', { p_kid: k.id, p_name: k.name, p_birth_year: k.birth_year, p_team: k.team_id, p_status: 'udmeldt' })); toast(`${k.name} er meldt ud`); await refresh(); } catch {}
  }));
}

// ---------- Admin: kontingent (kasserer og admin) ----------
export function clubFeesTab() {
  const gr = group();
  if (!gr.club_fee_label) return `<div class="card empty"><p class="muted">Der er ikke sat et kontingent op endnu.${isAdmin() ? ' Det gøres under Medlemmer → Klubbens indstillinger.' : ' Bed klubbens admin om at sætte det op.'}</p></div>`;
  const act = C().kids.filter((k) => k.status === 'aktiv' && !k.trial);
  const n = (st) => act.filter((k) => feeOf(k.id) === st).length;
  const teams = C().teams.filter((t) => !t.archived);
  const groups = [...teams.map((t) => ({ t, ks: act.filter((k) => k.team_id === t.id) })), { t: null, ks: act.filter((k) => !teams.some((t) => t.id === k.team_id)) }].filter((x) => x.ks.length);
  return `
    <div class="card feesum"><b>💳 Kontingent ${esc(gr.club_fee_label)} · ${kr(gr.club_fee || 0)}</b>
      <div class="ftiles"><div><b class="ok">${n('betalt')}</b><small>betalt</small></div><div><b class="warnc">${n('afventer')}</b><small>afventer</small></div><div><b class="no">${n('ubetalt')}</b><small>mangler</small></div></div>
      <div class="mact"><button class="btn sm" id="feeRemind" ${n('ubetalt') ? '' : 'disabled'}>🔔 Påmind</button><button class="btn sm" id="feeCsv">⬇️ Liste</button></div>
      <p class="muted small">Påmindelsen sendes som notifikation til forældre, der ikke har betalt. Listen kan åbnes i Excel.</p></div>
    ${groups.map(({ t, ks }) => `<div class="card"><b>${t ? esc(t.name) : 'Uden hold'}</b>
      ${ks.map((k) => `<div class="krow"><span class="grow">${esc(k.name)} ${feeBadge(k)}<small class="muted">${esc(guardianNames(k.id))}</small></span>
        ${feeOf(k.id) === 'betalt' ? `<button class="btn sm" data-kfee="${k.id}|ubetalt">Fortryd</button>` : `<button class="btn sm primary" data-kfee="${k.id}|betalt">✓ Betalt</button>`}</div>`).join('')}</div>`).join('')}`;
}

export function bindClubFees(refresh) {
  app.querySelectorAll('[data-kfee]').forEach((b) => (b.onclick = async () => {
    const [id, st] = b.dataset.kfee.split('|');
    busy(b, true);
    try { await q(sb.rpc('padel_club_fee_set', { p_kid: id, p_status: st })); await refresh(); } catch { busy(b, false); }
  }));
  document.getElementById('feeRemind')?.addEventListener('click', async (e) => {
    if (!confirm('Send en påmindelse til alle forældre, der ikke har betalt?')) return;
    busy(e.currentTarget, true);
    try { const n = await q(sb.rpc('padel_club_fee_reminder', { g: S.groupId })); toast(n ? `Påmindelse sendt til ${n} ${n === 1 ? 'forælder' : 'forældre'}` : 'Alle har betalt'); } catch {}
    busy(e.currentTarget, false);
  });
  document.getElementById('feeCsv')?.addEventListener('click', () => {
    const gr = group(), cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Navn', 'Fødselsdato', 'Køn', 'Hold', 'Forældre', 'Adresse', `Kontingent ${gr.club_fee_label}`]];
    for (const k of C().kids.filter((x) => x.status === 'aktiv')) rows.push([k.name, k.birth_date || k.birth_year || '', GENDER_KID[k.gender] || '', team(k.team_id)?.name || '', guardianNames(k.id), k.address || '', { betalt: 'Betalt', afventer: 'Afventer', ubetalt: 'Ikke betalt' }[feeOf(k.id)]]);
    const blob = new Blob(['﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${gr.name} - medlemmer.csv`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
}

// ---------- Admin: bestyrelse, rettigheder og børneattest (formanden / admin) ----------
export const BOARD_TITLES = ['Formand', 'Næstformand', 'Kasserer', 'Sekretær', 'Bestyrelsesmedlem', 'Suppleant', 'Revisor'];
// Kasserer og revisor får kun adgang til kontingent
const MONEY_TITLES = ['Kasserer', 'Revisor'];
const RIGHTS = [['treasurer', '💳 Kontingent'], ['can_post', '📣 Opslag til alle'], ['can_events', '📅 Arrangementer'], ['can_approve', '✅ Godkende børn']];
export function clubStaffCard() {
  if (!isAdmin()) return '';
  const g = S.groupId;
  const mem = S.members.filter((m) => m.group_id === g && m.status === 'aktiv' && S.profiles[m.player_id]);
  const st = (id) => C().staff.find((x) => x.user_id === id) || {};
  const ids = new Set([...mem.filter((m) => ['admin', 'superbruger'].includes(m.role)).map((m) => m.player_id),
    ...C().staff.filter((x) => x.board_title || RIGHTS.some(([k]) => x[k])).map((x) => x.user_id), ...(S.staffAdd ? [S.staffAdd] : [])]);
  const people = [...ids].filter((id) => S.profiles[id] && mem.some((m) => m.player_id === id))
    .sort((a, b) => (BOARD_TITLES.indexOf(st(a).board_title) + 1 || 99) - (BOARD_TITLES.indexOf(st(b).board_title) + 1 || 99) || nameOf(a).localeCompare(nameOf(b)));
  const others = mem.map((m) => m.player_id).filter((id) => !ids.has(id)).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const cert = (id) => C().certs.find((x) => x.user_id === id)?.cert_date || '';
  const role = (id) => mem.find((m) => m.player_id === id)?.role;
  const teamsOf = (id) => C().teamTrainers.filter((x) => x.user_id === id).map((x) => team(x.team_id)).filter((t) => t && !t.archived).map((t) => t.name);
  const board = people.filter((id) => st(id).board_title);
  return `<details class="card gset staff" ${S.staffOpen ? 'open' : ''}><summary><b>🧑‍💼 Bestyrelse og rettigheder</b><small class="muted">${board.length ? board.map((id) => `${esc(st(id).board_title)}: ${esc(nameOf(id).split(' ')[0])}`).join(' · ') : 'Ingen bestyrelse endnu'}</small></summary>
    <p class="muted small">Vælg post i bestyrelsen, og hvad hver person må i appen. Formanden bliver automatisk admin. Admin har altid alle rettigheder, og trænere styrer deres egne hold. Bestyrelsen vises med kontaktinfo under Opslag.</p>
    ${people.map((id) => `<form class="staffrow" data-staff="${id}">
      <div><b>${esc(nameOf(id))}</b><small class="muted">${role(id) === 'admin' ? 'Admin · alle rettigheder' : role(id) === 'superbruger' ? 'Træner' : 'Medlem'}${teamsOf(id).length ? ` · ${esc(teamsOf(id).join(', '))}` : ''}</small></div>
      <label>Post i bestyrelsen<select name="title"><option value="">Ingen</option>${BOARD_TITLES.map((t) => `<option ${st(id).board_title === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      ${role(id) === 'admin' ? '' : `<div class="checks rights">${RIGHTS.map(([k, l]) => { const fixed = MONEY_TITLES.includes(st(id).board_title); return `<label><input type="checkbox" name="${k}" ${(fixed ? k === 'treasurer' : st(id)[k]) ? 'checked' : ''} ${fixed ? 'disabled' : ''}><span>${l}</span></label>`; }).join('')}</div>
      <small class="muted rightsnote" ${MONEY_TITLES.includes(st(id).board_title) ? '' : 'hidden'}>Kasserer og revisor får automatisk adgang til kontingent, og kun det.</small>`}
      <label>Børneattest indhentet <small class="muted">(trænere)</small><input type="date" name="cert" value="${cert(id)}" max="${todayISO()}"></label>
      ${role(id) === 'superbruger' && !cert(id) ? '<small class="warnc">Mangler børneattest</small>' : ''}
      <div class="mact">${st(id).board_title || RIGHTS.some(([k]) => st(id)[k]) ? `<button type="button" class="btn sm ghost danger" data-staffrm="${id}">Fjern</button>` : ''}<button class="btn sm primary">Gem</button></div></form>`).join('')}
    ${others.length ? `<form class="frow" id="addStaff"><label class="grow">Tilføj en person<select name="u"><option value="">Vælg…</option>${others.map((id) => `<option value="${id}">${esc(nameOf(id))}</option>`).join('')}</select></label><button class="btn sm">Tilføj</button></form>` : ''}
  </details>`;
}

export function bindClubStaff(refresh) {
  const d = app.querySelector('details.staff');
  if (!d) return;
  d.ontoggle = () => (S.staffOpen = d.open);
  app.querySelectorAll('form[data-staff]').forEach((f) => (f.title.onchange = () => {
    const fixed = MONEY_TITLES.includes(f.title.value);
    f.querySelectorAll('.rights input').forEach((x) => { x.disabled = fixed; if (fixed) x.checked = x.name === 'treasurer'; });
    const n = f.querySelector('.rightsnote'); if (n) n.hidden = !fixed;
  }));
  app.querySelectorAll('form[data-staff]').forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button'); busy(btn, true);
    const v = (k) => !!f.elements[k]?.checked;
    try {
      await q(sb.rpc('padel_club_set_rights', { g: S.groupId, p_user: f.dataset.staff, p_title: f.title.value || null, p_treasurer: v('treasurer'), p_post: v('can_post'), p_events: v('can_events'), p_approve: v('can_approve'), p_cert_date: f.cert.value || null }));
      const chair = f.title.value === 'Formand';
      S.staffAdd = null; toast(chair ? 'Gemt. Formanden er nu klubbens admin med alle rettigheder' : 'Gemt');
      if (chair) await hooks.loadBase();
      await loadClub(S.groupId); await refresh();
    } catch { busy(btn, false); }
  }));
  app.querySelectorAll('[data-staffrm]').forEach((b) => (b.onclick = async () => {
    const id = b.dataset.staffrm;
    if (!confirm(`Fjern ${nameOf(id)} fra bestyrelsen og tag rettighederne fra?\n\nPersonen bliver i klubben (som medlem, træner eller admin som før).`)) return;
    busy(b, true);
    try {
      await q(sb.rpc('padel_club_set_rights', { g: S.groupId, p_user: id, p_title: null, p_treasurer: false, p_post: false, p_events: false, p_approve: false, p_cert_date: C().certs.find((x) => x.user_id === id)?.cert_date || null }));
      toast(`${nameOf(id)} er fjernet fra bestyrelsen`); await loadClub(S.groupId); await refresh();
    } catch { busy(b, false); }
  }));
  const ad = document.getElementById('addStaff');
  if (ad) ad.onsubmit = (e) => { e.preventDefault(); if (ad.u.value) { S.staffAdd = ad.u.value; refresh(); } };
}

// ---------- Admin: hold og træningstider ----------
const sessForm = (s, teamId) => `<form class="sform" data-sform="${s?.id || ''}" data-steam="${teamId}">
  <div class="frow"><label class="grow">Dag<select name="wd">${Object.entries(WEEKDAY).map(([k, v]) => `<option value="${k}" ${+k === (s?.weekday || 2) ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label>Fra<input name="st" type="time" value="${t5(s?.start_time) || '16:00'}" required></label><label>Til<input name="en" type="time" value="${t5(s?.end_time) || '17:00'}" required></label></div>
  <label>Sted <small class="muted">(valgfrit)</small><input name="place" value="${esc(s?.place || '')}" maxlength="80" placeholder="Fx Padelhuset Gilleleje, bane 1-2"></label>
  <div class="frow"><label class="grow">Første gang <small class="muted">(valgfri)</small><input name="vfrom" type="date" value="${s?.valid_from || ''}"></label><label class="grow">Sidste gang <small class="muted">(valgfri)</small><input name="vto" type="date" value="${s?.valid_to || ''}"></label></div>
  <small class="muted">Uden datoer gentages træningen hver uge, indtil den fjernes.</small>
  <div class="mact">${s ? '<button type="button" class="btn sm ghost danger" data-sdel>Fjern tiden</button>' : ''}<button class="btn sm primary">${s ? 'Gem' : 'Tilføj tid'}</button></div></form>`;

const shortDate = (d) => new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
const periodText = (s) => (s.valid_from || s.valid_to ? `${s.valid_from ? shortDate(s.valid_from) : 'nu'} – ${s.valid_to ? shortDate(s.valid_to) : 'fremover'}` : '');
const sessionOver = (s) => s.valid_to && s.valid_to < todayISO();

// Ny træning med tale eller fritekst: appen udfylder formularen, træneren tjekker og trykker Opret
function quickSessionCard(teams) {
  const opt = (v, l) => `<option value="${v}">${l}</option>`;
  return `<div class="card quickses"><b>🎤 Ny træning med tale</b>
    <p class="muted small">Sig eller skriv fx: <i>"Begyndere tirsdag fra 16 til 17.30 de næste 6 uger"</i></p>
    <form id="qsAsk" class="qsask"><input id="qsText" placeholder="Hold, dag, tid og evt. antal uger" autocomplete="off">${SR ? '<button type="button" class="btn sm" id="qsMic">🎤 Sig det</button>' : ''}<button class="btn sm primary">Udfyld</button></form>
    ${SR ? '' : '<p class="muted small">Tip: brug mikrofonen på telefonens tastatur.</p>'}
    <form id="qsForm" class="sform" hidden>
      <label>Hold<select name="team">${teams.map((t) => opt(t.id, esc(t.name))).join('')}${opt('__new', '➕ Nyt hold…')}</select></label>
      <label id="qsNewWrap" hidden>Navn på nyt hold<input name="newteam" maxlength="60"></label>
      <div class="frow"><label class="grow">Dag<select name="wd">${Object.entries(WEEKDAY).map(([k, v]) => opt(k, v)).join('')}</select></label>
        <label>Fra<input name="st" type="time" required></label><label>Til<input name="en" type="time" required></label></div>
      <label>Sted <small class="muted">(valgfrit)</small><input name="place" maxlength="80"></label>
      <div class="frow"><label class="grow">Første gang<input name="vfrom" type="date"></label><label class="grow">Sidste gang <small class="muted">(valgfri)</small><input name="vto" type="date"></label></div>
      <p class="muted small" id="qsSum"></p>
      <div class="mact"><button type="button" class="btn sm ghost" id="qsCancel">Annuller</button><button class="btn sm primary">Opret træning</button></div>
    </form></div>`;
}

function bindQuickSession(refresh) {
  const ask = document.getElementById('qsAsk'), f = document.getElementById('qsForm');
  if (!ask || !f) return;
  const g = S.groupId;
  const sum = () => {
    const a = f.vfrom.value, b = f.vto.value;
    const n = a && b && b >= a ? Math.floor((Date.parse(b) - Date.parse(a)) / (7 * 864e5)) + 1 : 0;
    document.getElementById('qsSum').textContent = !f.st.value || !f.en.value ? 'Udfyld tidspunktet.'
      : `${WEEKDAY[f.wd.value]} kl. ${f.st.value.replace(':', '.')}–${f.en.value.replace(':', '.')}${n ? `, ${n} ${n === 1 ? 'gang' : 'gange'} (${shortDate(a)} – ${shortDate(b)})` : a ? `, hver uge fra ${shortDate(a)}` : ', hver uge'}`;
  };
  const newTeam = () => { const on = f.team.value === '__new'; document.getElementById('qsNewWrap').hidden = !on; if (on) f.newteam.required = true; else f.newteam.required = false; };
  f.team.onchange = newTeam;
  ['wd', 'st', 'en', 'vfrom', 'vto'].forEach((k) => f[k].addEventListener('change', sum));
  const fill = (text) => {
    const now = new Date(), nowMin = +new Intl.DateTimeFormat('da-DK', { hour: 'numeric', hour12: false, timeZone: 'Europe/Copenhagen' }).format(now) * 60 + now.getMinutes();
    const r = parseSession(text, { teams: myTeams(), centers: S.centers.map((c) => c.name), today: todayISO(), nowMinutes: nowMin });
    if (!r.weekday && !r.start && !r.team && !r.newTeam) return toast('Jeg kunne ikke forstå det. Prøv fx "Begyndere tirsdag fra 16 til 17.30 i 6 uger"', true);
    f.hidden = false;
    if (r.team) f.team.value = r.team;
    else if (r.newTeam) { f.team.value = '__new'; f.newteam.value = r.newTeam; }
    newTeam();
    if (r.weekday) f.wd.value = String(r.weekday);
    f.st.value = r.start || ''; f.en.value = r.end || '';
    const last = C().sessions.filter((x) => x.team_id === f.team.value && x.active && x.place).slice(-1)[0];
    f.place.value = r.place || last?.place || '';
    f.vfrom.value = r.from || ''; f.vto.value = r.to || '';
    sum();
    const miss = [!r.weekday && 'dag', !r.start && 'starttid', !r.end && 'sluttid', !(r.team || r.newTeam) && 'hold'].filter(Boolean);
    toast(miss.length ? `Tjek formularen. Jeg mangler: ${miss.join(', ')}` : 'Tjek, og tryk Opret træning');
    f.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  ask.onsubmit = (e) => { e.preventDefault(); const v = document.getElementById('qsText').value.trim(); if (v) fill(v); };
  document.getElementById('qsMic')?.addEventListener('click', (e) => listen(e.currentTarget, (txt) => { document.getElementById('qsText').value = txt; fill(txt); },
    (err) => toast(err === 'not-allowed' ? 'Giv appen lov til at bruge mikrofonen, eller skriv i feltet' : 'Jeg hørte ikke noget. Prøv igen', true)));
  document.getElementById('qsCancel').onclick = () => { f.hidden = true; f.reset(); };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button.primary'); busy(btn, true);
    try {
      let team = f.team.value;
      if (team === '__new') team = await q(sb.rpc('padel_club_save_team', { p_id: null, g, p_name: f.newteam.value, p_archived: false }));
      await q(sb.rpc('padel_club_save_session_v2', { p_id: null, p_team: team, p_weekday: +f.wd.value, p_start: f.st.value, p_end: f.en.value, p_place: f.place.value, p_active: true, p_from: f.vfrom.value || null, p_to: f.vto.value || null }));
      S.teamOpen = team; toast('Træningen er oprettet. Forældrene kan se den under Træning'); await refresh();
    } catch { busy(btn, false); }
  };
}

export function clubTeamsTab() {
  const teams = myTeams(), admin = isAdmin();
  const coaches = S.members.filter((m) => m.group_id === S.groupId && m.status === 'aktiv' && ['admin', 'superbruger'].includes(m.role) && S.profiles[m.player_id]).map((m) => m.player_id).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const onTeam = (t, u) => C().teamTrainers.some((x) => x.team_id === t && x.user_id === u);
  const count = (t) => C().kids.filter((k) => k.status === 'aktiv' && k.team_id === t).length;
  return `
    ${quickSessionCard(teams)}
    ${teams.map((t) => {
      const ss = C().sessions.filter((s) => s.team_id === t.id && s.active && !sessionOver(s)).sort((a, b) => a.weekday - b.weekday || t5(a.start_time).localeCompare(t5(b.start_time)));
      return `<details class="card teamcard" data-team="${t.id}" ${S.teamOpen === t.id ? 'open' : ''}><summary><span class="grow"><b>${esc(t.name)}</b><small class="muted">${count(t.id)}${t.max_kids ? `/${t.max_kids}` : ''} børn · ${ss.length ? ss.map((s) => `${WEEKDAY[s.weekday].slice(0, 3).toLowerCase()} ${t5(s.start_time)}`).join(', ') : 'ingen tider'}${trainersOf(t.id).length ? ` · ${trainersOf(t.id).map((x) => esc(x.name.split(' ')[0])).join(', ')}` : ''}</small></span><span class="muted">›</span></summary>
        ${admin ? `<div class="lbl">Trænere på holdet</div>${coaches.length ? `<div class="checks coach">${coaches.map((u) => `<label><input type="checkbox" data-coach="${t.id}" value="${u}" ${onTeam(t.id, u) ? 'checked' : ''}><span>${esc(nameOf(u).split(' ')[0])}</span></label>`).join('')}</div>` : '<p class="muted small">Gør først nogen til Træner under Medlemmer.</p>'}` : ''}
        ${admin ? `<form class="frow tmax" data-tmax="${t.id}"><label class="grow">Maks. antal børn <small class="muted">(tom = ingen grænse)</small><input name="max" type="number" min="0" value="${t.max_kids || ''}"></label><button class="btn sm">Gem</button></form>` : ''}
        <div class="lbl">Træningstider</div>
        ${ss.map((s) => `<details class="srow"><summary><span class="grow">${WEEKDAY[s.weekday]} ${t5(s.start_time)}–${t5(s.end_time)}${s.place || periodText(s) ? `<small class="muted">${esc([s.place, periodText(s)].filter(Boolean).join(' · '))}</small>` : ''}${byLine(s.created_by, s.created_at)}</span><span class="link sm">Ret</span></summary>${sessForm(s, t.id)}</details>`).join('')}
        <details class="srow new"><summary><span class="grow">➕ Tilføj træningstid</span></summary>${sessForm(null, t.id)}</details>
        <div class="mact"><button class="link sm" data-trename="${t.id}">Omdøb holdet</button>${admin ? `<button class="link sm dn" data-tarch="${t.id}">Slet holdet</button>` : ''}</div>
      </details>`;
    }).join('') || '<div class="card empty"><p class="muted">Ingen hold endnu.</p></div>'}
    <form class="card frow" id="newTeam"><input name="name" class="grow" placeholder="Nyt hold, fx U12 eller Begyndere" maxlength="60" required><button class="btn sm primary">Opret hold</button></form>
    ${admin ? '' : '<p class="muted small">Opretter du et hold, bliver du selv træner på det. Admin kan tilføje flere trænere.</p>'}`;
}

export function bindClubTeams(refresh) {
  const g = S.groupId;
  bindQuickSession(refresh);
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
  app.querySelectorAll('form[data-tmax]').forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault();
    try { await q(sb.rpc('padel_club_set_team_max', { p_team: f.dataset.tmax, p_max: +f.max.value || 0 })); S.teamOpen = f.dataset.tmax; toast('Gemt'); await refresh(); } catch {}
  }));
  app.querySelectorAll('[data-coach]').forEach((cb) => (cb.onchange = async () => {
    const t = cb.dataset.coach, users = [...app.querySelectorAll(`[data-coach="${t}"]:checked`)].map((x) => x.value);
    try { await q(sb.rpc('padel_club_set_team_trainers', { p_team: t, p_users: users })); S.teamOpen = t; toast('Trænerne er gemt'); await refresh(); } catch { cb.checked = !cb.checked; }
  }));
  app.querySelectorAll('form[data-sform]').forEach((f) => {
    f.onsubmit = async (e) => {
      e.preventDefault();
      const btn = f.querySelector('button.primary'); busy(btn, true);
      try {
        await q(sb.rpc('padel_club_save_session_v2', { p_id: f.dataset.sform || null, p_team: f.dataset.steam, p_weekday: +f.wd.value, p_start: f.st.value, p_end: f.en.value, p_place: f.place.value, p_active: true, p_from: f.vfrom.value || null, p_to: f.vto.value || null }));
        S.teamOpen = f.dataset.steam; toast('Træningstiden er gemt'); await refresh();
      } catch { busy(btn, false); }
    };
    f.querySelector('[data-sdel]')?.addEventListener('click', async () => {
      if (!confirm('Fjern træningstiden?')) return;
      try { await q(sb.rpc('padel_club_save_session_v2', { p_id: f.dataset.sform, p_team: f.dataset.steam, p_weekday: +f.wd.value, p_start: f.st.value, p_end: f.en.value, p_place: f.place.value, p_active: false, p_from: f.vfrom.value || null, p_to: f.vto.value || null })); S.teamOpen = f.dataset.steam; await refresh(); } catch {}
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
      <label class="switch"><input type="checkbox" name="addr" ${gr.club_collect_address ? 'checked' : ''}><span>🏠 Spørg om adresse ved indmeldelse</span></label>
      <p class="muted small">Slå til, hvis klubben skal bruge adresser, fx til kommunens tilskud.</p>
 <label class="switch"><input type="checkbox" name="disc" ${gr.club_discoverable ? 'checked' : ''}><span>🔎 Kan findes i appen</span></label>
      <p class="muted small">Slået til: brugere uden for klubben ser linjen "Meld et barn ind i en klub" under Profil, og klubben kan vælges, når de melder et barn ind. Der sendes ingen beskeder.</p>
      <label class="switch"><input type="checkbox" name="remind" ${gr.club_reminders !== false ? 'checked' : ''}><span>🔔 Påmindelse dagen før træning</span></label>
      <label>Afbudsfrist (timer før træning) <small class="muted">(0 = ingen frist)</small><input name="hours" type="number" min="0" max="72" value="${gr.club_absence_hours || 0}"></label>
      <p class="muted small">Afbud efter fristen er stadig muligt, men holdets trænere får besked.</p>
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
    try { await q(sb.rpc('padel_club_set_fee_v2', { g: S.groupId, p_fee: f.fee.value ? +f.fee.value : null, p_label: f.label.value, p_url: f.url.value, p_info: f.info.value, p_collect_address: f.addr.checked }));
      await q(sb.rpc('padel_club_set_options', { g: S.groupId, p_reminders: f.remind.checked, p_absence_hours: +f.hours.value || 0 }));
      await q(sb.rpc('padel_club_set_discoverable', { g: S.groupId, p_on: f.disc.checked })); toast('Gemt'); await hooks.loadBase(); await refresh(); } catch { busy(btn, false); }
  };
}

// ---------- Kalender-abonnement ----------
export async function showCalendar(renew = false) {
  let token;
  try { token = await q(sb.rpc('padel_ical_token', { p_new: renew === true })); } catch { return; }
  const https = `https://jlstsyvhlzsbqymwiyzx.supabase.co/functions/v1/padel-ical?t=${token}`;
  const webcal = https.replace(/^https:/, 'webcal:');
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
  document.getElementById('calModal')?.remove();
  const wrap = document.createElement('div');
  wrap.id = 'calModal'; wrap.className = 'modal';
  wrap.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="calTitle">
    <div class="fgicon">📅</div><h2 id="calTitle">Træninger i din kalender</h2>
    <p class="muted">Træningerne kommer automatisk i telefonens kalender og bliver opdateret, hvis tider ændres eller en træning aflyses.</p>
    <div class="calbtns"><a class="btn primary" href="${webcal}">📱 iPhone / Outlook</a><a class="btn" href="${google}" target="_blank" rel="noopener">Google Kalender</a></div>
    <p class="muted small">Android: brug Google Kalender. Virker en knap ikke, så <button class="link sm" id="calCopy">kopiér linket</button> og tilføj det som kalender-abonnement.</p>
    <p class="muted small">Linket er personligt. Har du delt det ved en fejl, kan du <button class="link sm" id="calNew">lave et nyt</button> (det gamle holder op med at virke).</p>
    <div class="mact"><button class="btn ghost" id="calClose">Luk</button></div></div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.querySelector('#calClose').onclick = close;
  wrap.querySelector('#calCopy').onclick = async () => { try { await navigator.clipboard.writeText(https); toast('Linket er kopieret'); } catch { prompt('Kopiér linket', https); } };
  wrap.querySelector('#calNew').onclick = () => { if (confirm('Lav et nyt link? Det gamle holder op med at virke, så du skal tilføje kalenderen igen.')) { close(); showCalendar(true); } };
}

// ---------- Admin: fremmøde ----------
export async function loadAttendance(weeks) {
  const to = todayISO(), from = addDays(to, -weeks * 7);
  await loadClub(S.groupId, { from, to });
  return { from, to };
}

export function clubAttendanceTab() {
  const weeks = S.attWeeks || 8, teams = myTeams();
  if (S.attTeam && !teams.some((t) => t.id === S.attTeam)) S.attTeam = null;
  const tId = S.attTeam || teams[0]?.id;
  if (!tId) return '<div class="card empty"><p class="muted">Ingen hold endnu.</p></div>';
  const to = todayISO(), from = addDays(to, -weeks * 7);
  // Træninger der er holdt: ikke aflyst, og hvor træneren har krydset fremmøde af
  const held = occurrences([tId], from, to).filter((o) => !cancelOf(o.s.id, o.day) && C().attendance.some((a) => a.session_id === o.s.id && a.day === o.day));
  const kids = C().kids.filter((k) => k.status === 'aktiv' && k.team_id === tId);
  const rows = kids.map((k) => {
    const met = held.filter((o) => present(o.s.id, o.day, k.id)).length;
    const afb = held.filter((o) => answer(o.s.id, o.day, k.id) === 'afbud').length;
    const last = held.filter((o) => present(o.s.id, o.day, k.id)).map((o) => o.day).pop();
    return { k, met, afb, pct: held.length ? Math.round((met / held.length) * 100) : null, last };
  }).sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101) || a.k.name.localeCompare(b.k.name));
  const avg = rows.length && held.length ? Math.round(rows.reduce((s2, x) => s2 + x.met, 0) / (rows.length * held.length) * 100) : null;
  return `
    ${teams.length > 1 ? `<label class="teamsel"><span>Hold</span><select id="attTeamSel">${teams.map((t) => `<option value="${t.id}" ${t.id === tId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>` : ''}
    <div class="chips static">${[4, 8, 16].map((w) => `<button class="chip ${w === weeks ? 'on' : ''}" data-attweeks="${w}">${w} uger</button>`).join('')}</div>
    <div class="card feesum"><b>📊 ${esc(team(tId).name)} · de sidste ${weeks} uger</b>
      <div class="ftiles"><div><b>${held.length}</b><small>træninger</small></div><div><b>${avg ?? '–'}${avg != null ? '%' : ''}</b><small>fremmøde</small></div><div><b>${kids.length}</b><small>børn</small></div></div>
      <p class="muted small">Tæller de træninger, hvor fremmødet er krydset af.</p></div>
    <div class="card">${rows.map((x) => `<div class="krow"><span class="grow"><b>${esc(x.k.name)}</b><small class="muted">${x.met} af ${held.length} gange${x.afb ? ` · ${x.afb} afbud` : ''}${x.last ? ` · sidst ${fmtDay(x.last)}` : ''}</small></span>
      <span class="pct ${x.pct == null ? '' : x.pct < 50 ? 'low' : x.pct < 75 ? 'mid' : 'high'}">${x.pct == null ? '–' : `${x.pct}%`}</span></div>`).join('') || '<p class="muted small">Ingen børn på holdet.</p>'}</div>`;
}

export function bindClubAttendance(refresh) {
  const as = document.getElementById('attTeamSel'); if (as) as.onchange = () => { S.attTeam = as.value; refresh(); };
  app.querySelectorAll('[data-attweeks]').forEach((b) => (b.onclick = () => { S.attWeeks = +b.dataset.attweeks; refresh(); }));
}

// Antal børn der venter på godkendelse i klubber, hvor jeg er træner (til tallet på Admin)
export async function loadClubPending() {
  S.clubPending = 0; S.clubPendingBy = {};
  try { S.clubRights = S.groups.some((x) => x.kind === 'klub') ? await q(sb.rpc('padel_club_my_rights')) : []; } catch { S.clubRights = []; }
  const clubs = S.groups.filter((x) => x.kind === 'klub' && !x.archived && (canRun(x.id) || myRight('godkende', x.id)));
  if (!clubs.length) return;
  try {
    const all = await q(sb.from('padel_club_kids').select('id,group_id,waitlist,status,team_id').in('group_id', clubs.map((x) => x.id)).in('status', ['ansoegt', 'aktiv']));
    const rows = all.filter((r) => r.status === 'ansoegt' && !r.waitlist);
    // Optagne børn uden hold tæller også med: der er noget, træneren skal tage stilling til
    S.clubNoTeamBy = {};
    for (const r of all.filter((x) => x.status === 'aktiv' && !x.team_id)) S.clubNoTeamBy[r.group_id] = (S.clubNoTeamBy[r.group_id] || 0) + 1;
    for (const r of rows) S.clubPendingBy[r.group_id] = (S.clubPendingBy[r.group_id] || 0) + 1;
    for (const [g, n] of Object.entries(S.clubNoTeamBy)) S.clubPendingBy[g] = (S.clubPendingBy[g] || 0) + n;
    S.clubPending = Object.values(S.clubPendingBy).reduce((a, b) => a + b, 0);
    S.clubNewBy = {}; for (const r of rows) S.clubNewBy[r.group_id] = (S.clubNewBy[r.group_id] || 0) + 1;
  } catch {}
}

// Når appen åbnes: vis trænerne, hvis der er nye børn eller børn uden hold
export function showClubTodo() {
  if (S.viewAs || document.getElementById('todoModal')) return false;
  // Kun trænere (ikke admin/formand) får popuppen; admin ser stadig tallet ved Admin i menuen
  const ids = [...new Set([...Object.keys(S.clubNewBy || {}), ...Object.keys(S.clubNoTeamBy || {})])].filter((g) => group(g) && roleIn(S.me?.id, g) === 'superbruger');
  if (!ids.length) return false;
  const line = (g) => {
    const n = S.clubNewBy?.[g] || 0, m = S.clubNoTeamBy?.[g] || 0;
    return `<div class="todorow"><b>${esc(group(g).name)}</b><ul>${n ? `<li>👋 ${n === 1 ? '1 nyt barn venter' : `${n} nye børn venter`} på godkendelse</li>` : ''}${m ? `<li>⚠️ ${m === 1 ? '1 barn mangler' : `${m} børn mangler`} et hold</li>` : ''}</ul>
      <button class="btn primary block" data-todo="${g}">Tag stilling nu</button></div>`;
  };
  const wrap = document.createElement('div');
  wrap.id = 'todoModal';
  wrap.className = 'modal';
  wrap.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="todoTitle">
    <div class="fgicon">🧒</div><h2 id="todoTitle">Der venter noget i klubben</h2>
    ${ids.map(line).join('')}
    <div class="mact"><button class="btn ghost" id="todoLater">Senere</button></div></div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('#todoLater').onclick = () => wrap.remove();
  wrap.querySelectorAll('[data-todo]').forEach((b) => (b.onclick = () => {
    wrap.remove(); setGroup(b.dataset.todo); S.adminTab = 'boern'; S.kidsOpen = { none: true };
    if (location.hash === '#/admin') hooks.route?.(); else location.hash = '#/admin';
  }));
  return true;
}

// Invitationslink til klubben
export const clubInvite = (g) => ({
  qr: () => showQR(`${location.origin}/#/velkommen/${g}`, `Meld ind i ${group(g)?.name}`, 'Scan med telefonens kamera. Forældre opretter sig og melder deres barn ind.'),
  share: () => share(`${location.origin}/#/velkommen/${g}`, `Meld dit barn ind i ${group(g)?.name}! Opret dig (eller log ind) her, og udfyld indmeldelsen:`),
});

// ---------- Popup: "Kommer X til næste træning?" ----------
// Når appen åbnes: for hvert af ens egne børn (og én selv med eget login) spørges kun om den allernæste træning,
// hvis man ikke har svaret. Ingen påvirker andres børn.
export async function askNextTraining() {
  if (S.viewAs || !S.me || document.querySelector('.modal')) return false;
  try {
    const me = S.me.id, today = todayISO();
    const gd = await q(sb.from('padel_club_guardians').select('kid_id').eq('user_id', me).eq('active', true));
    const own = await q(sb.from('padel_club_kids').select('id').eq('player_id', me));
    const ids = [...new Set([...gd.map((x) => x.kid_id), ...own.map((x) => x.id)])];
    if (!ids.length) return false;
    const kids = (await q(sb.from('padel_club_kids').select('id,name,team_id,group_id,player_id').in('id', ids).eq('status', 'aktiv'))).filter((k) => k.team_id && group(k.group_id));
    if (!kids.length) return false;
    const teamIds = [...new Set(kids.map((k) => k.team_id))];
    const [sessions, teams] = await Promise.all([
      q(sb.from('padel_club_sessions').select('*').in('team_id', teamIds).eq('active', true)),
      q(sb.from('padel_club_teams').select('id,name,archived').in('id', teamIds)),
    ]);
    if (!sessions.length) return false;
    const until = addDays(today, 14), sids = sessions.map((s) => s.id);
    const [cancels, answers] = await Promise.all([
      q(sb.from('padel_club_cancellations').select('session_id,day').in('session_id', sids).eq('cancelled', true).gte('day', today).lte('day', until)),
      q(sb.from('padel_club_absence').select('session_id,day,kid_id,status').in('kid_id', kids.map((k) => k.id)).gte('day', today).lte('day', until)),
    ]);
    const now = Date.now();
    // Den næste træning for et barn (ikke aflyst, ikke begyndt)
    const nextFor = (k) => {
      const ss = sessions.filter((s) => s.team_id === k.team_id && !teams.find((t) => t.id === s.team_id)?.archived);
      for (let d = today; d <= until; d = addDays(d, 1)) {
        const hits = ss.filter((s) => s.weekday === isoDow(d) && (!s.valid_from || d >= s.valid_from) && (!s.valid_to || d <= s.valid_to)
          && startMs(d, s.start_time) > now && !cancels.some((c) => c.session_id === s.id && c.day === d))
          .sort((a, b) => t5(a.start_time).localeCompare(t5(b.start_time)));
        if (hits.length) return { s: hits[0], day: d };
      }
      return null;
    };
    const ask = kids.map((k) => ({ k, o: nextFor(k) })).filter((x) => x.o && !answers.some((a) => a.kid_id === x.k.id && a.session_id === x.o.s.id && a.day === x.o.day));
    if (!ask.length || document.querySelector('.modal')) return false;
    const tname = (id) => teams.find((t) => t.id === id)?.name || '';
    const who = (k) => (k.player_id === me ? 'du' : esc(k.name.split(' ')[0]));
    const wrap = document.createElement('div');
    wrap.id = 'askModal';
    wrap.className = 'modal';
    wrap.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="askTitle">
      <div class="fgicon">🎾</div><h2 id="askTitle">Næste træning</h2>
      ${ask.map(({ k, o }) => `<div class="askrow" data-askrow="${k.id}"><p><b>Kommer ${who(k)}?</b><br><span class="muted">${cap(dayLabel(o.day))} kl. ${t5(o.s.start_time).replace(':', '.')}–${t5(o.s.end_time).replace(':', '.')}<br>${esc(tname(k.team_id))}${o.s.place ? ` · ${esc(o.s.place)}` : ''}</span></p>
        <div class="yesno"><button class="btn" data-ask="${o.s.id}|${o.day}|${k.id}|afbud">Afbud</button><button class="btn primary" data-ask="${o.s.id}|${o.day}|${k.id}|kommer">✓ Kommer</button></div></div>`).join('')}
      <div class="mact"><button class="btn ghost" id="askLater">Senere</button></div></div>`;
    document.body.appendChild(wrap);
    wrap.querySelector('#askLater').onclick = () => wrap.remove();
    wrap.querySelectorAll('[data-ask]').forEach((b) => (b.onclick = async () => {
      const [sid, day, kid, st] = b.dataset.ask.split('|');
      busy(b, true);
      try {
        await q(sb.rpc('padel_club_set_absence', { p_session: sid, p_day: day, p_kid: kid, p_status: st, p_reason: null }));
        const row = wrap.querySelector(`[data-askrow="${kid}"]`);
        row.innerHTML = `<p>${st === 'kommer' ? '✓ Tak! Træneren ved, at ' + who(kids.find((k) => k.id === kid)) + ' kommer.' : 'Afbuddet er sendt til træneren.'}</p>`;
        if (!wrap.querySelector('[data-ask]')) setTimeout(() => { wrap.remove(); hooks.route?.(); }, 900);
      } catch { busy(b, false); }
    }));
    return true;
  } catch { return false; }
}
