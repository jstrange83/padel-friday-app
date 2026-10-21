// Ranglisten og den enkelte spillers statistik.
import { sb, S, app, GENDER, SIDE, ROLE, roleOf, esc, nameOf, first, fmtDate, q } from '../core.js';
import { startViewAs } from '../viewas.js';

export async function viewRanking() {
  const changes = await q(sb.from('padel_elo_changes').select('player_id,delta,created_at').eq('active', true).order('created_at', { ascending: false }));
  const stats = {};
  for (const c of changes) {
    const s = (stats[c.player_id] ||= { n: 0, form: [] });
    s.n++;
    if (s.form.length < 5) s.form.push(c.delta);
  }
  let list = Object.values(S.profiles);
  if (S.filter !== 'alle') list = list.filter((p) => p.gender === S.filter);
  list.sort((a, b) => b.elo - a.elo || a.name.localeCompare(b.name));
  const active = list.filter((p) => stats[p.id]?.n);
  const fresh = list.filter((p) => !stats[p.id]?.n);

  const row = (p, i) => {
    const s = stats[p.id];
    const medal = ['🥇', '🥈', '🥉'][i] || `<span class="rk">${i + 1}</span>`;
    const form = s.form.map((d) => `<i class="${d > 0 ? 'up' : d < 0 ? 'dn' : 'eq'}"></i>`).join('');
    return `<a class="row ${p.id === S.me.id ? 'me' : ''}" href="#/spiller/${p.id}">
      <div class="pos">${medal}</div>
      <div class="grow"><b>${esc(p.name)}</b><small>${s.n} kampe <span class="form">${form}</span></small></div>
      <div class="elo">${p.elo}</div></a>`;
  };

  app.innerHTML = `
  <div class="page">
    <h1>Rangliste</h1>
    <div class="chips">${[['alle', 'Alle'], ['mand', 'Mænd'], ['kvinde', 'Kvinder']].map(([k, v]) =>
      `<button class="chip ${S.filter === k ? 'on' : ''}" data-f="${k}">${v}</button>`).join('')}</div>
    <div class="list">${active.map(row).join('') || '<p class="muted pad">Ingen kampe spillet endnu.</p>'}</div>
    ${fresh.length ? `<details class="faq fresh"><summary>Ikke spillet endnu (${fresh.length})</summary><div>${fresh.map((p) =>
      `<a class="logrow" href="#/spiller/${p.id}"><span class="grow">${esc(p.name)}</span><span class="muted">${p.elo}</span></a>`).join('')}</div></details>` : ''}
    <p class="muted small">Alle starter på 1000 point. Slår man et stærkere hold, giver det flere point. <a class="link" href="#/faq">Sådan virker point</a></p>
  </div>`;
  app.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { S.filter = b.dataset.f; viewRanking(); }));
}

export async function viewPlayer(id) {
  const p = S.profiles[id];
  if (!p) { app.innerHTML = '<div class="page"><p>Spilleren findes ikke.</p></div>'; return; }
  const [ms, ch] = await Promise.all([
    q(sb.from('padel_matches').select('*, padel_events(starts_at,format)')
      .or(`a_left.eq.${id},a_right.eq.${id},b_left.eq.${id},b_right.eq.${id}`).eq('status', 'bekraeftet').order('created_at', { ascending: false })),
    q(sb.from('padel_elo_changes').select('match_id,delta').eq('player_id', id).eq('active', true)),
  ]);
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
  const canViewAs = S.realMe?.is_admin && !S.viewAs && p.id !== S.realMe.id;

  app.innerHTML = `
  <div class="page">
    <button class="back" onclick="history.back()">‹ Tilbage</button>
    <div class="head"><h1>${esc(p.name)}</h1>${canViewAs ? '<button class="btn sm" id="viewAsBtn">👁 Se som</button>' : ''}</div>
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
  document.getElementById('viewAsBtn')?.addEventListener('click', () => startViewAs(id));
}
