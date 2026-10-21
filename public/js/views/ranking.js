// Ranglisten (pr. gruppe, og fælles for superadmin) og den enkelte spillers statistik.
import { sb, S, app, GENDER, SIDE, ROLE, roleIn, isSuper, isAdmin, activeMembers, groupElo, group, groupBar, esc, nameOf, first, fmtDate, q } from '../core.js';
import { startViewAs } from '../viewas.js';

// Gruppens kampe (til formen og antal kampe pr. spiller)
async function groupChanges(g) {
  const evs = await q(sb.from('padel_events').select('id').eq('group_id', g));
  if (!evs.length) return [];
  const ms = await q(sb.from('padel_matches').select('id').in('event_id', evs.map((e) => e.id)).eq('status', 'bekraeftet'));
  if (!ms.length) return [];
  return q(sb.from('padel_elo_changes').select('player_id,group_delta,delta,created_at').in('match_id', ms.map((m) => m.id)).eq('active', true).order('created_at', { ascending: false }));
}

export async function viewRanking() {
  const showGlobal = isSuper() || S.settings.global_ranking_public;
  const global = S.rankTab === 'global' && showGlobal;
  let rows;
  if (global) {
    rows = (await q(sb.rpc('padel_global_ranking'))).map((r) => ({ id: r.id, name: r.name, gender: r.gender, elo: r.elo, n: Number(r.matches), form: [] }));
  } else {
    const changes = await groupChanges(S.groupId);
    const stats = {};
    for (const c of changes) {
      const s = (stats[c.player_id] ||= { n: 0, form: [] });
      s.n++;
      if (s.form.length < 5) s.form.push(c.group_delta ?? c.delta);
    }
    rows = activeMembers().map((m) => S.profiles[m.player_id]).filter(Boolean)
      .map((p) => ({ id: p.id, name: p.name, gender: p.gender, elo: groupElo(p.id), ...(stats[p.id] || { n: 0, form: [] }) }));
  }
  if (S.filter !== 'alle') rows = rows.filter((p) => p.gender === S.filter);
  rows.sort((a, b) => b.elo - a.elo || a.name.localeCompare(b.name));
  const active = rows.filter((p) => p.n), fresh = rows.filter((p) => !p.n);

  const row = (p, i) => {
    const medal = ['🥇', '🥈', '🥉'][i] || `<span class="rk">${i + 1}</span>`;
    const form = p.form.map((d) => `<i class="${d > 0 ? 'up' : d < 0 ? 'dn' : 'eq'}"></i>`).join('');
    return `<a class="row ${p.id === S.me.id ? 'me' : ''}" href="#/spiller/${p.id}">
      <div class="pos">${medal}</div>
      <div class="grow"><b>${esc(p.name)}</b><small>${p.n} kampe <span class="form">${form}</span></small></div>
      <div class="elo">${p.elo}</div></a>`;
  };

  app.innerHTML = `
  <div class="page">
    <h1>Rangliste</h1>
    ${showGlobal ? `<div class="chips tabs"><button class="chip ${!global ? 'on' : ''}" data-tab="group">${esc(group()?.name || 'Gruppe')}</button>
      <button class="chip ${global ? 'on' : ''}" data-tab="global">🌍 Fælles</button></div>` : groupBar(viewRanking)}
    ${global && !S.settings.global_ranking_public ? '<p class="muted small">Den fælles rangliste på tværs af grupper er kun synlig for dig som superadmin.</p>' : ''}
    <div class="chips">${[['alle', 'Alle'], ['mand', 'Mænd'], ['kvinde', 'Kvinder']].map(([k, v]) =>
      `<button class="chip ${S.filter === k ? 'on' : ''}" data-f="${k}">${v}</button>`).join('')}</div>
    <div class="list">${active.map(row).join('') || '<p class="muted pad">Ingen kampe spillet endnu.</p>'}</div>
    ${fresh.length ? `<details class="faq fresh"><summary>Ikke spillet endnu (${fresh.length})</summary><div>${fresh.map((p) =>
      `<a class="logrow" href="#/spiller/${p.id}"><span class="grow">${esc(p.name)}</span><span class="muted">${p.elo}</span></a>`).join('')}</div></details>` : ''}
    <p class="muted small">Alle starter på 1000 point. Slår man et stærkere hold, giver det flere point. <a class="link" href="#/faq">Sådan virker point</a></p>
  </div>`;
  app.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { S.filter = b.dataset.f; viewRanking(); }));
  app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => {
    S.rankTab = b.dataset.tab;
    viewRanking();
  }));
  // Superadmin med flere grupper: vælg gruppe under fanen
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

  const render = () => {
    const from = S.statPer === 'all' ? 0 : Date.now() - +S.statPer * 864e5;
    const L = all.filter((x) => x.date.getTime() >= from);
    const w = L.filter((x) => x.sc > x.th).length, l = L.filter((x) => x.sc < x.th).length;
    const pts = L.filter((x) => x.after != null).map((x) => x.after);
    const eggW = L.filter((x) => x.set && x.th === 0 && x.sc >= 6).length, eggL = L.filter((x) => x.set && x.sc === 0 && x.th >= 6).length;
    // Makkere og modstandere: summen af point vundet/tabt sammen med / imod
    const sum = (key) => {
      const t = {};
      for (const x of L) for (const o of key === 'mate' ? [x.mate] : x.opps) { const r = (t[o] ||= { n: 0, d: 0 }); r.n++; r.d += x.d; }
      return Object.entries(t).sort((a, b) => b[1].d - a[1].d);
    };
    const tab = S.statTab || 'mate';
    const list = sum(tab);
    const row = ([pid, r]) => `<a class="row" href="#/spiller/${pid}"><span class="grow"><b>${esc(nameOf(pid))}</b><small>${r.n} kampe</small></span><span class="delta ${r.d > 0 ? 'up' : r.d < 0 ? 'dn' : ''}">${r.d > 0 ? '+' : ''}${r.d}</span></a>`;
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
      <div class="head"><h1>${esc(p.name)}</h1>${canViewAs ? '<button class="btn sm" id="viewAsBtn">👁 Se som</button>' : ''}</div>
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
        ${graph(pts)}
        <div class="trio"><div><small>Højeste</small><b>${pts.length ? Math.max(...pts) : '–'}</b></div><div><small>Laveste</small><b>${pts.length ? Math.min(...pts) : '–'}</b></div>
          <div><small>Gns.</small><b>${pts.length ? Math.round(pts.reduce((a, b) => a + b, 0) / pts.length) : '–'}</b></div></div>
      </div>
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
  };
  render();
}

// Enkel linjegraf som SVG
function graph(pts) {
  if (pts.length < 2) return '<p class="muted small">Grafen kommer, når der er spillet et par kampe.</p>';
  const W = 320, H = 120, lo = Math.floor(Math.min(...pts) / 50) * 50, hi = Math.ceil(Math.max(...pts) / 50) * 50 || lo + 50;
  const x = (i) => (i / (pts.length - 1)) * (W - 30) + 28, y = (v) => H - 8 - ((v - lo) / (hi - lo || 1)) * (H - 16);
  const line = pts.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `<svg class="pgraph" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Point over tid">
    <text x="0" y="12">${hi}</text><text x="0" y="${H - 4}">${lo}</text>
    <line x1="28" y1="8" x2="28" y2="${H - 8}"/><line x1="28" y1="${H - 8}" x2="${W}" y2="${H - 8}"/>
    <polyline points="${line}"/></svg>`;
}
