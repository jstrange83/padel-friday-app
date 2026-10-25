// Admin for den valgte gruppe (invitation, anmodninger, medlemmer) og superadmin (grupper, centre, fælles rangliste).
import {
  sb, S, app, hooks, hasSuggest, liveGroups, GENDER, SIDE, roleNames, roleIn, isSuper, isAdmin, canRun, isClub, member, group, groupBar, groupCenterIds, setGroup,
  esc, nameOf, courtById, centerById, toast, q, busy, radios, share, phoneOf, fmtPhone, phoneLinks,
} from '../core.js';
import { startViewAs } from '../viewas.js';
import { showQR } from '../qr.js';
import { loadSuggestions, suggestTab, bindSuggestTab } from './suggest.js';
import { isRealSuper, setEditMode } from '../editmode.js';
import { loadClub, loadClubPending, clubKidsTab, bindClubKids, clubTeamsTab, bindClubTeams, clubSettingsCard, bindClubSettings, clubInvite, clubFeesTab, bindClubFees, clubStaffCard, bindClubStaff, isTreasurer } from './club.js';

export async function viewAdmin() {
  // Faner: Spillere (gruppens admin), Grupper og Baner (kun superadmin). I en klub: Børn og Hold og tider (trænere)
  const club = isClub() && S.groupId;
  const tabs = [
    club && canRun() ? ['boern', `👧 Børn${S.clubPendingBy?.[S.groupId] ? ` (${S.clubPendingBy[S.groupId]})` : ''}`] : null,
    club && canRun() ? ['hold', '🗓 Hold og tider'] : null,
    club && isTreasurer() ? ['kontingent', '💳 Kontingent'] : null,
    (isAdmin() && S.groupId) || isSuper() ? ['spillere', club ? '👥 Medlemmer' : '👥 Spillere'] : null,
    isSuper() ? ['grupper', '🗂 Grupper'] : null, isSuper() ? ['baner', '🎾 Baner'] : null, isSuper() && hasSuggest() ? ['forslag', '💡 Forslag'] : null].filter(Boolean);
  if (!tabs.some(([k]) => k === S.adminTab)) S.adminTab = tabs[0]?.[0];
  if (S.adminTab === 'forslag') { try { await loadSuggestions(); } catch { S.suggestions = []; } }
  if (club && ['boern', 'hold', 'kontingent', 'spillere'].includes(S.adminTab)) { await loadClub(S.groupId); await loadClubPending(); }
  const body = { spillere: playersTab, grupper: groupsTab, baner: courtsTab, forslag: suggestTab, boern: clubKidsTab, hold: clubTeamsTab, kontingent: clubFeesTab }[S.adminTab];
  app.innerHTML = `
  <div class="page admin">
    <h1>Admin</h1>
    ${club && ['boern', 'hold', 'kontingent'].includes(S.adminTab) ? groupBar(viewAdmin) : ''}
    ${tabs.length > 1 ? `<div class="tabbar">${tabs.map(([k, t]) => `<button class="tab ${k === S.adminTab ? 'on' : ''}" data-tab="${k}">${t}</button>`).join('')}</div>` : ''}
    ${body ? body() : '<p class="muted">Du har ikke adgang til admin.</p>'}
    ${isRealSuper() ? `<div class="card editcard"><label class="switch"><input type="checkbox" id="editMode" ${S.editMode ? 'checked' : ''}><span>✏️ Redigeringstilstand <small class="muted">(ret og slet alt, på denne enhed)</small></span></label></div>` : ''}
  </div>`;
  app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { S.adminTab = b.dataset.tab; viewAdmin(); }));
  const em = document.getElementById('editMode');
  if (em) em.onchange = () => { setEditMode(em.checked); toast(em.checked ? 'Redigering er slået til' : 'Redigering er slået fra'); };
  if (S.adminTab === 'forslag') bindSuggestTab(viewAdmin);
  const clubRefresh = async () => { await viewAdmin(); hooks.renderNav?.(); };
  if (S.adminTab === 'boern') bindClubKids(clubRefresh);
  if (S.adminTab === 'hold') bindClubTeams(clubRefresh);
  if (S.adminTab === 'kontingent') bindClubFees(clubRefresh);
  if (S.adminTab === 'spillere' && club) { bindClubSettings(clubRefresh); bindClubStaff(clubRefresh); }
  app.querySelectorAll('[data-group]').forEach((b) => (b.onclick = () => { S.gmemOpen = false; setGroup(b.dataset.group); viewAdmin(); }));
  app.querySelectorAll('[data-pgroup]').forEach((b) => (b.onclick = () => { S.adminAll = false; setGroup(b.dataset.pgroup); viewAdmin(); }));
  app.querySelector('[data-allp]')?.addEventListener('click', () => { S.adminAll = true; viewAdmin(); });
  bind();
}

