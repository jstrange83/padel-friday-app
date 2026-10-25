// Udseende: farvetemaer. Gemmes på profilen (følger med på alle telefoner) og på telefonen (så det er der med det samme).
import { sb, S, app, toast, q, esc } from './core.js';

export const THEMES = [
  ['', 'Standard', '#0c1b2a', '#13283c', '#d4f53c'],
  ['pink', 'Pink', '#1f0b1a', '#2e1328', '#ff5fb7'],
  ['rosa', 'Lyserød (lys)', '#fff0f7', '#ffffff', '#e3268b'],
  ['lys', 'Lys', '#f2f5f9', '#ffffff', '#16a34a'],
  ['hav', 'Hav', '#04202b', '#0a3140', '#2dd4bf'],
  ['lilla', 'Lilla', '#160f2b', '#221845', '#b694ff'],
  ['nat', 'Sort og guld', '#0a0a0a', '#161616', '#f5c542'],
];

export function applyTheme(key) {
  const t = THEMES.find((x) => x[0] === (key || '')) || THEMES[0];
  if (t[0]) document.documentElement.dataset.theme = t[0]; else delete document.documentElement.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t[2]);
  try { localStorage.setItem('fp-theme', t[0]); } catch {}
}

export function viewTheme() {
  const cur = S.realMe?.theme || '';
  app.innerHTML = `
  <div class="page">
    <button class="back" onclick="location.hash='#/profil'">‹ Profil</button>
    <h1>🎨 Udseende</h1>
    <p class="muted">Vælg de farver, du kan lide. Det gælder kun for dig, og det følger med, hvis du logger ind på en anden telefon.</p>
    <div class="themes">${THEMES.map(([k, name, bg, card, acc]) => `
      <button class="theme ${k === cur ? 'on' : ''}" data-theme-key="${k}" aria-pressed="${k === cur}">
        <div class="tprev" style="background:${bg}"><i style="background:${card}"></i><i style="background:${card};width:70%"></i><b style="background:${acc}"></b></div>
        <span>${esc(name)}${k === cur ? ' ✓' : ''}</span>
      </button>`).join('')}</div>
  </div>`;
  app.querySelectorAll('[data-theme-key]').forEach((b) => (b.onclick = async () => {
    const k = b.dataset.themeKey;
    applyTheme(k);
    if (S.realMe) S.realMe.theme = k || null;
    viewTheme();
    try { await q(sb.rpc('padel_set_theme', { p_theme: k || null })); toast('Udseendet er gemt'); } catch {}
  }));
}
