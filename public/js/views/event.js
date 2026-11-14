// En spilledag: din næste kamp, runder og kampe, dagens stilling, tilmeldinger og styring af dagen.
import {
  sb, S, app, hooks, isSuper, FORMAT, MODE, SIDE_SHORT, isAdmin, canRun, canJoin, setGroup, group, activeMembers, groupElo,
  esc, nameOf, first, shortName, fmtDate, hm, courtById, centerById, plural, toast, q, busy, share, onLeave, openMobilePay, isWide,
  haptic, canPlan, mapsUrl,
} from '../core.js';
import { generateRound } from '../pairing.js';
import { lineup, lineupText } from '../lineup.js';
import { SR, listenScore, beep } from '../voice.js';
import { giveFormBody, bindGive, signoffFine, fineWarn, kr } from './fines.js';
import { editBtn } from '../editmode.js';
import { castTv } from '../cast.js';
import { reportResult, pendingFor } from '../outbox.js';

// ---------- Indlæsning og live opdatering ----------
async function loadEvent(id) {
  const [ev, signups, matches, log] = await Promise.all([
    q(sb.from('padel_events').select('*').eq('id', id).single()),
    q(sb.from('padel_signups').select('*').eq('event_id', id).order('created_at')),
    q(sb.from('padel_matches').select('*').eq('event_id', id).order('round_no').order('created_at')),
    q(sb.from('padel_signup_log').select('*').eq('event_id', id).order('created_at', { ascending: false }).limit(200)),
  ]);
  const ids = matches.map((m) => m.id);
  const changes = ids.length ? await q(sb.from('padel_elo_changes').select('*').in('match_id', ids).eq('active', true)) : [];
  const price = await q(sb.rpc('padel_event_price', { e: id })).catch(() => null);
  return { ev, signups, matches, changes, log, price };
}

export async function viewEvent(id) {
  const data = await loadEvent(id);
  // Rettigheder og point følger dagens gruppe
  if (data.ev.group_id !== S.groupId) setGroup(data.ev.group_id);
  render(data);

  // Genindlæs når kampe, tilmeldinger eller dagen ændres. Skriver man et resultat, venter vi til man er færdig.
  let timer = null, pending = false;
  const typing = () => {
    const a = document.activeElement;
    return (a && app.contains(a) && ['INPUT', 'SELECT'].includes(a.tagName)) || !!app.querySelector('form.enter:not([hidden]), form.editteams:not([hidden]), details.givebox[open]');
  };
  const refresh = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!location.hash.startsWith('#/fredag/' + id)) return;
      if (typing()) { pending = true; return; }
      pending = false;
      try { await hooks.loadBase(); render(await loadEvent(id)); } catch {}
    }, 400);
  };
  app.onfocusout = () => { if (pending) setTimeout(refresh, 300); };
  const channel = sb.channel('fredag-' + id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'padel_matches', filter: `event_id=eq.${id}` }, refresh)
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'padel_matches' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'padel_signups', filter: `event_id=eq.${id}` }, refresh)
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'padel_signups' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'padel_events', filter: `id=eq.${id}` }, refresh)
    .subscribe();
  // Sikkerhedsnet hvis live-forbindelsen falder ud (fx når telefonen har været låst)
  const poll = setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  const onVisible = () => { if (!document.hidden) refresh(); };
  document.addEventListener('visibilitychange', onVisible);
  onLeave(() => {
    clearTimeout(timer); clearInterval(poll);
    sb.removeChannel(channel);
    document.removeEventListener('visibilitychange', onVisible);
    app.onfocusout = null;
  });
}

// ---------- Beregninger til siden ----------
function context({ ev, signups, matches, changes, log }) {
  const me = S.me.id;
  const signed = signups.map((s) => s.player_id).filter((pid) => !S.profiles[pid]?.deleted_at);
  const courts = ev.court_ids.map(courtById).filter(Boolean).sort((a, b) => a.sort - b.sort);
  const L = lineup(signed, courts.length);

  const rounds = {};
  for (const m of matches) (rounds[m.round_no] ||= []).push(m);
  const roundNos = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  const inRound = (r) => new Set((rounds[r] || []).flatMap((x) => [x.a_left, x.a_right, x.b_left, x.b_right]));
  const cur = rounds[ev.current_round] || [];
  // Rotation styres af en fælles nedtælling (admin starter runderne). Alle andre spiltyper er "frie":
  // hver bane indtaster sit resultat, når kampen er færdig, uden at nogen starter en runde.
  const free = ev.format !== 'rotation';
  const touched = Math.max(0, ...matches.filter((m) => m.status !== 'planlagt').map((m) => m.round_no));
  const base = free ? touched : ev.current_round;
  const futureRounds = roundNos.filter((r) => r > base);
  const roundDone = (r) => (rounds[r] || []).every((m) => m.status === 'bekraeftet');
  const planPlayers = new Set(futureRounds.flatMap((r) => [...inRound(r)]));

  const delta = {};
  for (const c of changes) delta[c.match_id + c.player_id] = c.delta;

  const f = ev.format;
  const totalRounds = Math.max(1, Math.floor(ev.duration_minutes / ev.round_minutes));
  return {
    ev, signups, matches, log, me, signed, courts, L, rounds, roundNos, inRound, cur, futureRounds, delta, totalRounds,
    free, base, roundDone,
    center: centerById(ev.center_id),
    isRot: f === 'rotation', isAm: f === 'americano', isSet: f === 'saet',
    isShare: f !== 'klassisk',
    unit: f === 'americano' ? 'point' : f === 'klassisk' ? 'sæt' : 'partier',
    lastDone: ev.current_round >= totalRounds,
    nextPlanned: !!rounds[ev.current_round + 1],
    roundStart: (r) => new Date(new Date(ev.starts_at).getTime() + (r - 1) * ev.round_minutes * 60e3),
    endsAt: new Date(new Date(ev.starts_at).getTime() + ev.duration_minutes * 60e3),
    planOutdated: futureRounds.length > 0 && ev.status !== 'afsluttet' &&
      (L.playing.some((p) => !planPlayers.has(p)) || [...planPlayers].some((p) => !L.playing.includes(p)) ||
       futureRounds.some((r) => rounds[r].length > courts.length || rounds[r].some((m) => !ev.court_ids.includes(m.court_id)))),
    run: canRun(), admin: canPlan(),
  };
}

// Dagens stilling. For Americano der ikke tæller endnu, beregnes cirka hvad pointene ville blive.
function standingsOf(c) {
  const { matches, delta, ev, isAm, isShare } = c;
  const done = matches.filter((m) => m.status === 'bekraeftet');
  const table = {};
  for (const m of done) {
    for (const [pl, f, a] of [[m.a_left, m.score_a, m.score_b], [m.a_right, m.score_a, m.score_b], [m.b_left, m.score_b, m.score_a], [m.b_right, m.score_b, m.score_a]]) {
      const t = (table[pl] ||= { n: 0, w: 0, f: 0, a: 0, pts: 0 });
      t.n++; t.f += f; t.a += a; if (f > a) t.w++;
      t.pts += delta[m.id + pl] || 0;
    }
  }
  const estimate = isAm && !ev.ranked;
  if (estimate) {
    const elo = Object.fromEntries(Object.values(S.profiles).map((p) => [p.id, groupElo(p.id)]));
    for (const t of Object.values(table)) t.pts = 0;
    for (const m of done.sort((x, y) => x.round_no - y.round_no || x.created_at.localeCompare(y.created_at))) {
      if (m.score_a + m.score_b === 0) continue;
      const ra = (elo[m.a_left] + elo[m.a_right]) / 2, rb = (elo[m.b_left] + elo[m.b_right]) / 2;
      const d = Math.round(32 * (m.score_a / (m.score_a + m.score_b) - 1 / (1 + 10 ** ((rb - ra) / 400))));
      for (const p of [m.a_left, m.a_right]) { elo[p] += d; table[p].pts += d; }
      for (const p of [m.b_left, m.b_right]) { elo[p] -= d; table[p].pts -= d; }
    }
  }
  const diff = (t) => t.f - t.a;
  const rows = Object.entries(table).sort(([, x], [, y]) => (isShare ? y.f - x.f : y.w - x.w) || diff(y) - diff(x));
  return { rows, estimate, confirmed: done.length };
}

// ---------- Afsnit på siden ----------
const sign = (n) => `${n > 0 ? '+' : ''}${n}`;
const signCls = (n) => (n > 0 ? 'up' : n < 0 ? 'dn' : '');

function header(c) {
  const { ev, center, isRot, isAm, courts, admin } = c;
  const status = ev.cancelled_at ? ' · <b class="dn">Aflyst</b>' : ev.status === 'igang' ? ' · <b class="live-txt">● I gang</b>' : ev.status === 'afsluttet' ? ' · Afsluttet' : '';
  return `
    <div class="head"><button class="back" onclick="location.hash='#/fredage'">‹ ${esc(group()?.name || 'Tilbage')}</button>
      ${admin ? `<div class="tools">${isSuper() ? '<button class="icon" id="tvEvent" aria-label="TV-skærm" title="Vis dagen på et TV i centret (kun superadmin)">📺</button>' : ''}${ev.status !== 'afsluttet' ? '<button class="icon" id="shareEvent" aria-label="Del dagen">📤</button>' : ''}<a class="icon" href="#/ret-fredag/${ev.id}" aria-label="Ret dagen">✏️</a></div>` : ''}${editBtn('padel_events', ev.id)}</div>
    <h1 class="cap evtitle">${fmtDate(ev.starts_at, { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
    <p class="muted evsub">${hm(ev.starts_at)}–${hm(c.endsAt)} · ${center ? `<a class="maplink" href="${esc(mapsUrl(center))}" target="_blank" rel="noopener" title="Vis vej til ${esc(center.name)}">📍 ${esc(center.name)}</a>` : ''}${ev.title ? ` · ${esc(ev.title)}` : ''}${status}</p>
    ${quickSettings(c, '')}`;
}

