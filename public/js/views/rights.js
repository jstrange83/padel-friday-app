// Admin → Rettigheder: admin sætter flueben ved, hvad hver person må i gruppen eller klubben.
// Gemmes med det samme. Admin har altid alle rettigheder. Databasen tjekker det samme (padel_has_right_v2).
import { sb, S, app, esc, nameOf, toast, q, isAdmin, isClub, roleIn, roleNames, viewMode, haptic } from '../core.js';

export const GROUP_RIGHTS = [
  ['koere', '▶️', 'Køre spilledagen', 'Starte runder, rette hold, til- og afmelde andre og godkende resultater'],
  ['spilledage', '📅', 'Spilledage', 'Oprette og rette spilledage'],
  ['medlemmer', '👥', 'Spillere', 'Godkende nye spillere og rette deres oplysninger'],
  ['boeder', '💸', 'Bødekasse', 'Godkende bøder og betalinger'],
  ['nyhedsbrev', '📰', 'Nyhedsbrev', 'Skrive og sende nyhedsbreve på mail til gruppen'],
];
export const CLUB_RIGHTS = [
  ['traening', '🗓', 'Træninger', 'Se alle hold, tilmeldinger og afbud og krydse fremmøde af (men ikke rette hold og tider)'],
  ['medlemmer', '🧒', 'Medlemmer', 'Godkende nye og sætte dem på hold'],
  ['kontingent', '💳', 'Kontingent', 'Se og registrere, hvem der har betalt'],
  ['opslag', '📣', 'Opslag', 'Skrive opslag til hele klubben'],
  ['arrangementer', '🎉', 'Arrangementer', 'Oprette og styre arrangementer'],
  ['nyhedsbrev', '📰', 'Nyhedsbrev', 'Skrive og sende nyhedsbreve på mail til klubben'],
];
export const rightsFor = (g = S.groupId) => (isClub(g) ? CLUB_RIGHTS : GROUP_RIGHTS);

// Har jeg fået nogen rettigheder i den valgte gruppe? (så får jeg Admin i menuen)
// (I en spillegruppe giver kun Spillere en side under Admin; de andre virker ude i appen)
export const anyRight = (g = S.groupId) => viewMode() !== 'bruger' && (isClub(g) ? !!S.rights?.[g]?.length : ['medlemmer', 'nyhedsbrev'].some((r) => S.rights?.[g]?.includes(r)));

export async function loadGroupRights(g = S.groupId) {
  S.groupRights ||= {};
  if (!g || !isAdmin(g)) return;
  try { S.groupRights[g] = Object.fromEntries((await q(sb.rpc('padel_group_rights_v2', { g }))).map((x) => [x.user_id, x.rights])); } catch { S.groupRights[g] = {}; }
}
export const rightsOf = (uid, g = S.groupId) => S.groupRights?.[g]?.[uid] || [];
export const rightsCount = (g = S.groupId) => Object.values(S.groupRights?.[g] || {}).filter((r) => r.length).length;

export async function saveRights(uid, rights, g = S.groupId) {
  await q(sb.rpc('padel_set_rights_v2', { g, p_user: uid, p_rights: rights }));
  S.groupRights ||= {}; S.groupRights[g] ||= {}; S.groupRights[g][uid] = rights;
}

function personCard(uid) {
  const g = S.groupId, role = roleIn(uid) || 'bruger', mine = rightsOf(uid), list = rightsFor();
  if (role === 'admin') return `<div class="card rcard admin"><div class="rhead"><b>${esc(nameOf(uid))}</b><span class="badge role-admin">${roleNames()[role]}</span></div><p class="muted small">Admin må alt.</p></div>`;
  // Superbruger i en spillegruppe må altid køre spilledagen (via rollen)
  const viaRole = (k) => !isClub(g) && role === 'superbruger' && k === 'koere';
  return `<div class="card rcard" data-ruser="${uid}">
    <div class="rhead"><b>${esc(nameOf(uid))}</b>${role !== 'bruger' ? `<span class="badge role-${role}">${roleNames()[role]}</span>` : ''}
      <span class="grow"></span><button class="link sm" data-rall="${uid}">Alle</button><button class="link sm" data-rnone="${uid}">Ingen</button></div>
    <div class="rchips">${list.map(([k, ic, t, d]) => `<label class="rchip ${viaRole(k) ? 'locked' : ''}" title="${esc(d)}">
      <input type="checkbox" data-rk="${k}" ${mine.includes(k) || viaRole(k) ? 'checked' : ''} ${viaRole(k) ? 'disabled' : ''}><span>${ic} ${t}</span></label>`).join('')}</div>
  </div>`;
}

