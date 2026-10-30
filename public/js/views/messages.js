// Beskeder: skriv til trænerne, bestyrelsen, kassereren eller admin, og svar i samtaler.
// Børn er aldrig alene i en samtale med en voksen: forældrene er altid med (det sikres i databasen).
import { sb, S, app, hooks, esc, toast, q, busy, fmtDate, group, isClub, canRun, isAdmin } from '../core.js';
import { hasAnyRight, hasAdults } from './club.js';
import { loadUnread } from './notify.js';

const ROLE = { traenere: 'Trænerne', bestyrelse: 'Bestyrelsen', kasserer: 'Kassereren', admin: 'Admin' };
const roleLabel = (r, club) => (r === 'admin' && !club ? 'Gruppens admin' : r === 'admin' ? 'Klubbens admin' : ROLE[r]);
const when = (d) => fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
// Billeder: gøres mindre på telefonen før upload og ligger privat, så kun dem i samtalen kan se dem
async function shrink(file) {
  const img = await createImageBitmap(file).catch(() => null);
  // Kan browseren ikke læse billedet, sendes det, som det er (hvis det er et almindeligt format)
  if (!img) { if (/^image\/(jpeg|png|webp)$/.test(file.type) && file.size < 5e6) return file; throw new Error('Billedet kunne ikke læses'); }
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.82));
}
async function uploadImage(file) {
  const blob = await shrink(file);
  const type = blob.type || 'image/jpeg';
  const path = `${S.realMe.id}/${crypto.randomUUID()}.${type.split('/')[1].replace('jpeg', 'jpg')}`;
  const { error } = await sb.storage.from('padel-msg').upload(path, blob, { contentType: type, upsert: false });
  if (error) throw error;
  return path;
}
const picker = () => `<div class="imgpick"><label class="btn sm ghost">📷 Billede<input type="file" name="img" accept="image/*" hidden></label><span class="imgprev" hidden><img alt=""><button type="button" class="imgx" aria-label="Fjern billedet">✕</button></span></div>`;
function bindPicker(f) {
  const inp = f.img, prev = f.querySelector('.imgprev');
  inp.onchange = () => {
    const file = inp.files[0];
    prev.hidden = !file;
    if (file) prev.querySelector('img').src = URL.createObjectURL(file);
  };
  prev.querySelector('.imgx').onclick = () => { inp.value = ''; prev.hidden = true; };
}
// Send: upload billedet først (hvis der er et), og tjek at der er tekst eller billede
async function withImage(f, btn, send) {
  const file = f.img.files[0];
  if (!f.body.value.trim() && !file) { toast('Skriv en besked eller vælg et billede', true); return; }
  busy(btn, true);
  let image = null;
  try { if (file) image = await uploadImage(file); }
  catch (e) { busy(btn, false); toast(e?.message === 'Billedet kunne ikke læses' ? e.message : 'Billedet kunne ikke sendes. Prøv igen.', true); return; }
  try { await send(image); } catch { busy(btn, false); }
}
function showImages(root) {
  const imgs = [...root.querySelectorAll('img.msgimg[data-path]')];
  if (!imgs.length) return;
  sb.storage.from('padel-msg').createSignedUrls(imgs.map((i) => i.dataset.path), 3600).then(({ data }) => {
    imgs.forEach((i) => { const u = data?.find((d) => d.path === i.dataset.path)?.signedUrl; if (u) i.src = u; else i.alt = 'Billedet kunne ikke hentes'; });
  });
  imgs.forEach((i) => (i.onclick = () => {
    if (!i.src) return;
    const v = document.createElement('div');
    v.className = 'imgview';
    v.innerHTML = `<img src="${i.src}" alt=""><button type="button" class="imgx" aria-label="Luk">✕</button>`;
    v.onclick = () => v.remove();
    document.body.append(v);
  }));
}

const back = (to) => `<button class="back" onclick="history.length > 1 ? history.back() : (location.hash = '${to}')">‹ Tilbage</button>`;

export const msgLabel = () => (isClub() ? 'Skriv til klubben' : 'Skriv til admin');
// I Profil: trænere og bestyrelse modtager også beskeder, så for dem hedder det Beskeder fra medlemmer
export const msgRowLabel = () => ((isClub() ? canRun() || hasAnyRight() : isAdmin()) ? 'Samtaler med medlemmer' : msgLabel());

// Antal ulæste samtaler (til mærke i Profil)
export async function unreadThreads() {
  if (S.viewAs) return 0;
  try { return (await q(sb.rpc('padel_thread_list'))).filter((t) => t.unread).length; } catch { return 0; }
}