// ---------- Spillere i den valgte gruppe ----------
// Gruppeknapper, og for superadmin også "Alle spillere"
function playersBar() {
  if (!isSuper()) return groupBar(viewAdmin);
  return `<div class="chips groups">${liveGroups().map((x) => `<button class="chip ${!S.adminAll && x.id === S.groupId ? 'on' : ''}" data-pgroup="${x.id}">${esc(x.name)}</button>`).join('')}
    <button class="chip ${S.adminAll ? 'on' : ''}" data-allp>🌍 Alle spillere</button></div>`;
}

// Superadmin: alle spillere på tværs af grupper, med deres grupper og roller
const noLogin = (p) => (p.placeholder ? ' <span class="badge">Uden login</span>' : '');
const noLoginNote = (p) => (p.placeholder ? '<p class="muted small">Har ikke oprettet sig endnu. Når spilleren opretter sig med samme telefonnummer, overtager de profilen med kampe og point.</p>' : '');

// Opret en spiller, der ikke selv har oprettet sig
function createPlayerBox() {
  return `<div class="card newplayer" ${S.newPlayerOpen ? '' : 'hidden'}><b>➕ Opret spiller</b>
    <form id="newPlayer">
      <p class="muted small">Til en spiller, der ikke har oprettet sig selv. Spilleren kan med det samme tilmeldes og sættes på hold. Når de senere opretter sig med samme telefonnummer, overtager de profilen med kampe og point.</p>
      <label>Navn<input name="name" required maxlength="60" autocomplete="off"></label>
      <label>Telefonnummer<input name="phone" type="tel" inputmode="tel" required placeholder="Fx 12 34 56 78" autocomplete="off"></label>
      <div class="lbl">Køn</div>${radios('npgender', GENDER, '')}
      <div class="lbl">Foretrukken side</div>${radios('npside', SIDE, 'begge')}
      <div class="mact"><button type="button" class="btn sm ghost" id="newPlayerClose">Luk</button><button class="btn sm primary">Opret spiller</button></div>
    </form></div>`;
}

