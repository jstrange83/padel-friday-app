// Opdatering i appen (Android-appen og appen på hjemmeskærmen), hvor der ikke er en genindlæs-knap:
// 1) Træk ned fra toppen af siden for at opdatere.
// 2) Swipe mod højre for at gå tilbage til den forrige side.
// 3) Når appen har ligget i baggrunden i 30 minutter, hentes den nyeste version automatisk, når den åbnes igen.

const inApp = () => !!(window.Capacitor && (window.Capacitor.isNativePlatform ? window.Capacitor.isNativePlatform() : true))
  || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const busyTyping = () => {
  const a = document.activeElement;
  return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable);
};

export function setupRefresh() {
  if (!inApp()) return;
  document.documentElement.classList.add('inapp');

  // Træk ned for at opdatere
  const ind = document.createElement('div');
  ind.className = 'ptr';
  ind.innerHTML = '<span>↓</span><b>Træk for at opdatere</b>';
  document.body.appendChild(ind);
  const LIMIT = 80;
  let y0 = null, dy = 0;
  const topOk = () => (window.scrollY || document.documentElement.scrollTop) <= 0 && !document.querySelector('.modal, dialog[open], .sheet');
  addEventListener('touchstart', (e) => {
    y0 = (e.touches.length === 1 && topOk()) ? e.touches[0].clientY : null; dy = 0;
  }, { passive: true });
  addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    dy = e.touches[0].clientY - y0;
    if (dy <= 0 || !topOk()) { ind.style.transform = ''; ind.classList.remove('show', 'ready'); return; }
    const d = Math.min(dy * 0.5, LIMIT + 20);
    ind.classList.add('show');
    ind.classList.toggle('ready', dy * 0.5 >= LIMIT);
    ind.querySelector('b').textContent = dy * 0.5 >= LIMIT ? 'Slip for at opdatere' : 'Træk for at opdatere';
    ind.style.transform = `translate(-50%, ${d}px)`;
  }, { passive: true });
  addEventListener('touchend', () => {
    if (y0 != null && dy * 0.5 >= LIMIT) {
      ind.classList.add('ready', 'spin');
      ind.querySelector('b').textContent = 'Opdaterer …';
      setTimeout(() => location.reload(), 150);
    } else { ind.style.transform = ''; ind.classList.remove('show', 'ready'); }
    y0 = null; dy = 0;
  }, { passive: true });

  setupSwipeBack();

  // Hent nyeste version, når appen åbnes igen efter mindst 30 minutter
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > 30 * 60 * 1000 && !busyTyping()) location.reload();
  });
}

// Swipe mod højre = tilbage. Ikke i felter, i ting der selv kan rulles sidelæns, eller når en boks er åben.
function scrollsSideways(el) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 2) { const o = getComputedStyle(n).overflowX; if (o === 'auto' || o === 'scroll') return true; }
  }
  return false;
}
export function setupSwipeBack() {
  const arrow = document.createElement('div');
  arrow.className = 'swb';
  arrow.textContent = '‹';
  document.body.appendChild(arrow);
  const NEED = 90;
  let x0 = null, y0 = 0, t0 = 0, dx = 0, mode = null;
  const reset = () => { x0 = null; dx = 0; mode = null; arrow.style.transform = ''; arrow.classList.remove('show', 'ready'); };
  addEventListener('touchstart', (e) => {
    reset();
    if (e.touches.length !== 1 || history.length < 2) return;
    const tg = e.target;
    if (tg.closest && tg.closest('input, textarea, select, [contenteditable], .modal, dialog, .sheet, .noswipe')) return;
    if (document.querySelector('.modal, dialog[open], .sheet') || scrollsSideways(tg)) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
  }, { passive: true });
  addEventListener('touchmove', (e) => {
    if (x0 == null) return;
    dx = e.touches[0].clientX - x0; const dy = e.touches[0].clientY - y0;
    if (!mode && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) mode = dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.5 ? 'back' : 'no';
    if (mode !== 'back') return;
    if (Math.abs(dy) > 60 || dx <= 0) { arrow.classList.remove('show', 'ready'); return; }
    arrow.classList.add('show');
    arrow.classList.toggle('ready', dx >= NEED);
    arrow.style.transform = `translate(${Math.min(dx * 0.5, 60)}px, -50%)`;
  }, { passive: true });
  addEventListener('touchend', () => {
    const go = mode === 'back' && dx >= NEED && arrow.classList.contains('show') && Date.now() - t0 < 1200;
    reset();
    if (go) history.back();
  }, { passive: true });
  addEventListener('touchcancel', reset, { passive: true });
}