export async function viewThreads() {
  if (S.viewAs) {
    app.innerHTML = `<div class="page">${back('#/profil')}<h1>💬 Beskeder</h1><div class="card warnbox">Samtaler kan kun ses af dem, der er med i dem, så de vises ikke, når du ser appen som en anden.</div></div>`;
    return;
  }
  const list = await q(sb.rpc('padel_thread_list'));
  const many = new Set(list.map((t) => t.group_id)).size > 1;
  const open = list.filter((t) => t.status === 'aaben'), done = list.filter((t) => t.status !== 'aaben');
  const row = (t) => {
    const g = S.groups.find((x) => x.id === t.group_id);
    const club = g?.kind === 'klub';
    const who = t.from_staff && !t.staff ? `Fra ${esc(t.creator)}` : t.staff && t.created_by !== S.realMe.id ? `Fra ${esc(t.creator)}` : `Til ${esc(roleLabel(t.to_role, club).toLowerCase())}`;
    return `<a class="row throw ${t.unread ? 'unread' : ''}" href="#/samtale/${t.id}">
      <div class="grow"><b>${esc(t.subject)}</b>
        <small class="muted">${who}${t.kid ? ` · om ${esc(t.kid.split(' ')[0])}` : ''}${many ? ` · ${esc(g?.name || '')}` : ''}</small>
        ${t.last ? `<small class="thlast">${t.last.mine ? 'Dig' : esc(t.last.author?.split(' ')[0] || '')}: ${esc(t.last.body)}</small>` : ''}</div>
      ${t.unread ? `<span class="badge new">${t.unread}</span>` : t.status !== 'aaben' ? '<span class="tag">✓ Løst</span>' : '<span class="muted">›</span>'}</a>`;
  };
  app.innerHTML = `
  <div class="page threads">
    ${back('#/profil')}
    <h1>💬 Beskeder</h1>
    ${S.groupId ? `<a class="btn primary block" href="#/ny-besked" id="newMsg">✉️ ${msgLabel()}</a>` : ''}
    ${list.length ? '' : `<p class="muted">${isClub() ? 'Her kan du skrive til trænerne, bestyrelsen eller kassereren. Svarene kommer her, og du får en notifikation.' : 'Her kan du skrive til gruppens admin. Svaret kommer her, og du får en notifikation.'}</p>`}
    ${open.length ? `<div class="list">${open.map(row).join('')}</div>` : ''}
    ${done.length ? `<details class="card donebox"><summary><b>Løste samtaler (${done.length})</b><span class="muted">›</span></summary><div class="list">${done.map(row).join('')}</div></details>` : ''}
  </div>`;
}

