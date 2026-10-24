// Ranglisten (pr. gruppe, og fælles for superadmin) og den enkelte spillers statistik.
import { sb, S, app, GENDER, SIDE, ROLE, roleIn, isSuper, isAdmin, activeMembers, groupElo, group, groupBar, esc, nameOf, first, fmtDate, q } from '../core.js';
import { startViewAs } from '../viewas.js';
import { editBtn } from '../editmode.js';

// Gruppens godkendte kampe med dato, format og pointændringer
async function groupData(g) {
  const evs = await q(sb.from('padel_events').select('id,starts_at,format').eq('group_id', g));
  if (!evs.length) return { ms: [], changes: [] };
  const ev = Object.fromEntries(evs.map((e) => [e.id, e]));
  const ms = (await q(sb.from('padel_matches').select('id,event_id,a_left,a_right,b_left,b_right,score_a,score_b,created_at')
    .in('event_id', evs.map((e) => e.id)).eq('status', 'bekraeftet').order('created_at'))).map((m) => ({ ...m, ev: ev[m.event_id] }));
  const changes = ms.length ? await q(sb.from('padel_elo_changes').select('match_id,player_id,group_delta,delta,created_at')
    .in('match_id', ms.map((m) => m.id)).eq('active', true).order('created_at', { ascending: false })) : [];
  return { ms, changes };
}

const TABS = [['point', '🏆 Point'], ['maaned', '⭐ Måned'], ['aeg', '🥚 Æg'], ['streak', '🔥 Streak']];
const MONTHS = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];

