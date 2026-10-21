// "Se som": en admin kan se og bruge appen som en bestemt spiller. Ændringer gemmes i spillerens navn
// (med admins egne rettigheder, så loggen viser hvem der gjorde det).
import { S, hooks, esc, nameOf, toast } from './core.js';

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
  bar.innerHTML = `<span>👁 Du er <b>${esc(nameOf(S.viewAs))}</b> · det du gør, gemmes i ${esc(nameOf(S.viewAs).split(' ')[0])}s navn</span><button id="stopViewAs">Tilbage til mig</button>`;
  bar.querySelector('#stopViewAs').onclick = stopViewAs;
}
