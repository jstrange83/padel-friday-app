// Forslagskasse: spilleren skriver forslag i appen (ingen mails). Superadmin læser og svarer under Admin.
import { sb, S, app, esc, toast, q, busy, fmtDate, nameOf, group } from '../core.js';

export const SSTATUS = { ny: 'Ny', set: 'Set', planlagt: 'Planlagt', lavet: 'Lavet ✓', nej: 'Nej tak' };
const date = (d) => fmtDate(d, { day: 'numeric', month: 'short', year: 'numeric' });

export async function viewSuggest() {
  const mine = await q(sb.from('padel_suggestions').select('*').eq('player_id', S.me.id).order('created_at', { ascending: false }));
  app.innerHTML = `
  <div class="page suggest">
    <button class="back" onclick="location.hash='#/profil'">‹ Profil</button>
    <h1>💡 Forslagskasse</h1>
    <p class="muted">Har du en idé til appen, eller er der noget, der driller? Skriv det her. Kun den, der står for appen, kan læse det, og du får svar her i appen.</p>
    ${S.viewAs ? '<div class="card warnbox">Du ser appen som en anden spiller. Forslag sendes i dit eget navn.</div>' : ''}
    <form class="card" id="sugForm">
      <label>Dit forslag<textarea name="text" rows="5" maxlength="2000" required placeholder="Fx: Det ville være fedt, hvis …"></textarea></label>
      <button class="btn primary">Send forslag</button>
    </form>
    ${mine.length ? `<h3>Dine forslag</h3>${mine.map((x) => `
      <div class="card sug ${x.reply_seen ? '' : 'new'}">
        <div class="ftop"><small class="muted">${date(x.created_at)}</small><span class="badge sst-${x.status}">${SSTATUS[x.status]}</span></div>
        <p class="stext">${esc(x.text)}</p>
        ${x.reply ? `<div class="sreply"><small class="muted">Svar${x.replied_at ? ` · ${date(x.replied_at)}` : ''}</small><p>${esc(x.reply)}</p></div>` : ''}
      </div>`).join('')}` : ''}
  </div>`;
  if (mine.some((x) => !x.reply_seen) && !S.viewAs) { try { await q(sb.rpc('padel_suggestion_replies_seen')); } catch {} }
  const f = document.getElementById('sugForm');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button');
    busy(btn, true);
    try {
      await q(sb.rpc('padel_send_suggestion', { p_text: f.text.value, p_source: 'profil', p_group: S.groupId }));
      toast('Tak for dit forslag! 💡');
      viewSuggest();
    } catch { busy(btn, false); }
  };
}

// Antal nye svar til mig (til mærket ved "Forslagskasse" på profilen)
export async function unseenReplies() {
  try { return (await q(sb.from('padel_suggestions').select('id').eq('player_id', S.me.id).eq('reply_seen', false))).length; } catch { return 0; }
}

// Popup én gang, når spilleren har spillet et vist antal kampe
export async function maybeAskFeedback() {
  let ask = false;
  try { ask = await q(sb.rpc('padel_should_ask_feedback')); } catch { return; }
  if (!ask || document.getElementById('fbModal')) return;
  const n = S.settings.feedback_after_matches || 5;
  const wrap = document.createElement('div');
  wrap.id = 'fbModal';
  wrap.className = 'modal';
  wrap.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="fbTitle">
    <div class="fgicon">💡</div>
    <h2 id="fbTitle">Hvad synes du om appen?</h2>
    <p class="muted">Du har spillet ${n} kampe eller flere. Har du en idé, eller er der noget, der driller? Skriv det her. Kun den, der står for appen, kan læse det.</p>
    <form id="fbForm">
      <textarea name="text" rows="4" maxlength="2000" placeholder="Fx: Det ville være fedt, hvis …"></textarea>
      <div class="mact"><button type="button" class="btn ghost" id="fbLater">Ikke nu</button><button class="btn primary">Send</button></div>
    </form></div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  const f = wrap.querySelector('#fbForm');
  wrap.querySelector('#fbLater').onclick = async () => { close(); try { await q(sb.rpc('padel_feedback_asked')); } catch {} toast('Du kan altid skrive under Profil → Forslagskasse'); };
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (!f.text.value.trim()) return toast('Skriv dit forslag, eller tryk Ikke nu', true);
    const btn = f.querySelector('button.primary');
    busy(btn, true);
    try { await q(sb.rpc('padel_send_suggestion', { p_text: f.text.value, p_source: 'popup', p_group: S.groupId })); close(); toast('Tak for dit forslag! 💡'); } catch { busy(btn, false); }
  };
}

// ---------- Superadmin: læs og svar ----------
export async function loadSuggestions() {
  S.suggestions = await q(sb.from('padel_suggestions').select('*').order('created_at', { ascending: false }));
}

export function suggestTab() {
  const all = S.suggestions || [];
  S.sugTab ||= 'nye';
  const shown = S.sugTab === 'nye' ? all.filter((x) => x.status === 'ny') : all;
  return `
    <div class="card"><form id="fbAfter" class="frow">
      <label class="grow">Spørg efter antal spillede kampe <small class="muted">(0 = aldrig)</small><input type="number" name="n" min="0" max="500" value="${S.settings.feedback_after_matches ?? 5}"></label>
      <button class="btn sm">Gem</button></form></div>
    <div class="tabbar inner"><button class="tab ${S.sugTab === 'nye' ? 'on' : ''}" data-stab="nye">Nye (${all.filter((x) => x.status === 'ny').length})</button><button class="tab ${S.sugTab === 'alle' ? 'on' : ''}" data-stab="alle">Alle (${all.length})</button></div>
    ${shown.map((x) => `
      <form class="card sug sadm" data-sug="${x.id}">
        <div class="ftop"><b>${esc(nameOf(x.player_id))}</b><small class="muted">${date(x.created_at)}${x.group_id ? ` · ${esc(group(x.group_id)?.name || '')}` : ''}${x.source === 'popup' ? ' · popup' : ''}</small></div>
        <p class="stext">${esc(x.text)}</p>
        <label>Status<select name="status">${Object.entries(SSTATUS).map(([k, v]) => `<option value="${k}" ${x.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>Svar til spilleren <small class="muted">(vises i appen)</small><textarea name="reply" rows="2" maxlength="2000">${esc(x.reply || '')}</textarea></label>
        <div class="mact"><button class="btn sm primary">Gem</button></div>
      </form>`).join('') || `<p class="muted">${S.sugTab === 'nye' ? 'Ingen nye forslag.' : 'Ingen forslag endnu.'}</p>`}`;
}

export function bindSuggestTab(refresh) {
  app.querySelectorAll('[data-stab]').forEach((b) => (b.onclick = () => { S.sugTab = b.dataset.stab; refresh(); }));
  const fa = document.getElementById('fbAfter');
  if (fa) fa.onsubmit = async (e) => {
    e.preventDefault();
    const btn = fa.querySelector('button'); busy(btn, true);
    try { await q(sb.rpc('padel_set_feedback_after', { p_n: +fa.n.value })); S.settings.feedback_after_matches = +fa.n.value; toast('Gemt'); } finally { busy(btn, false); }
  };
  app.querySelectorAll('form[data-sug]').forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button'); busy(btn, true);
    try { await q(sb.rpc('padel_answer_suggestion', { p_id: f.dataset.sug, p_status: f.status.value, p_reply: f.reply.value })); toast('Gemt'); await refresh(); } catch { busy(btn, false); }
  }));
}
