// Egen profil: overblik øverst, ret oplysninger i en fold-ud. Første gang: velkomstformular.
import { installHow, renderInstall } from '../install.js';
import { unseenReplies } from './suggest.js';
import { latestNewsId } from '../news.js';
import { sb, S, app, hooks, hasSuggest, GENDER, SIDE, roleNames, roleIn, groupElo, group, isSuper, isClub, phoneOf, fmtPhone, esc, toast, q, busy, radios, viewMode, setViewMode, hasElevated } from '../core.js';
import { myKidsSection, bindMyKids, showCalendar, discoverRow } from './club.js';
import { editBtn, setEditMode } from '../editmode.js';
import { msgRowLabel, unreadThreads } from './messages.js';

const initials = (name) => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

// Forælder i en juniorklub: siden på banen er ligegyldig
const parentOnly = () => ['klub', 'foraelder'].includes(S.joinInfo?.kind);

function form(p, isNew) {
  const parent = isNew && parentOnly();
  return `<form class="card" id="pf">
    <label>${parent ? 'Dit navn (forælder)' : 'Navn'}<input name="name" value="${esc(p.name || '')}" required maxlength="60" autocomplete="name"></label>
    <label>Telefonnummer<input name="phone" type="tel" inputmode="tel" value="${esc(p.id ? fmtPhone(phoneOf(p.id)) : '')}" required autocomplete="tel" placeholder="Fx 12 34 56 78">
      <small class="muted">${parent ? 'Kun trænerne kan se det.' : 'Kun admins i dine grupper kan se det.'}</small></label>
    <div class="lbl">Køn</div>${radios('gender', GENDER, p.gender)}
    ${parent ? '<input type="hidden" name="side" value="begge">' : `<div class="lbl">Foretrukken side</div>${radios('side', SIDE, p.side)}`}
    <button class="btn primary">${isNew ? 'Kom i gang' : 'Gem'}</button>
  </form>`;
}

