// Admin for den valgte gruppe (invitation, anmodninger, medlemmer) og superadmin (grupper, centre, fælles rangliste).
import {
  sb, S, app, hooks, GENDER, SIDE, ROLE, roleIn, isSuper, isAdmin, member, group, groupBar, groupCenterIds, setGroup,
  esc, nameOf, courtById, centerById, toast, q, busy, radios, share,
} from '../core.js';
import { startViewAs } from '../viewas.js';

export async function viewAdmin() {
  // Faner: Spillere (gruppens admin), Grupper og Baner (kun superadmin)
  const tabs = [isAdmin() && S.groupId ? ['spillere', '👥 Spillere'] : null, isSuper() ? ['grupper', '🗂 Grupper'] : null, isSuper() ? ['baner', '🎾 Baner'] : null].filter(Boolean);
  if (!tabs.some(([k]) => k === S.adminTab)) S.adminTab = tabs[0]?.[0];
  const body = { spillere: playersTab, grupper: groupsTab, baner: courtsTab }[S.adminTab];
  app.innerHTML = `
  <div class="page admin">
    <h1>Admin</h1>
    ${tabs.length > 1 ? `<div class="tabbar">${tabs.map(([k, t]) => `<button class="tab ${k === S.adminTab ? 'on' : ''}" data-tab="${k}">${t}</button>`).join('')}</div>` : ''}
    ${body ? body() : '<p class="muted">Du har ikke adgang til admin.</p>'}
  </div>`;
  app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { S.adminTab = b.dataset.tab; viewAdmin(); }));
  app.querySelectorAll('[data-group]').forEach((b) => (b.onclick = () => { setGroup(b.dataset.group); viewAdmin(); }));
  bind();
}

// ---------- Spillere i den valgte gruppe ----------
function playersTab() {
  const gm = S.members.filter((m) => m.group_id === S.groupId);
  const pending = gm.filter((m) => m.status === 'afventer' && S.profiles[m.player_id]);
  const players = gm.filter((m) => m.status === 'aktiv' && S.profiles[m.player_id]).map((m) => S.profiles[m.player_id]).sort((a, b) => a.name.localeCompare(b.name));
  const badge = (p) => { const r = roleIn(p.id); return r && r !== 'bruger' ? ` <span class="badge role-${r}">${ROLE[r]}</span>` : ''; };
  return `
    ${groupBar(viewAdmin)}
    <div class="card invitebar"><div class="grow"><b>${esc(group()?.name || '')}</b><small>${players.length === 1 ? '1 spiller' : `${players.length} spillere`}</small></div>
      <button class="btn sm primary" id="invite">📤 Inviter</button></div>

    ${pending.length ? `<div class="card pendingbox"><b>⏳ Venter på godkendelse (${pending.length})</b>${pending.map((m) => {
      const p = S.profiles[m.player_id];
      return `<div class="hitrow"><span class="grow">${esc(p.name)}<small class="muted"> · ${GENDER[p.gender]} · ${SIDE[p.side]}</small></span>
        <button class="btn sm primary" data-approve="${p.id}">Godkend</button><button class="btn sm ghost" data-decline="${p.id}">Afvis</button></div>`;
    }).join('')}</div>` : ''}

    <input type="search" id="playerSearch" placeholder="🔍 Find spiller…" autocomplete="off">
    <div class="list compact" id="players">${players.map((p) => `
      <details class="prow" data-name="${esc(p.name.toLowerCase())}">
        <summary><span class="grow"><b>${esc(p.name)}</b>${badge(p)}<small>${GENDER[p.gender]} · ${SIDE[p.side]} · ${member(p.id)?.elo ?? 1000} point</small></span><span class="muted">›</span></summary>
        <div class="ppanel" id="p-${p.id}">
          <label>Rolle<select class="rolesel" data-role="${p.id}">${Object.entries(ROLE).map(([k, v]) =>
            `<option value="${k}" ${(roleIn(p.id) || 'bruger') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <div class="mact">
            <button class="btn sm" data-edit="${p.id}">✏️ Ret</button>
            ${p.id !== S.me.id ? `<button class="btn sm" data-viewas="${p.id}">👁 Se som</button>` : ''}
            <a class="btn sm" href="#/spiller/${p.id}">📊 Statistik</a>
            ${p.id !== S.me.id ? `<button class="btn sm ghost danger" data-remove="${p.id}">Fjern</button>` : ''}
          </div>
        </div>
      </details>`).join('') || '<p class="muted pad">Ingen spillere endnu. Tryk Inviter.</p>'}</div>`;
}

// ---------- Grupper (superadmin) ----------
function groupsTab() {
  const g = S.groupId;
  const allowed = groupCenterIds();
  const mem = S.members.filter((m) => m.group_id === g && m.status === 'aktiv' && S.profiles[m.player_id])
    .sort((a, b) => ['admin', 'superbruger', 'bruger'].indexOf(a.role) - ['admin', 'superbruger', 'bruger'].indexOf(b.role) || S.profiles[a.player_id].name.localeCompare(S.profiles[b.player_id].name));
  const admins = mem.filter((m) => m.role === 'admin');
  const count = (id) => S.members.filter((m) => m.group_id === id && m.status === 'aktiv').length;
  return `
    <div class="chips groups">${S.groups.map((x) => `<button class="chip ${x.id === g ? 'on' : ''}" data-group="${x.id}">${esc(x.name)} <small>${count(x.id)}</small></button>`).join('')}</div>
    ${g ? `<div class="card">
      <div class="head"><b class="big">${esc(group()?.name || '')}</b><button class="icon" id="renameGroup" aria-label="Omdøb gruppe">✏️</button></div>
      <div class="lbl">Centre gruppen må bruge</div>
      <div class="checks">${S.centers.map((c) => `<label><input type="checkbox" name="gc" value="${c.id}" ${allowed.includes(c.id) ? 'checked' : ''}><span>${esc(c.name)}</span></label>`).join('')}</div>
      <div class="lbl">Tilføj en eksisterende spiller</div>
      <input type="search" id="superAdd" placeholder="➕ Søg blandt alle spillere…" autocomplete="off"><div id="superHits" class="hits"></div>
      <div class="lbl">Medlemmer (${mem.length}) ${admins.length ? '' : '<span class="warn">· gruppen har ingen admin</span>'}</div>
      <div class="mlist">${mem.map((m) => {
        const p = S.profiles[m.player_id];
        return `<div class="mrow"><span class="grow">${esc(p.name)}</span>
          <select class="rolesel sm" data-role="${p.id}" aria-label="Rolle for ${esc(p.name)}">${Object.entries(ROLE).map(([k, v]) =>
            `<option value="${k}" ${m.role === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <button class="icon sm" data-remove="${p.id}" aria-label="Fjern ${esc(p.name)} fra gruppen">✕</button></div>`;
      }).join('') || '<p class="muted small">Ingen endnu.</p>'}</div>
    </div>` : ''}

    <details class="card newgroup"><summary><b>＋ Ny gruppe</b></summary>
      <form id="newGroup">
        <input name="name" placeholder="Fx Lørdagspadel" required maxlength="60">
        <div class="lbl">Centre</div>
        <div class="checks">${S.centers.map((c) => `<label><input type="checkbox" name="nc" value="${c.id}"><span>${esc(c.name)}</span></label>`).join('')}</div>
        <button class="btn primary">Opret gruppe</button>
      </form>
    </details>

    <div class="card">
      <label class="switch"><input type="checkbox" id="globalPublic" ${S.settings.global_ranking_public ? 'checked' : ''}>
        <span>Vis den fælles rangliste for alle</span></label>
      <p class="muted small">Slået fra kan kun du se den fælles rangliste på tværs af grupper.</p>
    </div>`;
}

