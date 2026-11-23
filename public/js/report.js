// Anmeld og bloker: brugere kan anmelde en besked, et opslag eller en person, og blokere personer,
// så man ikke længere ser deres beskeder og opslag. Anmeldelser går til appens superadmin.
import { sb, S, esc, toast, q, busy } from './core.js';

export const REASONS = ['Krænkende eller chikanerende', 'Upassende indhold', 'Spam eller reklame', 'Andet'];

export async function loadBlocks(force = false) {
  if (S.blocks && !force) return S.blocks;
  try { S.blocks = await q(sb.rpc('padel_my_blocks_v2')) || []; } catch { S.blocks = S.blocks || []; }
  return S.blocks;
}
export const isBlocked = (id) => !!(S.blocks || []).find((b) => b.id === id);

// Popup: vælg grund, skriv evt. lidt mere, send. what = 'beskeden' | 'opslaget' | navn
export function reportDialog(kind, item, what, after) {
  document.getElementById('repModal')?.remove();
  const wrap = document.createElement('div');
  wrap.id = 'repModal';
  wrap.className = 'modal';
  wrap.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="repTitle">
    <div class="fgicon">🚩</div><h2 id="repTitle">Anmeld ${esc(what)}</h2>
    <p class="muted small center">Anmeldelsen går til Padelklubben, som kigger på den hurtigst muligt og senest inden for 24 timer. Personen får ikke at vide, hvem der har anmeldt.</p>
    <form id="repForm"><div class="repreasons">${REASONS.map((r, i) => `<label class="reprow"><input type="radio" name="reason" value="${esc(r)}" ${i === 0 ? 'checked' : ''}> ${esc(r)}</label>`).join('')}</div>
      <label>Vil du fortælle mere? <small class="muted">(valgfrit)</small><textarea name="details" rows="3" maxlength="1000"></textarea></label>
      <div class="mact"><button type="button" class="btn" id="repCancel">Fortryd</button><button class="btn primary">Send anmeldelse</button></div></form></div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('#repCancel').onclick = () => wrap.remove();
  wrap.querySelector('#repForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, b = f.querySelector('button.primary');
    busy(b, true);
    try {
      await q(sb.rpc('padel_report_v2', { p_kind: kind, p_item: item, p_reason: f.reason.value, p_details: f.details.value.trim() || null }));
      wrap.remove();
      toast('Tak. Anmeldelsen er sendt 🚩');
      after?.();
    } catch { busy(b, false); }
  };
}

export async function setBlock(id, name, on, after) {
  if (on && !confirm(`Bloker ${name}? Du ser ikke længere ${name.split(' ')[0]}s beskeder og opslag. Du kan fjerne blokeringen under Min padel → Indstillinger.`)) return;
  try {
    await q(sb.rpc('padel_block_v2', { p_user: id, p_on: on }));
    await loadBlocks(true);
    toast(on ? `${name.split(' ')[0]} er blokeret` : `Blokeringen af ${name.split(' ')[0]} er fjernet`);
    after?.();
  } catch {}
}

// Små knapper under en besked eller et opslag fra en anden
export const reportLinks = (kind, item, userId, name) => userId && userId !== S.me?.id ? `<span class="repacts">
  <button class="link sm" data-rep="${kind}|${item}">🚩 Anmeld</button><button class="link sm" data-blk="${userId}" data-bname="${esc(name || 'brugeren')}">🚫 Bloker</button></span>` : '';

export function bindReportLinks(root, after) {
  root.querySelectorAll('[data-rep]').forEach((b) => (b.onclick = () => { const [k, id] = b.dataset.rep.split('|'); reportDialog(k, id, k === 'msg' ? 'beskeden' : 'opslaget', after); }));
  root.querySelectorAll('[data-blk]').forEach((b) => (b.onclick = () => setBlock(b.dataset.blk, b.dataset.bname, true, after)));
  root.querySelectorAll('[data-unblk]').forEach((b) => (b.onclick = () => setBlock(b.dataset.unblk, b.dataset.bname, false, after)));
}

// Liste til indstillinger
export async function blockedListHtml() {
  const bl = await loadBlocks(true);
  return bl.length ? bl.map((b) => `<div class="krow"><span class="grow">${esc(b.name)}</span><button class="btn sm ghost" data-unblk="${b.id}" data-bname="${esc(b.name)}">Fjern blokering</button></div>`).join('')
    : '<p class="muted small">Du har ikke blokeret nogen.</p>';
}

// Superadmin: alle anmeldelser
export async function viewReports(app) {
  let list = [];
  try { list = await q(sb.rpc('padel_reports_list_v2')); } catch { app.innerHTML = '<div class="page"><p class="muted">Det har du ikke adgang til.</p></div>'; return; }
  const kindL = { msg: 'Besked', post: 'Opslag', user: 'Person' };
  app.innerHTML = `<div class="page"><a class="back" href="#/profil">‹ Min padel</a><h1>🚩 Anmeldelser</h1>
    <p class="muted small">Anmeldelser skal ses på inden for 24 timer. Fjern indholdet og bloker eller fjern personen fra gruppen, hvis det er nødvendigt.</p>
    ${list.map((r) => `<div class="card report ${r.status === 'ny' ? 'new' : ''}"><div class="ftop"><b class="grow">${esc(kindL[r.kind] || r.kind)} fra ${esc(r.target || 'ukendt')}</b><span class="badge">${r.status === 'ny' ? 'Ny' : 'Behandlet'}</span></div>
      <p class="small"><b>${esc(r.reason || '')}</b>${r.details ? ` · ${esc(r.details)}` : ''}</p>
      ${r.excerpt ? `<blockquote class="small">${esc(r.excerpt)}</blockquote>` : ''}
      <small class="muted">Anmeldt af ${esc(r.reporter || 'ukendt')} · ${new Date(r.at).toLocaleString('da-DK', { dateStyle: 'short', timeStyle: 'short' })}</small>
      ${r.status === 'ny' ? `<div class="mact"><button class="btn sm" data-rdone="${r.id}">✓ Markér som behandlet</button></div>` : ''}</div>`).join('') || '<div class="card empty"><p class="muted">Ingen anmeldelser.</p></div>'}</div>`;
  app.querySelectorAll('[data-rdone]').forEach((b) => (b.onclick = async () => { busy(b, true); try { await q(sb.rpc('padel_report_status_v2', { p_id: b.dataset.rdone, p_status: 'behandlet' })); viewReports(app); } catch { busy(b, false); } }));
}

// Min padel → Indstillinger → Blokerede brugere
export async function viewBlocked(app) {
  app.innerHTML = `<div class="page"><a class="back" href="#/profil">‹ Min padel</a><h1>🚫 Blokerede brugere</h1>
    <p class="muted small">Du ser ikke beskeder og opslag fra personer, du har blokeret. Du blokerer en person med 🚫 Bloker under deres besked eller opslag.</p>
    <div class="card" id="blkList">${await blockedListHtml()}</div></div>`;
  bindReportLinks(app, () => viewBlocked(app));
}
