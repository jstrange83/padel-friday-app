// Den fælles rangliste og den enkelte spillers statistik.
import { sb, S, app, GENDER, SIDE, ROLE, roleIn, isSuper, isAdmin, activeMembers, groupElo, group, groupBar, esc, nameOf, first, fmtDate, q } from '../core.js';
import { startViewAs } from '../viewas.js';
import { editBtn } from '../editmode.js';

const TABS = [['point', '🏆 Point'], ['maaned', '⭐ Måned'], ['aeg', '🥚 Æg'], ['streak', '🔥 Streak']];
const MONTHS = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];
const MODE_TXT = { alle: 'Alle spillere fra alle grupper', gruppe: `Kun spillere fra gruppen`, ingen: 'Gruppen har ingen rangliste' };

// Én fælles rangliste med samme point i alle grupper. Gruppens admin bestemmer, om den viser alle eller kun gruppen.
export async function viewRanking() {
  const kind = S.rankKind || 'point';
  const mode = group()?.ranking_mode || 'alle';
  if (mode === 'ingen' && !isAdmin()) {
    app.innerHTML = `<div class="page"><h1>Rangliste</h1>${groupBar(viewRanking)}<p class="muted">${esc(group()?.name || 'Gruppen')} har ikke en rangliste. Kampene giver stadig point på den fælles rangliste.</p></div>`;
    return;
  }
  const data = await q(sb.rpc('padel_ranking', { g: S.groupId }));
  const now = new Date();
  const val = { point: (r) => r.elo, maaned: (r) => r.month_pts, aeg: (r) => r.eggs, streak: (r) => r.cur_streak }[kind];
  let rows = data.map((r) => ({ id: r.id, name: r.name, gender: r.gender, val: val(r), n: r.matches, form: r.form || [], best: r.best_streak }));
  let unit = '', note = '';
  if (kind === 'maaned') { unit = 'point'; note = `Flest point vundet i ${MONTHS[now.getMonth()]}.`; rows = rows.filter((r) => r.n && r.val); }
  if (kind === 'aeg') { unit = 'æg'; note = 'Flest sæt vundet 6‑0 (eller 7‑0) i Ét sæt pr. runde og Klassisk.'; rows = rows.filter((r) => r.val > 0); }
  if (kind === 'streak') { unit = 'i træk'; note = 'Flest kampe vundet i træk lige nu. Længste står under navnet.'; rows = rows.filter((r) => r.n); }
  if (S.filter !== 'alle') rows = rows.filter((p) => p.gender === S.filter);
  rows.sort((a, b) => b.val - a.val || (b.best || 0) - (a.best || 0) || a.name.localeCompare(b.name));
  const plain = kind === 'point';
  const active = plain ? rows.filter((p) => p.n) : rows, fresh = plain ? rows.filter((p) => !p.n) : [];
  // Kun spillere fra egne grupper har en statistikside, man kan åbne
  const link = (p) => (S.profiles[p.id] ? `href="#/spiller/${p.id}"` : '');

  const row = (p, i) => {
    const medal = ['🥇', '🥈', '🥉'][i] || `<span class="rk">${i + 1}</span>`;
    const form = (p.form || []).map((d) => `<i class="${d > 0 ? 'up' : d < 0 ? 'dn' : 'eq'}"></i>`).join('');
    const sub = kind === 'streak' ? `længste ${p.best}` : `${p.n} ${p.n === 1 ? 'kamp' : 'kampe'} <span class="form">${form}</span>`;
    const v = kind === 'maaned' ? `${p.val > 0 ? '+' : ''}${p.val}` : p.val;
    return `<a class="row ${p.id === S.me.id ? 'me' : ''}" ${link(p)}>
      <div class="pos">${medal}</div>${editBtn('padel_profiles', p.id)}
      <div class="grow"><b>${esc(p.name)}</b><small>${sub}</small></div>
      <div class="elo">${v}${unit ? `<small class="unit">${unit}</small>` : ''}</div></a>`;
  };

  app.innerHTML = `
  <div class="page">
    <h1>Rangliste</h1>
    ${groupBar(viewRanking)}
    ${mode === 'ingen' ? '<div class="card warnbox">Gruppen har valgt ingen rangliste, så spillerne kan ikke se den. Du ser den, fordi du er admin.</div>' : ''}
    <p class="muted small">${mode === 'gruppe' ? `Viser kun spillere fra ${esc(group()?.name || 'gruppen')}` : 'Fælles rangliste for alle grupper'}${isAdmin() ? ' · <a class="link" href="#/admin">skift under Admin</a>' : ''}</p>
    <div class="tabbar">${TABS.map(([k, t]) => `<button class="tab ${kind === k ? 'on' : ''}" data-kind="${k}">${t}</button>`).join('')}</div>
    <div class="chips">${[['alle', 'Alle'], ['mand', 'Mænd'], ['kvinde', 'Kvinder']].map(([k, v]) =>
      `<button class="chip ${S.filter === k ? 'on' : ''}" data-f="${k}">${v}</button>`).join('')}</div>
    ${note ? `<p class="muted small">${note}</p>` : ''}
    <div class="list">${active.map(row).join('') || '<p class="muted pad">Ingen endnu.</p>'}</div>
    ${fresh.length ? `<details class="faq fresh"><summary>Ikke spillet endnu (${fresh.length})</summary><div>${fresh.map((p) =>
      `<a class="logrow" ${link(p)}><span class="grow">${esc(p.name)}</span><span class="muted">${p.val}</span></a>`).join('')}</div></details>` : ''}
    ${plain ? '<p class="muted small">Alle starter på 1000 point. Slår man et stærkere hold, giver det flere point. <a class="link" href="#/faq">Sådan virker point</a></p>' : ''}
  </div>`;
  app.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { S.filter = b.dataset.f; viewRanking(); }));
  app.querySelectorAll('[data-kind]').forEach((b) => (b.onclick = () => { S.rankKind = b.dataset.kind; viewRanking(); }));
}