export function renderProfile(isNew) {
  const p = S.me || { name: '', gender: '', side: 'begge' };
  if (isNew) {
    const ji = S.joinInfo;
    const intro = ji?.kind === 'klub' ? `Først lidt om dig. Bagefter melder du dit barn ind i <b>${esc(ji.name)}</b>.`
      : ji?.kind === 'foraelder' ? `Først lidt om dig. Så får du adgang til <b>${esc(ji.kid)}</b>s træninger i ${esc(ji.name)}.`
      : ji?.kind === 'barn' ? `Fortæl lidt om dig selv. Så kan du se dine træninger i <b>${esc(ji.name)}</b>.`
      : 'Fortæl lidt om dig selv, så appen kan sætte gode hold.';
    app.innerHTML = `<div class="page"><h1>Velkommen 👋</h1>
      <p class="muted">${intro}</p>${form(p, true)}</div>`;
    return bind(true);
  }
  const mine = S.members.filter((m) => m.player_id === p.id && m.status !== 'fjernet');
  const phone = phoneOf(p.id);
  const viewing = !!S.viewAs;
  const club = isClub();

  app.innerHTML = `
  <div class="page profile">
    <div class="card me-card">
      <div class="avatar">${esc(initials(p.name))}</div>
      <div class="grow">
        <h1>${esc(p.name)}</h1>${editBtn('padel_profiles', p.id)}
        <small>${isSuper() ? 'Superadmin · ' : ''}${GENDER[p.gender]} · ${SIDE[p.side]}${phone ? ` · ${fmtPhone(phone)}` : ''}</small>
        ${mine.length ? `<div class="gchips">${mine.map((m) => `<span class="gchip">${esc(group(m.group_id)?.name || 'Gruppe')}${m.status === 'afventer' ? ' ⏳' : roleIn(p.id, m.group_id) && roleIn(p.id, m.group_id) !== 'bruger' ? ` · ${roleNames(m.group_id)[roleIn(p.id, m.group_id)]}` : ''}</span>`).join('')}</div>` : ''}
      </div>
      ${club ? '' : `<div class="pts"><b>${groupElo(p.id)}</b><small>point</small></div>`}
    </div>

    ${!phone ? `<div class="card warnbox">📱 ${viewing ? 'Spilleren mangler et telefonnummer.' : 'Tilføj dit telefonnummer, så admin kan få fat i dig.'}</div>` : ''}
    <details class="card editbox" ${phone ? '' : 'open'}><summary><b>✏️ ${viewing ? 'Ret oplysninger' : 'Ret mine oplysninger'}</b><span class="muted">›</span></summary>${form(p, false)}</details>

    <div id="kidsBox"></div>
    <h3>${club ? 'Mit' : 'Min padel'}</h3>
    <div class="list links">
      ${club ? '' : `<a class="row" href="#/spiller/${p.id}"><span class="grow">📊 ${viewing ? 'Statistik' : 'Min statistik'}</span><span class="muted">›</span></a>`}
      ${group()?.fines_enabled ? '<a class="row" href="#/boeder"><span class="grow">💸 Bødekasse</span><span class="muted">›</span></a>' : ''}
      ${viewing ? '' : `<a class="row" href="#/samtaler" id="msgRow"><span class="grow">💬 ${msgRowLabel()}</span><span class="muted">›</span></a>`}
      <a class="row" href="#/beskeder" id="notRow"><span class="grow">🔔 Beskeder og notifikationer</span>${S.unread && !viewing ? `<span class="badge new">${S.unread} nye</span>` : '<span class="muted">›</span>'}</a>
    </div>
    <h3>Appen</h3>
    <div class="list links">
      ${viewing ? '' : '<a class="row" href="#/udseende"><span class="grow">🎨 Udseende</span><span class="muted">›</span></a>'}
      ${hasSuggest() ? '<a class="row" href="#/forslag" id="sugRow"><span class="grow">💡 Forslagskasse</span><span class="muted">›</span></a>' : ''}
      <a class="row" href="#/nyt"><span class="grow">🆕 Nyt i appen</span><span class="muted">›</span></a>
      <a class="row" href="#/faq"><span class="grow">❓ Spørgsmål og svar</span><span class="muted">›</span></a>
      ${club && !viewing ? '<a class="row" href="#" id="calRow"><span class="grow">📅 Træninger i min kalender</span><span class="muted">›</span></a>' : ''}
      <a class="row" href="#/privatliv"><span class="grow">🔒 Privatliv</span><span class="muted">›</span></a>
      ${!viewing && installHow() ? '<a class="row" href="#" id="installRow"><span class="grow">📲 Læg på hjemmeskærmen</span><span class="muted">›</span></a>' : ''}
    </div>
    ${!viewing && hasElevated() ? `<div class="card modecard"><b>👁 Visning</b>
      ${radios('vmode', S.realMe?.is_superadmin ? { super: 'Superadmin', mine: 'Mine roller', bruger: 'Bruger' } : { mine: 'Admin', bruger: 'Bruger' }, viewMode())}
      <p class="muted small">${S.realMe?.is_superadmin ? '<b>Superadmin</b>: alt i alle grupper. <b>Mine roller</b>: kun de grupper, du er med i, med den rolle du har dér. <b>Bruger</b>: som en almindelig spiller.' : '<b>Admin</b>: med dine admin- og trænerrettigheder. <b>Bruger</b>: som en almindelig spiller.'}</p>
      ${S.realMe?.is_superadmin ? `<label class="switch"><input type="checkbox" id="editMode" ${S.editMode ? 'checked' : ''}><span>✏️ Redigeringstilstand <small class="muted">(ret og slet alt, på denne enhed)</small></span></label>` : ''}</div>` : ''}
    <div class="pfoot">
      ${viewing ? '' : '<button class="btn" id="logout">↩️ Log ud</button>'}
      ${p.is_superadmin ? '' : `<button class="link sm dn" id="deleteMe">🗑 ${viewing ? 'Slet spilleren' : 'Slet min profil'}</button>`}
    </div>
  </div>`;
  bind(false);
  // Mine børn i en juniorklub (og knap til at melde flere ind)
  // Diskret linje i listen, hvis der er en klub man kan melde sine børn ind i
  discoverRow().then((h) => { const nr = document.getElementById('notRow'); if (nr && h && !document.getElementById('discRow')) nr.insertAdjacentHTML('afterend', h); });
  myKidsSection().then((h) => { const box = document.getElementById('kidsBox'); if (box && h) { box.innerHTML = h; bindMyKids(() => renderProfile(false)); } });
  // Mærke ved ulæste samtaler
  if (!viewing) unreadThreads().then((n) => { const r = document.getElementById('msgRow'); if (n && r) r.querySelector('.muted').outerHTML = `<span class="badge new">${n} ${n === 1 ? 'ny' : 'nye'}</span>`; });
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
        // Nye spillere skal ikke have gamle nyheder
        if (isNew) { try { await q(sb.rpc('padel_set_news_seen', { p_id: latestNewsId() })); } catch {} }
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
  const em = document.getElementById('editMode');
  if (em) em.onchange = () => { setEditMode(em.checked); toast(em.checked ? 'Redigering er slået til' : 'Redigering er slået fra'); };
  app.querySelectorAll('input[name=vmode]').forEach((r) => (r.onchange = () => { setViewMode(r.value); toast({ super: 'Du ser appen som superadmin', mine: 'Du ser appen med dine egne roller', bruger: 'Du ser appen som almindelig bruger' }[r.value]); hooks.boot(); }));
  document.getElementById('calRow')?.addEventListener('click', (e) => { e.preventDefault(); showCalendar(); });
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
