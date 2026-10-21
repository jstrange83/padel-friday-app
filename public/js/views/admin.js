// Admin: invitationer, spillere (rolle, ret, se som) og centre/baner.
import { sb, S, app, hooks, GENDER, SIDE, ROLE, roleOf, esc, nameOf, courtById, centerById, toast, q, radios, share } from '../core.js';
import { startViewAs } from '../viewas.js';

export async function viewAdmin() {
  const players = Object.values(S.profiles).sort((a, b) => a.name.localeCompare(b.name));
  const roleBadge = (p) => (roleOf(p) !== 'bruger' ? ` <span class="badge role-${roleOf(p)}">${ROLE[roleOf(p)]}</span>` : '');

  app.innerHTML = `
  <div class="page">
    <h1>Admin</h1>
    <div class="card">
      <b>Inviter spillere</b>
      <p class="muted small">Send linket i jeres gruppechat. Det åbner direkte på "Opret konto".</p>
      <button class="btn primary" id="invite">📤 Del invitationslink</button>
    </div>

    <h3>Spillere (${players.length})</h3>
    <input type="search" id="playerSearch" placeholder="Find spiller…" autocomplete="off">
    <div class="list" id="players">${players.map((p) => `
      <details class="prow" data-name="${esc(p.name.toLowerCase())}">
        <summary><span class="grow"><b>${esc(p.name)}</b>${roleBadge(p)}<small>${GENDER[p.gender]} · ${SIDE[p.side]} · ${p.elo} point</small></span><span class="muted">›</span></summary>
        <div class="ppanel" id="p-${p.id}">
          <label>Rolle<select class="rolesel" data-role="${p.id}">${Object.entries(ROLE).map(([k, v]) =>
            `<option value="${k}" ${roleOf(p) === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <div class="mact">
            <button class="btn sm" data-edit="${p.id}">✏️ Ret navn, køn, side</button>
            ${p.id !== S.me.id ? `<button class="btn sm" data-viewas="${p.id}">👁 Se som</button>` : ''}
            <a class="btn sm" href="#/spiller/${p.id}">📊 Statistik</a>
          </div>
        </div>
      </details>`).join('')}</div>

    <h3>Centre og baner</h3>
    ${S.centers.map((c) => `<div class="card">
      <div class="head"><b>${esc(c.name)}</b><button class="btn sm" data-rencenter="${c.id}">Omdøb</button></div>
      ${S.courts.filter((x) => x.center_id === c.id).map((x) => `<div class="row">
        <div class="grow">${esc(x.name)}</div>
        <button class="btn sm" data-rencourt="${x.id}">Omdøb</button>
        <button class="btn sm ghost" data-delcourt="${x.id}">Slet</button></div>`).join('')}
      <button class="btn sm" data-addcourt="${c.id}">+ Tilføj bane</button>
    </div>`).join('')}
    <button class="btn" id="addCenter">+ Nyt center</button>
  </div>`;

  const refresh = async () => { await hooks.loadBase(); viewAdmin(); };
  const on = (sel, fn) => app.querySelectorAll(sel).forEach((el) => (el.onclick = () => fn(el)));

  document.getElementById('invite').onclick = () =>
    share(`${location.origin}/#/velkommen`, 'Kom med til fredagspadel! Opret en profil her, så kan du tilmelde dig og komme på ranglisten:');

  document.getElementById('playerSearch').oninput = (e) => {
    const t = e.target.value.trim().toLowerCase();
    app.querySelectorAll('.prow').forEach((r) => (r.hidden = t && !r.dataset.name.includes(t)));
  };

  app.querySelectorAll('[data-role]').forEach((sel) => (sel.onchange = async () => {
    const uid = sel.dataset.role, role = sel.value, prev = roleOf(S.profiles[uid]);
    const self = uid === S.me.id;
    if (!confirm(`${self ? 'Gør dig selv' : `Gør ${nameOf(uid)}`} til ${ROLE[role].toLowerCase()}?${self && role !== 'admin' ? ' Du mister selv adgangen til Admin.' : ''}`)) { sel.value = prev; return; }
    try { await q(sb.rpc('padel_set_role', { p_user: uid, p_role: role })); toast(`${nameOf(uid)} er nu ${ROLE[role].toLowerCase()}`); }
    catch { sel.value = prev; return; }
    if (self && role !== 'admin') { location.hash = '#/profil'; return hooks.boot(); }
    refresh();
  }));

  on('[data-viewas]', (b) => startViewAs(b.dataset.viewas));

  on('[data-edit]', (b) => {
    const p = S.profiles[b.dataset.edit];
    const panel = document.getElementById('p-' + p.id);
    panel.innerHTML = `<form class="editp"><input name="name" value="${esc(p.name)}" required>
      ${radios('gender', GENDER, p.gender)}${radios('side', SIDE, p.side)}
      <div class="mact"><button class="btn sm primary">Gem</button><button type="button" class="btn sm" data-cancel>Annuller</button></div></form>`;
    panel.querySelector('[data-cancel]').onclick = viewAdmin;
    panel.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      await q(sb.rpc('padel_admin_update_player', { p_user: p.id, p_name: f.name.value, p_gender: f.gender.value, p_side: f.side.value }));
      refresh();
    };
  });

  on('[data-rencenter]', async (b) => {
    const c = centerById(b.dataset.rencenter), n = prompt('Nyt navn', c.name);
    if (n?.trim()) { await q(sb.from('padel_centers').update({ name: n.trim() }).eq('id', c.id)); refresh(); }
  });
  on('[data-rencourt]', async (b) => {
    const c = courtById(b.dataset.rencourt), n = prompt('Nyt navn', c.name);
    if (n?.trim()) { await q(sb.from('padel_courts').update({ name: n.trim() }).eq('id', c.id)); refresh(); }
  });
  on('[data-delcourt]', async (b) => {
    const c = courtById(b.dataset.delcourt);
    if (!confirm(`Slet ${c.name}?`)) return;
    try { await q(sb.from('padel_courts').delete().eq('id', c.id)); refresh(); } catch {}
  });
  on('[data-addcourt]', async (b) => {
    const n = prompt('Navn på banen');
    if (!n?.trim()) return;
    const sort = Math.max(0, ...S.courts.filter((x) => x.center_id === b.dataset.addcourt).map((x) => x.sort)) + 1;
    await q(sb.from('padel_courts').insert({ center_id: b.dataset.addcourt, name: n.trim(), sort }));
    refresh();
  });
  document.getElementById('addCenter').onclick = async () => {
    const n = prompt('Navn på centret');
    if (n?.trim()) { await q(sb.from('padel_centers').insert({ name: n.trim() })); refresh(); }
  };
}