export async function viewPlayer(id) {
  const p = S.profiles[id];
  if (!p) { app.innerHTML = '<div class="page"><p>Spilleren findes ikke.</p></div>'; return; }
  const [ms, ch] = await Promise.all([
    q(sb.from('padel_matches').select('*, padel_events(starts_at,format,group_id)')
      .or(`a_left.eq.${id},a_right.eq.${id},b_left.eq.${id},b_right.eq.${id}`).eq('status', 'bekraeftet').order('created_at', { ascending: true })),
    q(sb.from('padel_elo_changes').select('match_id,delta,elo_before').eq('player_id', id).eq('active', true)),
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
      d: c?.delta ?? 0, after: c ? (c.elo_before ?? 1000) + (c.delta ?? 0) : null,
      set: ['saet', 'klassisk'].includes(m.padel_events.format),
    };
  });
  const rank = activeMembers().map((x) => groupElo(x.player_id)).sort((a, b) => b - a).indexOf(groupElo(id)) + 1;
  const canViewAs = !S.viewAs && p.id !== S.realMe.id && (isSuper() || isAdmin());
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
    q(sb.from('padel_elo_changes').select('match_id,delta,elo_before').eq('player_id', pid).eq('active', true)),
  ]);
  const when = Object.fromEntries(ms.filter((m) => m.padel_events?.group_id === S.groupId).map((m) => [m.id, new Date(m.padel_events.starts_at).getTime()]));
  const cs = ch.filter((c) => when[c.match_id] != null).sort((a, b) => when[a.match_id] - when[b.match_id]);
  const hist = cs.map((c) => ({ t: when[c.match_id], v: (c.elo_before ?? 1000) + (c.delta ?? 0) }));
  if (cs.length) hist.unshift({ t: when[cs[0].match_id] - 864e5, v: cs[0].elo_before ?? 1000 });
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
