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
      .or(`a_left.eq.${id},a_right.eq.${id},b_left.eq.${id},b_right.eq.${id}`).eq('status', 'bekraeftet').order('created_at', { ascending: false })),
    q(sb.from('padel_elo_changes').select('match_id,delta,group_delta').eq('player_id', id).eq('active', true)),
  ]);
  // Kun kampe i den valgte gruppe
  const mine = ms.filter((m) => m.padel_events?.group_id === S.groupId);
  const delta = Object.fromEntries(ch.map((c) => [c.match_id, c.group_delta ?? c.delta]));
  let w = 0, d = 0, l = 0, gf = 0, ga = 0;
  const partners = {};
  const rows = mine.map((m) => {
    const onA = [m.a_left, m.a_right].includes(id);
    const sc = onA ? m.score_a : m.score_b, th = onA ? m.score_b : m.score_a;
    const mate = onA ? (m.a_left === id ? m.a_right : m.a_left) : (m.b_left === id ? m.b_right : m.b_left);
    const opps = onA ? [m.b_left, m.b_right] : [m.a_left, m.a_right];
    partners[mate] = (partners[mate] || 0) + 1;
    if (sc > th) w++; else if (sc < th) l++; else d++;
    gf += sc; ga += th;
    const dl = delta[m.id] ?? 0;
    return `<div class="row"><div class="grow"><b>${sc}–${th}</b> med ${esc(first(mate))} mod ${esc(first(opps[0]))} & ${esc(first(opps[1]))}
      <small>${fmtDate(m.padel_events.starts_at, { day: 'numeric', month: 'short' })}</small></div>
      <div class="delta ${dl > 0 ? 'up' : dl < 0 ? 'dn' : ''}">${dl > 0 ? '+' : ''}${dl}</div></div>`;
  });
  const topMate = Object.entries(partners).sort((a, b) => b[1] - a[1])[0];
  const role = roleIn(id);
  const canViewAs = !S.viewAs && p.id !== S.realMe.id && (S.realMe.is_superadmin || isAdmin());

  app.innerHTML = `
  <div class="page">
    <button class="back" onclick="history.back()">‹ Tilbage</button>
    <div class="head"><h1>${esc(p.name)}</h1>${canViewAs ? '<button class="btn sm" id="viewAsBtn">👁 Se som</button>' : ''}</div>
    <p class="muted">${GENDER[p.gender]} · ${SIDE[p.side]}${role && role !== 'bruger' ? ` · ${ROLE[role]}` : ''} · ${esc(group()?.name || '')}</p>
    <div class="stats">
      <div><b>${groupElo(id)}</b><span>Point</span></div>
      <div><b>${mine.length}</b><span>Kampe</span></div>
      <div><b>${w}/${d}/${l}</b><span>V/U/T</span></div>
      <div><b>${gf - ga > 0 ? '+' : ''}${gf - ga}</b><span>Score</span></div>
    </div>
    ${isSuper() ? `<p class="muted small">Fælles point på tværs af grupper: <b>${p.elo}</b></p>` : ''}
    ${topMate ? `<div class="card">🤝 Oftest makker: <b>${esc(nameOf(topMate[0]))}</b> (${topMate[1]} kampe)</div>` : ''}
    <h3>Seneste kampe</h3>
    <div class="list">${rows.slice(0, 15).join('') || '<p class="muted pad">Ingen kampe endnu.</p>'}</div>
  </div>`;
  document.getElementById('viewAsBtn')?.addEventListener('click', () => startViewAs(id));
}
