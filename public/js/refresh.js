// Opdatering i appen (Android-appen og appen på hjemmeskærmen), hvor der ikke er en genindlæs-knap:
// 1) Træk ned fra toppen af siden for at opdatere.
// 2) Når appen har ligget i baggrunden i 30 minutter, hentes den nyeste version automatisk, når den åbnes igen.

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

  // Hent nyeste version, når appen åbnes igen efter mindst 30 minutter
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > 30 * 60 * 1000 && !busyTyping()) location.reload();
  });
}
