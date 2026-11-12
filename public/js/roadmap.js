// "Nyt og på vej" (Profil): ✅ Bygget (nyhederne), 🔨 I gang og 💡 På tegnebrættet.
// Listen ligger i databasen (padel_roadmap_v2). Alle kan give 👍; superadmin retter, flytter og tilføjer punkter.
import { sb, S, esc, toast, q, busy, isSuper, haptic } from './core.js';
import { forMe, entry, markNewsSeen } from './news.js';

export const RM_STATUS = { igang: '🔨 I gang', plan: '💡 På tegnebrættet', bygget: '✅ Bygget' };
const AUD = { alle: 'Alle', admin: 'Kun admins og trænere', klub: 'Kun klubber', gruppe: 'Kun spillegrupper' };
const NEXT = { plan: 'igang', igang: 'bygget' };

async function load() {
  try { S.roadmap = await q(sb.rpc('padel_roadmap_list_v2')); } catch { S.roadmap = []; }
}

const itemForm = (r = {}) => `<form class="rmform" data-rmform="${r.id || ''}">
  <label>Titel<input name="title" maxlength="120" required value="${esc(r.title || '')}"></label>
  <label>Beskrivelse <small class="muted">(valgfri)</small><textarea name="body" rows="2" maxlength="1000">${esc(r.body || '')}</textarea></label>
  <div class="frow"><label class="grow">Status<select name="status">${Object.entries(RM_STATUS).map(([k, v]) => `<option value="${k}" ${(r.status || S.rmTab || 'plan') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="grow">Hvem ser det<select name="aud">${Object.entries(AUD).map(([k, v]) => `<option value="${k}" ${(r.audience || 'alle') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
  <div class="frow"><label class="switch grow"><input type="checkbox" name="hidden" ${r.hidden ? 'checked' : ''}><span>🔒 Kun for mig (hemmeligt)</span></label>
    <label style="max-width:110px">Rækkefølge<input name="sort" type="number" value="${r.sort ?? 100}"></label></div>
  <div class="mact"><button class="btn sm primary">${r.id ? 'Gem' : 'Tilføj'}</button></div></form>`;

function card(r) {
  const canVote = r.status !== 'bygget' && !S.viewAs;
  return `<div class="card rmitem ${r.hidden ? 'secret' : ''}" data-rm="${r.id}">
    <div class="rmhead"><b>${esc(r.title)}</b>${r.hidden ? '<span class="badge">🔒 Kun dig</span>' : ''}${r.audience !== 'alle' ? `<span class="badge">${AUD[r.audience]}</span>` : ''}</div>
    ${r.body ? `<p class="muted small">${esc(r.body)}</p>` : ''}
    ${canVote ? `<div class="rmact"><button class="btn sm ${r.my_vote ? 'primary' : 'ghost'} rmvote" data-vote="${r.id}" aria-pressed="${r.my_vote}">👍${r.votes ? ` ${r.votes}` : ''}</button><small class="muted">${r.my_vote ? 'Du vil gerne have den' : 'Vil du gerne have den?'}</small></div>` : ''}
    ${isSuper() ? `<div class="rmadmin">${NEXT[r.status] ? `<button class="link sm" data-rmnext="${r.id}">${r.status === 'plan' ? '🔨 Sæt i gang' : '✅ Færdig'}</button>` : ''}<button class="link sm" data-rmedit="${r.id}">✏️ Ret</button></div>` : ''}
    ${isSuper() && S.rmEdit === r.id ? itemForm(r) : ''}
  </div>`;
}

export async function viewRoadmap(app) {
  if (!S.roadmap || S.rmReload) { await load(); S.rmReload = false; }
  S.rmTab ||= 'bygget';
  const list = (S.roadmap || []).filter((r) => r.status === S.rmTab);
  const n = (st) => (S.roadmap || []).filter((r) => r.status === st).length;
  const tabs = [['bygget', '✅ Bygget'], ['igang', `🔨 I gang${n('igang') ? ` (${n('igang')})` : ''}`], ['plan', `💡 På vej${n('plan') ? ` (${n('plan')})` : ''}`]];
  const body = S.rmTab === 'bygget'
    ? `${isSuper() && list.length ? `<details class="card"><summary class="muted small">Færdige punkter fra listen (${list.length})</summary>${list.map(card).join('')}</details>` : ''}
       ${forMe().map((x) => `<div class="card">${entry(x)}</div>`).join('') || '<p class="muted">Ingen nyheder endnu.</p>'}`
    : `<p class="muted small">${S.rmTab === 'igang' ? 'Det arbejder vi på lige nu.' : 'Idéer og ønsker til appen. Tryk 👍 ved det, du gerne vil have, så ved vi, hvad der er vigtigst. Har du selv en idé, så skriv i <a href="#/forslag">Forslagskassen</a>.'}</p>
       ${list.map(card).join('') || `<p class="muted">${S.rmTab === 'igang' ? 'Intet lige nu.' : 'Ingen punkter endnu.'}</p>`}`;
  app.innerHTML = `<div class="page roadmap">
    <button class="back" onclick="location.hash='#/profil'">‹ Profil</button>
    <h1>🆕 Nyt og på vej</h1>
    <div class="tabbar">${tabs.map(([k, t]) => `<button class="tab ${k === S.rmTab ? 'on' : ''}" data-rmtab="${k}">${t}</button>`).join('')}</div>
    ${isSuper() && S.rmTab !== 'bygget' ? `<details class="card rmnew" ${S.rmNew ? 'open' : ''}><summary><b>＋ Nyt punkt</b></summary>${itemForm()}</details>` : ''}
    ${body}
  </div>`;
  if (S.rmTab === 'bygget') markNewsSeen();
  const again = () => viewRoadmap(app);
  app.querySelectorAll('[data-rmtab]').forEach((b) => (b.onclick = () => { S.rmTab = b.dataset.rmtab; S.rmEdit = null; again(); }));
  app.querySelectorAll('[data-vote]').forEach((b) => (b.onclick = async () => {
    const r = S.roadmap.find((x) => x.id === b.dataset.vote), on = !r.my_vote;
    busy(b, true);
    try { r.votes = await q(sb.rpc('padel_roadmap_vote_v2', { p_item: r.id, p_on: on })); r.my_vote = on; haptic('light'); if (on) toast('Tak! Vi kan se, at du gerne vil have den 👍'); } catch {}
    again();
  }));
  app.querySelectorAll('[data-rmedit]').forEach((b) => (b.onclick = () => { S.rmEdit = S.rmEdit === b.dataset.rmedit ? null : b.dataset.rmedit; again(); }));
  app.querySelectorAll('[data-rmnext]').forEach((b) => (b.onclick = async () => {
    const r = S.roadmap.find((x) => x.id === b.dataset.rmnext);
    busy(b, true);
    try { await save(r.id, { ...r, status: NEXT[r.status] }); toast(`Flyttet til ${RM_STATUS[NEXT[r.status]]}`); } catch {}
    S.rmReload = true; again();
  }));
  const nd = app.querySelector('details.rmnew'); if (nd) nd.ontoggle = () => (S.rmNew = nd.open);
  app.querySelectorAll('form[data-rmform]').forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button.primary'); busy(btn, true);
    try {
      await save(f.dataset.rmform || null, { title: f.title.value, body: f.body.value, status: f.status.value, audience: f.aud.value, hidden: f.hidden.checked, sort: +f.sort.value || 100 });
      toast('Gemt'); S.rmEdit = null; S.rmNew = false; S.rmTab = f.status.value; S.rmReload = true; again();
    } catch { busy(btn, false); }
  }));
}

function save(id, r) {
  return q(sb.rpc('padel_roadmap_save_v2', { p_id: id, p_title: r.title, p_body: r.body || null, p_status: r.status, p_audience: r.audience || 'alle', p_hidden: !!r.hidden, p_sort: r.sort ?? 100, p_source: null }));
}

// Forslagskassen (superadmin): sæt et forslag på listen "På vej"
export async function suggestionToRoadmap(text) {
  const title = text.trim().split(/[.!?\n]/)[0].slice(0, 110) || 'Forslag';
  await q(sb.rpc('padel_roadmap_save_v2', { p_id: null, p_title: title, p_body: text.trim().slice(0, 1000), p_status: 'plan', p_audience: 'alle', p_hidden: true, p_sort: 100, p_source: 'forslag' }));
  S.rmReload = true;
}
