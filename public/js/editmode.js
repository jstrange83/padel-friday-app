// Redigeringstilstand for superadmin: en ✏️ på kasserne rundt i appen, som åbner et vindue
// hvor man kan rette felterne og slette. Slås til og fra under Admin (gemmes på denne telefon).
import { sb, S, hooks, esc, toast, q, busy, FORMAT, MODE, GENDER, SIDE, ROLE } from './core.js';

try { S.editMode = localStorage.getItem('fp-edit') === '1'; } catch { S.editMode = false; }
export const isRealSuper = () => !!S.realMe?.is_superadmin;
export const editOn = () => isRealSuper() && !S.viewAs && !!S.editMode;
export function setEditMode(on) {
  S.editMode = !!on;
  try { localStorage.setItem('fp-edit', on ? '1' : '0'); } catch {}
  renderEditBar();
}
// Knappen der sættes på en kasse
export const editBtn = (table, id) => (editOn() ? `<button type="button" class="sedit" data-sedit="${table}|${id}" aria-label="Ret eller slet">✏️</button>` : '');

const opt = (o) => Object.entries(o).map(([v, l]) => ({ v, l }));
const SCHEMA = {
  padel_events: { title: 'Spilledag', del: 'Slet spilledagen med alle kampe og tilmeldinger? Pointene rulles tilbage.', fields: [
    ['title', 'Titel', 'text'], ['starts_at', 'Starter', 'datetime'], ['duration_minutes', 'Varighed (min)', 'number'],
    ['round_minutes', 'Minutter pr. runde', 'number'], ['format', 'Spiltype', opt(FORMAT)], ['team_mode', 'Hold', opt(MODE)],
    ['status', 'Status', opt({ planlagt: 'Planlagt', igang: 'I gang', afsluttet: 'Afsluttet' })], ['current_round', 'Nuværende runde', 'number'],
    ['ranked', 'Tæller på ranglisten', 'bool'], ['points_per_match', 'Point pr. kamp (Americano)', 'number']] },
  padel_matches: { title: 'Kamp', del: 'Slet kampen? Pointene rulles tilbage.', fields: [
    ['round_no', 'Runde', 'number'], ['court_id', 'Bane', 'court'], ['score_a', 'Score hold 1 (venstre)', 'number'], ['score_b', 'Score hold 2 (højre)', 'number'],
    ['status', 'Status', opt({ planlagt: 'Ikke spillet', indtastet: 'Afventer godkendelse', bekraeftet: 'Godkendt' })]] },
  padel_fines: { title: 'Bøde', del: 'Slet bøden?', fields: [
    ['title', 'Hvad for', 'text'], ['amount', 'Beløb (kr.)', 'number'], ['minutes', 'Minutter', 'number'], ['note', 'Note', 'text'],
    ['status', 'Status', opt({ ubetalt: 'Ubetalt', afventer: 'Afventer', betalt: 'Betalt', annulleret: 'Annulleret' })]] },
  padel_fine_types: { title: 'Takst', del: 'Slet taksten? Bøder der er givet, bliver stående.', fields: [
    ['name', 'Navn', 'text'], ['amount', 'Beløb (kr.)', 'number'], ['per_minute', 'Pr. minut', 'bool'],
    ['auto', 'Automatisk', [{ v: '', l: 'Nej' }, { v: 'afbud', l: 'Ved afmelding' }, { v: 'afbud_dagen', l: 'Ved afmelding på dagen' }]],
    ['active', 'Slået til', 'bool'], ['sort', 'Rækkefølge', 'number']] },
  padel_profiles: { title: 'Spiller', fields: [
    ['name', 'Navn', 'text'], ['gender', 'Køn', opt(GENDER)], ['side', 'Side', opt(SIDE)], ['elo', 'Fælles point (alle grupper)', 'number']] },
  padel_group_members: { title: 'Spiller i gruppen', fields: [
    ['elo', 'Point i gruppen', 'number'], ['role', 'Rolle', opt(ROLE)], ['status', 'Status', opt({ aktiv: 'Aktiv', afventer: 'Afventer', fjernet: 'Fjernet' })]] },
  padel_suggestions: { title: 'Forslag', del: 'Slet forslaget?', fields: [
    ['text', 'Forslag', 'textarea'], ['status', 'Status', opt({ ny: 'Ny', set: 'Set', planlagt: 'Planlagt', lavet: 'Lavet', nej: 'Nej tak' })], ['reply', 'Svar', 'textarea']] },
  padel_signup_log: { title: 'Linje i til- og afmeldinger', del: 'Slet linjen?', fields: [] },
};

const toLocal = (iso) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