export async function viewRanking() {
  const showGlobal = isSuper() || S.settings.global_ranking_public;
  const global = S.rankTab === 'global' && showGlobal;
  const kind = S.rankKind || 'point';
  let rows, unit = '', note = '';
  if (global) {
    rows = (await q(sb.rpc('padel_global_ranking'))).map((r) => ({ id: r.id, name: r.name, gender: r.gender, val: r.elo, n: Number(r.matches), form: [] }));
  } else {
    const { ms, changes } = await groupData(S.groupId);
    const people = activeMembers().map((m) => S.profiles[m.player_id]).filter(Boolean);
    const stat = Object.fromEntries(people.map((p) => [p.id, { n: 0, form: [], month: 0, eggs: 0, cur: 0, best: 0 }]));
    for (const c of changes) { const s = stat[c.player_id]; if (s && s.form.length < 5) s.form.push(c.group_delta ?? c.delta); }
    const now = new Date(), mStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const dl = Object.fromEntries(changes.map((c) => [c.match_id + c.player_id, c.group_delta ?? c.delta]));
    for (const m of ms) {
      const sets = ['saet', 'klassisk'].includes(m.ev.format);
      for (const [pid, my, th] of [[m.a_left, m.score_a, m.score_b], [m.a_right, m.score_a, m.score_b], [m.b_left, m.score_b, m.score_a], [m.b_right, m.score_b, m.score_a]]) {
        const s = stat[pid]; if (!s) continue;
        s.n++;
        if (new Date(m.ev.starts_at).getTime() >= mStart) s.month += dl[m.id + pid] || 0;
        if (sets && th === 0 && my >= 6) s.eggs++;
        if (my > th) { s.cur++; s.best = Math.max(s.best, s.cur); } else s.cur = 0;
      }
    }
    const val = { point: (p) => groupElo(p.id), maaned: (p) => stat[p.id].month, aeg: (p) => stat[p.id].eggs, streak: (p) => stat[p.id].cur }[kind];
    rows = people.map((p) => ({ id: p.id, name: p.name, gender: p.gender, val: val(p), ...stat[p.id] }));
    if (kind === 'maaned') { unit = 'point'; note = `Flest point vundet i ${MONTHS[now.getMonth()]}.`; rows = rows.filter((r) => r.n); }
    if (kind === 'aeg') { unit = 'æg'; note = 'Flest sæt vundet 6‑0 (eller 7‑0) i Ét sæt pr. runde og Klassisk.'; rows = rows.filter((r) => r.val > 0); }
    if (kind === 'streak') { unit = 'i træk'; note = 'Flest kampe vundet i træk lige nu. Længste står under navnet.'; rows = rows.filter((r) => r.n); }
  }
  if (S.filter !== 'alle') rows = rows.filter((p) => p.gender === S.filter);
  rows.sort((a, b) => b.val - a.val || (b.best || 0) - (a.best || 0) || a.name.localeCompare(b.name));
  const plain = global || kind === 'point';
  const active = plain ? rows.filter((p) => p.n) : rows, fresh = plain ? rows.filter((p) => !p.n) : [];

  const row = (p, i) => {
    const medal = ['🥇', '🥈', '🥉'][i] || `<span class="rk">${i + 1}</span>`;
    const form = (p.form || []).map((d) => `<i class="${d > 0 ? 'up' : d < 0 ? 'dn' : 'eq'}"></i>`).join('');
    const sub = kind === 'streak' && !global ? `længste ${p.best}` : `${p.n} ${p.n === 1 ? 'kamp' : 'kampe'} <span class="form">${form}</span>`;
    const v = kind === 'maaned' && !global ? `${p.val > 0 ? '+' : ''}${p.val}` : p.val;
    return `<a class="row ${p.id === S.me.id ? 'me' : ''}" href="#/spiller/${p.id}">
      <div class="pos">${medal}</div>${global ? editBtn('padel_profiles', p.id) : editBtn('padel_group_members', `${S.groupId}|${p.id}`)}
      <div class="grow"><b>${esc(p.name)}</b><small>${sub}</small></div>
      <div class="elo">${v}${unit ? `<small class="unit">${unit}</small>` : ''}</div></a>`;
  };

  app.innerHTML = `
  <div class="page">
    <h1>Rangliste</h1>
    ${showGlobal ? `<div class="chips tabs"><button class="chip ${!global ? 'on' : ''}" data-tab="group">${esc(group()?.name || 'Gruppe')}</button>
      <button class="chip ${global ? 'on' : ''}" data-tab="global">🌍 Fælles</button></div>` : groupBar(viewRanking)}
    ${global ? (S.settings.global_ranking_public ? '' : '<p class="muted small">Den fælles rangliste på tværs af grupper er kun synlig for dig som superadmin.</p>')
      : `<div class="tabbar">${TABS.map(([k, t]) => `<button class="tab ${kind === k ? 'on' : ''}" data-kind="${k}">${t}</button>`).join('')}</div>`}
    <div class="chips">${[['alle', 'Alle'], ['mand', 'Mænd'], ['kvinde', 'Kvinder']].map(([k, v]) =>
      `<button class="chip ${S.filter === k ? 'on' : ''}" data-f="${k}">${v}</button>`).join('')}</div>
    ${note ? `<p class="muted small">${note}</p>` : ''}
    <div class="list">${active.map(row).join('') || '<p class="muted pad">Ingen endnu.</p>'}</div>
    ${fresh.length ? `<details class="faq fresh"><summary>Ikke spillet endnu (${fresh.length})</summary><div>${fresh.map((p) =>
      `<a class="logrow" href="#/spiller/${p.id}"><span class="grow">${esc(p.name)}</span><span class="muted">${p.val}</span></a>`).join('')}</div></details>` : ''}
    ${plain ? '<p class="muted small">Alle starter på 1000 point. Slår man et stærkere hold, giver det flere point. <a class="link" href="#/faq">Sådan virker point</a></p>' : ''}
  </div>`;
  app.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { S.filter = b.dataset.f; viewRanking(); }));
  app.querySelectorAll('[data-kind]').forEach((b) => (b.onclick = () => { S.rankKind = b.dataset.kind; viewRanking(); }));
  app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { S.rankTab = b.dataset.tab; viewRanking(); }));
  if (showGlobal && !global && isSuper()) {
    const bar = groupBar(viewRanking);
    if (bar) app.querySelector('.chips.tabs').insertAdjacentHTML('afterend', bar);
  }
}

