// Admin → Nyhedsbrev: skriv et flot nyhedsbrev til gruppen eller klubben, se det som mail, send en test til dig selv, og send til alle.
// Kræver rettigheden "nyhedsbrev" (admin har den altid). Mailen laves af edge function padel-newsletter i samme design som forhåndsvisningen.
import { sb, S, app, esc, toast, q, busy, group, fmtDate, nameOf, haptic } from '../core.js';

const MAX = 12;
const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#5b3ee6');
const ink = (c) => { const n = parseInt(c.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#14112b' : '#ffffff'; };
const para = (t, color) => String(t || '').trim().split(/\n\s*\n/).filter(Boolean)
  .map((p) => `<p>${esc(p).replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, `<a href="$1" style="color:${color}">$1</a>`)}</p>`).join('');
const okUrl = (u) => /^https?:\/\/[^\s"'<>]+$/i.test((u || '').trim());

// Forhåndsvisning: samme opbygning som mailen
function preview(d) {
  const color = hex(group()?.brand_color), on = ink(color);
  const date = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  return `<div class="nlmail" style="--c:${color};--on:${on}">
    <div class="nlhead"><div class="nlrow"><span>${esc(group()?.name || '')}</span><img src="/icon-192.png" alt=""></div>
      <h1>${esc(d.title || 'Overskrift på nyhedsbrevet')}</h1><small>Nyhedsbrev · ${date}</small></div>
    ${d.intro ? `<div class="nlintro">${para(d.intro, color)}</div>` : ''}
    ${(d.sections || []).map((s) => `<div class="nlsec">${s.heading ? `<h2><i></i>${esc(s.heading)}</h2>` : ''}${para(s.text, color)}
      ${s.button_text && okUrl(s.button_url) ? `<span class="nlbtn">${esc(s.button_text)} →</span>` : ''}</div>`).join('')}
    <div class="nlsec"><span class="nlbtn">Åbn Padelklubben →</span></div>
    <div class="nlfoot">Skrevet af ${esc(S.me?.name || '')} · ${esc(group()?.name || '')} via Padelklubben.<br>Vil du ikke have nyhedsbreve? Afmeld her.</div>
  </div>`;
}

const blank = () => ({ id: null, title: '', intro: '', sections: [{ heading: '', text: '', button_text: '', button_url: '' }] });

export async function loadNewsletters() {
  try { S.nlList = await q(sb.rpc('padel_newsletter_list_v2', { g: S.groupId })); } catch { S.nlList = []; }
  try { S.nlCount = await q(sb.rpc('padel_newsletter_count_v2', { g: S.groupId })); } catch { S.nlCount = null; }
  S.nlFor = S.groupId;
}

export function newsletterTab() {
  const d = S.nlDraft;
  if (d) return editor(d);
  const list = S.nlList || [];
  return `<div class="card nlintro-card"><p>Skriv et nyhedsbrev til alle i <b>${esc(group()?.name || '')}</b>. Det kommer på mail i et flot design med ${group()?.brand_color ? 'jeres farve' : 'appens farver'}, og alle kan afmelde sig.</p>
      <p class="muted small">${S.nlCount != null ? `Det sendes til <b>${S.nlCount}</b> ${S.nlCount === 1 ? 'person' : 'personer'} med mail.` : ''} Børn med eget login får det ikke.</p>
      <button class="btn primary" id="nlNew">✏️ Skriv et nyt nyhedsbrev</button></div>
    ${list.length ? `<h3>Nyhedsbreve</h3><div class="list">${list.map((n) => `<button class="row nlrow-item" data-nlopen="${n.id}"><span class="grow"><b>${esc(n.title || 'Uden overskrift')}</b>
      <small>${n.status === 'sendt' ? `✅ Sendt ${fmtDate(n.sent_at, { day: 'numeric', month: 'short' })} til ${n.recipients} · af ${esc(nameOf(n.sent_by))}` : `📝 Kladde · ${fmtDate(n.updated_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}</small></span><span class="muted">›</span></button>`).join('')}</div>` : ''}`;
}

function editor(d) {
  const sent = d.status === 'sendt';
  const sec = (s, i) => `<div class="card nlsecedit" data-sec="${i}">
      <div class="ftop"><b>Afsnit ${i + 1}</b>${sent ? '' : `<span>${i ? `<button type="button" class="link sm" data-up="${i}" aria-label="Flyt op">↑</button>` : ''}<button type="button" class="link sm dn" data-del="${i}">Fjern</button></span>`}</div>
      <label>Overskrift<input name="heading" maxlength="120" value="${esc(s.heading || '')}" ${sent ? 'disabled' : ''} placeholder="Fx Klubmesterskab 2026"></label>
      <label>Tekst<textarea name="text" rows="5" maxlength="4000" ${sent ? 'disabled' : ''} placeholder="Skriv løs. En tom linje giver et nyt afsnit, og links bliver klikbare.">${esc(s.text || '')}</textarea></label>
      <div class="frow"><label class="grow">Knap <small class="muted">(valgfri)</small><input name="button_text" maxlength="40" value="${esc(s.button_text || '')}" ${sent ? 'disabled' : ''} placeholder="Fx Tilmeld dig"></label>
        <label class="grow">Link<input name="button_url" type="url" maxlength="500" value="${esc(s.button_url || '')}" ${sent ? 'disabled' : ''} placeholder="https://"></label></div>
    </div>`;
  return `<div class="nlwrap">
    <div class="nledit">
      <button class="back" id="nlBack">‹ Alle nyhedsbreve</button>
      ${sent ? `<div class="card okbox">✅ Sendt ${fmtDate(d.sent_at, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} til ${d.recipients} personer.</div>` : ''}
      <form id="nlForm">
        <div class="card"><label>Overskrift <small class="muted">(bliver også emnet på mailen)</small><input name="title" maxlength="150" required value="${esc(d.title || '')}" ${sent ? 'disabled' : ''} placeholder="Fx Nyt fra klubben i november"></label>
          <label>Indledning<textarea name="intro" rows="3" maxlength="3000" ${sent ? 'disabled' : ''} placeholder="Et par ord til at starte med">${esc(d.intro || '')}</textarea></label></div>
        ${(d.sections || []).map(sec).join('')}
        ${sent || (d.sections || []).length >= MAX ? '' : '<button type="button" class="btn ghost" id="nlAdd">＋ Tilføj afsnit</button>'}
      </form>
      ${sent ? '<button class="btn" id="nlCopy">📄 Brug som skabelon til et nyt</button>' : `<div class="nlactions">
        <button class="btn" id="nlSave">💾 Gem kladde</button>
        <button class="btn" id="nlTest">🧪 Test til mig</button></div>
        <button class="btn primary nlsend" id="nlSend">📨 Send til ${S.nlCount ?? 'alle'}</button>`}
    </div>
    <div class="nlprev"><div class="lbl">Sådan ser mailen ud</div><div id="nlPreview">${preview(d)}</div></div>
  </div>`;
}

function readForm() {
  const f = document.getElementById('nlForm');
  if (!f) return S.nlDraft;
  const d = S.nlDraft;
  d.title = f.title.value; d.intro = f.intro.value;
  d.sections = [...f.querySelectorAll('[data-sec]')].map((el) => ({ heading: el.querySelector('[name=heading]').value, text: el.querySelector('[name=text]').value,
    button_text: el.querySelector('[name=button_text]').value, button_url: el.querySelector('[name=button_url]').value.trim() }));
  return d;
}
const clean = (d) => d.sections.filter((s) => s.heading.trim() || s.text.trim() || s.button_text.trim());

async function save() {
  const d = readForm();
  const id = await q(sb.rpc('padel_newsletter_save_v2', { p_id: d.id, g: S.groupId, p_title: d.title.trim(), p_intro: d.intro.trim() || null, p_sections: clean(d) }));
  d.id = id;
  return id;
}

export function bindNewsletter(refresh) {
  document.getElementById('nlNew')?.addEventListener('click', () => { S.nlDraft = blank(); refresh(); });
  app.querySelectorAll('[data-nlopen]').forEach((b) => (b.onclick = () => {
    const n = (S.nlList || []).find((x) => x.id === b.dataset.nlopen);
    S.nlDraft = { ...n, sections: n.sections?.length ? n.sections : blank().sections };
    refresh();
  }));
  if (!S.nlDraft) return;
  document.getElementById('nlBack').onclick = async () => { S.nlDraft = null; await loadNewsletters(); refresh(); };
  const f = document.getElementById('nlForm');
  // Forhåndsvisningen følger med, mens man skriver
  f.oninput = () => { document.getElementById('nlPreview').innerHTML = preview(readForm()); };
  document.getElementById('nlAdd')?.addEventListener('click', () => { readForm().sections.push({ heading: '', text: '', button_text: '', button_url: '' }); refresh(); });
  app.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => { const d = readForm(); d.sections.splice(+b.dataset.del, 1); if (!d.sections.length) d.sections = blank().sections; refresh(); }));
  app.querySelectorAll('[data-up]').forEach((b) => (b.onclick = () => { const d = readForm(), i = +b.dataset.up; [d.sections[i - 1], d.sections[i]] = [d.sections[i], d.sections[i - 1]]; refresh(); }));
  document.getElementById('nlCopy')?.addEventListener('click', () => { const d = S.nlDraft; S.nlDraft = { ...blank(), title: d.title, intro: d.intro, sections: d.sections.map((s) => ({ ...s })) }; refresh(); });
  const need = () => { if (!f.title.value.trim()) { toast('Giv nyhedsbrevet en overskrift', true); f.title.focus(); return false; } return true; };
  document.getElementById('nlSave')?.addEventListener('click', async (e) => {
    if (!need()) return;
    busy(e.currentTarget, true);
    try { await save(); toast('Kladden er gemt'); } catch {} busy(e.currentTarget, false);
  });
  document.getElementById('nlTest')?.addEventListener('click', async (e) => {
    if (!need()) return;
    busy(e.currentTarget, true);
    try { await save(); await q(sb.rpc('padel_newsletter_send_v2', { p_id: S.nlDraft.id, p_test: true })); toast('Testen er sendt til din mail. Den kommer om lidt'); } catch {}
    busy(e.currentTarget, false);
  });
  document.getElementById('nlSend')?.addEventListener('click', async (e) => {
    if (!need()) return;
    if (!confirm(`Send "${f.title.value.trim()}" til ${S.nlCount ?? 'alle'} i ${group()?.name}?\n\nDet kan ikke trækkes tilbage.`)) return;
    busy(e.currentTarget, true);
    try {
      await save();
      const n = await q(sb.rpc('padel_newsletter_send_v2', { p_id: S.nlDraft.id, p_test: false }));
      haptic('success'); toast(`Nyhedsbrevet er sendt til ${n} ${n === 1 ? 'person' : 'personer'} 📨`);
      S.nlDraft = null; await loadNewsletters(); refresh();
    } catch { busy(e.currentTarget, false); }
  });
}