export async function viewCompose() {
  const g = S.groupId;
  if (!g || S.viewAs) { location.hash = '#/samtaler'; return; }
  const o = await q(sb.rpc('padel_thread_options', { g }));
  const club = o.club;
  const roles = club ? ['traenere', ...(o.has_board ? ['bestyrelse'] : []), ...(o.has_treasurer ? ['kasserer'] : []), 'admin'] : ['admin'];
  const staffKids = o.staff_kids || [];
  const myKids = o.my_kids || [];
  const pre = new URLSearchParams(location.hash.split('?')[1] || '');
  const preRole = roles.includes(pre.get('til')) ? pre.get('til') : roles[0];
  const preKid = pre.get('barn');
  const toParents = !!(preKid && staffKids.some((k) => k.id === preKid));
  // Voksent medlem (man er sit eget "barn"): ingen forældre læser med
  const ownAdult = o.own_kid ? !!(await q(sb.from('padel_club_kids').select('adult').eq('id', o.own_kid).maybeSingle()).catch(() => null))?.adult : false;

  app.innerHTML = `
  <div class="page compose">
    ${back('#/samtaler')}
    <h1>✉️ ${msgLabel()}</h1>
    <form class="card" id="cmp">
      ${staffKids.length ? `<div class="seg two" role="radiogroup">
          <label><input type="radio" name="mode" value="klub" ${toParents ? '' : 'checked'}><span>${club ? 'Til klubben' : 'Til admin'}</span></label>
          <label><input type="radio" name="mode" value="foraeldre" ${toParents ? 'checked' : ''}><span>${hasAdults(g) ? 'Til et medlem' : 'Til forældre'}</span></label></div>` : '<input type="hidden" name="mode" value="klub">'}
      <div id="toKlub">
        ${roles.length > 1 ? `<div class="lbl">Til</div><div class="seg wrap">${roles.map((r) => `<label><input type="radio" name="role" value="${r}" ${r === preRole ? 'checked' : ''}><span>${esc(roleLabel(r, club))}</span></label>`).join('')}</div>`
          : `<input type="hidden" name="role" value="${roles[0]}"><p class="muted small">Beskeden går til ${club ? 'klubbens' : 'gruppens'} admin.</p>`}
        ${o.own_kid && ownAdult ? '' : o.own_kid ? '<p class="muted small">👪 Dine forældre kan også læse samtalen.</p>'
          : myKids.length ? `<label>Drejer det sig om et barn?<select name="kid"><option value="">Nej, ikke et bestemt barn</option>${myKids.map((k) => `<option value="${k.id}" ${k.id === preKid || (myKids.length === 1 && !preKid) ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select>
            <small class="muted">Barnets andre forælder og barnet selv (hvis det har eget login) kan også læse med.</small></label>` : ''}
      </div>
      ${staffKids.length ? `<div id="toParents">
        <label>${hasAdults(g) ? 'Hvem?' : 'Hvilket barn?'}<select name="skid">${staffKids.map((k) => `<option value="${k.id}" data-role="${k.role}" ${k.id === preKid ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select>
          <small class="muted">Beskeden går til barnets forældre. Har barnet eget login, kan barnet også læse med, men aldrig uden forældrene.${hasAdults(g) ? ' Er det en voksen spiller, går beskeden til spilleren selv.' : ''}</small></label></div>` : ''}
      <label>Emne<input name="subject" maxlength="100" placeholder="Fx Afbud resten af måneden"></label>
      <label>Besked<textarea name="body" rows="5" maxlength="4000"></textarea></label>
      ${picker()}
      <button class="btn primary">Send</button>
    </form>
  </div>`;
  const f = document.getElementById('cmp');
  const sync = () => {
    const p = f.mode.value === 'foraeldre';
    document.getElementById('toKlub').hidden = p;
    const tp = document.getElementById('toParents'); if (tp) tp.hidden = !p;
  };
  f.querySelectorAll('input[name=mode]').forEach((r) => (r.onchange = sync));
  sync();
  bindPicker(f);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button.primary');
    const p = f.mode.value === 'foraeldre';
    const opt = p ? f.skid.selectedOptions[0] : null;
    await withImage(f, btn, async (image) => {
      const id = await q(sb.rpc('padel_thread_start_v2', { g, p_role: p ? opt.dataset.role : f.role.value, p_kid: p ? opt.value : (f.kid?.value || null),
        p_subject: f.subject.value, p_body: f.body.value, p_image: image }));
      toast('Beskeden er sendt');
      location.replace('#/samtale/' + id);
    });
  };
}

export async function viewThread(id) {
  if (S.viewAs) { location.hash = '#/samtaler'; return; }
  let t;
  try { t = await q(sb.rpc('padel_thread_get', { t: id })); } catch { app.innerHTML = `<div class="page">${back('#/samtaler')}<p class="muted">Samtalen findes ikke, eller du har ikke adgang til den.</p></div>`; return; }
  const club = S.groups.find((x) => x.id === t.group_id)?.kind === 'klub';
  const gname = group(t.group_id)?.name || S.groups.find((x) => x.id === t.group_id)?.name || '';
  app.innerHTML = `
  <div class="page thread">
    ${back('#/samtaler')}
    <h1>${esc(t.subject)}</h1>
    <p class="muted small thmeta">${t.from_staff ? `Fra ${esc(t.creator)} til forældrene` : `Til ${esc(roleLabel(t.to_role, club).toLowerCase())}`}${t.kid ? ` · om ${esc(t.kid)}` : ''} · ${esc(gname)}</p>
    <details class="thpeople"><summary class="muted small">👥 Med i samtalen (${(t.people || []).length})</summary><p class="small">${(t.people || []).map(esc).join(', ')}</p></details>
    <div class="msgs">${(t.msgs || []).map((m) => `<div class="msg ${m.mine ? 'mine' : ''}"><small>${m.mine ? 'Dig' : esc(m.author || 'Tidligere bruger')} · ${when(m.at)}</small>${m.image ? `<img class="msgimg" data-path="${esc(m.image)}" alt="Billede">` : ''}${m.body ? `<p>${esc(m.body).replace(/\n/g, '<br>')}</p>` : ''}</div>`).join('')}</div>
    <form class="card replybox" id="rep"><textarea name="body" rows="3" maxlength="4000" placeholder="Skriv et svar"></textarea>
      ${picker()}<div class="mact">${t.status === 'aaben' ? (t.staff ? '<button type="button" class="btn sm ghost" id="solve">✓ Løst</button>' : '') : '<button type="button" class="btn sm ghost" id="reopen">↺ Genåbn</button>'}<button class="btn sm primary">Svar</button></div></form>
    ${t.status !== 'aaben' ? '<p class="muted small center">✓ Samtalen er markeret som løst. Skriver nogen igen, åbner den igen.</p>' : ''}
  </div>`;
  app.querySelector('.msgs .msg:last-child')?.scrollIntoView({ block: 'nearest' });
  showImages(app);
  const f = document.getElementById('rep');
  bindPicker(f);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button.primary');
    await withImage(f, btn, async (image) => { await q(sb.rpc('padel_thread_reply_v2', { t: id, p_body: f.body.value, p_image: image })); viewThread(id); });
  };
  const st = async (s) => { try { await q(sb.rpc('padel_thread_status', { t: id, p_status: s })); toast(s === 'loest' ? 'Markeret som løst' : 'Samtalen er åbnet igen'); viewThread(id); } catch {} };
  document.getElementById('solve')?.addEventListener('click', () => st('loest'));
  document.getElementById('reopen')?.addEventListener('click', () => st('aaben'));
  await loadUnread(); hooks.renderNav?.();
}