// Spiltype, hold og baner som knapper. Tryk for at ændre direkte på dagen (baner tildeles ofte først på dagen).
function quickSettings(c, status) {
  const { ev, isRot, isAm, courts, run, admin } = c;
  const fmtLabel = `${FORMAT[ev.format]}${isRot ? ` · ${ev.round_minutes} min` : isAm ? ` · ${ev.points_per_match} point` : ''}`;
  const editable = run && ev.status !== 'afsluttet';
  const chip = (key, label) => editable ? `<button class="chip edit" data-qs="${key}">${label} ▾</button>` : `<span class="chip">${label}</span>`;
  const all = S.courts.filter((x) => x.center_id === ev.center_id).sort((a, b) => a.sort - b.sort);
  const seg = (name, opts, val, can) => `<div class="seg qs">${Object.entries(opts).map(([k, v]) =>
    `<button class="segbtn ${k === val ? 'on' : ''}" data-set="${name}" data-val="${k}" ${can ? '' : 'disabled'}>${v}</button>`).join('')}</div>`;
  return `
    <div class="chips static">${admin ? chip('format', fmtLabel) : `<span class="chip">${fmtLabel}</span>`}${admin ? chip('mode', MODE[ev.team_mode]) : `<span class="chip">${MODE[ev.team_mode]}</span>`}${chip('courts', plural(courts.length, 'bane', 'baner'))}${status}</div>
    ${editable ? `<div class="card qspanel" id="qspanel" hidden>
      ${admin ? `<div class="lbl">Spiltype</div>${seg('format', FORMAT, ev.format, true)}
      <div class="lbl">Hold</div>${seg('mode', MODE, ev.team_mode, true)}` : ''}
      <div class="lbl">Baner i dag <small class="muted">(tryk for at slå til og fra)</small></div>
      <div class="seg qs">${all.map((x) => `<button class="segbtn ${ev.court_ids.includes(x.id) ? 'on' : ''}" data-court="${x.id}">${esc(x.name)}</button>`).join('')}</div>
    </div>` : ''}`;
}

