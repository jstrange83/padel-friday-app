// Egen profil: overblik øverst, ret oplysninger i en fold-ud. Første gang: velkomstformular.
import { installHow, renderInstall } from '../install.js';
import { unseenReplies } from './suggest.js';
import { sb, S, app, hooks, hasSuggest, GENDER, SIDE, ROLE, roleIn, groupElo, group, isSuper, phoneOf, fmtPhone, esc, toast, q, busy, radios } from '../core.js';
import { editBtn } from '../editmode.js';

const initials = (name) => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

function form(p, isNew) {
  return `<form class="card" id="pf">
    <label>Navn<input name="name" value="${esc(p.name || '')}" required maxlength="60" autocomplete="name"></label>
    <label>Telefonnummer<input name="phone" type="tel" inputmode="tel" value="${esc(p.id ? fmtPhone(phoneOf(p.id)) : '')}" required autocomplete="tel" placeholder="Fx 12 34 56 78">
      <small class="muted">Kun admins i dine grupper kan se det.</small></label>
    <div class="lbl">Køn</div>${radios('gender', GENDER, p.gender)}
    <div class="lbl">Foretrukken side</div>${radios('side', SIDE, p.side)}
    <button class="btn primary">${isNew ? 'Kom i gang' : 'Gem'}</button>
  </form>`;
}

export function renderProfile(isNew) {
  const p = S.me || { name: '', gender: '', side: 'begge' };
  if (isNew) {
    app.innerHTML = `<div class="page"><h1>Velkommen 👋</h1>
      <p class="muted">Fortæl lidt om dig selv, så appen kan sætte gode hold.</p>${form(p, true)}</div>`;
    return bind(true);
  }
  const mine = S.members.filter((m) => m.player_id === p.id && m.status !== 'fjernet');
  const phone = phoneOf(p.id);
  const viewing = !!S.viewAs;

  app.innerHTML = `
  <div class="page profile">
    <div class="card me-card">
      <div class="avatar">${esc(initials(p.name))}</div>
      <div class="grow">
        <h1>${esc(p.name)}</h1>${editBtn('padel_profiles', p.id)}
        <small>${isSuper() ? 'Superadmin · ' : ''}${GENDER[p.gender]} · ${SIDE[p.side]}${phone ? ` · ${fmtPhone(phone)}` : ''}</small>
      </div>
      <div class="pts"><b>${groupElo(p.id)}</b><small>point</small></div>
    </div>

    ${mine.length ? `<div class="list groups-mine">${mine.map((m) => `<div class="row">
      <div class="grow"><b>${esc(group(m.group_id)?.name || 'Gruppe')}</b>
        <small>${m.status === 'afventer' ? '⏳ Venter på godkendelse' : ROLE[roleIn(p.id, m.group_id)] || 'Bruger'}</small></div>
      </div>`).join('')}</div>` : ''}

    ${!phone ? `<div class="card warnbox">📱 ${viewing ? 'Spilleren mangler et telefonnummer.' : 'Tilføj dit telefonnummer, så admin kan få fat i dig.'}</div>` : ''}
    <details class="card editbox" ${phone ? '' : 'open'}><summary><b>✏️ ${viewing ? 'Ret oplysninger' : 'Ret mine oplysninger'}</b><span class="muted">›</span></summary>${form(p, false)}</details>

    <div class="list links">
      <a class="row" href="#/spiller/${p.id}"><span class="grow">📊 ${viewing ? 'Statistik' : 'Min statistik'}</span><span class="muted">›</span></a>
      ${group()?.fines_enabled ? '<a class="row" href="#/boeder"><span class="grow">💸 Bødekasse</span><span class="muted">›</span></a>' : ''}
      ${hasSuggest() ? '<a class="row" href="#/forslag" id="sugRow"><span class="grow">💡 Forslagskasse</span><span class="muted">›</span></a>' : ''}
      <a class="row" href="#/faq"><span class="grow">❓ Spørgsmål og svar</span><span class="muted">›</span></a>
      ${!viewing && installHow() ? '<a class="row" href="#" id="installRow"><span class="grow">📲 Læg på hjemmeskærmen</span><span class="muted">›</span></a>' : ''}
      ${viewing ? '' : '<button class="row logout" id="logout"><span class="grow">↩️ Log ud</span></button>'}
      ${p.is_superadmin ? '' : `<button class="row delme" id="deleteMe"><span class="grow">🗑 ${viewing ? 'Slet spilleren' : 'Slet min profil'}</span></button>`}
    </div>
  </div>`;
  bind(false);
  // Mærke ved nye svar på forslag
  if (hasSuggest()) unseenReplies().then((n) => { const r = document.getElementById('sugRow'); if (n && r) r.querySelector('.muted').outerHTML = `<span class="badge new">${n === 1 ? 'Nyt svar' : `${n} nye svar`}</span>`; });
}

function bind(isNew) {
  const f = document.getElementById('pf');
  if (f) f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button');
    busy(btn, true);
    try {
      if (S.viewAs) {
        // Admin retter spillerens oplysninger
        await q(sb.rpc('padel_admin_update_player', { p_user: S.viewAs, p_name: f.name.value, p_gender: f.gender.value, p_side: f.side.value }));
        await q(sb.rpc('padel_admin_set_phone', { p_user: S.viewAs, p_phone: f.phone.value }));
      } else {
        await q(sb.rpc('padel_save_profile', { p_name: f.name.value, p_gender: f.gender.value, p_side: f.side.value }));
        const claimed = await q(sb.rpc('padel_set_phone_v2', { p_phone: f.phone.value }));
        if (claimed) {
          toast('Velkommen! Dine kampe og point fra før er flyttet over til dig');
          if (isNew) { location.hash = '#/fredage'; return hooks.boot(); }
          await hooks.loadBase(); return renderProfile(false);
        }
      }
      toast('Profilen er gemt');
      if (isNew) { if (!location.hash.startsWith('#/fredag/')) location.hash = '#/fredage'; return hooks.boot(); }
      await hooks.loadBase();
      renderProfile(false);
    } catch { busy(btn, false); }
  };
  document.getElementById('logout')?.addEventListener('click', () => sb.auth.signOut());
  document.getElementById('deleteMe')?.addEventListener('click', async (e) => {
    const who = S.viewAs ? S.me.name : 'din profil';
    if (!confirm(`Slet ${who}?\n\n${S.viewAs ? 'Spilleren' : 'Du'} forsvinder fra grupperne og ranglisten. Point og kampe gemmes: ${S.viewAs ? 'kommer spilleren' : 'kommer du'} igen (samme mail eller telefonnummer), er pointene de samme.`)) return;
    busy(e.currentTarget, true);
    try {
      await q(sb.rpc('padel_delete_player', { p_user: S.me.id }));
      if (S.viewAs) { toast('Spilleren er slettet'); const { stopViewAs } = await import('../viewas.js'); return stopViewAs(); }
      toast('Din profil er slettet'); await sb.auth.signOut();
    } catch { busy(e.currentTarget, false); }
  });
  document.getElementById('installRow')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('nav').innerHTML = '';
    renderInstall(() => hooks.boot());
  });
}
