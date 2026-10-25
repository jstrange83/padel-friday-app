// "Se som": en admin kan se og bruge appen som en bestemt spiller. Ændringer gemmes i spillerens navn
// (med admins egne rettigheder, så loggen viser hvem der gjorde det).
import { S, hooks, esc, nameOf, toast, viewMode, setViewMode } from './core.js';

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

export function stopViewAs() {
  try { sessionStorage.removeItem(KEY); } catch {}
  location.hash = '#/admin';
  hooks.boot();
}

export function renderViewAsBar() {
  let bar = document.getElementById('viewAsBar');
  // Valgt visning uden fulde rettigheder: lille bjælke, så man husker det
  const mode = viewMode(), full = S.realMe?.is_superadmin ? 'super' : 'mine';
  const reduced = !S.viewAs && mode !== full;
  document.body.classList.toggle('viewing', !!S.viewAs || reduced);
  if (reduced) {
    if (!bar) { bar = document.createElement('div'); bar.id = 'viewAsBar'; document.body.prepend(bar); }
    bar.className = 'modebar';
    bar.innerHTML = `<span>👁 Du ser appen ${mode === 'bruger' ? 'som almindelig bruger' : 'med dine egne roller'}</span><button id="stopViewAs">${S.realMe?.is_superadmin ? 'Superadmin' : 'Admin'}</button>`;
    bar.querySelector('#stopViewAs').onclick = () => { setViewMode(full); location.hash = '#/profil'; hooks.boot(); };
    return;
  }
  if (bar) bar.className = '';
  if (!S.viewAs) return bar?.remove();
  if (!bar) { bar = document.createElement('div'); bar.id = 'viewAsBar'; document.body.prepend(bar); }
  bar.innerHTML = `<span>👁 Du er <b>${esc(nameOf(S.viewAs))}</b> · det du gør, gemmes i ${esc(nameOf(S.viewAs).split(' ')[0])}s navn</span><button id="stopViewAs">Tilbage til mig</button>`;
  bar.querySelector('#stopViewAs').onclick = stopViewAs;
}