export function rightsTab() {
  const g = S.groupId;
  const mem = S.members.filter((m) => m.group_id === g && m.status === 'aktiv' && S.profiles[m.player_id]);
  const has = (id) => rightsOf(id).length || ['admin', 'superbruger'].includes(roleIn(id)) || (S.rightsAdd || []).includes(id);
  const order = { admin: 0, superbruger: 1, bruger: 2 };
  const shown = mem.map((m) => m.player_id).filter(has).sort((a, b) => order[roleIn(a) || 'bruger'] - order[roleIn(b) || 'bruger'] || nameOf(a).localeCompare(nameOf(b)));
  const others = mem.map((m) => m.player_id).filter((id) => !has(id)).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  return `
    <div class="card rintro"><p>Sæt flueben ved det, hver person må. Det gemmes med det samme. <b>Admin</b> må altid alt.</p>
      <details class="rlegend"><summary class="muted small">Hvad betyder fluebenene?</summary>
        <ul>${rightsFor().map(([, ic, t, d]) => `<li>${ic} <b>${t}</b>: ${d}</li>`).join('')}</ul>
        ${isClub() ? '<p class="muted small">Trænere styrer altid deres egne hold. Med Træninger kan man se og krydse af på alle hold.</p>' : '<p class="muted small">Superbrugere må altid køre spilledagen.</p>'}</details></div>
    ${others.length ? `<div class="card radd"><label>➕ Giv rettigheder til en person<input type="search" id="rightsFind" placeholder="Skriv et navn…" autocomplete="off"></label>
      <div class="hits" id="rightsHits"></div></div>` : ''}
    <div class="rlist">${shown.map(personCard).join('')}</div>`;
}

export function bindRights(refresh) {
  const g = S.groupId;
  const save = async (card, uid, rights) => {
    card?.classList.add('saving');
    try { await saveRights(uid, rights, g); haptic('light'); toast(`Gemt for ${nameOf(uid).split(' ')[0]}`); } catch { await refresh(); }
    card?.classList.remove('saving');
  };
  app.querySelectorAll('.rcard[data-ruser]').forEach((card) => {
    const uid = card.dataset.ruser;
    const current = () => [...card.querySelectorAll('input[data-rk]:checked:not(:disabled)')].map((x) => x.dataset.rk);
    card.querySelectorAll('input[data-rk]').forEach((x) => (x.onchange = () => save(card, uid, current())));
    card.querySelector('[data-rall]').onclick = () => { card.querySelectorAll('input[data-rk]:not(:disabled)').forEach((x) => (x.checked = true)); save(card, uid, current()); };
    card.querySelector('[data-rnone]').onclick = () => { card.querySelectorAll('input[data-rk]:not(:disabled)').forEach((x) => (x.checked = false)); save(card, uid, []); };
  });
  const find = document.getElementById('rightsFind'), hits = document.getElementById('rightsHits');
  if (find) find.oninput = () => {
    const t = find.value.trim().toLowerCase();
    const mem = S.members.filter((m) => m.group_id === g && m.status === 'aktiv' && S.profiles[m.player_id] && !app.querySelector(`.rcard[data-ruser="${m.player_id}"]`));
    const list = t ? mem.filter((m) => nameOf(m.player_id).toLowerCase().includes(t)).slice(0, 8) : [];
    hits.innerHTML = list.map((m) => `<button class="hit" data-radd="${m.player_id}">${esc(nameOf(m.player_id))}</button>`).join('') || (t ? '<p class="muted small">Ingen fundet</p>' : '');
    hits.querySelectorAll('[data-radd]').forEach((b) => (b.onclick = () => { S.rightsAdd = [...(S.rightsAdd || []), b.dataset.radd]; refresh(); }));
  };
}
