// Spørgsmål og svar med søgefelt.
import { app, esc, sb, S, isSuper } from '../core.js';
import { FAQ as ALL } from '../faq-data.js';
// Spørgsmålene passer til der, hvor man er:
// - om grupper (spilledage, point, formater, bøder …) kun for dem, der er med i (eller har bedt om at komme med i) en gruppe
// - om juniorklubben kun for dem, der er med i en klub eller har meldt et barn ind
// - resten (konto, notifikationer, padelregler …) for alle. Superadmin ser det hele.
const GROUP_CATS = ['Point og rangliste', 'Formater', 'Hold og runder', 'Resultater', 'Bødekasse'];
const memberOf = (kind, sts) => S.groups?.some((g) => !g.archived && (g.kind === 'klub') === (kind === 'klub')
  && S.members?.some((m) => m.group_id === g.id && m.player_id === S.me?.id && sts.includes(m.status)));
const inGroup = () => isSuper() || memberOf('gruppe', ['aktiv', 'afventer']);
let hasKids = false;
const inClub = () => isSuper() || hasKids || memberOf('klub', ['aktiv']);
const forMe = (f) => (f.club ? inClub() : f.group || GROUP_CATS.includes(f.cat) ? inGroup() : true);

const norm = (t) => t.toLowerCase().replace(/<[^>]+>/g, ' ');

export async function viewFaq() {
  // Forælder med et barn, der venter på godkendelse, er ikke medlem endnu, men skal kunne læse om klubben
  hasKids = false;
  if (!S.viewAs && !isSuper() && !memberOf('klub', ['aktiv'])) { try { const { data } = await sb.from('padel_club_kids').select('id').limit(1); hasKids = !!data?.length; } catch {} }
  app.innerHTML = `
  <div class="page">
    <button class="back" onclick="history.back()">‹ Tilbage</button>
    <h1>Spørgsmål og svar</h1>
    <input type="search" id="faqSearch" placeholder="${inGroup() ? 'Søg, fx americano, point, pause…' : 'Søg, fx afbud, træning, kalender…'}" autocomplete="off">
    <div id="faqList"></div>
  </div>`;
  const list = document.getElementById('faqList');
  const draw = (term = '') => {
    const words = norm(term).split(/\s+/).filter(Boolean);
    const FAQ = ALL.filter(forMe);
    const hits = FAQ.filter((f) => words.every((w) => norm(f.q + ' ' + f.a + ' ' + f.cat).includes(w)));
    if (!hits.length) { list.innerHTML = '<p class="muted pad">Ingen svar matcher. Prøv et andet ord, eller spørg en admin.</p>'; return; }
    const cats = [...new Set(hits.map((f) => f.cat))];
    list.innerHTML = cats.map((c) => `<h3>${esc(c)}</h3>${hits.filter((f) => f.cat === c).map((f) =>
      `<details class="faq" ${words.length ? 'open' : ''}><summary>${esc(f.q)}</summary><div>${f.a}</div></details>`).join('')}`).join('');
  };
  draw();
  document.getElementById('faqSearch').oninput = (e) => draw(e.target.value);
}
