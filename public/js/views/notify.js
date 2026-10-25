// Beskeder i appen (fx plads fra ventelisten) og notifikationer på telefonen.
import { sb, S, app, hooks, esc, toast, q, busy, fmtDate } from '../core.js';
import { pushSupported, pushOn, enablePush, disablePush, isIOS, standalone } from '../push.js';

export async function loadUnread() {
  try { S.unread = (await q(sb.from('padel_notifications').select('id').eq('user_id', S.realMe.id).is('read_at', null).limit(99))).length; } catch { S.unread = 0; }
}

async function pushCard() {
  const on = await pushOn();
  const iosHint = isIOS() && !standalone();
  if (!pushSupported() && !iosHint) return '<div class="card"><p class="muted small">Din browser kan ikke vise notifikationer. Beskederne står stadig her i appen.</p></div>';
  return `<div class="card pushcard">
    <label class="switch"><input type="checkbox" id="pushToggle" ${on ? 'checked' : ''} ${iosHint ? 'disabled' : ''}><span>🔔 Notifikationer på denne enhed</span></label>
    <p class="muted small">${iosHint ? 'På iPhone skal appen være lagt på hjemmeskærmen, før den kan sende notifikationer. Tryk Del → Føj til hjemmeskærm, og åbn appen derfra.'
      : on ? 'Slået til. Du får besked, fx når du får en plads fra ventelisten.' : 'Slå til for at få besked på telefonen eller computeren, fx når du får en plads fra ventelisten.'}</p></div>`;
}

export async function viewNotices() {
  const list = await q(sb.from('padel_notifications').select('*').eq('user_id', S.realMe.id).order('created_at', { ascending: false }).limit(50));
  app.innerHTML = `
  <div class="page notices-page">
    <button class="back" onclick="history.length > 1 ? history.back() : (location.hash = '#/fredage')">‹ Tilbage</button>
    <h1>🔔 Beskeder</h1>
    ${S.viewAs ? '<div class="card warnbox">Du ser dine egne beskeder (ikke spillerens).</div>' : ''}
    ${await pushCard()}
    ${list.length ? `<div class="list">${list.map((n) => `
      <a class="row nrow ${n.read_at ? '' : 'unread'}" href="${esc(n.url || '#/fredage')}">
        <div class="grow"><b>${esc(n.title)}</b>${n.body ? `<small>${esc(n.body)}</small>` : ''}<small class="muted">${fmtDate(n.created_at, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></div>
      </a>`).join('')}</div>` : '<p class="muted">Ingen beskeder endnu.</p>'}
  </div>`;
  bindPushToggle(viewNotices);
  if (list.some((n) => !n.read_at)) { try { await q(sb.rpc('padel_notifications_read')); } catch {} S.unread = 0; hooks.renderNav?.(); }
}

function bindPushToggle(rerender) {
  const t = document.getElementById('pushToggle');
  if (!t) return;
  t.onchange = async () => {
    t.disabled = true;
    try {
      if (t.checked) { await enablePush(); toast('Notifikationer er slået til 🔔'); } else { await disablePush(); toast('Notifikationer er slået fra'); }
    } catch (e) { t.checked = !t.checked; toast(e.message || 'Det lykkedes ikke', true); }
    t.disabled = false;
    rerender?.();
  };
}

// Lille kort på Spilledage: tilbyd at slå notifikationer til (én gang pr. telefon)
export function pushPromptCard() {
  if (S.viewAs || !pushSupported() || Notification.permission !== 'default') return '';
  try { if (localStorage.getItem('fp-push-ask') === 'nej') return ''; } catch {}
  return `<div class="card pushask"><p>🔔 Vil du have besked på telefonen, fx når du får en plads fra ventelisten?</p>
    <div class="mact"><button class="btn sm ghost" id="pushNo">Ikke nu</button><button class="btn sm primary" id="pushYes">Slå til</button></div></div>`;
}
export function bindPushPrompt() {
  const card = app.querySelector('.pushask');
  if (!card) return;
  document.getElementById('pushNo').onclick = () => { try { localStorage.setItem('fp-push-ask', 'nej'); } catch {} card.remove(); };
  document.getElementById('pushYes').onclick = async (e) => {
    busy(e.currentTarget, true);
    try { await enablePush(); toast('Notifikationer er slået til 🔔'); card.remove(); } catch (err) { toast(err.message || 'Det lykkedes ikke', true); busy(e.currentTarget, false); }
  };
}
