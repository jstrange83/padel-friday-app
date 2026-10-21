// Egen profil (og velkomst første gang).
import { sb, S, app, hooks, GENDER, SIDE, ROLE, roleIn, groupElo, group, isSuper, esc, toast, q, busy, radios } from '../core.js';

export function renderProfile(isNew) {
  const p = S.me || { name: '', gender: '', side: 'begge' };
  app.innerHTML = `
  <div class="page">
    <h1>${isNew ? 'Velkommen 👋' : 'Din profil'}</h1>
    ${isNew ? '<p class="muted">Fortæl lidt om dig selv, så appen kan sætte gode hold.</p>'
      : `<p class="muted">${isSuper() ? 'Superadmin' : ''}</p>`}
    <form class="card" id="pf">
      <label>Navn<input name="name" value="${esc(p.name)}" required maxlength="60" autocomplete="name"></label>
      <div class="lbl">Køn</div>${radios('gender', GENDER, p.gender)}
      <div class="lbl">Foretrukken side</div>${radios('side', SIDE, p.side)}
      <button class="btn primary">${isNew ? 'Kom i gang' : 'Gem'}</button>
    </form>
    ${isNew ? '' : `
      ${groupsList(p)}
      <div class="list links">
        <a class="row" href="#/spiller/${p.id}"><span class="grow">📊 Min statistik</span><span class="muted">›</span></a>
        <a class="row" href="#/faq"><span class="grow">❓ Spørgsmål og svar</span><span class="muted">›</span></a>
      </div>
      <p class="muted small tipline">Tip: Vælg "Føj til hjemmeskærm" i Safari eller Chrome, så ligger appen på telefonen.</p>
      <button class="btn ghost" id="logout">Log ud</button>`}
  </div>`;

  document.getElementById('pf').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('button');
    busy(btn, true);
    try {
      await q(sb.rpc('padel_save_profile', { p_name: f.name.value, p_gender: f.gender.value, p_side: f.side.value }));
      toast('Profilen er gemt');
      if (isNew) { if (!location.hash.startsWith('#/fredag/')) location.hash = '#/fredage'; return hooks.boot(); }
      await hooks.loadBase();
    } catch {} finally { busy(btn, false); }
  };
  document.getElementById('logout')?.addEventListener('click', () => sb.auth.signOut());
}

// Mine grupper med point og rolle, samt anmodninger der venter
function groupsList(p) {
  const mine = S.members.filter((m) => m.player_id === p.id && m.status !== 'fjernet');
  if (!mine.length) return '';
  return `<h3>Mine grupper</h3><div class="list">${mine.map((m) => `<div class="row">
    <div class="grow"><b>${esc(group(m.group_id)?.name || 'Gruppe')}</b>
      <small>${m.status === 'afventer' ? '⏳ Venter på godkendelse' : `${ROLE[roleIn(p.id, m.group_id)] || 'Bruger'}`}</small></div>
    ${m.status === 'aktiv' ? `<div class="elo">${groupElo(p.id, m.group_id)}</div>` : ''}</div>`).join('')}</div>`;
}