// ---------- Centre og baner (superadmin) ----------
function courtsTab() {
  return `${S.centers.map((c) => {
    const cs = S.courts.filter((x) => x.center_id === c.id);
    return `<details class="card centerbox"><summary><b>${esc(c.name)}</b><small class="muted">${cs.length} baner</small></summary>
      ${cs.map((x) => `<div class="crow"><span class="grow">${esc(x.name)}</span>
        <button class="icon sm" data-rencourt="${x.id}" aria-label="Omdøb ${esc(x.name)}">✏️</button>
        <button class="icon sm" data-delcourt="${x.id}" aria-label="Slet ${esc(x.name)}">🗑</button></div>`).join('')}
      <div class="mact"><button class="btn sm" data-addcourt="${c.id}">+ Tilføj bane</button><button class="btn sm ghost" data-rencenter="${c.id}">✏️ Omdøb center</button></div>
    </details>`;
  }).join('')}
  <button class="btn" id="addCenter">+ Nyt center</button>`;
}

function bind() {
  const g = S.groupId;
  const refresh = async () => { await hooks.loadBase(); viewAdmin(); };
  const on = (sel, fn) => app.querySelectorAll(sel).forEach((el) => (el.onclick = () => fn(el)));
  const setMember = (p, role, status) => q(sb.rpc('padel_set_member', { g, p, p_role: role, p_status: status }));

  document.getElementById('invite')?.addEventListener('click', () =>
    share(`${location.origin}/#/velkommen/${g}`, `Kom med i ${group()?.name || 'padel'}! Opret en profil (eller log ind) her, så godkender jeg dig:`));

  const ps = document.getElementById('playerSearch');
  if (ps) ps.oninput = () => {
    const t = ps.value.trim().toLowerCase();
    app.querySelectorAll('.prow').forEach((r) => (r.hidden = t && !r.dataset.name.includes(t)));
  };

  on('[data-approve]', async (b) => { busy(b, true); try { await setMember(b.dataset.approve, 'bruger', 'aktiv'); toast(`${nameOf(b.dataset.approve)} er godkendt`); refresh(); } catch { busy(b, false); } });
  on('[data-decline]', async (b) => { if (!confirm(`Afvis ${nameOf(b.dataset.decline)}?`)) return; await setMember(b.dataset.decline, 'bruger', 'fjernet'); refresh(); });
  on('[data-remove]', async (b) => {
    const p = b.dataset.remove;
    if (!confirm(`Fjern ${nameOf(p)} fra ${group()?.name}? Pointene gemmes, hvis de kommer med igen.`)) return;
    try { await setMember(p, roleIn(p) || 'bruger', 'fjernet'); refresh(); } catch {}
  });

  app.querySelectorAll('[data-role]').forEach((sel) => (sel.onchange = async () => {
    const uid = sel.dataset.role, role = sel.value, prev = roleIn(uid) || 'bruger';
    const self = uid === S.me.id;
    if (!confirm(`${self ? 'Gør dig selv' : `Gør ${nameOf(uid)}`} til ${ROLE[role].toLowerCase()} i ${group()?.name}?${self && role !== 'admin' && !isSuper() ? ' Du mister selv adgangen til Admin.' : ''}`)) { sel.value = prev; return; }
    try { await setMember(uid, role, 'aktiv'); toast(`${nameOf(uid)} er nu ${ROLE[role].toLowerCase()}`); }
    catch { sel.value = prev; return; }
    if (self && role !== 'admin' && !isSuper()) { location.hash = '#/profil'; return hooks.boot(); }
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

  if (!isSuper()) return;

  // Superadmin: centre for gruppen
  app.querySelectorAll('[name=gc]').forEach((cb) => (cb.onchange = async () => {
    const ids = [...app.querySelectorAll('[name=gc]:checked')].map((x) => x.value);
    try { await q(sb.rpc('padel_set_group_centers', { g, p_centers: ids })); toast('Centrene er gemt'); await hooks.loadBase(); } catch { cb.checked = !cb.checked; }
  }));
  document.getElementById('renameGroup')?.addEventListener('click', async () => {
    const n = prompt('Nyt navn på gruppen', group()?.name);
    if (n?.trim()) { await q(sb.rpc('padel_rename_group', { g, p_name: n.trim() })); refresh(); }
  });

  // Superadmin: tilføj en hvilken som helst spiller til gruppen
  const sa = document.getElementById('superAdd');
  if (sa) sa.oninput = () => {
    const t = sa.value.trim().toLowerCase();
    const hits = t ? Object.values(S.profiles).filter((p) => member(p.id)?.status !== 'aktiv' && p.name.toLowerCase().includes(t)).slice(0, 8) : [];
    const box = document.getElementById('superHits');
    box.innerHTML = hits.map((p) => `<div class="hitrow"><span class="grow">${esc(p.name)}</span>
      <button class="btn sm" data-sadd="${p.id}" data-r="bruger">Bruger</button><button class="btn sm" data-sadd="${p.id}" data-r="superbruger">Superbruger</button><button class="btn sm primary" data-sadd="${p.id}" data-r="admin">Admin</button></div>`).join('')
      || (t ? '<p class="muted small">Ingen fundet. Spilleren skal have oprettet en profil først.</p>' : '');
    box.querySelectorAll('[data-sadd]').forEach((b) => (b.onclick = async () => {
      await setMember(b.dataset.sadd, b.dataset.r, 'aktiv');
      toast(`${nameOf(b.dataset.sadd)} er tilføjet som ${ROLE[b.dataset.r].toLowerCase()}`);
      refresh();
    }));
  };

  const ng = document.getElementById('newGroup');
  if (ng) ng.onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, ids = [...f.querySelectorAll('[name=nc]:checked')].map((x) => x.value);
    if (!ids.length) return toast('Vælg mindst ét center', true);
    const btn = f.querySelector('button');
    busy(btn, true);
    try {
      const id = await q(sb.rpc('padel_create_group', { p_name: f.name.value, p_centers: ids }));
      S.groupId = id;
      try { localStorage.setItem('fp-group', id); } catch {}
      toast(`${f.name.value} er oprettet. Tilføj en admin herunder.`);
      refresh();
    } catch { busy(btn, false); }
  };

  const gp = document.getElementById('globalPublic');
  if (gp) gp.onchange = async (e) => {
    try { await q(sb.rpc('padel_set_global_public', { p_public: e.target.checked })); toast(e.target.checked ? 'Den fælles rangliste er nu synlig for alle' : 'Kun du kan se den fælles rangliste'); await hooks.loadBase(); }
    catch { e.target.checked = !e.target.checked; }
  };

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
  const ac = document.getElementById('addCenter');
  if (ac) ac.onclick = async () => {
    const n = prompt('Navn på centret');
    if (n?.trim()) { await q(sb.from('padel_centers').insert({ name: n.trim() })); refresh(); }
  };
}
