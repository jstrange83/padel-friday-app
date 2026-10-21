// Spørgsmål og svar med søgefelt.
import { app, esc } from '../core.js';
import { FAQ } from '../faq-data.js';

const norm = (t) => t.toLowerCase().replace(/<[^>]+>/g, ' ');

export function viewFaq() {
  app.innerHTML = `
  <div class="page">
    <button class="back" onclick="history.back()">‹ Tilbage</button>
    <h1>Spørgsmål og svar</h1>
    <input type="search" id="faqSearch" placeholder="Søg, fx americano, point, pause…" autocomplete="off">
    <div id="faqList"></div>
  </div>`;
  const list = document.getElementById('faqList');
  const draw = (term = '') => {
    const words = norm(term).split(/\s+/).filter(Boolean);
    const hits = FAQ.filter((f) => words.every((w) => norm(f.q + ' ' + f.a + ' ' + f.cat).includes(w)));
    if (!hits.length) { list.innerHTML = '<p class="muted pad">Ingen svar matcher. Prøv et andet ord, eller spørg en admin.</p>'; return; }
    const cats = [...new Set(hits.map((f) => f.cat))];
    list.innerHTML = cats.map((c) => `<h3>${esc(c)}</h3>${hits.filter((f) => f.cat === c).map((f) =>
      `<details class="faq" ${words.length ? 'open' : ''}><summary>${esc(f.q)}</summary><div>${f.a}</div></details>`).join('')}`).join('');
  };
  draw();
  document.getElementById('faqSearch').oninput = (e) => draw(e.target.value);
}
