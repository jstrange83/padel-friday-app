// Oversigt over fredage, og formularen til at oprette eller rette fredage.
import { sb, S, app, hooks, FORMAT, MODE, isAdmin, canJoin, group, groupBar, groupCenterIds, phoneOf, pendingForMe, nameOf, esc, centerById, fmtDate, toast, q, busy, radios } from '../core.js';
import { lineup } from '../lineup.js';
import { signoffFine, fineWarn, kr } from './fines.js';
import { pushPromptCard, bindPushPrompt } from './notify.js';
import { editBtn } from '../editmode.js';

// Kort til superadmin: slettede spillere der er kommet igen
function noticeCard() {
  if (S.viewAs || !S.notices?.length) return '';
  return `<div class="card approvals notices"><div class="mtitle">♻️ Kommet igen (${S.notices.length})</div>
    ${S.notices.map((n) => `<div class="appr">
      <p><b>${esc(nameOf(n.player_id))}</b> ${esc(n.how)}.</p>
      <small class="muted">${fmtDate(n.created_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${n.elo != null ? ` · har ${n.elo} point med tilbage` : ''}</small>
    </div>`).join('')}
    <div class="mact"><button class="btn sm" id="noticesOk">OK, set</button></div></div>`;
}

// Kort øverst til admin: spillere der venter på at komme med i gruppen
function pendingCard() {
  if (S.viewAs) return '';
  const ps = pendingForMe();
  if (!ps.length) return '';
  const many = new Set(ps.map((m) => m.group_id)).size > 1 || ps.some((m) => m.group_id !== S.groupId);
  return `<div class="card approvals"><div class="mtitle">✋ Vil gerne være med (${ps.length})</div>
    ${ps.map((m) => { const p = S.profiles[m.player_id]; return `<div class="appr">
      <p><b>${esc(p.name)}</b>${many ? ` <span class="muted small">· ${esc(group(m.group_id)?.name || '')}</span>` : ''}</p>
      <small class="muted">${p.gender === 'kvinde' ? 'Kvinde' : 'Mand'}${phoneOf(p.id) ? ` · 📱 ${esc(phoneOf(p.id))}` : ''}</small>
      <div class="mact"><button class="btn sm primary" data-pok="${m.group_id}|${p.id}">Godkend</button><button class="btn sm" data-pno="${m.group_id}|${p.id}">Afvis</button></div>
    </div>`; }).join('')}</div>`;
}

export async function viewEvents() {
  // Hent medlemmer på ny, så admin ser nye anmodninger om at komme med
  try { S.members = await q(sb.from('padel_group_members').select('*')); hooks.renderNav?.(); } catch {}
  const evs = await q(sb.from('padel_events').select('*, padel_signups(player_id, created_at)').eq('group_id', S.groupId).order('starts_at', { ascending: false }).limit(60));
  const now = Date.now() - 6 * 3600e3;
  const upcoming = evs.filter((e) => e.status !== 'afsluttet' && new Date(e.starts_at).getTime() >= now).reverse();
  const running = evs.filter((e) => e.status === 'igang' && !upcoming.includes(e));
  const past = evs.filter((e) => !upcoming.includes(e) && !running.includes(e));
  const card = (e) => {
    e.padel_signups = e.padel_signups.filter((s) => !S.profiles[s.player_id]?.deleted_at);
    const n = e.padel_signups.length;
    const mine = e.padel_signups.some((s) => s.player_id === S.me.id);
    const ids = e.padel_signups.slice().sort((x, y) => x.created_at.localeCompare(y.created_at)).map((x) => x.player_id);
    const L = lineup(ids, e.court_ids.length);
    const waitNo = L.courts ? L.waiting.indexOf(S.me.id) : -1;
    const status = L.courts ? `${L.courts} ${L.courts === 1 ? 'bane' : 'baner'} klar${L.waiting.length ? `, ${L.waiting.length} venter` : ''}` : `mangler ${4 - n} til første bane`;
    const btn = e.status === 'planlagt'
      ? mine ? `<button class="btn sm quick" data-off="${e.id}">Afmeld</button>`
        : canJoin(e) ? `<button class="btn sm primary quick" data-on="${e.id}">Tilmeld</button>` : ''
      : e.status === 'igang' ? '<span class="badge live">I gang</span>' : '';
    // Kort og overskueligt: spiltype (eller egen titel), sted og plads, og om man selv er med
    const what = `${e.title ? esc(e.title) : FORMAT[e.format]}${e.team_mode !== 'aaben' ? ` · ${MODE[e.team_mode]}` : ''}`;
    const me = mine ? (waitNo >= 0 ? `<span class="evme warn">⏳ Nr. ${waitNo + 1} på venteliste</span>` : '<span class="evme ok">✓ Du er med</span>') : '';
    return `<a class="ev ${mine && waitNo < 0 ? 'mine' : ''}" href="#/fredag/${e.id}">${editBtn('padel_events', e.id)}
      <div class="when">${fmtDate(e.starts_at, { weekday: 'short', day: 'numeric', month: 'short' })}<b>${fmtDate(e.starts_at, { hour: '2-digit', minute: '2-digit' })}</b></div>
      <div class="grow"><b>${what}</b>
        <small>${esc(centerById(e.center_id)?.name || '')} · ${n} tilmeldt · ${status}</small>${me}</div>
      ${btn}</a>`;
  };
  const coming = [...running, ...upcoming];
  app.innerHTML = `
  <div class="page">
    <div class="head"><h1>${esc(group()?.name || 'Spilledage')}</h1><div class="tools"><a class="icon bell" href="#/beskeder" aria-label="Beskeder">🔔${S.unread && !S.viewAs ? `<b class="navbadge">${S.unread}</b>` : ''}</a>${isAdmin() && coming.length ? '<a class="btn primary sm" href="#/ny-fredag">+ Ny</a>' : ''}</div></div>
    ${groupBar(viewEvents)}
    ${pendingCard()}
    ${pushPromptCard()}
    ${noticeCard()}
    ${!S.viewAs && !phoneOf(S.me.id) ? '<a class="card warnbox phonetip" href="#/profil">📱 Tilføj dit telefonnummer, så admin kan få fat i dig ›</a>' : ''}
    ${coming.map(card).join('') || (isAdmin()
      ? '<div class="card empty"><p>Der er ingen kommende spilledage endnu. Opret en, så kan spillerne tilmelde sig.</p><a class="btn primary" href="#/ny-fredag">+ Opret spilledag</a></div>'
      : '<p class="muted pad">Der er ingen kommende spilledage endnu. Så snart en admin opretter en, kan du tilmelde dig her.</p>')}
    ${past.length ? `<details class="past"><summary>Tidligere (${past.length})</summary>${past.map(card).join('')}</details>` : ''}
  </div>`;
  const quick = async (e, fn) => {
    e.preventDefault(); e.stopPropagation();
    const btn = e.currentTarget;
    busy(btn, true);
    try { await fn(); await viewEvents(); } catch { busy(btn, false); }
  };
  bindPushPrompt();
  const nok = document.getElementById('noticesOk');
  if (nok) nok.onclick = async () => {
    busy(nok, true);
    try { await q(sb.rpc('padel_notices_seen', { p_ids: S.notices.map((n) => n.id) })); S.notices = []; hooks.renderNav?.(); viewEvents(); } catch { busy(nok, false); }
  };
  // Godkend/afvis nye spillere direkte herfra
  app.querySelectorAll('[data-pok]').forEach((b) => (b.onclick = async () => {
    const [g, p] = b.dataset.pok.split('|');
    busy(b, true);
    try { await q(sb.rpc('padel_set_member', { g, p, p_role: 'bruger', p_status: 'aktiv' })); toast(`${nameOf(p)} er godkendt`); await hooks.loadBase(); viewEvents(); } catch { busy(b, false); }
  }));
  app.querySelectorAll('[data-pno]').forEach((b) => (b.onclick = async () => {
    const [g, p] = b.dataset.pno.split('|');
    if (!confirm(`Afvis ${nameOf(p)}?`)) return;
    busy(b, true);
    try { await q(sb.rpc('padel_set_member', { g, p, p_role: 'bruger', p_status: 'fjernet' })); toast(`${nameOf(p)} er afvist`); await hooks.loadBase(); viewEvents(); } catch { busy(b, false); }
  }));
  app.querySelectorAll('[data-on]').forEach((b) => (b.onclick = (e) => quick(e, async () => {
    await q(sb.from('padel_signups').insert({ event_id: b.dataset.on, player_id: S.me.id }));
    toast('Du er tilmeldt');
  })));
  app.querySelectorAll('[data-off]').forEach((b) => (b.onclick = (e) => quick(e, async () => {
    const t = await signoffFine(b.dataset.off, S.me.id);
    if (!confirm(`Afmeld dig denne dag?${fineWarn(t, 'Du får')}`)) throw new Error('fortrudt');
    await q(sb.from('padel_signups').delete().eq('event_id', b.dataset.off).eq('player_id', S.me.id));
    toast(t ? `Du er afmeldt. Bøde: ${t.name} ${kr(t.amount)}` : 'Du er afmeldt');
  })));
}

// Samme ugedag og klokkeslæt i flere uger i træk (lokal tid, så sommer/vintertid passer)
function weekDates(value, n) {
  if (!value) return [];
  return Array.from({ length: n }, (_, i) => { const d = new Date(value); d.setDate(d.getDate() + 7 * i); return d; });
}

function nextFriday() {
  const d = new Date();
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
  d.setHours(19, 0, 0, 0);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T19:00`;
}

function toLocalInput(d) {
  const x = new Date(d), pad = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

// Opret nye fredage, eller ret en eksisterende (ev)
export async function viewEventForm(ev) {
  if (ev) S.groupId = ev.group_id;
  if (!isAdmin()) return (location.hash = '#/fredage');
  // Kun de centre gruppen må bruge
  const allowed = groupCenterIds();
  const centers = S.centers.filter((c) => allowed.includes(c.id) || c.id === ev?.center_id);
  if (!centers.length) { app.innerHTML = '<div class="page"><button class="back" onclick="history.back()">‹ Tilbage</button><h1>Ingen centre</h1><p class="muted">Gruppen har ikke fået nogen centre endnu. Superadmin vælger dem under Admin.</p></div>'; return; }
  let confirmed = 0;
  if (ev) {
    const ms = await q(sb.from('padel_matches').select('id,status').eq('event_id', ev.id));
    confirmed = ms.filter((m) => m.status === 'bekraeftet').length;
  }
  const v = ev || { center_id: centers[0].id, format: 'rotation', team_mode: 'aaben', duration_minutes: 120, round_minutes: 30, points_per_match: 24, title: '' };
  app.innerHTML = `
  <div class="page">
    <button class="back" onclick="history.back()">‹ Tilbage</button>
    <h1>${ev ? 'Ret spilledag' : 'Ny spilledag'}</h1>
    <p class="muted">${esc(group()?.name || '')}</p>
    ${ev && confirmed ? `<div class="card tip">Der er allerede ${confirmed} godkendt${confirmed === 1 ? '' : 'e'} kamp${confirmed === 1 ? '' : 'e'}. De beholder deres point. Ændringer gælder de kommende runder.</div>` : ''}
    <form class="card" id="nf">
      <label>Center<select name="center">${centers.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
      <div class="lbl">Baner</div><div id="courts" class="checks"></div>
      <label>Dato og tid${ev ? '' : ' (første gang)'}<input type="datetime-local" name="when" value="${ev ? toLocalInput(ev.starts_at) : nextFriday()}" required></label>
      ${ev ? '' : `<label>Gentag<select name="count">${[1, 2, 3, 4, 6, 8].map((n) => `<option value="${n}" ${n === 4 ? 'selected' : ''}>${n === 1 ? 'Kun denne dag' : `${n} uger i træk`}</option>`).join('')}</select>
        <small class="muted" id="countHint"></small></label>`}
      <label>Titel (valgfri)<input name="title" placeholder="${esc(group()?.name || '')}" maxlength="60" value="${esc(v.title || '')}"></label>
      <div class="lbl">Spiltype</div>${radios('format', FORMAT, v.format)}
      <label>Varighed<select name="duration">${[60, 90, 120, 150, 180].map((n) =>
        `<option value="${n}" ${n === v.duration_minutes ? 'selected' : ''}>${n % 60 ? `${Math.floor(n / 60)}½ time` : `${n / 60} ${n === 60 ? 'time' : 'timer'}`}</option>`).join('')}</select></label>
      <label id="ptsWrap">Point pr. kamp<select name="points">${[16, 21, 24, 32].map((n) => `<option value="${n}" ${n === (v.points_per_match || 24) ? 'selected' : ''}>${n} point</option>`).join('')}</select>
        <small class="muted">Americano tæller ikke på ranglisten, før en admin tilføjer dagen bagefter.</small></label>
      <label id="minWrap"><span id="minLabel">Minutter pr. runde</span><input type="number" name="minutes" value="${v.round_minutes}" min="5" max="180" inputmode="numeric"><small id="roundsHint" class="muted"></small></label>
      <div class="lbl">Hold</div>${radios('mode', MODE, v.team_mode)}
      <button class="btn primary" id="createBtn">${ev ? 'Gem ændringer' : 'Opret'}</button>
    </form>
  </div>`;
  const f = document.getElementById('nf');
  const drawCourts = (selected) => {
    document.getElementById('courts').innerHTML = S.courts.filter((c) => c.center_id === f.center.value)
      .map((c) => `<label><input type="checkbox" name="court" value="${c.id}" ${!selected || selected.includes(c.id) ? 'checked' : ''}><span>${esc(c.name)}</span></label>`).join('');
  };
  f.center.value = v.center_id; drawCourts(ev?.court_ids);
  f.center.onchange = () => drawCourts();
  const hint = () => {
    const n = Math.floor(+f.duration.value / (+f.minutes.value || 30));
    document.getElementById('roundsHint').textContent = n ? `Giver ${n} runder` : '';
  };
  f.duration.onchange = hint; f.minutes.oninput = hint; hint();
  const ROUND_MIN = { rotation: 30, saet: 20, americano: 20, klassisk: 40 };
  const fmt = (changed) => {
    const fm = f.format.value;
    document.getElementById('minLabel').textContent = fm === 'rotation' ? 'Minutter pr. runde' : 'Ca. minutter pr. runde (bruges til dagsplanen)';
    document.getElementById('ptsWrap').style.display = fm === 'americano' ? '' : 'none';
    if (changed) { f.minutes.value = ROUND_MIN[fm]; hint(); }
  };
  f.querySelectorAll('[name=format]').forEach((r) => (r.onchange = () => fmt(true))); fmt(false);
  if (!ev) {
    const countHint = () => {
      const ds = weekDates(f.when.value, +f.count.value);
      document.getElementById('countHint').textContent = ds.length > 1 ? ds.map((d) => fmtDate(d, { day: 'numeric', month: 'short' })).join(', ') : '';
      document.getElementById('createBtn').textContent = ds.length > 1 ? `Opret ${ds.length} spilledage` : 'Opret spilledag';
    };
    f.count.onchange = countHint; f.when.onchange = countHint; countHint();
  }
  f.onsubmit = async (e) => {
    e.preventDefault();
    const courts = [...f.querySelectorAll('[name=court]:checked')].map((x) => x.value);
    if (!courts.length) return toast('Vælg mindst én bane', true);
    const base = {
      center_id: f.center.value, title: f.title.value.trim() || null,
      format: f.format.value, team_mode: f.mode.value, round_minutes: +f.minutes.value || 30, points_per_match: f.format.value === 'americano' ? +f.points.value : null,
      duration_minutes: +f.duration.value || 120, court_ids: courts,
    };
    const btn = f.querySelector('button.primary');
    busy(btn, true);
    try {
      if (ev) {
        // Ranglisten: uden godkendte kampe følger den spiltypen. Med godkendte kampe ændres den ikke her.
        const upd = { ...base, starts_at: new Date(f.when.value).toISOString() };
        if (!confirmed) upd.ranked = base.format !== 'americano';
        await q(sb.from('padel_events').update(upd).eq('id', ev.id));
        toast('Dagen er opdateret');
        location.hash = '#/fredag/' + ev.id;
        return;
      }
      const rows = weekDates(f.when.value, +f.count.value).map((d) => ({ ...base, starts_at: d.toISOString(), ranked: base.format !== 'americano', created_by: S.me.id, group_id: S.groupId }));
      const evs = await q(sb.from('padel_events').insert(rows).select());
      toast(evs.length === 1 ? 'Dagen er oprettet' : `${evs.length} spilledage er oprettet`);
      location.hash = evs.length === 1 ? '#/fredag/' + evs[0].id : '#/fredage';
    } catch {} finally { busy(btn, false); }
  };
}

// ---------- Popup: ledige pladser på en spilledag ----------
// Kun når der er ledige pladser, kun til dem der ikke er tilmeldt, og kun de sidste 3 dage før.
// "Ikke denne gang" huskes på telefonen og giver aldrig bøde.
const SKIP = 'fp-skipday';
const skipped = () => { try { return JSON.parse(localStorage.getItem(SKIP) || '[]'); } catch { return []; } };
const skip = (id) => { try { localStorage.setItem(SKIP, JSON.stringify([...skipped(), id].slice(-30))); } catch {} };

export async function askOpenSpots() {
  if (S.viewAs || !S.me || document.querySelector('.modal')) return false;
  const gids = S.members.filter((m) => m.player_id === S.me.id && m.status === 'aktiv').map((m) => m.group_id)
    .filter((g) => { const x = group(g); return x && !x.archived && x.kind !== 'klub'; });
  if (!gids.length) return false;
  try {
    const now = new Date(), soon = new Date(now.getTime() + 3 * 864e5);
    const evs = await q(sb.from('padel_events').select('*, padel_signups(player_id)').in('group_id', gids).eq('status', 'planlagt')
      .gte('starts_at', now.toISOString()).lte('starts_at', soon.toISOString()).order('starts_at', { ascending: true }));
    const e = evs.find((x) => {
      const ids = x.padel_signups.map((s) => s.player_id).filter((p) => !S.profiles[p]?.deleted_at);
      return !ids.includes(S.me.id) && !skipped().includes(x.id) && canJoin(x) && x.court_ids.length * 4 - ids.length > 0;
    });
    if (!e || document.querySelector('.modal')) return false;
    const n = e.padel_signups.filter((s) => !S.profiles[s.player_id]?.deleted_at).length, free = e.court_ids.length * 4 - n;
    const when = `${fmtDate(e.starts_at, { weekday: 'long' })} kl. ${fmtDate(e.starts_at, { hour: '2-digit', minute: '2-digit' })}`;
    const wrap = document.createElement('div');
    wrap.id = 'spotModal';
    wrap.className = 'modal';
    wrap.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="spotTitle">
      <div class="fgicon">🎾</div><h2 id="spotTitle">${free === 1 ? 'Der er 1 ledig plads' : `Der er ${free} ledige pladser`}</h2>
      <p>${esc(group(e.group_id)?.name || '')} spiller <b>${esc(when)}</b> i ${esc(centerById(e.center_id)?.name || '')}. Vil du være med?</p>
      <p class="muted small">${n} er tilmeldt. Svarer du "Ikke denne gang", spørger vi ikke igen om denne dag.</p>
      <div class="mact"><button class="btn" id="spotNo">Ikke denne gang</button><button class="btn primary" id="spotYes">Meld mig til</button></div></div>`;
    document.body.appendChild(wrap);
    wrap.querySelector('#spotNo').onclick = () => { skip(e.id); wrap.remove(); };
    wrap.querySelector('#spotYes').onclick = async (ev) => {
      busy(ev.currentTarget, true);
      try {
        await q(sb.from('padel_signups').insert({ event_id: e.id, player_id: S.me.id }));
        wrap.remove(); toast('Du er tilmeldt 🎾'); location.hash = '#/fredag/' + e.id; hooks.route?.();
      } catch { busy(ev.currentTarget, false); }
    };
    return true;
  } catch { return false; }
}
