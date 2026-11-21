// Nye spillere, der venter på godkendelse i mine grupper: popup med Godkend/Afvis direkte,
// når appen åbnes, og når man trykker på beskeden "X vil gerne være med" (#/godkend).
import { sb, S, hooks, esc, toast, q, busy, pendingForMe, GENDER, SIDE, phoneOf, fmtPhone } from '../core.js';

const KEY = 'fp-pend-later';
const later = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch { return []; } };
const setLater = (ids) => { try { sessionStorage.setItem(KEY, JSON.stringify(ids)); } catch {} };
const idOf = (m) => m.group_id + '|' + m.player_id;

export function askPending(force = false) {
  if (S.viewAs || !S.me || document.querySelector('.modal')) return false;
  const all = pendingForMe().filter((m) => S.groups.find((g) => g.id === m.group_id)?.kind !== 'klub');
  const list = force ? all : all.filter((m) => !later().includes(idOf(m)));
  if (!list.length) return false;
  const gname = (g) => S.groups.find((x) => x.id === g)?.name || '';
  const wrap = document.createElement('div');
  wrap.id = 'pendModal';
  wrap.className = 'modal';
  const row = (m) => {
    const p = S.profiles[m.player_id];
    const info = [gname(m.group_id), GENDER[p.gender], SIDE[p.side], phoneOf(p.id) ? fmtPhone(phoneOf(p.id)) : ''].filter(Boolean).join(' · ');
    return `<div class="pendrow" data-pm="${idOf(m)}"><span class="grow"><b>${esc(p.name)}</b><small class="muted">${esc(info)}</small></span>
      <div class="mact"><button class="btn sm ghost" data-pno="${idOf(m)}">Afvis</button><button class="btn sm primary" data-pyes="${idOf(m)}">Godkend</button></div></div>`;
  };
  wrap.innerHTML = `<div class="modal-card pendcard" role="dialog" aria-modal="true" aria-labelledby="pendTitle">
    <div class="fgicon">👋</div><h2 id="pendTitle">${list.length === 1 ? 'Ny spiller vil være med' : `${list.length} nye spillere vil være med`}</h2>
    <div class="pendlist">${list.map(row).join('')}</div>
    <div class="mact"><button class="btn" id="pendLater">Senere</button><a class="btn ghost" href="#/admin" id="pendAdmin">Se under Admin</a></div></div>`;
  document.body.appendChild(wrap);
  const close = async (changed) => { wrap.remove(); if (changed) { await hooks.loadBase(); hooks.renderNav?.(); } };
  let changed = false;
  const left = () => wrap.querySelectorAll('.pendrow').length;
  const decide = async (b, id, status) => {
    const [g, p] = id.split('|');
    busy(b, true);
    try {
      await q(sb.rpc('padel_set_member', { g, p, p_role: 'bruger', p_status: status }));
      changed = true;
      const m = S.members.find((x) => x.group_id === g && x.player_id === p); if (m) m.status = status;
      toast(status === 'aktiv' ? `${S.profiles[p]?.name.split(' ')[0] || 'Spilleren'} er godkendt og kan nu tilmelde sig` : 'Anmodningen er afvist');
      wrap.querySelector(`[data-pm="${id}"]`)?.remove();
      if (!left()) close(true);
    } catch { busy(b, false); }
  };
  wrap.querySelectorAll('[data-pyes]').forEach((b) => (b.onclick = () => decide(b, b.dataset.pyes, 'aktiv')));
  wrap.querySelectorAll('[data-pno]').forEach((b) => (b.onclick = () => { if (confirm(`Afvis ${S.profiles[b.dataset.pno.split('|')[1]]?.name || 'spilleren'}?`)) decide(b, b.dataset.pno, 'fjernet'); }));
  wrap.querySelector('#pendLater').onclick = () => { setLater([...new Set([...later(), ...list.map(idOf)])]); close(changed); };
  wrap.querySelector('#pendAdmin').onclick = () => close(changed);
  return true;
}
