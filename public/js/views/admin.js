// Admin for den valgte gruppe (invitation, anmodninger, medlemmer) og superadmin (grupper, centre, fælles rangliste).
import {
  sb, S, app, hooks, GENDER, SIDE, ROLE, roleIn, isSuper, isAdmin, member, group, groupBar, groupCenterIds,
  esc, nameOf, courtById, centerById, toast, q, busy, radios, share,
} from '../core.js';
import { startViewAs } from '../viewas.js';

export async function viewAdmin() {
  const g = S.groupId;
  const gm = S.members.filter((m) => m.group_id === g);
  const pending = gm.filter((m) => m.status === 'afventer' && S.profiles[m.player_id]);
  const players = gm.filter((m) => m.status === 'aktiv' && S.profiles[m.player_id]).map((m) => S.profiles[m.player_id]).sort((a, b) => a.name.localeCompare(b.name));
  const badge = (p) => { const r = roleIn(p.id); return r && r !== 'bruger' ? ` <span class="badge role-${r}">${ROLE[r]}</span>` : ''; };

  app.innerHTML = `
  <div class="page">
    <h1>Admin</h1>
    ${g ? `<p class="muted">${esc(group()?.name || '')}</p>${groupBar(viewAdmin)}` : ''}

    ${g && isAdmin() ? `
    <div class="card">
      <b>Inviter spillere til ${esc(group()?.name || '')}</b>
      <p class="muted small">Send linket i jeres gruppechat. Nye opretter en konto, og eksisterende spillere logger bare ind. Du godkender dem herunder.</p>
      <button class="btn primary" id="invite">📤 Del invitationslink</button>
    </div>

    ${pending.length ? `<h3>Venter på godkendelse (${pending.length})</h3><div class="list">${pending.map((m) => {
      const p = S.profiles[m.player_id];
      return `<div class="row wrap"><div class="grow"><b>${esc(p.name)}</b><small>${GENDER[p.gender]} · ${SIDE[p.side]}</small></div>
        <button class="btn sm primary" data-approve="${p.id}">Godkend</button><button class="btn sm ghost" data-decline="${p.id}">Afvis</button></div>`;
    }).join('')}</div>` : ''}

    <h3>Spillere (${players.length})</h3>
    <input type="search" id="playerSearch" placeholder="Find spiller…" autocomplete="off">
    <div class="list" id="players">${players.map((p) => `
      <details class="prow" data-name="${esc(p.name.toLowerCase())}">
        <summary><span class="grow"><b>${esc(p.name)}</b>${badge(p)}<small>${GENDER[p.gender]} · ${SIDE[p.side]} · ${member(p.id)?.elo ?? 1000} point</small></span><span class="muted">›</span></summary>
        <div class="ppanel" id="p-${p.id}">
          <label>Rolle i ${esc(group()?.name || 'gruppen')}<select class="rolesel" data-role="${p.id}">${Object.entries(ROLE).map(([k, v]) =>
            `<option value="${k}" ${(roleIn(p.id) || 'bruger') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <div class="mact">
            <button class="btn sm" data-edit="${p.id}">✏️ Ret navn, køn, side</button>
            ${p.id !== S.me.id ? `<button class="btn sm" data-viewas="${p.id}">👁 Se som</button>` : ''}
            <a class="btn sm" href="#/spiller/${p.id}">📊 Statistik</a>
            ${p.id !== S.me.id ? `<button class="btn sm ghost danger" data-remove="${p.id}">Fjern fra gruppen</button>` : ''}
          </div>
        </div>
      </details>`).join('') || '<p class="muted pad">Ingen spillere endnu.</p>'}</div>` : ''}

    ${isSuper() ? superSection() : ''}
  </div>`;
  bind();
}

// ---------- Kun superadmin ----------
function superSection() {
  const g = S.groupId;
  const allowed = groupCenterIds();
  return `
    <h2 class="sect">Superadmin</h2>
    ${g ? `<div class="card">
      <div class="head"><b>${esc(group()?.name || '')}</b><button class="btn sm" id="renameGroup">Omdøb</button></div>
      <div class="lbl">Centre gruppen må bruge</div>
      <div class="checks">${S.centers.map((c) => `<label><input type="checkbox" name="gc" value="${c.id}" ${allowed.includes(c.id) ? 'checked' : ''}><span>${esc(c.name)}</span></label>`).join('')}</div>
      <div class="lbl">Tilføj en spiller direkte (fx en ny gruppeadmin)</div>
      <input type="search" id="superAdd" placeholder="Søg blandt alle spillere…" autocomplete="off"><div id="superHits" class="hits"></div>
    </div>` : ''}

    <div class="card">
      <b>Ny gruppe</b>
      <form id="newGroup">
        <input name="name" placeholder="Fx Lørdagspadel" required maxlength="60">
        <div class="lbl">Centre</div>
        <div class="checks">${S.centers.map((c) => `<label><input type="checkbox" name="nc" value="${c.id}"><span>${esc(c.name)}</span></label>`).join('')}</div>
        <button class="btn primary">Opret gruppe</button>
      </form>
    </div>

    <div class="card">
      <label class="switch"><input type="checkbox" id="globalPublic" ${S.settings.global_ranking_public ? 'checked' : ''}>
        <span>Vis den fælles rangliste for alle spillere</span></label>
      <p class="muted small">Slået fra kan kun du se den fælles rangliste på tværs af grupper.</p>
    </div>

    <h3>Centre og baner</h3>
    ${S.centers.map((c) => `<div class="card">
      <div class="head"><b>${esc(c.name)}</b><button class="btn sm" data-rencenter="${c.id}">Omdøb</button></div>
      ${S.courts.filter((x) => x.center_id === c.id).map((x) => `<div class="row">
        <div class="grow">${esc(x.name)}</div>
        <button class="btn sm" data-rencourt="${x.id}">Omdøb</button>
        <button class="btn sm ghost" data-delcourt="${x.id}">Slet</button></div>`).join('')}
      <button class="btn sm" data-addcourt="${c.id}">+ Tilføj bane</button>
    </div>`).join('')}
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
      <button class="btn sm" data-sadd="${p.id}" data-r="bruger">Som spiller</button><button class="btn sm primary" data-sadd="${p.id}" data-r="admin">Som admin</button></div>`).join('')
      || (t ? '<p class="muted small">Ingen fundet. Spilleren skal have oprettet en profil først.</p>' : '');
    box.querySelectorAll('[data-sadd]').forEach((b) => (b.onclick = async () => {
      await setMember(b.dataset.sadd, b.dataset.r, 'aktiv');
      toast(`${nameOf(b.dataset.sadd)} er tilføjet${b.dataset.r === 'admin' ? ' som admin' : ''}`);
      refresh();
    }));
  };

  document.getElementById('newGroup').onsubmit = async (e) => {
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

  document.getElementById('globalPublic').onchange = async (e) => {
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
  document.getElementById('addCenter').onclick = async () => {
    const n = prompt('Navn på centret');
    if (n?.trim()) { await q(sb.from('padel_centers').insert({ name: n.trim() })); refresh(); }
  };
}