function allPlayers() {
  const all = Object.values(S.profiles).sort((a, b) => a.name.localeCompare(b.name));
  const gname = (g) => S.groups.find((x) => x.id === g)?.name || 'Gruppe';
  return `
    ${playersBar()}
    <details class="card plist" ${S.playersOpen ? 'open' : ''}><summary><b>👥 Spillere (${all.length})</b></summary>
    <input type="search" id="playerSearch" placeholder="🔍 Find spiller…" autocomplete="off">
    <div class="list compact">${all.map((p) => {
      const ms = S.members.filter((m) => m.player_id === p.id && m.status !== 'fjernet');
      const summary = ms.length ? ms.map((m) => `${esc(gname(m.group_id))}${m.status === 'afventer' ? ' (venter)' : m.role !== 'bruger' ? ` (${roleNames(m.group_id)[m.role]})` : ''}`).join(' · ') : 'Ingen gruppe';
      const notIn = liveGroups().filter((g) => !ms.some((m) => m.group_id === g.id && m.status === 'aktiv'));
      return `<details class="prow" data-name="${esc(p.name.toLowerCase())}">
        <summary><span class="grow"><b>${esc(p.name)}</b>${p.is_superadmin ? ' <span class="badge role-admin">Superadmin</span>' : ''}${noLogin(p)}${p.deleted_at ? ' <span class="badge st-ubetalt">Slettet</span>' : ''}<small>${summary}</small></span><span class="muted">›</span></summary>
        <div class="ppanel" id="p-${p.id}">
          ${noLoginNote(p)}<div class="mact contact">${phoneLinks(p.id)}</div>
          ${ms.filter((m) => m.status === 'aktiv').map((m) => `<div class="mrow"><span class="grow">${esc(gname(m.group_id))}</span>
            <select class="rolesel sm" data-grole="${p.id}|${m.group_id}" aria-label="Rolle i ${esc(gname(m.group_id))}">${Object.entries(roleNames(m.group_id)).map(([k, v]) =>
              `<option value="${k}" ${m.role === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
            <button class="icon sm" data-gremove="${p.id}|${m.group_id}" aria-label="Fjern fra ${esc(gname(m.group_id))}">✕</button></div>`).join('')}
          ${notIn.length ? `<div class="mact">${notIn.map((g) => `<button class="btn sm" data-gadd="${p.id}|${g.id}">+ ${esc(g.name)}</button>`).join('')}</div>` : ''}
          <div class="mact">
            ${p.deleted_at ? `<button class="btn sm primary" data-restore="${p.id}">♻️ Gendan spiller</button>` : `<button class="btn sm" data-edit="${p.id}">Ret</button>
            ${p.id !== S.me.id ? `<button class="btn sm" data-viewas="${p.id}">Se som</button>` : ''}
            ${p.is_superadmin ? '' : `<button class="btn sm ghost danger" data-delplayer="${p.id}">Slet</button>`}`}
          </div>
        </div>
      </details>`;
    }).join('')}</div></details>`;
}

function playersTab() {
  if (isSuper() && (S.adminAll || !S.groupId)) return allPlayers();
  const gm = S.members.filter((m) => m.group_id === S.groupId);
  const pending = gm.filter((m) => m.status === 'afventer' && S.profiles[m.player_id]);
  const players = gm.filter((m) => m.status === 'aktiv' && S.profiles[m.player_id]).map((m) => S.profiles[m.player_id]).sort((a, b) => a.name.localeCompare(b.name));
  const badge = (p) => { const r = roleIn(p.id); return r && r !== 'bruger' ? ` <span class="badge role-${r}">${roleNames()[r]}</span>` : ''; };
  const club = isClub();
  return `
    ${playersBar()}
    <div class="card invitebar"><div><b>${esc(group()?.name || '')}</b> <small class="muted">· ${club ? `${players.length} voksne og juniorer med login` : players.length === 1 ? '1 spiller' : `${players.length} spillere`}</small></div>
      ${club ? '<p class="muted small">Del linket med forældrene. De opretter sig og melder deres barn ind, og I godkender under Børn.</p>' : ''}
      <div class="mact"><button class="btn sm" id="inviteQR" aria-label="Vis QR-kode">▦ QR</button>${club ? '' : '<button class="btn sm" id="newPlayerBtn">➕ Opret</button>'}<button class="btn sm primary" id="invite">📤 Inviter</button></div></div>
    ${club ? clubSettingsCard() + clubStaffCard() : `${createPlayerBox()}
    <details class="card gset" ${S.gsetOpen ? 'open' : ''}><summary><b>⚙️ Gruppens indstillinger</b><small class="muted">Rangliste: ${{ alle: 'alle', gruppe: 'kun gruppen', ingen: 'ingen' }[group()?.ranking_mode || 'alle']} · Bøder: ${group()?.fines_enabled ? 'til' : 'fra'}</small></summary>
    <div class="rankmode"><div class="lbl">🏆 Rangliste</div>
      ${radios('rankmode', { alle: 'Alle spillere', gruppe: 'Kun gruppen', ingen: 'Ingen' }, group()?.ranking_mode || 'alle')}
      <p class="muted small">Én fælles rangliste med samme point i alle grupper. Vælg om gruppen ser alle, kun sine egne, eller ingen (kampene giver stadig point).</p></div>
    <div class="finesrow"><label class="switch"><input type="checkbox" id="finesOn" ${group()?.fines_enabled ? 'checked' : ''}><span>💸 Bødekasse</span></label>
      <p class="muted small">${group()?.fines_enabled ? 'Slået til. Alle i gruppen kan se bødekassen. <a href="#/boeder">Gå til bødekassen ›</a>' : 'Slået fra. Slå den til, så kan admin og superbrugere give bøder, og alle i gruppen kan se dem.'}</p></div>
    </details>`}

    ${pending.length ? `<div class="card pendingbox"><b>⏳ Venter på godkendelse (${pending.length})</b>${pending.map((m) => {
      const p = S.profiles[m.player_id];
      return `<div class="hitrow"><span class="grow">${esc(p.name)}<small class="muted"> · ${GENDER[p.gender]} · ${SIDE[p.side]}${phoneOf(p.id) ? ` · ${fmtPhone(phoneOf(p.id))}` : ''}</small></span>
        <button class="btn sm primary" data-approve="${p.id}">Godkend</button><button class="btn sm ghost" data-decline="${p.id}">Afvis</button></div>`;
    }).join('')}</div>` : ''}

    <details class="card plist" ${S.playersOpen ? 'open' : ''}><summary><b>👥 ${club ? 'Medlemmer' : 'Spillere'} (${players.length})</b></summary>
    ${club ? '<p class="muted small">Gør trænerne til <b>Træner</b>. Trænere kan godkende børn, sætte hold og tider, krydse fremmøde af og skrive opslag.</p>' : ''}
    <input type="search" id="playerSearch" placeholder="🔍 Find…" autocomplete="off">
    <div class="list compact" id="players">${players.map((p) => `
      <details class="prow" data-name="${esc(p.name.toLowerCase())}">
        <summary><span class="grow"><b>${esc(p.name)}</b>${badge(p)}${noLogin(p)}<small>${club ? (phoneOf(p.id) ? fmtPhone(phoneOf(p.id)) : '') : `${GENDER[p.gender]} · ${SIDE[p.side]} · ${member(p.id)?.elo ?? 1000} point`}</small></span><span class="muted">›</span></summary>
        <div class="ppanel" id="p-${p.id}">
          ${noLoginNote(p)}<div class="mact contact">${phoneLinks(p.id)}</div>
          <label>Rolle<select class="rolesel" data-role="${p.id}">${Object.entries(roleNames()).map(([k, v]) =>
            `<option value="${k}" ${(roleIn(p.id) || 'bruger') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <div class="mact">
            <button class="btn sm" data-edit="${p.id}">Ret</button>
            ${p.id !== S.me.id ? `<button class="btn sm" data-viewas="${p.id}">Se som</button>` : ''}
            ${club ? '' : `<a class="btn sm" href="#/spiller/${p.id}">Statistik</a>`}
          </div>
          ${p.id !== S.me.id ? `<div class="mact"><button class="btn sm ghost danger" data-remove="${p.id}">Fjern fra gruppen</button></div>${p.is_superadmin ? '' : `<div class="mact"><button class="btn sm ghost danger" data-delplayer="${p.id}">Slet spiller helt</button></div>`}` : ''}
        </div>
      </details>`).join('') || '<p class="muted pad">Ingen spillere endnu. Tryk Inviter.</p>'}</div></details>`;
}

// ---------- Grupper (superadmin) ----------
function groupsTab() {
  const g = S.groupId;
  const allowed = groupCenterIds();
  const mem = S.members.filter((m) => m.group_id === g && m.status === 'aktiv' && S.profiles[m.player_id])
    .sort((a, b) => ['admin', 'superbruger', 'bruger'].indexOf(a.role) - ['admin', 'superbruger', 'bruger'].indexOf(b.role) || S.profiles[a.player_id].name.localeCompare(S.profiles[b.player_id].name));
  const admins = mem.filter((m) => m.role === 'admin');
  const count = (id) => S.members.filter((m) => m.group_id === id && m.status === 'aktiv').length;
  const live = liveGroups();
  const adminNames = admins.map((m) => esc(S.profiles[m.player_id].name.split(' ')[0])).join(', ');
  return `
    ${live.length > 1 ? `<div class="chips groups">${live.map((x) => `<button class="chip ${x.id === g ? 'on' : ''}" data-group="${x.id}">${esc(x.name)} <small>${count(x.id)}</small></button>`).join('')}</div>` : ''}
    ${g ? `<div class="card gcard">
      <div class="head"><div class="grow"><b class="big">${esc(group()?.name || '')}</b>
        <small class="muted gsum">${group()?.kind === 'klub' ? '🧒 Juniorklub · ' : ''}${mem.length === 1 ? '1 spiller' : `${mem.length} spillere`} · ${admins.length ? `Admin: ${adminNames}` : '<span class="warn">ingen admin</span>'}</small></div>
        <button class="icon" id="renameGroup" aria-label="Omdøb gruppe">✏️</button></div>
      <div class="lbl">Centre</div>
      <div class="checks">${S.centers.map((c) => `<label><input type="checkbox" name="gc" value="${c.id}" ${allowed.includes(c.id) ? 'checked' : ''}><span>${esc(c.name)}</span></label>`).join('')}</div>
      <details class="gmem" ${S.gmemOpen || !admins.length ? 'open' : ''}><summary><b>👥 Medlemmer og roller</b><span class="muted">${mem.length} ›</span></summary>
      <input type="search" id="superAdd" placeholder="➕ Tilføj spiller…" autocomplete="off"><div id="superHits" class="hits"></div>
      <div class="mlist">${mem.map((m) => {
        const p = S.profiles[m.player_id];
        return `<div class="mrow"><span class="grow">${esc(p.name)}</span>
          <select class="rolesel sm" data-role="${p.id}" aria-label="Rolle for ${esc(p.name)}">${Object.entries(roleNames()).map(([k, v]) =>
            `<option value="${k}" ${m.role === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <button class="icon sm" data-remove="${p.id}" aria-label="Fjern ${esc(p.name)} fra gruppen">✕</button></div>`;
      }).join('') || '<p class="muted small">Ingen endnu.</p>'}</div></details>
      <div class="gfoot"><button class="link sm dn" id="archiveGroup">Slet gruppe</button></div>
    </div>` : ''}
    ${S.groups.some((x) => x.archived) ? `<details class="card archived"><summary><b>🗄 Slettede grupper (${S.groups.filter((x) => x.archived).length})</b></summary>
      ${S.groups.filter((x) => x.archived).map((x) => `<div class="mrow"><span class="grow">${esc(x.name)}<small class="muted"> · ${count(x.id)} spillere</small></span><button class="btn sm" data-unarchive="${x.id}">♻️ Hent tilbage</button></div>`).join('')}
    </details>` : ''}

    <details class="card newgroup"><summary><b>＋ Ny gruppe</b></summary>
      <form id="newGroup">
        <input name="name" placeholder="Fx Lørdagspadel" required maxlength="60">
        <div class="lbl">Type</div>${radios('kind', { gruppe: '🎾 Spillegruppe', klub: '🧒 Juniorklub' }, 'gruppe')}
        <p class="muted small">En juniorklub har træningstider, afbud, opslag og indmeldelse af børn i stedet for spilledage og rangliste.</p>
        <div class="lbl">Centre</div>
        <div class="checks">${S.centers.map((c) => `<label><input type="checkbox" name="nc" value="${c.id}"><span>${esc(c.name)}</span></label>`).join('')}</div>
        <button class="btn primary">Opret gruppe</button>
      </form>
    </details>`;
}

// ---------- Centre og baner (superadmin) ----------
function courtsTab() {
  return `${S.centers.map((c) => {
    const cs = S.courts.filter((x) => x.center_id === c.id).sort((a, b) => a.sort - b.sort);
    return `<details class="card centerbox"><summary><b>${esc(c.name)}</b><small class="muted">${cs.length} baner</small></summary>
      <p class="muted small">Øverst er den bedste bane. Det stærkeste hold kommer på den øverste.</p>
      ${cs.map((x, i) => `<div class="crow"><span class="rk">${i + 1}</span><span class="grow">${esc(x.name)}</span>
        <button class="icon sm" data-cmove="${x.id}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Flyt ${esc(x.name)} op">↑</button>
        <button class="icon sm" data-cmove="${x.id}" data-dir="1" ${i === cs.length - 1 ? 'disabled' : ''} aria-label="Flyt ${esc(x.name)} ned">↓</button>
        <button class="icon sm" data-rencourt="${x.id}" aria-label="Omdøb ${esc(x.name)}">✏️</button>
        <button class="icon sm" data-delcourt="${x.id}" aria-label="Slet ${esc(x.name)}">🗑</button></div>`).join('')}
      <div class="mact"><button class="btn sm" data-addcourt="${c.id}">+ Tilføj bane</button><button class="btn sm ghost" data-rencenter="${c.id}">Omdøb center</button></div>
    </details>`;
  }).join('')}
  <button class="btn" id="addCenter">+ Nyt center</button>`;
}

function bind() {
  const g = S.groupId;
  const refresh = async () => { await hooks.loadBase(); await viewAdmin(); hooks.renderNav?.(); };
  const refreshOpen = async (pid) => {
    const term = document.getElementById('playerSearch')?.value || '';
    await refresh();
    const ps = document.getElementById('playerSearch');
    if (ps && term) { ps.value = term; ps.oninput(); }
    document.getElementById('p-' + pid)?.closest('details')?.setAttribute('open', '');
  };
  const on = (sel, fn) => app.querySelectorAll(sel).forEach((el) => (el.onclick = () => fn(el)));
  const setMember = (p, role, status) => q(sb.rpc('padel_set_member', { g, p, p_role: role, p_status: status }));

  document.getElementById('inviteQR')?.addEventListener('click', () => (isClub() ? clubInvite(g).qr() :
    showQR(`${location.origin}/#/velkommen/${g}`, `Kom med i ${group()?.name || 'padel'}`, 'Scan med telefonens kamera for at oprette dig eller logge ind')));
  document.getElementById('invite')?.addEventListener('click', () => (isClub() ? clubInvite(g).share() :
    share(`${location.origin}/#/velkommen/${g}`, `Kom med i ${group()?.name || 'padel'}! Opret en profil (eller log ind) her, så godkender jeg dig:`)));

  const pl = app.querySelector('details.plist');
  if (pl) pl.ontoggle = () => (S.playersOpen = pl.open);
  const ps = document.getElementById('playerSearch');
  if (ps) ps.oninput = () => {
    const t = ps.value.trim().toLowerCase();
    app.querySelectorAll('.prow').forEach((r) => (r.hidden = t && !r.dataset.name.includes(t)));
  };

  on('[data-approve]', async (b) => { busy(b, true); try { await setMember(b.dataset.approve, 'bruger', 'aktiv'); toast(`${nameOf(b.dataset.approve)} er godkendt`); refresh(); } catch { busy(b, false); } });
  on('[data-decline]', async (b) => { if (!confirm(`Afvis ${nameOf(b.dataset.decline)}?`)) return; await setMember(b.dataset.decline, 'bruger', 'fjernet'); refresh(); });
  on('[data-delplayer]', async (b) => {
    const pid = b.dataset.delplayer;
    if (!confirm(`Slet ${nameOf(pid)}?\n\nSpilleren forsvinder fra grupperne og ranglisten. Point og kampe gemmes: kommer de igen (samme mail eller telefonnummer), har de samme point.`)) return;
    busy(b, true);
    try { await q(sb.rpc('padel_delete_player', { p_user: pid })); toast(`${nameOf(pid)} er slettet`); refresh(); } catch { busy(b, false); }
  });
  on('[data-restore]', async (b) => {
    busy(b, true);
    try { await q(sb.rpc('padel_restore_player', { p_user: b.dataset.restore })); toast(`${nameOf(b.dataset.restore)} er gendannet. Tilføj dem til en gruppe igen.`); refresh(); } catch { busy(b, false); }
  });
  on('[data-remove]', async (b) => {
    const p = b.dataset.remove;
    if (!confirm(`Fjern ${nameOf(p)} fra ${group()?.name}? Pointene gemmes, hvis de kommer med igen.`)) return;
    try { await setMember(p, roleIn(p) || 'bruger', 'fjernet'); refresh(); } catch {}
  });

  app.querySelectorAll('[data-role]').forEach((sel) => (sel.onchange = async () => {
    const uid = sel.dataset.role, role = sel.value, prev = roleIn(uid) || 'bruger';
    const self = uid === S.me.id;
    if (!confirm(`${self ? 'Gør dig selv' : `Gør ${nameOf(uid)}`} til ${roleNames()[role].toLowerCase()} i ${group()?.name}?${self && role !== 'admin' && !isSuper() ? ' Du mister selv adgangen til Admin.' : ''}`)) { sel.value = prev; return; }
    try { await setMember(uid, role, 'aktiv'); toast(`${nameOf(uid)} er nu ${roleNames()[role].toLowerCase()}`); }
    catch { sel.value = prev; return; }
    if (self && role !== 'admin' && !isSuper()) { location.hash = '#/profil'; return hooks.boot(); }
    refresh();
  }));

  on('[data-viewas]', (b) => startViewAs(b.dataset.viewas));

  // Alle spillere: rolle, fjern og tilføj pr. gruppe
  const pg = (el, key) => el.dataset[key].split('|');
  app.querySelectorAll('[data-grole]').forEach((sel) => (sel.onchange = async () => {
    const [p, gid] = pg(sel, 'grole');
    try { await q(sb.rpc('padel_set_member', { g: gid, p, p_role: sel.value, p_status: 'aktiv' })); toast(`${nameOf(p)} er nu ${roleNames(gid)[sel.value].toLowerCase()}`); refreshOpen(p); } catch {}
  }));
  on('[data-gremove]', async (b) => {
    const [p, gid] = pg(b, 'gremove');
    const gname = S.groups.find((x) => x.id === gid)?.name;
    if (!confirm(`Fjern ${nameOf(p)} fra ${gname}?`)) return;
    try { await q(sb.rpc('padel_set_member', { g: gid, p, p_role: member(p, gid)?.role || 'bruger', p_status: 'fjernet' })); toast(`Fjernet fra ${gname}`); refreshOpen(p); } catch {}
  });
  on('[data-gadd]', async (b) => {
    const [p, gid] = pg(b, 'gadd');
    busy(b, true);
    try { await q(sb.rpc('padel_set_member', { g: gid, p, p_role: 'bruger', p_status: 'aktiv' })); toast(`${nameOf(p)} er tilføjet`); refreshOpen(p); } catch { busy(b, false); }
  });

  on('[data-edit]', (b) => {
    const p = S.profiles[b.dataset.edit];
    const panel = document.getElementById('p-' + p.id);
    panel.innerHTML = `<form class="editp"><input name="name" value="${esc(p.name)}" required>
      <input name="phone" type="tel" inputmode="tel" placeholder="Telefonnummer" value="${esc(fmtPhone(phoneOf(p.id)))}">
      ${radios('gender', GENDER, p.gender)}${radios('side', SIDE, p.side)}
      <div class="mact"><button class="btn sm primary">Gem</button><button type="button" class="btn sm" data-cancel>Annuller</button></div></form>`;
    panel.querySelector('[data-cancel]').onclick = viewAdmin;
    panel.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      await q(sb.rpc('padel_admin_update_player', { p_user: p.id, p_name: f.name.value, p_gender: f.gender.value, p_side: f.side.value }));
      if (f.phone.value.trim() && f.phone.value.trim() !== fmtPhone(phoneOf(p.id))) await q(sb.rpc('padel_admin_set_phone', { p_user: p.id, p_phone: f.phone.value }));
      refresh();
    };
  });

  // Gruppens admin: opret spiller, rangliste og bødekasse
  const np = document.getElementById('newPlayer');
  const gs = app.querySelector('details.gset');
  if (gs) gs.ontoggle = () => (S.gsetOpen = gs.open);
  const gmem = app.querySelector('details.gmem');
  if (gmem) {
    gmem.querySelector('summary').onclick = () => (S.gmemOpen = !gmem.open);
    // Arbejder man i listen (tilføj, rolle, fjern), bliver den stående åben
    const keep = (e) => { if (!e.target.closest('summary')) S.gmemOpen = true; };
    gmem.addEventListener('click', keep, true);
    gmem.addEventListener('change', keep, true);
  }
  const npb = document.getElementById('newPlayerBtn');
  if (npb) npb.onclick = () => { S.newPlayerOpen = true; np.closest('.newplayer').hidden = false; np.elements.name.focus(); };
  if (np) {
    document.getElementById('newPlayerClose').onclick = () => { S.newPlayerOpen = false; np.closest('.newplayer').hidden = true; };
    np.onsubmit = async (e) => {
      e.preventDefault();
      const btn = np.querySelector('button.primary');
      busy(btn, true);
      try {
        await q(sb.rpc('padel_admin_create_player', { g, p_name: np.elements.name.value, p_phone: np.phone.value, p_gender: np.npgender.value, p_side: np.npside.value }));
        toast(`${np.elements.name.value.trim()} er oprettet`);
        S.newPlayerOpen = false;
        await refresh();
      } catch { busy(btn, false); }
    };
  }

  app.querySelectorAll('input[name=rankmode]').forEach((r) => (r.onchange = async () => {
    try { await q(sb.rpc('padel_set_ranking_mode', { g, p_mode: r.value })); toast({ alle: 'Ranglisten viser alle spillere', gruppe: 'Ranglisten viser kun gruppen', ingen: 'Gruppen har nu ingen rangliste' }[r.value]); await refresh(); } catch {}
  }));
  const fo = document.getElementById('finesOn');
  if (fo) fo.onchange = async (e) => {
    try {
      await q(sb.rpc('padel_set_fines', { g, p_enabled: e.target.checked, p_pay_to: group()?.fines_pay_to || null, p_note: group()?.fines_note || null }));
      toast(e.target.checked ? 'Bødekassen er slået til' : 'Bødekassen er slået fra');
      await refresh();
      hooks.renderNav?.();
    } catch { e.target.checked = !e.target.checked; }
  };

  if (!isSuper()) return;

  // Superadmin: centre for gruppen
  app.querySelectorAll('[name=gc]').forEach((cb) => (cb.onchange = async () => {
    const ids = [...app.querySelectorAll('[name=gc]:checked')].map((x) => x.value);
    try { await q(sb.rpc('padel_set_group_centers', { g, p_centers: ids })); toast('Centrene er gemt'); await hooks.loadBase(); } catch { cb.checked = !cb.checked; }
  }));
  document.getElementById('archiveGroup')?.addEventListener('click', async (e) => {
    if (!confirm(`Slet gruppen "${group()?.name}"?\n\nIngen kan bruge den længere: den forsvinder for alle spillere, og invitationslinket holder op med at virke. Kampe, point og bøder bliver gemt, så du kan hente gruppen tilbage under "Slettede grupper".`)) return;
    busy(e.currentTarget, true);
    try { await q(sb.rpc('padel_archive_group', { g, p_archived: true })); toast('Gruppen er slettet'); S.groupId = null; await refresh(); } catch { busy(e.currentTarget, false); }
  });
  app.querySelectorAll('[data-unarchive]').forEach((b) => (b.onclick = async () => {
    busy(b, true);
    try { await q(sb.rpc('padel_archive_group', { g: b.dataset.unarchive, p_archived: false })); toast('Gruppen er hentet tilbage'); await refresh(); } catch { busy(b, false); }
  }));
  document.getElementById('renameGroup')?.addEventListener('click', async () => {
    const n = prompt('Nyt navn på gruppen', group()?.name);
    if (n?.trim()) { await q(sb.rpc('padel_rename_group', { g, p_name: n.trim() })); refresh(); }
  });

  // Superadmin: tilføj en hvilken som helst spiller til gruppen
  const sa = document.getElementById('superAdd');
  if (sa) sa.oninput = () => {
    const t = sa.value.trim().toLowerCase();
    const hits = t ? Object.values(S.profiles).filter((p) => !p.deleted_at && member(p.id)?.status !== 'aktiv' && p.name.toLowerCase().includes(t)).slice(0, 8) : [];
    const box = document.getElementById('superHits');
    box.innerHTML = hits.map((p) => `<div class="hitrow"><span class="grow">${esc(p.name)}</span>
      <button class="btn sm" data-sadd="${p.id}" data-r="bruger">${roleNames().bruger}</button><button class="btn sm" data-sadd="${p.id}" data-r="superbruger">${roleNames().superbruger}</button><button class="btn sm primary" data-sadd="${p.id}" data-r="admin">Admin</button></div>`).join('')
      || (t ? '<p class="muted small">Ingen fundet. Spilleren skal have oprettet en profil først.</p>' : '');
    box.querySelectorAll('[data-sadd]').forEach((b) => (b.onclick = async () => {
      await setMember(b.dataset.sadd, b.dataset.r, 'aktiv');
      toast(`${nameOf(b.dataset.sadd)} er tilføjet som ${roleNames()[b.dataset.r].toLowerCase()}`);
      refresh();
    }));
  };

  const ng = document.getElementById('newGroup');
  if (ng) ng.onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, ids = [...f.querySelectorAll('[name=nc]:checked')].map((x) => x.value);
    if (!ids.length && f.kind.value !== 'klub') return toast('Vælg mindst ét center', true);
    const btn = f.querySelector('button');
    busy(btn, true);
    try {
      const id = await q(sb.rpc('padel_create_group_v2', { p_name: f.name.value, p_centers: ids, p_kind: f.kind.value }));
      S.groupId = id;
      try { localStorage.setItem('fp-group', id); } catch {}
      toast(`${f.name.value} er oprettet. Tilføj en admin herunder.`);
      refresh();
    } catch { busy(btn, false); }
  };



  on('[data-rencenter]', async (b) => {
    const c = centerById(b.dataset.rencenter), n = prompt('Nyt navn', c.name);
    if (n?.trim()) { await q(sb.from('padel_centers').update({ name: n.trim() }).eq('id', c.id)); refresh(); }
  });
  on('[data-cmove]', async (b) => {
    const c = courtById(b.dataset.cmove);
    const cs = S.courts.filter((x) => x.center_id === c.center_id).sort((a, x) => a.sort - x.sort);
    const i = cs.indexOf(c), j = i + +b.dataset.dir;
    if (j < 0 || j >= cs.length) return;
    [cs[i], cs[j]] = [cs[j], cs[i]];
    // Gem den nye rækkefølge 1, 2, 3 …
    for (const [k, x] of cs.entries()) if (x.sort !== k + 1) await q(sb.from('padel_courts').update({ sort: k + 1 }).eq('id', x.id));
    await hooks.loadBase(); viewAdmin();
    document.querySelectorAll('details.centerbox').forEach((d) => { if (d.querySelector(`[data-cmove="${c.id}"]`)) d.open = true; });
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