// "Din næste kamp": det vigtigste for spilleren selv, øverst. Kort og visuelt: runde, bane, tid og holdene.
// Bane og bolde pr. spiller: banelejen delt ligeligt mellem dem, der spiller, plus bolde. Betales med MobilePay til den, der har booket.
function priceCard(c) {
  const { ev, me, signed, L, run } = c, pr = c.raw?.price;
  if (!pr) return '';
  const plays = signed.includes(me) && !(L.courts && L.waiting.includes(me));
  const payee = pr.payee === me;
  const paid = pr.paid || [];
  const iPaid = paid.includes(me);
  const nr = pr.phone || '';
  const fmt = (n) => String(n).replace(/(\d{2})(?=\d)/g, '$1\u00a0');
  // Dem, der skal betale: alle i dagsplanen (eller de tilmeldte), undtagen den, der har booket
  const inPlan = [...new Set((c.raw?.matches || []).flatMap((m) => [m.a_left, m.a_right, m.b_left, m.b_right]).filter(Boolean))];
  const payers = (inPlan.length ? inPlan : L.courts ? L.playing : signed).filter((p) => p !== pr.payee);
  const overview = run || payee;
  // Har man betalt, forsvinder kortet (admin, superbruger og den, der har booket, ser stadig hvem der har betalt)
  const planned = (c.raw?.matches || []).length > 0;
  // Kortet vises først, når dagsplanen er lavet
  if (!planned) return '';
  if (!overview && (!plays || iPaid)) return '';
  const members = activeMembers(ev.group_id).map((m) => S.profiles[m.player_id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  const booker = `<select id="bookedBy" aria-label="Banen er booket af">${members.map((p) => `<option value="${p.id}" ${p.id === pr.payee ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`;
  return `<div class="card pricecard"><div class="mtitle">💰 Bane og bolde</div>
    <p><b class="big">${pr.total} kr.</b> <small class="muted">pr. spiller</small></p>
    ${plays && !payee && !iPaid && nr ? `<p class="small">Send ${pr.total} kr. med MobilePay til <b>${esc(pr.payee_name || '')}</b> på ${fmt(nr)}, og tryk så <b>Jeg har betalt</b>.</p>
      <div class="mact"><button type="button" class="btn sm primary" data-mpopen="${nr}">📱 MobilePay</button><button type="button" class="btn sm ghost" data-ipaid="1">✓ Jeg har betalt</button></div>
      <p class="muted small">Nummeret kopieres, når du trykker, så du kan sætte det ind i MobilePay.</p>` : ''}
    ${plays && !payee && iPaid ? '<p class="small ok">✓ Du har betalt.</p>' : ''}
    ${overview && payers.length ? `<div class="paidlist">${payers.map((p) => `<button type="button" class="chip sm ${paid.includes(p) ? 'on' : ''}" data-paidfor="${p}" data-on="${paid.includes(p) ? 1 : 0}" title="Tryk for at ændre">${paid.includes(p) ? '✓' : '○'} ${esc(shortName(p))}</button>`).join('')}</div>
      <p class="muted small">${paid.filter((p) => payers.includes(p)).length} af ${payers.length} har betalt til ${payee ? 'dig' : esc(pr.payee_name || '')}.</p>` : ''}
    ${run ? (planned ? `<details class="bookedby"><summary class="muted small">Booket af ${esc(pr.payee_name || '')} · <span class="link sm">Skift</span></summary>${booker}</details>`
      : `<label class="small">Banen er booket af${booker}</label>`) : ''}
  </div>`;
}

// Lille genvej til kalender-abonnementet, indtil man har sat det op
const calDone = () => { try { return localStorage.getItem('fp-cal') === '1'; } catch { return false; } };
const calHint = () => (S.viewAs || calDone() ? '' : '<p class="small calhint"><button type="button" class="link sm" id="evCal">📅 Få dine spilledage i kalenderen</button></p>');

function myNight(c, st) {
  const { ev, me, signed, L, rounds, inRound, roundStart, totalRounds } = c;
  const iAmIn = signed.includes(me);
  const card = (title, body, cls = '') => `<div class="card mine-card ${cls}"><div class="mtitle">${title}</div>${body}</div>`;
  const signBtn = ev.status === 'planlagt'
    ? iAmIn ? '<button class="btn sm" id="signoff">Afmeld mig</button>'
      : canJoin(ev) ? `<button class="btn primary" id="signon">${L.full ? 'Skriv mig på ventelisten' : 'Tilmeld mig'}</button>` : ''
    : '';
  const signRow = signBtn ? `<div class="mact">${signBtn}</div>` : '';

  if (!iAmIn) {
    if (ev.status !== 'planlagt') return '';
    const why = canJoin(ev) ? 'Du er ikke tilmeldt endnu.' : `Denne dag er kun for ${MODE[ev.team_mode].toLowerCase()}.`;
    return card('Din tilmelding', `<p>${why}</p>${signRow}`);
  }
  const waitNo = L.courts ? L.waiting.indexOf(me) : -1;
  if (waitNo >= 0) return card('Din tilmelding', `<p>⏳ Du er nr. <b>${waitNo + 1}</b> på ventelisten.</p>${signRow}`, 'wait');

  if (ev.status === 'afsluttet') {
    const pos = st.rows.findIndex(([pid]) => pid === me);
    if (pos < 0) return '';
    const t = st.rows[pos][1];
    return card('Din dag', `<p>${pos === 0 ? '👑 Du vandt dagen!' : `Du sluttede som nr. <b>${pos + 1}</b> af ${st.rows.length}.`}
      ${t.pts ? `<span class="delta ${signCls(t.pts)}">${st.estimate ? '≈' : ''}${sign(t.pts)} point</span>` : ''}</p>`);
  }

  const myDone = (n) => rounds[n]?.some((x) => x.status === 'bekraeftet' && [x.a_left, x.a_right, x.b_left, x.b_right].includes(me));
  const nos = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  if (!nos.length) return card('Din tilmelding', `<p>✅ Du er med <span class="muted">· nr. ${signed.indexOf(me) + 1} af ${signed.length}</span></p>${signRow}${calHint()}`);
  let r, now;
  if (c.free) {
    // Første runde, hvor jeg mangler at spille (eller holder pause i en runde der ikke er færdig)
    r = nos.find((n) => (inRound(n).has(me) ? !myDone(n) : !c.roundDone(n)));
    now = !!r && (ev.status === 'igang' || r === nos[0]);
  } else {
    const startR = ev.status === 'igang' ? ev.current_round : ev.current_round + 1;
    r = nos.filter((n) => n >= startR && !(n === ev.current_round && myDone(n)))[0];
    now = r === ev.current_round && ev.status === 'igang';
  }
  if (!r) return card('Dine kampe', '<p>✅ Du har spillet alle dine kampe i dag.</p>');
  c.mineRound = r;
  const pill = (t) => `<span class="pill">${t}</span>`;
  const time = now && !c.free ? 'Nu' : `ca. ${hm(roundStart(r))}`;

  if (!inRound(r).has(me)) {
    const nxt = nos.find((n) => n > r && inRound(n).has(me) && !myDone(n));
    return card('Din næste kamp', `<div class="pills">${pill(`Runde ${r}`)}${pill(time)}</div>
      <p class="big">☕ Du holder pause</p>${nxt ? `<p class="muted">Derefter spiller du i runde ${nxt}, ca. ${hm(roundStart(nxt))}.</p>` : ''}${signRow}`);
  }
  const m = rounds[r].find((x) => [x.a_left, x.a_right, x.b_left, x.b_right].includes(me));
  const onA = [m.a_left, m.a_right].includes(me);
  // Mit hold til venstre, modstanderne til højre
  const [ml, mr, ol, or] = onA ? [m.a_left, m.a_right, m.b_left, m.b_right] : [m.b_left, m.b_right, m.a_left, m.a_right];
  const nm = (pid, sd) => `<span class="${pid === me ? 'meName' : ''}">${pid === me ? 'Dig' : esc(first(pid))}<em>${sd}</em></span>`;
  const teams = `<div class="mbody nk"><div class="team">${nm(ml, 'V')}${nm(mr, 'H')}</div><div class="score muted">mod</div><div class="team">${nm(ol, 'V')}${nm(or, 'H')}</div></div>`;
  const canEnter = (now || c.free) && m.status === 'planlagt';
  if (canEnter) c.mineMatch = m.id;
  const todo = canEnter ? `<button class="btn sm primary" data-act="enter" data-id="${m.id}">Indtast resultat</button>`
    + (SR ? `<button class="btn sm" data-act="voice" data-id="${m.id}">🎤 Sig resultat</button>` : '')
    : m.status === 'indtastet' && (onA ? 'a' : 'b') === m.reported_team ? '<p class="muted small">Venter på, at modstanderne godkender rettelsen.</p>' : '';
  return card(now && !c.free ? 'Din kamp nu' : 'Din næste kamp',
    `<div class="pills">${pill(`Runde ${r}${r <= totalRounds ? ` af ${totalRounds}` : ''}`)}${pill(esc(courtById(m.court_id)?.name || ''))}${pill(time)}</div>
    ${teams}
    ${m.status === 'planlagt' ? (() => { const pa = winChance(m, c.ev.group_id); return chanceBar(onA ? pa : 100 - pa, 'I ', ' dem'); })() : ''}
    ${todo.startsWith('<button') ? `<div class="mact">${todo}</div>` : todo}${canEnter ? enterForm(c, m) : ''}${signRow}`, now ? 'now' : '');
}

// Rettelser der venter på mig (modstanderholdet), eller på admin/superbruger. Vises øverst, så de ikke overses.
function approvals(c) {
  const { matches, me, run } = c;
  const team = (m) => ([m.a_left, m.a_right].includes(me) ? 'a' : [m.b_left, m.b_right].includes(me) ? 'b' : null);
  const list = matches.filter((m) => m.status === 'indtastet' && ((team(m) && team(m) !== m.reported_team) || run))
    .sort((x, y) => x.round_no - y.round_no);
  if (!list.length) return '';
  const names = (l, r) => `${esc(first(l))} & ${esc(first(r))}`;
  return `<div class="card approvals"><div class="mtitle">✋ Venter på ${run ? 'godkendelse' : 'din godkendelse'} (${list.length})</div>
    ${list.map((m) => `<div class="appr">
      <small>Runde ${m.round_no} · ${esc(courtById(m.court_id)?.name || '')}</small>
      <p>${names(m.a_left, m.a_right)} <b class="sc">${m.score_a}–${m.score_b}</b> ${names(m.b_left, m.b_right)}</p>
      <small class="muted">${m.changed ? `Rettet${m.prev_score_a != null ? ` fra ${m.prev_score_a}–${m.prev_score_b}` : ''}` : 'Indtastet'}${m.reported_by ? ` af ${esc(first(m.reported_by))}` : ''}</small>
      <div class="mact"><button class="btn sm primary" data-act="confirm" data-id="${m.id}">Godkend</button><button class="btn sm" data-act="reject" data-id="${m.id}" data-changed="${m.changed && m.prev_score_a != null ? 1 : ''}">Afvis</button></div>
    </div>`).join('')}</div>`;
}

function timer(c) {
  const { ev, isRot, totalRounds } = c;
  if (!isRot || ev.status !== 'igang' || !ev.round_started_at) return '';
  return `<div class="timer card"><small>Runde ${ev.current_round} af ${totalRounds}</small><div id="clock">--:--</div><small id="clockSub">tilbage</small></div>`;
}

// Styring af dagen (admin og superbruger): én tydelig hovedknap og resten som små knapper
function runBar(c) {
  const { ev, run, admin, lastDone, futureRounds, nextPlanned, totalRounds, cur, matches, planOutdated } = c;
  if (!run) return '';
  if (ev.status === 'afsluttet') return '<div class="runbar"><button class="btn sm" id="reopen">Genåbn dagen</button></div>';
  const next = ev.current_round + 1;
  const nextLabel = !ev.current_round ? '▶ Start runde 1'
    : lastDone && !nextPlanned ? 'Spil en ekstra runde' : `Start runde ${next}${next <= totalRounds ? ` af ${totalRounds}` : ''}`;
  if (c.free) return freeBar(c);
  const canPlan = !futureRounds.length && !lastDone;
  const canRedoPlan = futureRounds.length && futureRounds.every((r) => c.rounds[r].every((m) => m.status === 'planlagt'));
  const canRedoRound = ev.status === 'igang' && cur.length && cur.every((m) => m.status === 'planlagt');

  let primary;
  if (lastDone && ev.status === 'igang') primary = '<button class="btn primary" id="finish">Afslut dagen</button>';
  else if (canPlan && !ev.current_round) primary = `<button class="btn primary" id="makePlan">📋 Lav dagsplan (${totalRounds} runder)</button>`;
  else primary = `<button class="btn primary" id="nextRound">${nextLabel}</button>`;

  const small = [
    primary.includes('nextRound') ? '' : `<button class="btn sm" id="nextRound">${nextLabel}</button>`,
    canPlan && ev.current_round ? `<button class="btn sm" id="makePlan">📋 Lav dagsplan</button>` : '',
    canRedoPlan ? '<button class="btn sm" id="redoPlan">🔄 Lav dagsplanen om</button>' : '',
    canRedoRound ? `<button class="btn sm" id="redoRound">Lav runde ${ev.current_round} om</button>` : '',
    ev.status === 'igang' && !primary.includes('finish') ? '<button class="btn sm ghost" id="finish">Afslut dagen</button>' : '',
    admin && !matches.length ? '<button class="btn sm ghost danger" id="delEvent">Slet dagen</button>' : '',
  ].filter(Boolean).join('');

  return `<div class="card runbar">${primary}${small ? `<div class="mact">${small}</div>` : ''}</div>
    ${planOutdated ? '<div class="card warnbox">⚠️ Tilmeldingerne er ændret, siden dagsplanen blev lavet. Tryk <b>🔄 Ny plan</b> for at få dem med.</div>' : ''}`;
}

// Frie spiltyper: ingen "Start runde". Lav dagsplanen, og afslut dagen til sidst.
function freeBar(c) {
  const { ev, admin, futureRounds, totalRounds, matches, roundNos, planOutdated } = c;
  const canPlan = !matches.length;
  const canRedoPlan = futureRounds.length > 0;
  const allDone = roundNos.length && roundNos.every(c.roundDone);
  const extra = roundNos.length && !futureRounds.length;
  // Én stor knap kun når der er noget at gøre (lav plan / alt er spillet). Ellers en lille række.
  let primary = '';
  if (canPlan) {
    return `<div class="runbar"><div class="mact"><button class="btn sm primary" id="makePlan" title="${totalRounds} runder">📋 Lav dagsplan</button>${admin ? '<button class="btn sm ghost danger" id="delEvent">Slet dagen</button>' : ''}</div></div>`;
  }
  if (allDone) primary = '<button class="btn primary" id="finish">🏁 Afslut dagen</button>';
  const small = [
    canRedoPlan ? '<button class="btn sm" id="redoPlan">🔄 Ny plan</button>' : '',
    !allDone && ev.status === 'igang' ? '<button class="btn sm ghost" id="finish">Afslut dagen</button>' : '',
    extra ? '<button class="btn sm" id="extraRound">➕ Spil en ekstra runde</button>' : '',
    admin && !matches.length ? '<button class="btn sm ghost danger" id="delEvent">Slet dagen</button>' : '',
  ].filter(Boolean).join('');
  if (!primary && !small) return '';
  return `<div class="${primary ? 'card ' : ''}runbar">${primary}${small ? `<div class="mact">${small}</div>` : ''}</div>
    ${planOutdated ? '<div class="card warnbox">⚠️ Tilmeldingerne er ændret, siden dagsplanen blev lavet. Tryk <b>🔄 Ny plan</b> for at få dem med.</div>' : ''}`;
}

function teamHtml(l, r, me) {
  const n = (pid, s) => `<span class="${pid === me ? 'meName' : ''}">${esc(first(pid))}<em>${s}</em></span>`;
  return `<div class="team">${n(l, 'V')}${n(r, 'H')}</div>`;
}

// Computer: banen set fra oven med navnene i hvert felt. Hold A til venstre, hold B til højre, nettet i midten.
// Set fra hver spillers egen side står venstre-spilleren (V) til venstre: for hold A er det øverst, for hold B nederst.
function courtHtml(m, me, score) {
  const box = (pid, side, pos) => `<div class="pbox ${pos} ${pid === me ? 'me' : ''}"><b>${esc(first(pid))}</b><small>${side === 'V' ? 'Venstre' : 'Højre'}</small></div>`;
  return `<div class="pcourt">
    <div class="phalf a"><div class="pback"></div><div class="pserve">${box(m.a_left, 'V', 'top')}${box(m.a_right, 'H', 'bot')}</div></div>
    <div class="pnet">${score}</div>
    <div class="phalf b"><div class="pserve">${box(m.b_right, 'H', 'top')}${box(m.b_left, 'V', 'bot')}</div><div class="pback"></div></div>
  </div>`;
}

// Vinderchance ud fra holdenes point (gennemsnit af de to spillere), samme formel som ranglisten bruger
function winChance(m, g) {
  const ra = (groupElo(m.a_left, g) + groupElo(m.a_right, g)) / 2, rb = (groupElo(m.b_left, g) + groupElo(m.b_right, g)) / 2;
  return Math.round(100 / (1 + 10 ** ((rb - ra) / 400)));
}
const chanceBar = (pa, labelA = '', labelB = '') => `<div class="wchance" title="Vinderchance ud fra holdenes point">
  <div class="wcbar"><span class="wa" style="width:${pa}%"></span></div>
  <div class="wclbl"><span>${labelA}<b>${pa}%</b></span><small>Vinderchance</small><span><b>${100 - pa}%</b>${labelB}</span></div></div>`;

function matchCard(c, m) {
  const { ev, me, run, delta, isAm, isSet, unit } = c;
  const onA = [m.a_left, m.a_right].includes(me), onB = [m.b_left, m.b_right].includes(me);
  const myTeam = onA ? 'a' : onB ? 'b' : null;
  const future = !c.free && m.round_no > ev.current_round;
  const mic = SR ? `<button class="btn sm" data-act="voice" data-id="${m.id}">🎤 Sig resultat</button>` : '';
  let status = '', actions = '', links = '';
  if (m.status === 'planlagt' && future) {
    // Rotation: kommende runde, kun hold kan rettes (link i toppen af kortet)
  } else if (m.status === 'planlagt') {
    if (m.id === c.mineMatch) status = '<span class="badge">Tast øverst ↑</span>';
    else if (myTeam || run) actions = `<button class="btn sm primary" data-act="enter" data-id="${m.id}">Indtast resultat</button>${mic}`;
  } else if (m.status === 'indtastet') {
    // Et (ændret) resultat skal godkendes af en fra modstanderholdet. Admin og superbruger kan altid.
    const opp = myTeam && myTeam !== m.reported_team;
    const canOk = opp || run;
    status = m.changed
      ? `<span class="badge wait">Ændret${m.prev_score_a != null ? ` fra ${m.prev_score_a}–${m.prev_score_b}` : ''} · afventer modstanderen</span>`
      : '<span class="badge wait">Afventer godkendelse</span>';
    if (canOk) actions = `<button class="btn sm primary" data-act="confirm" data-id="${m.id}">Godkend</button>`;
    if (opp || run) actions += `<button class="btn sm" data-act="reject" data-id="${m.id}" data-changed="${m.changed && m.prev_score_a != null ? 1 : ''}">Afvis</button>`;
    if (myTeam || run) actions += `<button class="btn sm" data-act="enter" data-id="${m.id}">Ret</button>`;
  } else {
    const d = delta[m.id + m.a_left];
    if (d !== undefined) status = `<span class="badge">Point ${sign(d)} / ${sign(-d)}</span>`;
    links = `<button class="link sm" data-act="detail" data-id="${m.id}">📊 Detaljer</button>`;
    // Spillet kamp: kun små links, så listen er kort
    if (run || myTeam) links += `<button class="link sm" data-act="enter" data-id="${m.id}">Ret</button>`;
    if (run) links += `<button class="link sm dn" data-act="reset" data-id="${m.id}">Nulstil</button>`;
  }
  const changeNote = m.status === 'bekraeftet' && !run ? '<small class="muted">Retter du resultatet, skal en fra modstanderholdet godkende ændringen.</small>' : '';
  const score = m.score_a != null ? `<div class="score">${m.score_a}<span>–</span>${m.score_b}</div>` : '<div class="score muted">vs</div>';
  return `<div class="match ${myTeam ? 'mine' : ''}" id="m-${m.id}">
    <div class="mhead"><b>${esc(courtById(m.court_id)?.name || '')}</b><span class="mhr">${editBtn('padel_matches', m.id)}${status}${links}${run && m.status === 'planlagt' ? `<button class="link sm" data-act="teams" data-id="${m.id}">👥 Ret hold</button>` : ''}</span></div>
    <div class="mbody">${teamHtml(m.a_left, m.a_right, me)}${score}${teamHtml(m.b_left, m.b_right, me)}</div>
    ${courtHtml(m, me, m.score_a != null ? `<span class="pscore">${m.score_a}<i>–</i>${m.score_b}</span>` : '<span class="pscore vs">VS</span>')}
    ${pendingFor(m.id) ? `<div class="outq">⏳ ${pendingFor(m.id).a}–${pendingFor(m.id).b} er gemt på telefonen og sendes, når der er net</div>` : ''}
    ${m.status === 'planlagt' ? chanceBar(winChance(m, ev.group_id)) : ''}
    ${actions ? `<div class="mact">${actions}</div>` : ''}
    ${enterForm(c, m, changeNote)}
    ${run && m.status === 'planlagt' ? teamForm(c, m) : ''}
  </div>`;
}

// Felter til resultat. Viser hvilket hold der er hvilket, så man ikke bytter om på tallene.
function enterForm(c, m, note = '') {
  const { ev, isAm, isSet, unit } = c;
  const hint = isAm ? `Point til hvert hold (spil til ${ev.points_per_match} i alt). Skriv jeres egne point, så regnes modstandernes ud.` : isSet ? 'Antal partier i sættet, fx 6‑4 eller 7‑6 (højst 7)' : `Antal ${unit}`;
  const max = ev.format === 'saet' || ev.format === 'klassisk' ? 7 : 99;
  const tn = (l, r) => [l, r].includes(c.me) ? `Dig & ${esc(first(l === c.me ? r : l))}` : `${esc(first(l))} & ${esc(first(r))}`;
  // Sæt: store tal-knapper 0–7, så man ikke skal bruge tastaturet
  const pad = (k, v) => (max === 7 ? `<div class="numpad" data-for="${k}">${[0, 1, 2, 3, 4, 5, 6, 7].map((n) => `<button type="button" class="np ${v === n ? 'on' : ''}" data-n="${n}">${n}</button>`).join('')}</div>` : '');
  const rowA = `<div class="erow"><span class="et">${tn(m.a_left, m.a_right)}</span><input type="number" name="a" min="0" max="${max}" inputmode="numeric" value="${m.score_a ?? ''}" required aria-label="Score ${tn(m.a_left, m.a_right)}"></div>${pad('a', m.score_a)}`;
  const rowB = `<div class="erow"><span class="et">${tn(m.b_left, m.b_right)}</span><input type="number" name="b" min="0" max="${max}" inputmode="numeric" value="${m.score_b ?? ''}" required aria-label="Score ${tn(m.b_left, m.b_right)}"></div>${pad('b', m.score_b)}`;
  // Eget hold står øverst, så man skriver sit eget resultat først
  const meOnB = [m.b_left, m.b_right].includes(c.me);
  return `<form class="enter" hidden data-id="${m.id}">
      ${meOnB ? rowB + rowA : rowA + rowB}
      <div class="mact"><button class="btn sm primary">Gem resultat</button></div>
      <small class="muted">${hint}</small>${note}
    </form>`;
}

// Ret hold. Vælger man en spiller fra en anden kamp i runden, bytter de automatisk plads.
function teamForm(c, m) {
  const used = c.inRound(m.round_no);
  const pool = [...new Set([...c.signed, m.a_left, m.a_right, m.b_left, m.b_right])].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const sel = (name, label, val) => `<label>${label}<select name="${name}">${pool.map((p) =>
    `<option value="${p}" ${p === val ? 'selected' : ''}>${esc(nameOf(p))}${used.has(p) ? '' : ' (pause)'}</option>`).join('')}</select></label>`;
  return `<form class="editteams" hidden data-id="${m.id}">
    <div class="tgrid">${sel('al', 'Hold 1 venstre', m.a_left)}${sel('ar', 'Hold 1 højre', m.a_right)}${sel('bl', 'Hold 2 venstre', m.b_left)}${sel('br', 'Hold 2 højre', m.b_right)}</div>
    <label>Bane<select name="court">${c.courts.map((x) => `<option value="${x.id}" ${x.id === m.court_id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
    <div class="mact"><button class="btn sm primary">Gem hold</button><button type="button" class="btn sm" data-cancel>Annuller</button></div>
    <small class="muted">Vælger du en spiller fra en anden kamp, bytter de plads. Vælger du en bane der er i brug, bytter kampene bane.</small>
  </form>`;
}

function roundBlock(c, r) {
  const { ev, me, L, inRound, totalRounds, roundStart, rounds } = c;
  const live = c.free ? !c.roundDone(r) && rounds[r].some((m) => m.status !== 'planlagt') : r === ev.current_round && ev.status === 'igang';
  const tag = live ? '<span class="badge live">I gang</span>' : c.free && c.roundDone(r) ? '<span class="badge">✅ Spillet</span>' : '';
  const sit = L.playing.filter((p) => !inRound(r).has(p));
  return `<div class="rhead"><h3>Runde ${r}${r <= totalRounds ? ` af ${totalRounds}` : ''} <span class="rtime">ca. ${hm(roundStart(r))}</span></h3>${tag}</div>
    ${sit.length ? `<div class="sitline">☕ Pause: ${sit.map((p) => `<b class="${p === me ? 'meName' : ''}">${esc(first(p))}</b>`).join(', ')}</div>` : ''}
    <div class="mgrid">${rounds[r].map((m) => matchCard(c, m)).join('')}</div>`;
}

// Runderne som faner: man ser én runde ad gangen. Standard er den runde, hvor man selv skal spille.
function roundsSection(c) {
  const { ev, roundNos, rounds } = c;
  if (!roundNos.length) return '';
  const live = (r) => (c.free ? !c.roundDone(r) && rounds[r].some((m) => m.status !== 'planlagt') : r === ev.current_round && ev.status === 'igang');
  const firstOpen = c.free ? roundNos.find((r) => !c.roundDone(r)) : ev.current_round || roundNos[0];
  let sel = (S.evRound || {})[ev.id];
  if (!roundNos.includes(sel)) sel = roundNos.includes(c.mineRound) ? c.mineRound : firstOpen ?? roundNos[roundNos.length - 1];
  c.selRound = sel;
  const tabs = roundNos.map((r) => {
    const done = c.roundDone(r), mine = c.inRound(r).has(c.me);
    return `<button class="rtab ${r === sel ? 'on' : ''} ${done ? 'done' : ''} ${live(r) ? 'live' : ''} ${mine ? 'mine' : ''}" data-rtab="${r}" aria-label="Runde ${r}${done ? ', spillet' : ''}">${done ? '✓' : r}</button>`;
  }).join('');
  return `<div class="rtabs"><span class="rlbl">Runde</span>${tabs}</div>${roundBlock(c, sel)}`;
}

function standingsSection(c, st) {
  const { ev, me, isRot, isSet, isAm, isShare, admin } = c;
  const table = st.rows.length ? `<h3>Dagens stilling</h3><div class="list table">
    <div class="row th"><div class="pos">#</div><div class="grow">Spiller</div><div>K</div><div>${isRot || isSet ? 'Partier' : isAm ? 'Score' : 'Sejre'}</div><div>Point</div></div>
    ${st.rows.map(([pid, t], i) => `<div class="row ${pid === me ? 'me' : ''}"><div class="pos">${i === 0 ? '👑' : i + 1}</div>
      <div class="grow">${esc(nameOf(pid))}</div><div>${t.n}</div><div>${isShare ? `${t.f}–${t.a}` : t.w}</div>
      <div class="delta ${signCls(t.pts)}">${st.estimate ? '≈' : ''}${sign(t.pts)}</div></div>`).join('')}
  </div>` : '';
  const ranked = !isAm ? '' : `<div class="card ranked">${ev.ranked
    ? `✅ Dagen tæller på den officielle rangliste.${isAdmin() ? '<button class="btn sm" id="unrank">Fjern fra ranglisten</button>' : ''}`
    : `ℹ️ Americano tæller ikke på ranglisten, før en admin tilføjer dagen.${st.confirmed ? ' Kolonnen "Point" viser cirka, hvad hver spiller ville få.' : ''}
       ${isAdmin() && st.confirmed ? '<button class="btn primary" id="rank">Tilføj til officiel rangliste</button>' : ''}`}</div>`;
  return table + ranked;
}

// "Mangler én": admin kan med ét tryk give besked til gruppens spillere, der ikke er tilmeldt
const needOf = (c) => (c.ev.status === 'planlagt' && !c.ev.cancelled_at && !c.L.full && c.L.waiting.length ? 4 - c.L.waiting.length : 0);
const needBtn = (c) => (c.run && needOf(c) && new Date(c.ev.starts_at).getTime() > Date.now() - 30 * 60000
  ? `<div class="needrow"><button type="button" class="btn sm" id="needBtn">📣 Mangler ${needOf(c) === 1 ? 'én' : needOf(c)}: giv besked</button></div>` : '');

function signupsSection(c) {
  const { ev, me, signed, L, courts, run, log } = c;
  const person = (ids, wait, offset = 0) => `<div class="people">${ids.map((pid, i) => {
    const p = S.profiles[pid] || {};
    return `<div class="person ${wait ? 'wait' : ''} ${pid === me ? 'meP' : ''}"><small>${offset + i + 1}</small><span>${p.gender === 'kvinde' ? '♀' : '♂'}</span><b class="pn" title="${esc(p.name)}">${esc(shortName(pid))}</b><em>${SIDE_SHORT[p.side] || ''}</em>
      ${run ? `<button class="x" data-unsign="${pid}" aria-label="Afmeld ${esc(p.name)}">×</button>` : ''}</div>`;
  }).join('')}</div>`;
  const head = `<h3>Tilmeldte (${signed.length})</h3>`;
  return `${c.started ? `<details class="card signbox"><summary>${head}<span class="muted">›</span></summary>` : head}
    <div class="card lineup ${L.courts ? 'ok' : ''}">🎾 ${lineupText(L, courts.length)}${needBtn(c)}</div>
    ${signed.length ? person(L.courts ? L.playing : signed, false) : '<p class="muted">Ingen endnu.</p>'}
    ${L.courts && L.waiting.length ? `<h3>Venteliste (${L.waiting.length})</h3>${person(L.waiting, true, L.playing.length)}` : ''}
    ${run && ev.status !== 'afsluttet' ? `<div class="addp"><input type="search" id="addSearch" placeholder="➕ Tilmeld en spiller: søg på navn…" autocomplete="off">
      <div id="addHits" class="hits"></div></div>
      <details class="card importbox" ${S.importOpen ? 'open' : ''}><summary><b>📋 Indsæt en liste</b> <small class="muted">fra MATCHi, Excel eller en besked</small></summary>
        <p class="muted small">Én spiller pr. linje: navn, mail eller telefonnummer. Spillere, der allerede er i appen, bliver tilmeldt (og kommer med i gruppen). Dem, appen ikke kender, får du en liste over.</p>
        <textarea id="importText" rows="5" placeholder="Anna Holm&#10;mikkel@mail.dk&#10;20 30 40 50"></textarea>
        <div class="mact"><button class="btn sm primary" id="importGo">Tilmeld dem</button></div>
        <div id="importRes"></div></details>` : ''}
    ${log.length ? `<details class="faq log"><summary>Til‑ og afmeldinger (${log.length})</summary><div>${log.map((l) => {
      const by = l.done_by && l.done_by !== l.player_id ? ` <small>af ${esc(first(l.done_by))}</small>` : '';
      return `<div class="logrow">${editBtn('padel_signup_log', l.id)}<span class="${l.action === 'til' ? 'ok' : 'dn'}">${l.action === 'til' ? '＋' : '−'}</span>
        <span class="grow">${esc(nameOf(l.player_id))} ${l.action === 'til' ? 'meldte til' : 'meldte fra'}${by}</span>
        <small class="muted">${fmtDate(l.created_at, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></div>`;
    }).join('')}</div></details>` : ''}${c.started ? '</details>' : ''}`;
}

// ---------- Tegn siden ----------
// Aflys: kun før dagen er gået i gang. Dagen bliver liggende, og de tilmeldte får besked.
function cancelBar(c) {
  const { ev, run, matches } = c;
  if (!run || ev.status !== 'planlagt' || ev.current_round > 0 || matches.some((m) => m.status !== 'planlagt')) return '';
  return '<div class="mact cancelrow"><button class="btn sm ghost danger" id="cancelEvent">🚫 Aflys dagen</button></div>';
}
function cancelledCard(c) {
  const { ev, run } = c;
  return `<div class="card warnbox cancelled"><div class="mtitle">🚫 Spilledagen er aflyst</div>
    ${ev.cancel_reason ? `<p>Årsag: ${esc(ev.cancel_reason)}</p>` : ''}
    <p class="muted small">Aflyst ${fmtDate(ev.cancelled_at, { day: 'numeric', month: 'short' })} kl. ${hm(ev.cancelled_at)}${ev.cancelled_by && S.profiles[ev.cancelled_by] ? ` af ${esc(nameOf(ev.cancelled_by))}` : ''}. De tilmeldte har fået besked. Dagen tæller ikke med i ranglisten, og ingen mister deres stime.</p>
    ${run && new Date(ev.starts_at).getTime() > Date.now() ? '<div class="mact"><button class="btn sm" id="uncancelEvent">↩️ Fortryd aflysningen</button></div>' : ''}</div>`;
}

function render(data) {
  const c = context(data);
  const st = standingsOf(c);
  // Før dagen starter er tilmeldingen det vigtigste. Når den er i gang, er det runderne.
  const started = c.ev.status !== 'planlagt' || c.ev.current_round > 0 || c.base > 0;
  c.started = started;
  c.raw = data;
  // Aflyst dag: vises stadig (til historik og statistik), men man kan ikke tilmelde sig
  if (c.ev.cancelled_at) {
    app.innerHTML = `<div class="page event">
      ${header(c)}
      ${cancelledCard(c)}
      ${signupsSection(c)}
    </div>`;
    bind(c);
    return;
  }
  const fineBox = c.run && group(c.ev.group_id)?.fines_enabled ? '<details class="card givebox" id="evFine"><summary><b>💸 Giv en bøde</b></summary><div id="evFineBody"><p class="muted">Henter takster…</p></div></details>' : '';
  // Computer: dagens kampe til venstre, pris, tilmeldte og bøder til højre
  app.innerHTML = isWide() ? `
  <div class="page event wide">
    ${header(c)}
    <div class="wcols">
      <div class="wmain">${approvals(c)}${myNight(c, st)}${timer(c)}${runBar(c)}${cancelBar(c)}${started ? roundsSection(c) + standingsSection(c, st) : roundsSection(c)}</div>
      <aside class="wside">${priceCard(c)}${signupsSection(c)}${fineBox}</aside>
    </div>
  </div>` : `
  <div class="page event">
    ${header(c)}
    ${approvals(c)}
    ${myNight(c, st)}
    ${priceCard(c)}
    ${timer(c)}
    ${runBar(c)}
    ${cancelBar(c)}
    ${started ? roundsSection(c) + standingsSection(c, st) + signupsSection(c) : signupsSection(c) + roundsSection(c)}
    ${fineBox}
  </div>`;
  bind(c);
}

// ---------- Knapper ----------
function bind(c) {
  const { ev, me, L, rounds, cur, matches, courts, futureRounds, totalRounds, nextPlanned, isAm, run } = c;
  const reload = async () => { await hooks.loadBase(); render(await loadEvent(ev.id)); };
  const $ = (id) => document.getElementById(id);
  const act = (el, fn) => el?.addEventListener('click', async (e) => {
    busy(el, true);
    try { await fn(e); } catch (err) { console.error(err); } finally { if (el.isConnected) busy(el, false); }
  });

  // Nedtælling ved rotation
  if ($('clock')) {
    const end = new Date(ev.round_started_at).getTime() + ev.round_minutes * 60e3;
    const flag = `beeped-${ev.id}-${ev.current_round}`;
    const tick = () => {
      const el = $('clock');
      if (!el) return;
      const left = Math.round((end - Date.now()) / 1000), a = Math.abs(left);
      el.textContent = `${left < 0 ? '+' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
      el.parentElement.classList.toggle('over', left <= 0);
      $('clockSub').textContent = left <= 0 ? 'Tiden er gået – skift makker!' : 'tilbage';
      let beeped = false;
      try { beeped = !!sessionStorage.getItem(flag); } catch {}
      if (left <= 0 && left > -60 && !beeped) { try { sessionStorage.setItem(flag, '1'); } catch {} beep(); }
    };
    tick();
    const t = setInterval(tick, 1000);
    onLeave(() => clearInterval(t));
  }

  // Tilmelding
  // I Android/iPhone-appen åbnes kortet bedst via selve adressen (appen sender den videre til Kort/Maps)
  app.querySelector('.maplink')?.addEventListener('click', (e) => { if (window.Capacitor?.isNativePlatform?.()) { e.preventDefault(); location.href = e.currentTarget.href; } });
  act($('needBtn'), async () => {
    const n = needOf(c);
    if (!confirm(`Send en notifikation til gruppens spillere, der ikke er tilmeldt, om at I mangler ${n === 1 ? 'én' : n}?`)) return;
    try { const k = await q(sb.rpc('padel_event_need_v2', { e: ev.id, p_need: n })); toast(k ? `Besked sendt til ${k} ${k === 1 ? 'spiller' : 'spillere'}` : 'Alle i gruppen er allerede tilmeldt'); } catch { /* vist */ }
  });
  $('evCal')?.addEventListener('click', async () => { const { showCalendar } = await import('./club.js'); showCalendar(); });
  act($('signon'), async () => { await q(sb.from('padel_signups').insert({ event_id: ev.id, player_id: me })); toast('Du er tilmeldt'); await reload(); });
  act($('signoff'), async () => {
    const t = await signoffFine(ev.id, me);
    if (!confirm(`Afmeld dig denne dag?${fineWarn(t, 'Du får')}`)) return;
    await q(sb.from('padel_signups').delete().eq('event_id', ev.id).eq('player_id', me));
    toast(t ? `Du er afmeldt. Bøde: ${t.name} ${kr(t.amount)}` : 'Du er afmeldt');
    await reload();
  });
  app.querySelectorAll('[data-unsign]').forEach((b) => (b.onclick = async () => {
    const t = await signoffFine(ev.id, b.dataset.unsign);
    if (!confirm(`Afmeld ${nameOf(b.dataset.unsign)}?${fineWarn(t, `${first(b.dataset.unsign)} får`)}`)) return;
    await q(sb.from('padel_signups').delete().eq('event_id', ev.id).eq('player_id', b.dataset.unsign));
    if (t) toast(`${first(b.dataset.unsign)} er afmeldt og har fået en bøde: ${t.name}`);
    await reload();
  }));
  // Indsæt en liste fra MATCHi/Excel: tilmeld alle, appen kender
  const ib = app.querySelector('details.importbox'); if (ib) ib.ontoggle = () => (S.importOpen = ib.open);
  $('importGo')?.addEventListener('click', async (e) => {
    const lines = $('importText').value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    if (!lines.length) return toast('Indsæt mindst én linje', true);
    busy(e.currentTarget, true);
    try {
      const r = await q(sb.rpc('padel_import_signups_v2', { e: ev.id, p_lines: lines }));
      S.importResult = r; S.importOpen = true;
      toast(r.added.length ? `${r.added.length} tilmeldt` : 'Ingen nye tilmeldte');
      await hooks.loadBase(); await reload();
    } catch { busy(e.currentTarget, false); }
  });
  if (S.importResult && $('importRes')) {
    const r = S.importResult;
    $('importRes').innerHTML = `${r.added.length ? `<p class="ok small">✓ Tilmeldt: ${r.added.map(esc).join(', ')}</p>` : ''}${r.already.length ? `<p class="muted small">Var allerede tilmeldt: ${r.already.map(esc).join(', ')}</p>` : ''}${r.missing.length ? `<p class="warnc small">Ikke fundet i appen (${r.missing.length}): ${r.missing.map(esc).join(', ')}. Send dem invitationslinket, eller opret dem under Admin → Spillere.</p>` : ''}`;
    S.importResult = null;
  }
  // Søg og tilmeld en spiller fra gruppen
  const search = $('addSearch');
  if (search) {
    const others = activeMembers(ev.group_id).map((m) => S.profiles[m.player_id]).filter((p) => p && !c.signed.includes(p.id));
    const draw = () => {
      const t = search.value.trim().toLowerCase();
      const hits = t ? others.filter((p) => p.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(t)) || p.name.toLowerCase().includes(t)).slice(0, 8) : [];
      $('addHits').innerHTML = hits.map((p) => `<button class="hit" data-add="${p.id}">${esc(p.name)}<em>${SIDE_SHORT[p.side] || ''}</em></button>`).join('')
        || (t ? '<p class="muted small">Ingen i gruppen matcher.</p>' : '');
      $('addHits').querySelectorAll('[data-add]').forEach((b) => (b.onclick = async () => {
        busy(b, true);
        try {
          await q(sb.from('padel_signups').insert({ event_id: ev.id, player_id: b.dataset.add }));
          toast(`${nameOf(b.dataset.add)} er tilmeldt`);
          await reload();
          $('addSearch')?.focus();
        } catch { busy(b, false); }
      }));
    };
    search.oninput = draw;
  }

  // Runder: lav hold til en eller flere runder. Hver ny runde tager højde for dem, der lige er lavet.
  const buildRounds = async (from, to) => {
    // Gruppens point bruges til at gøre holdene lige og fordele baner efter niveau
    const players = L.playing.map((pid) => S.profiles[pid]).filter(Boolean).map((p) => ({ ...p, elo: groupElo(p.id, ev.group_id) }));
    const history = await q(sb.from('padel_matches').select('event_id,round_no,a_left,a_right,b_left,b_right,court_id,created_at')
      .order('created_at', { ascending: false }).limit(800));
    const rows = [];
    for (let r = from; r <= to; r++) {
      const res = generateRound({ players, courts, history, eventId: ev.id, mode: ev.team_mode, roundNo: r });
      if (res.error) { toast(res.error, true); return false; }
      const ms = res.matches.map((m) => ({ ...m, event_id: ev.id, round_no: r }));
      rows.push(...ms);
      history.unshift(...ms);
    }
    await q(sb.from('padel_matches').insert(rows));
    return true;
  };
  const lineupOk = () => {
    if (!L.courts) { toast('Der skal være mindst 4 tilmeldte', true); return false; }
    return !L.waiting.length || confirm(`${L.waiting.length} står på venteliste og kommer ikke med. Fortsæt?`);
  };
  const startRound = async (r, rebuild) => {
    if (rebuild && !(await buildRounds(r, r))) return;
    await q(sb.rpc('padel_start_round', { p_event: ev.id, p_round: r }));
    await reload();
  };

  act($('nextRound'), async () => {
    const open = cur.filter((m) => m.status !== 'bekraeftet').length;
    if (open && !confirm(`${open} kamp(e) i runde ${ev.current_round} mangler godkendt resultat. Start næste runde alligevel?`)) return;
    if (!nextPlanned && !lineupOk()) return;
    await startRound(ev.current_round + 1, !nextPlanned);
  });
  // Alle tilmeldte (også den, der laver planen) får en notifikation om, hvor og med hvem de starter
  const planNotify = async (redo) => { try { await sb.rpc('padel_event_plan_notify', { e: ev.id, p_redo: redo }); } catch {} };
  $('bookedBy')?.addEventListener('change', async (e) => {
    try { await q(sb.rpc('padel_event_set_booker', { e: ev.id, p_user: e.target.value })); toast('Gemt. Spillerne betaler til ' + (S.profiles[e.target.value]?.name.split(' ')[0] || '')); await reload(); } catch {}
  });
  // Betaling: spilleren trykker "Jeg har betalt"; admin og den, der har booket, kan hakke af
  app.querySelectorAll('.pricecard [data-ipaid]').forEach((b) => (b.onclick = async () => {
    try { await q(sb.rpc('padel_event_set_paid', { e: ev.id, p_player: me, p_paid: true })); toast('Tak! Betalingen er noteret'); await reload(); } catch {}
  }));
  app.querySelectorAll('.pricecard [data-paidfor]').forEach((b) => (b.onclick = async () => {
    try { await q(sb.rpc('padel_event_set_paid', { e: ev.id, p_player: b.dataset.paidfor, p_paid: b.dataset.on !== '1' })); await reload(); } catch {}
  }));
  app.querySelectorAll('.pricecard [data-mpopen]').forEach((b) => (b.onclick = () => openMobilePay(b.dataset.mpopen)));
  app.querySelectorAll('.pricecard [data-copy]').forEach((b) => (b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); toast('Nummeret er kopieret'); } catch { toast(`Nummeret er ${b.dataset.copy}`); } }));
  act($('makePlan'), async () => {
    if (!lineupOk()) return;
    if (await buildRounds(c.base + 1, totalRounds)) { toast('Dagsplanen er lavet, og de tilmeldte har fået besked'); await planNotify(false); await reload(); }
  });
  act($('redoPlan'), async () => {
    if (!confirm('Lav alle kommende runder om med de nuværende tilmeldte?') || !lineupOk()) return;
    await q(sb.from('padel_matches').delete().eq('event_id', ev.id).gt('round_no', c.base).eq('status', 'planlagt'));
    if (await buildRounds(c.base + 1, Math.max(totalRounds, ...futureRounds))) { toast('Dagsplanen er lavet om, og de tilmeldte har fået besked'); await planNotify(true); await reload(); }
  });
  act($('extraRound'), async () => {
    if (!lineupOk()) return;
    const r = Math.max(0, ...c.roundNos) + 1;
    if (await buildRounds(r, r)) { toast(`Runde ${r} er lavet`); await reload(); }
  });
  act($('redoRound'), async () => {
    if (!confirm(`Lav runde ${ev.current_round} om med nye hold?`)) return;
    await q(sb.from('padel_matches').delete().eq('event_id', ev.id).eq('round_no', ev.current_round).eq('status', 'planlagt'));
    await startRound(ev.current_round, true);
  });
  act($('finish'), async () => {
    const open = matches.filter((m) => m.status !== 'bekraeftet' && (m.status !== 'planlagt' || c.roundNos.some((r) => r === m.round_no && rounds[r].some((x) => x.status !== 'planlagt')))).length;
    if (!confirm(`Afslut dagen? Tilmelding og nye runder lukkes.${open ? `\n\n${open} kamp(e) i påbegyndte runder mangler godkendt resultat.` : ''}`)) return;
    await q(sb.rpc('padel_set_event_status', { p_event: ev.id, p_status: 'afsluttet' })); await reload();
  });
  act($('reopen'), async () => { await q(sb.rpc('padel_set_event_status', { p_event: ev.id, p_status: matches.length ? 'igang' : 'planlagt' })); await reload(); });
  act($('cancelEvent'), async () => {
    const why = prompt('Aflys dagen? De tilmeldte får besked på telefonen og på mail.\n\nSkriv evt. en årsag (fx "Banerne er lukket"):', '');
    if (why === null) return;
    const n = await q(sb.rpc('padel_cancel_event_v2', { p_event: ev.id, p_cancel: true, p_reason: why.trim() || null }));
    toast(n ? `Dagen er aflyst. ${n} ${n === 1 ? 'spiller har' : 'spillere har'} fået besked` : 'Dagen er aflyst');
    await reload();
  });
  act($('uncancelEvent'), async () => {
    if (!confirm('Fortryd aflysningen? De tilmeldte får besked om, at dagen alligevel bliver til noget.')) return;
    await q(sb.rpc('padel_cancel_event_v2', { p_event: ev.id, p_cancel: false, p_reason: null }));
    toast('Dagen er ikke længere aflyst');
    await reload();
  });
  act($('delEvent'), async () => {
    if (!confirm('Slet denne spilledag?')) return;
    await q(sb.from('padel_events').delete().eq('id', ev.id));
    location.hash = '#/fredage';
  });
  // TV-skærm: et hemmeligt link, der viser dagens baner, resultater og stilling live (uden login)
  act($('tvEvent'), async () => {
    const t = await q(sb.rpc('padel_tv_link_v2', { g: ev.group_id }));
    castTv(`${location.origin}/tv/${t}`);
  });
  $('shareEvent')?.addEventListener('click', () =>
    share(`${location.origin}/#/fredag/${ev.id}`, `${ev.title || group()?.name || 'Padel'} ${fmtDate(ev.starts_at)} i ${c.center?.name || ''}. Tilmeld dig her:`));
  act($('rank'), async () => {
    if (!confirm('Tilføj dagen til den officielle rangliste? Pointene beregnes kamp for kamp.')) return;
    await q(sb.rpc('padel_admin_set_ranked', { p_event: ev.id, p_ranked: true })); toast('Dagen tæller nu på ranglisten'); await reload();
  });
  act($('unrank'), async () => {
    if (!confirm('Fjern dagen fra ranglisten? Pointene rulles tilbage.')) return;
    await q(sb.rpc('padel_admin_set_ranked', { p_event: ev.id, p_ranked: false })); await reload();
  });

  // Bøde fra spilledagen (fx for sent fremmøde eller afbud). Dagens tilmeldte står først.
  const fb = $('evFine');
  if (fb) fb.ontoggle = async () => {
    if (!fb.open || fb.dataset.loaded) return;
    fb.dataset.loaded = '1';
    const types = await q(sb.from('padel_fine_types').select('*').eq('group_id', ev.group_id).order('sort'));
    $('evFineBody').innerHTML = giveFormBody(types);
    const byName = (a, b) => a.name.localeCompare(b.name);
    const signedP = c.signed.map((pid) => S.profiles[pid]).filter(Boolean).sort(byName);
    const rest = activeMembers(ev.group_id).map((m) => S.profiles[m.player_id]).filter((p) => p && !c.signed.includes(p.id)).sort(byName);
    bindGive(ev.group_id, ev.id, [...signedP, ...rest], async () => { $('giveFine').reset(); $('giveFine').type.dispatchEvent(new Event('change')); fb.open = false; });
  };

  // Hurtige indstillinger: spiltype, hold og baner
  app.querySelectorAll('[data-qs]').forEach((b) => (b.onclick = () => { const p = $('qspanel'); p.hidden = !p.hidden; }));
  const ROUND_MIN = { rotation: 30, saet: 20, americano: 20, klassisk: 40 };
  app.querySelectorAll('[data-set]').forEach((b) => (b.onclick = async () => {
    const { set, val } = b.dataset;
    if (b.classList.contains('on')) return;
    const upd = set === 'mode' ? { team_mode: val } : {
      format: val, round_minutes: ROUND_MIN[val], points_per_match: val === 'americano' ? (ev.points_per_match || 24) : null,
      ...(matches.some((m) => m.status === 'bekraeftet') ? {} : { ranked: val !== 'americano' }),
    };
    busy(b, true);
    try { await q(sb.from('padel_events').update(upd).eq('id', ev.id)); toast('Gemt'); await reload(); $('qspanel').hidden = false; } catch { busy(b, false); }
  }));
  app.querySelectorAll('[data-court]').forEach((b) => (b.onclick = async () => {
    const id = b.dataset.court;
    const next = ev.court_ids.includes(id) ? ev.court_ids.filter((x) => x !== id) : [...ev.court_ids, id];
    if (!next.length) return toast('Der skal være mindst én bane', true);
    busy(b, true);
    try {
      await q(sb.rpc('padel_set_event_courts', { p_event: ev.id, p_courts: next }));
      // Kampe der ikke er spillet endnu flyttes over på de valgte baner (i banernes rækkefølge)
      const chosen = S.courts.filter((x) => next.includes(x.id)).sort((a, b2) => a.sort - b2.sort).map((x) => x.id);
      for (const [r, ms] of Object.entries(rounds)) {
        if (!c.free && +r < ev.current_round) continue;
        const open = ms.filter((m) => m.status === 'planlagt');
        if (open.length > chosen.length) continue;
        // Behold banen hvis den stadig er valgt og ledig, ellers tag den næste ledige
        const taken = new Set(ms.filter((m) => m.status !== 'planlagt').map((m) => m.court_id));
        const plan = new Map();
        for (const m of open) if (chosen.includes(m.court_id) && !taken.has(m.court_id)) { plan.set(m.id, m.court_id); taken.add(m.court_id); }
        for (const m of open) if (!plan.has(m.id)) { const fr = chosen.find((x) => !taken.has(x)); plan.set(m.id, fr); taken.add(fr); }
        for (const m of open) {
          const t = plan.get(m.id);
          if (t && t !== m.court_id) await q(sb.rpc('padel_admin_set_teams', { p_match: m.id, p_al: m.a_left, p_ar: m.a_right, p_bl: m.b_left, p_br: m.b_right, p_court: t }));
        }
      }
      await reload(); $('qspanel').hidden = false;
    } catch { busy(b, false); }
  }));

  // Kampkort
  const form = (cls, id) => app.querySelector(`form.${cls}[data-id="${id}"]`);
  app.querySelectorAll('[data-rtab]').forEach((b) => (b.onclick = () => {
    S.evRound = { ...(S.evRound || {}), [ev.id]: +b.dataset.rtab };
    const y = scrollY; render(c.raw); scrollTo(0, y);
  }));
  app.querySelectorAll('[data-act]').forEach((b) => (b.onclick = async () => {
    const id = b.dataset.id, a = b.dataset.act;
    const near = () => b.closest('.match, .mine-card')?.querySelector(`form.enter[data-id="${id}"]`) || form('enter', id);
    if (a === 'detail') { showMatchDetail(c, matches.find((x) => x.id === id)); return; }
    if (a === 'enter') { const f = near(); f.hidden = !f.hidden; if (!f.hidden) f.a.focus(); return; }
    if (a === 'teams') { const f = form('editteams', id); f.hidden = !f.hidden; return; }
    if (a === 'voice') {
      const m = matches.find((x) => x.id === id);
      const team = [m.a_left, m.a_right].includes(me) ? 'a' : [m.b_left, m.b_right].includes(me) ? 'b' : null;
      const f = near(); f.hidden = false;
      return listenScore(b, f, team, () => f.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    }
    const ask = { reject: b.dataset.changed ? 'Afvis ændringen? Det tidligere resultat gælder igen.' : 'Afvis resultatet? Det skal så indtastes igen.', reset: 'Nulstil kampen? Pointene rulles tilbage.' }[a];
    if (ask && !confirm(ask)) return;
    const rpc = { confirm: 'padel_confirm_result', reject: 'padel_reject_result', reset: 'padel_admin_reset_match' }[a];
    busy(b, true);
    try { await q(sb.rpc(rpc, { p_match: id })); await reload(); } catch { busy(b, false); }
  }));

  // Hurtig indtastning: tal-knapper i sæt, og ved fast antal point regnes det andet hold ud
  app.querySelectorAll('form.enter').forEach((f) => {
    f.querySelectorAll('.numpad').forEach((np) => np.addEventListener('click', (e) => {
      const b = e.target.closest('.np'); if (!b) return;
      f[np.dataset.for].value = b.dataset.n;
      np.querySelectorAll('.np').forEach((x) => x.classList.toggle('on', x === b));
      haptic('light');
    }));
    if (isAm && ev.points_per_match) {
      const tot = ev.points_per_match;
      ['a', 'b'].forEach((k) => {
        const o = k === 'a' ? 'b' : 'a';
        f[k].addEventListener('input', () => {
          f[k].dataset.typed = '1';
          const v = f[k].value === '' ? NaN : +f[k].value;
          if (!f[o].dataset.typed && Number.isFinite(v) && v >= 0 && v <= tot) { f[o].value = tot - v; f[o].classList.add('auto'); }
        });
      });
    }
  });
  app.querySelectorAll('form.enter').forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault();
    const a = +f.a.value, bb = +f.b.value;
    if (['saet', 'klassisk'].includes(ev.format)) {
      if (a > 7 || bb > 7) return toast('Et hold kan højst få 7 i et sæt', true);
      if (a === 7 && bb === 7) return toast('Begge hold kan ikke have 7', true);
    }
    if (isAm && ev.points_per_match && a + bb !== ev.points_per_match &&
      !confirm(`Det giver ${a + bb} point i alt, men I spiller til ${ev.points_per_match}. Gem alligevel?`)) return;
    const btn = f.querySelector('button');
    busy(btn, true);
    try {
      const old = matches.find((x) => x.id === f.dataset.id);
      if (await reportResult(f.dataset.id, a, bb) === 'queued') { haptic('success'); return render(c.raw); }
      if (run || old.status === 'planlagt') haptic('success');
      toast(run || old.status === 'planlagt' ? 'Resultatet er gemt' : 'Rettelsen er sendt. En fra modstanderholdet skal godkende');
      await reload();
    } catch { busy(btn, false); }
  }));

  app.querySelectorAll('form.editteams').forEach((f) => {
    f.querySelector('[data-cancel]').onclick = () => { f.hidden = true; };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const m = matches.find((x) => x.id === f.dataset.id);
      const nv = [f.al.value, f.ar.value, f.bl.value, f.br.value];
      if (new Set(nv).size < 4) return toast('En spiller kan kun stå ét sted i kampen', true);
      const roundMs = rounds[m.round_no];
      const state = Object.fromEntries(roundMs.map((x) => [x.id, { p: [x.a_left, x.a_right, x.b_left, x.b_right], court: x.court_id, status: x.status }]));
      const old = state[m.id].p.slice();
      const leavers = old.filter((p) => !nv.includes(p));
      state[m.id].p = nv;
      // Spillere hentet fra en anden kamp bytter plads med dem, der forlader denne kamp
      for (const j of nv.filter((p) => !old.includes(p))) {
        for (const [mid, s] of Object.entries(state)) {
          const k = mid === m.id ? -1 : s.p.indexOf(j);
          if (k < 0) continue;
          if (s.status !== 'planlagt') return toast(`${nameOf(j)} spiller i en kamp, der allerede har resultat`, true);
          s.p[k] = leavers.shift();
        }
      }
      // Bane: er den i brug af en anden kamp i runden, bytter de
      if (f.court.value !== m.court_id) {
        for (const [mid, s] of Object.entries(state)) {
          if (mid === m.id || s.court !== f.court.value) continue;
          if (s.status !== 'planlagt') return toast('Banen bruges af en kamp, der allerede har resultat', true);
          s.court = m.court_id;
        }
        state[m.id].court = f.court.value;
      }
      const btn = f.querySelector('button.primary');
      busy(btn, true);
      try {
        for (const x of roundMs) {
          const s = state[x.id];
          if (s.court === x.court_id && s.p.join() === [x.a_left, x.a_right, x.b_left, x.b_right].join()) continue;
          await q(sb.rpc('padel_admin_set_teams', { p_match: x.id, p_al: s.p[0], p_ar: s.p[1], p_bl: s.p[2], p_br: s.p[3], p_court: s.court }));
        }
        toast('Holdene er rettet');
        await reload();
      } catch { busy(btn, false); }
    };
  });

  // "Indtast resultat" fra Din næste kamp
  app.querySelectorAll('.mine-card a[href^="#m-"]').forEach((a) => (a.onclick = (e) => {
    e.preventDefault();
    const id = a.getAttribute('href').slice(3);
    const card = document.getElementById('m-' + id);
    card?.closest('details')?.setAttribute('open', '');
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const f = form('enter', id);
    if (f && a.textContent.includes('Indtast')) { f.hidden = false; setTimeout(() => f.a.focus(), 400); }
  }));
}

// Kampdetaljer: banen med holdene og point, og hvordan pointene ændrede sig. Plus spillerens kampe på samme bane i dag.
function showMatchDetail(c, m) {
  if (!m) return;
  const { me, matches } = c;
  const ch = (c.raw?.changes || []).filter((x) => x.match_id === m.id);
  const dOf = (pid) => ch.find((x) => x.player_id === pid)?.delta;
  const fmtD = (d) => (d == null ? '' : `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)}`);
  const cls = (d) => (d > 0 ? 'up' : d < 0 ? 'dn' : '');
  const aWon = m.score_a > m.score_b, bWon = m.score_b > m.score_a;
  const cell = (pid) => `<div class="mdcell ${pid === me ? 'me' : ''}"><b>${pid === me ? 'Dig' : esc(shortName(pid))}</b><small class="${cls(dOf(pid))}">${fmtD(dOf(pid))}</small></div>`;
  const rows = [m.a_left, m.a_right, m.b_left, m.b_right].filter(Boolean).map((pid) => {
    const x = ch.find((y) => y.player_id === pid);
    return x ? { pid, before: x.elo_before, after: x.elo_before + x.delta, d: x.delta } : { pid };
  }).sort((p, q2) => (q2.d ?? 0) - (p.d ?? 0));
  // Spillerens (eller kortets) kampe på samme bane i dag, runde for runde
  const focus = [m.a_left, m.a_right, m.b_left, m.b_right].includes(me) ? me : m.a_left;
  const mine = matches.filter((x) => x.court_id === m.court_id && x.status === 'bekraeftet' && [x.a_left, x.a_right, x.b_left, x.b_right].includes(focus)).sort((x, y) => x.round_no - y.round_no);
  const setRow = (x) => {
    const onA = [x.a_left, x.a_right].includes(focus);
    const mate = onA ? (x.a_left === focus ? x.a_right : x.a_left) : (x.b_left === focus ? x.b_right : x.b_left);
    const opp = onA ? [x.b_left, x.b_right] : [x.a_left, x.a_right];
    const my = onA ? x.score_a : x.score_b, th = onA ? x.score_b : x.score_a;
    const d = (c.raw?.changes || []).find((y) => y.match_id === x.id && y.player_id === focus)?.delta;
    return `<div class="mdset ${x.id === m.id ? 'on' : ''}"><small class="muted">Runde ${x.round_no}</small>
      <span class="mdteam"><b>${focus === me ? 'Dig' : esc(shortName(focus))}</b><b>${esc(shortName(mate))}</b></span>
      <span class="mdsc"><i class="${cls(d)}">${fmtD(d)}</i><b>${my}–${th}</b></span>
      <span class="mdteam r"><span>${esc(shortName(opp[0]))}</span><span>${esc(shortName(opp[1]))}</span></span></div>`;
  };
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `<div class="modal-card mdcard" role="dialog" aria-modal="true" aria-label="Kampdetaljer">
    <div class="ftop"><b>${esc(courtById(m.court_id)?.name || 'Banen')} · runde ${m.round_no}</b><button class="link sm" id="mdClose">Luk</button></div>
    <div class="mdcourt">
      <div class="mdside ${aWon ? 'won' : ''}">${cell(m.a_left)}${cell(m.a_right)}</div>
      <div class="mdnet"><span class="mdscore">${m.score_a}–${m.score_b}</span></div>
      <div class="mdside ${bWon ? 'won' : ''}">${cell(m.b_left)}${cell(m.b_right)}</div>
    </div>
    ${mine.length > 1 ? `<div class="mtitle">${focus === me ? 'Dine' : `${esc(first(focus))}${/[sxz]$/i.test(first(focus)) ? '’' : 's'}`} kampe på banen i dag</div>${mine.map(setRow).join('')}` : ''}
    ${rows.some((r) => r.d != null) ? `<div class="mdpts"><div class="mtitle">Point efter kampen</div>
      ${rows.map((r) => `<div class="mdrow ${r.pid === me ? 'me' : ''}"><span class="grow">${esc(nameOf(r.pid))}</span><span class="muted">${r.before ?? ''}${r.before != null ? ` → ${r.after}` : ''}</span><b class="${cls(r.d)}">${fmtD(r.d)}</b></div>`).join('')}</div>` : '<p class="muted small">Kampen tæller ikke på ranglisten.</p>'}
  </div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.querySelector('#mdClose').onclick = close;
  onLeave(close);
}