export async function viewPlayer(id) {
  const p = S.profiles[id];
  if (!p) { app.innerHTML = '<div class="page"><p>Spilleren findes ikke.</p></div>'; return; }
  const [ms, ch] = await Promise.all([
    q(sb.from('padel_matches').select('*, padel_events(starts_at,format,group_id)')
      .or(`a_left.eq.${id},a_right.eq.${id},b_left.eq.${id},b_right.eq.${id}`).eq('status', 'bekraeftet').order('created_at', { ascending: true })),
    q(sb.from('padel_elo_changes').select('match_id,delta,group_delta,group_elo_before').eq('player_id', id).eq('active', true)),
  ]);
  const chg = Object.fromEntries(ch.map((c) => [c.match_id, c]));
  // Kampe i den valgte gruppe, ældste først
  const all = ms.filter((m) => m.padel_events?.group_id === S.groupId).map((m) => {
    const onA = [m.a_left, m.a_right].includes(id);
    const c = chg[m.id];
    return {
      m, date: new Date(m.padel_events.starts_at), sc: onA ? m.score_a : m.score_b, th: onA ? m.score_b : m.score_a,
      mate: onA ? (m.a_left === id ? m.a_right : m.a_left) : (m.b_left === id ? m.b_right : m.b_left),
      opps: onA ? [m.b_left, m.b_right] : [m.a_left, m.a_right],
      d: c?.group_delta ?? c?.delta ?? 0, after: c ? (c.group_elo_before ?? 1000) + (c.group_delta ?? 0) : null,
      set: ['saet', 'klassisk'].includes(m.padel_events.format),
    };
  });
  const rank = activeMembers().map((x) => x.elo).sort((a, b) => b - a).indexOf(groupElo(id)) + 1;
  const canViewAs = !S.viewAs && p.id !== S.realMe.id && (S.realMe.is_superadmin || isAdmin());
  const PER = [['30', '30 dage'], ['90', '90 dage'], ['365', 'År'], ['all', 'Alt']];
  S.statPer ||= '90';
  let cmp = null;

  const render = () => {
    const from = S.statPer === 'all' ? 0 : Date.now() - +S.statPer * 864e5;
    const L = all.filter((x) => x.date.getTime() >= from);
    const w = L.filter((x) => x.sc > x.th).length, l = L.filter((x) => x.sc < x.th).length;
    const pts = L.filter((x) => x.after != null).map((x) => x.after);
    const mePts = L.filter((x) => x.after != null).map((x) => ({ t: x.date.getTime(), v: x.after }));
    // Startpunkt før første kamp i perioden, så kurven også ses efter én kamp
    const f0 = L.find((x) => x.after != null);
    if (f0) mePts.unshift({ t: f0.date.getTime() - 864e5, v: f0.after - f0.d });
    const series = [{ cls: 'me', pts: mePts }];
    if (cmp) series.push({ cls: 'cmp', pts: cmp.hist.filter((x) => x.t >= from) });
    const eggW = L.filter((x) => x.set && x.th === 0 && x.sc >= 6).length, eggL = L.filter((x) => x.set && x.sc === 0 && x.th >= 6).length;
    // Makkere og modstandere: summen af point vundet/tabt sammen med / imod
    const sum = (key) => {
      const t = {};
      for (const x of L) for (const o of key === 'mate' ? [x.mate] : x.opps) { const r = (t[o] ||= { n: 0, d: 0 }); r.n++; r.d += x.d; }
      return Object.entries(t).sort((a, b) => b[1].d - a[1].d);
    };
    const tab = S.statTab || 'mate';
    const list = sum(tab);
    const row = ([pid, r]) => `<a class="row" href="#/spiller/${pid}"><span class="grow"><b>${esc(nameOf(pid))}</b><small>${r.n} ${r.n === 1 ? 'kamp' : 'kampe'}</small></span><span class="delta ${r.d > 0 ? 'up' : r.d < 0 ? 'dn' : ''}">${r.d > 0 ? '+' : ''}${r.d}</span></a>`;
    // Streaks (hele historikken): sejre i træk og uger i træk med kampe
    let cur = 0, best = 0;
    for (const x of all) { if (x.sc > x.th) { cur++; best = Math.max(best, cur); } else cur = 0; }
    const week = (d) => { const t = new Date(d); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t.getTime(); };
    const weeks = [...new Set(all.map((x) => week(x.date)))].sort((a, b) => a - b);
    let wBest = 0, wRun = 0, prev = null;
    for (const wk of weeks) { wRun = prev && wk - prev <= 7 * 864e5 + 36e5 ? wRun + 1 : 1; wBest = Math.max(wBest, wRun); prev = wk; }
    const wNow = prev && week(new Date()) - prev <= 7 * 864e5 + 36e5 ? wRun : 0;

    app.innerHTML = `
    <div class="page stats-page">
      <button class="back" onclick="history.back()">‹ Tilbage</button>
      <div class="head"><h1>${esc(p.name)}</h1>${editBtn('padel_profiles', p.id)}${canViewAs ? '<button class="btn sm" id="viewAsBtn">👁 Se som</button>' : ''}</div>
      <p class="muted">${esc(group()?.name || '')} · ${GENDER[p.gender]} · ${SIDE[p.side]}</p>
      <div class="stats">
        <div><b>${groupElo(id)}</b><span>Point</span></div>
        <div><b>#${rank || '–'}</b><span>Placering</span></div>
        <div><b>${all.length}</b><span>Kampe</span></div>
        <div><b>${all.length ? Math.round((all.filter((x) => x.sc > x.th).length / all.length) * 100) : 0}%</b><span>Vundet</span></div>
      </div>
      <div class="tabbar">${PER.map(([k, t]) => `<button class="tab ${S.statPer === k ? 'on' : ''}" data-per="${k}">${t}</button>`).join('')}</div>
      <div class="card">
        <b>Point over tid</b>
        ${graph(series)}
        ${cmp ? `<p class="legend"><i class="me"></i>${esc(first(id))} <i class="cmp"></i>${esc(nameOf(cmp.id))} <button class="link" id="cmpOff">Fjern</button></p>` : ''}
        <div class="trio"><div><small>Højeste</small><b>${pts.length ? Math.max(...pts) : '–'}</b></div><div><small>Laveste</small><b>${pts.length ? Math.min(...pts) : '–'}</b></div>
          <div><small>Gns.</small><b>${pts.length ? Math.round(pts.reduce((a, b) => a + b, 0) / pts.length) : '–'}</b></div></div>
      </div>
      ${cmp ? h2h(cmp.id) : ''}
      ${!cmp && id !== undefined ? `<div class="cmpbox"><input type="search" id="cmpSearch" placeholder="📈 Sammenlign med en spiller…" autocomplete="off"><div id="cmpHits" class="hits"></div></div>` : ''}
      <div class="card"><b>Kampe</b>
        <div class="trio"><div><small>Vundet</small><b class="ok">${w}</b></div><div><small>Tabt</small><b class="dn">${l}</b></div><div><small>Vinder‑%</small><b>${L.length ? Math.round((w / L.length) * 100) : 0}%</b></div></div>
        ${eggW || eggL ? `<p class="muted small">🥚 Æg (6‑0): ${eggW} vundet · ${eggL} tabt</p>` : ''}
      </div>
      <div class="card"><div class="tabbar inner"><button class="tab ${tab === 'mate' ? 'on' : ''}" data-st="mate">🤝 Makkere</button><button class="tab ${tab === 'opp' ? 'on' : ''}" data-st="opp">⚔️ Modstandere</button></div>
        ${list.length ? `<div class="lbl">🏆 Bedste</div><div class="list">${list.slice(0, 3).filter((x) => x[1].d >= 0).map(row).join('') || '<p class="muted small pad">Ingen endnu</p>'}</div>
        <div class="lbl">⚡ Nemesis</div><div class="list">${list.slice().reverse().slice(0, 3).filter((x) => x[1].d < 0).map(row).join('') || '<p class="muted small pad">Ingen endnu</p>'}</div>`
        : '<p class="muted small">Ingen kampe i perioden.</p>'}
      </div>
      <div class="stats two">
        <div><b>🔥 ${cur}</b><span>Sejre i træk · længste ${best}</span></div>
        <div><b>📅 ${wNow}</b><span>Uger i træk · længste ${wBest}</span></div>
      </div>
      <h3>Seneste kampe</h3>
      <div class="list">${all.slice().reverse().slice(0, 10).map((x) => `<div class="row"><div class="grow"><b>${x.sc}–${x.th}</b> med ${esc(first(x.mate))} mod ${esc(first(x.opps[0]))} & ${esc(first(x.opps[1]))}
        <small>${fmtDate(x.date, { day: 'numeric', month: 'short' })}</small></div><div class="delta ${x.d > 0 ? 'up' : x.d < 0 ? 'dn' : ''}">${x.d > 0 ? '+' : ''}${x.d}</div></div>`).join('') || '<p class="muted pad">Ingen kampe endnu.</p>'}</div>
    </div>`;
    app.querySelectorAll('[data-per]').forEach((b) => (b.onclick = () => { S.statPer = b.dataset.per; render(); }));
    app.querySelectorAll('[data-st]').forEach((b) => (b.onclick = () => { S.statTab = b.dataset.st; render(); }));
    document.getElementById('viewAsBtn')?.addEventListener('click', () => startViewAs(id));
    document.getElementById('cmpOff')?.addEventListener('click', () => { cmp = null; render(); });
    const cs = document.getElementById('cmpSearch');
    if (cs) cs.oninput = () => {
      const t = cs.value.trim().toLowerCase();
      const hits = t ? activeMembers().map((m) => S.profiles[m.player_id]).filter((x) => x && x.id !== id && x.name.toLowerCase().includes(t)).slice(0, 6) : [];
      const box = document.getElementById('cmpHits');
      box.innerHTML = hits.map((x) => `<button class="hit" data-cmp="${x.id}">${esc(x.name)}</button>`).join('');
      box.querySelectorAll('[data-cmp]').forEach((b) => (b.onclick = async () => { cmp = await loadHist(b.dataset.cmp); render(); }));
    };
  };
  // Indbyrdes: som makkere og som modstandere (alle perioder)
  const h2h = (o) => {
    const mates = all.filter((x) => x.mate === o), opp = all.filter((x) => x.opps.includes(o));
    const wl = (L) => `${L.filter((x) => x.sc > x.th).length}–${L.filter((x) => x.sc < x.th).length}`;
    return `<div class="card"><b>${esc(first(id))} og ${esc(nameOf(o))}</b>
      <div class="trio"><div><small>Som makkere</small><b>${wl(mates)}</b><small>${mates.length} ${mates.length === 1 ? 'kamp' : 'kampe'}</small></div>
        <div><small>Mod hinanden</small><b>${wl(opp)}</b><small>${opp.length} ${opp.length === 1 ? 'kamp' : 'kampe'}</small></div>
        <div><small>Point‑forskel</small><b>${groupElo(id) - groupElo(o) > 0 ? '+' : ''}${groupElo(id) - groupElo(o)}</b></div></div></div>`;
  };
  render();
}

