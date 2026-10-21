// "Se som": en admin kan se appen præcis som en bestemt spiller. Kun visning, intet gemmes i spillerens navn.
import { S, app, hooks, esc, nameOf, toast } from './core.js';

const KEY = 'fp-viewas';

export function readViewAs() {
  let id = null;
  try { id = sessionStorage.getItem(KEY); } catch {}
  // Superadmin, eller admin i en gruppe som spilleren er med i
  const allowed = id && S.profiles[id] && (S.realMe?.is_superadmin || S.members.some((m) => m.player_id === S.realMe?.id && m.role === 'admin' && m.status === 'aktiv' &&
    S.members.some((x) => x.group_id === m.group_id && x.player_id === id)));
  if (id && !allowed) { id = null; try { sessionStorage.removeItem(KEY); } catch {} }
  return id;
}

export function startViewAs(id) {
  try { sessionStorage.setItem(KEY, id); } catch {}
  toast(`Du ser nu appen som ${nameOf(id)}`);
  location.hash = '#/fredage';
  hooks.boot();
}

function stopViewAs() {
  try { sessionStorage.removeItem(KEY); } catch {}
  location.hash = '#/admin';
  hooks.boot();
}

export function renderViewAsBar() {
  let bar = document.getElementById('viewAsBar');
  document.body.classList.toggle('viewing', !!S.viewAs);
  if (!S.viewAs) return bar?.remove();
  if (!bar) { bar = document.createElement('div'); bar.id = 'viewAsBar'; document.body.prepend(bar); }
  bar.innerHTML = `<span>👁 Du ser appen som <b>${esc(nameOf(S.viewAs))}</b> · kun visning</span><button id="stopViewAs">Tilbage til mig</button>`;
  bar.querySelector('#stopViewAs').onclick = stopViewAs;
}

// Knapper der kun åbner/lukker eller navigerer, må bruges i "se som". Alt andet stoppes.
const SAFE = '.back, .chip, summary, [data-act="enter"], [data-act="teams"], [data-act="voice"], [data-cancel], #shareEvent';
const blocked = () => toast('Kun visning. Tryk "Tilbage til mig" for at ændre noget.', true);

app.addEventListener('click', (e) => {
  if (!S.viewAs) return;
  const btn = e.target.closest('button');
  if (btn && !btn.closest(SAFE)) { e.preventDefault(); e.stopImmediatePropagation(); blocked(); }
}, true);
app.addEventListener('submit', (e) => {
  if (!S.viewAs) return;
  e.preventDefault(); e.stopImmediatePropagation(); blocked();
}, true);
app.addEventListener('change', (e) => {
  if (!S.viewAs || !e.target.matches('#addPlayer, .rolesel')) return;
  e.stopImmediatePropagation(); e.target.value = ''; blocked();
}, true);