async function loadRow(table, id) {
  let qy = sb.from(table).select('*');
  if (table === 'padel_group_members') { const [g, p] = id.split('|'); qy = qy.eq('group_id', g).eq('player_id', p); } else qy = qy.eq('id', table === 'padel_signup_log' ? +id : id);
  return q(qy.single());
}

function input([k, label, type], row) {
  const v = row[k];
  if (type === 'bool') return `<label class="switch"><input type="checkbox" name="${k}" ${v ? 'checked' : ''}><span>${label}</span></label>`;
  if (type === 'textarea') return `<label>${label}<textarea name="${k}" rows="3">${esc(v ?? '')}</textarea></label>`;
  if (type === 'datetime') return `<label>${label}<input type="datetime-local" name="${k}" value="${toLocal(v)}"></label>`;
  if (type === 'court') return `<label>${label}<select name="${k}">${S.courts.map((c) => `<option value="${c.id}" ${c.id === v ? 'selected' : ''}>${esc(S.centers.find((x) => x.id === c.center_id)?.name || '')} · ${esc(c.name)}</option>`).join('')}</select></label>`;
  if (Array.isArray(type)) return `<label>${label}<select name="${k}">${type.map((o) => `<option value="${o.v}" ${String(v ?? '') === o.v ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select></label>`;
  return `<label>${label}<input type="${type === 'number' ? 'number' : 'text'}" ${type === 'number' ? 'step="any"' : ''} name="${k}" value="${esc(v ?? '')}"></label>`;
}

function readValue([k, , type], f) {
  const el = f.elements[k];
  if (type === 'bool') return el.checked;
  if (type === 'number') return el.value === '' ? null : +el.value;
  if (type === 'datetime') return el.value ? new Date(el.value).toISOString() : null;
  return el.value === '' ? null : el.value;
}

async function openEditor(table, id) {
  const sc = SCHEMA[table];
  if (!sc) return;
  let row;
  try { row = await loadRow(table, id); } catch { return; }
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `<div class="modal-card sedit-card" role="dialog" aria-modal="true">
    <h2>✏️ ${sc.title}</h2>
    <form id="seForm">${sc.fields.map((fd) => input(fd, row)).join('') || '<p class="muted">Kan kun slettes.</p>'}
      <div class="mact">${sc.del ? '<button type="button" class="btn sm ghost danger" id="seDel">🗑 Slet</button>' : ''}<button type="button" class="btn sm ghost" id="seClose">Luk</button>${sc.fields.length ? '<button class="btn sm primary">Gem</button>' : ''}</div>
    </form></div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  const done = async (msg) => { close(); toast(msg); await hooks.loadBase(); await hooks.route?.(); };
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.querySelector('#seClose').onclick = close;
  const f = wrap.querySelector('#seForm');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const data = {};
    for (const fd of sc.fields) { const v = readValue(fd, f); if (JSON.stringify(v) !== JSON.stringify(fd[2] === 'datetime' && row[fd[0]] ? new Date(row[fd[0]]).toISOString() : row[fd[0]] ?? null)) data[fd[0]] = v; }
    if (!Object.keys(data).length) return close();
    const btn = f.querySelector('button.primary'); busy(btn, true);
    try { await q(sb.rpc('padel_super_update', { p_table: table, p_id: id, p_data: data })); await done('Rettet'); } catch { busy(btn, false); }
  };
  const del = wrap.querySelector('#seDel');
  if (del) del.onclick = async () => {
    if (!confirm(sc.del)) return;
    busy(del, true);
    try {
      await q(sb.rpc('padel_super_prepare_delete', { p_table: table, p_id: id }));
      await q(sb.from(table).delete().eq('id', table === 'padel_signup_log' ? +id : id));
      if (table === 'padel_events' && location.hash.startsWith('#/fredag/')) location.hash = '#/fredage';
      await done('Slettet');
    } catch { busy(del, false); }
  };
}

// Én fælles lytter: virker på alle ✏️ i hele appen
document.addEventListener('click', (e) => {
  const b = e.target.closest?.('[data-sedit]');
  if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const i = b.dataset.sedit.indexOf('|');
  openEditor(b.dataset.sedit.slice(0, i), b.dataset.sedit.slice(i + 1));
}, true);

// Bjælke øverst, så man kan se, at redigering er slået til
export function renderEditBar() {
  let bar = document.getElementById('editBar');
  if (!editOn()) return bar?.remove();
  if (!bar) { bar = document.createElement('div'); bar.id = 'editBar'; document.body.prepend(bar); }
  bar.innerHTML = '<span>✏️ Redigering er slået til</span><button id="editOff">Slå fra</button>';
  bar.querySelector('#editOff').onclick = async () => { setEditMode(false); await hooks.route?.(); };
}