// En spillers pointkurve i den valgte gruppe (til sammenligning)
async function loadHist(pid) {
  const [ms, ch] = await Promise.all([
    q(sb.from('padel_matches').select('id, padel_events(starts_at,group_id)')
      .or(`a_left.eq.${pid},a_right.eq.${pid},b_left.eq.${pid},b_right.eq.${pid}`).eq('status', 'bekraeftet')),
    q(sb.from('padel_elo_changes').select('match_id,group_delta,group_elo_before').eq('player_id', pid).eq('active', true)),
  ]);
  const when = Object.fromEntries(ms.filter((m) => m.padel_events?.group_id === S.groupId).map((m) => [m.id, new Date(m.padel_events.starts_at).getTime()]));
  const cs = ch.filter((c) => when[c.match_id] != null).sort((a, b) => when[a.match_id] - when[b.match_id]);
  const hist = cs.map((c) => ({ t: when[c.match_id], v: (c.group_elo_before ?? 1000) + (c.group_delta ?? 0) }));
  if (cs.length) hist.unshift({ t: when[cs[0].match_id] - 864e5, v: cs[0].group_elo_before ?? 1000 });
  return { id: pid, hist };
}

// Linjegraf som SVG, én eller flere spillere, med tid på x-aksen
function graph(series) {
  const all = series.flatMap((s) => s.pts);
  if (series[0].pts.length < 2 && all.length < 2) return '<p class="muted small">Grafen kommer, når der er spillet et par kampe.</p>';
  const W = 320, H = 120;
  const vs = all.map((p) => p.v), ts = all.map((p) => p.t);
  const lo = Math.floor(Math.min(...vs) / 50) * 50, hi = Math.max(Math.ceil(Math.max(...vs) / 50) * 50, lo + 50);
  const t0 = Math.min(...ts), t1 = Math.max(...ts);
  const x = (t) => (t1 === t0 ? W / 2 : 28 + ((t - t0) / (t1 - t0)) * (W - 32)), y = (v) => H - 8 - ((v - lo) / (hi - lo)) * (H - 16);
  // Flere kampe samme dag spredes lidt, så kurven ikke står lodret
  const line = (pts) => pts.map((p, i) => `${(x(p.t) + i * 0.001).toFixed(2)},${y(p.v).toFixed(1)}`).join(' ');
  return `<svg class="pgraph" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Point over tid">
    <text x="0" y="12">${hi}</text><text x="0" y="${H - 4}">${lo}</text>
    <line x1="28" y1="8" x2="28" y2="${H - 8}"/><line x1="28" y1="${H - 8}" x2="${W}" y2="${H - 8}"/>
    ${series.map((s) => (s.pts.length > 1 ? `<polyline class="${s.cls}" points="${line(s.pts)}"/>` : '')).join('')}</svg>`;
}
