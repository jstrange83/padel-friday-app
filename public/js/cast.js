// Vis spilledagen på et TV, ligesom når man caster fra telefonen.
// Chrome (computer og Android) kan sende siden direkte til et Chromecast eller Google TV via Presentation API.
// Kan browseren ikke caste, kan man åbne TV-skærmen i et nyt vindue (fx på en computer, der er sluttet til TV'et) eller kopiere linket.
import { esc, toast, haptic } from './core.js';

let conn = null; // den aktive cast-forbindelse

export function castTv(url) {
  const canCast = 'PresentationRequest' in window && !window.Capacitor?.isNativePlatform?.();
  const box = document.createElement('div');
  box.className = 'modal'; box.id = 'castModal';
  box.innerHTML = `<div class="modal-card castcard" role="dialog" aria-modal="true" aria-labelledby="castTitle">
    <div class="fgicon">📺</div><h2 id="castTitle">Vis på TV</h2>
    ${conn ? `<p class="center">Dagen vises på TV'et lige nu. Den opdaterer sig selv, når der kommer resultater.</p>
      <div class="mact"><button class="btn" id="castStop">Stop visning</button><button class="btn primary" id="castClose">Luk</button></div>`
    : `<p class="center">Banerne, resultaterne og stillingen vises live på TV'et og opdaterer sig selv.</p>
      ${canCast ? `<button class="btn primary castbig" id="castGo">📡 Cast til TV</button>
        <small class="muted center castnote" id="castNote">Vælg dit TV på listen. Det skal have Chromecast eller Google TV og være på samme wifi.</small>`
      : `<p class="muted small center">Din browser kan ikke caste. Brug Chrome på en computer eller en Android-telefon, eller åbn TV-skærmen på en computer, der er sluttet til TV'et.</p>`}
      <div class="mact"><button class="btn" id="castOpen">🖥 Åbn TV-skærmen her</button><button class="btn" id="castCopy">🔗 Kopiér link</button></div>
      <button class="link sm castclose" id="castClose">Luk</button>`}
  </div>`;
  document.body.appendChild(box);
  const close = () => box.remove();
  box.onclick = (e) => { if (e.target === box) close(); };
  box.querySelector('#castClose')?.addEventListener('click', close);
  box.querySelector('#castStop')?.addEventListener('click', () => { try { conn?.terminate(); } catch {} conn = null; toast('TV-visningen er stoppet'); close(); });
  box.querySelector('#castOpen')?.addEventListener('click', () => { window.open(url, '_blank', 'noopener'); close(); });
  box.querySelector('#castCopy')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url); toast('Linket er kopieret. Åbn det i browseren på TV\'et'); } catch { prompt('Kopiér linket', url); }
  });
  const go = box.querySelector('#castGo');
  if (go) {
    const req = new PresentationRequest([url]);
    // Vis om der er et TV i nærheden (ikke alle browsere svarer)
    req.getAvailability?.().then((a) => {
      const upd = () => { const n = box.querySelector('#castNote'); if (n && !a.value) n.textContent = 'Der er ikke fundet noget TV endnu. Tjek at TV\'et er tændt og på samme wifi. Du kan stadig prøve.'; };
      upd(); a.onchange = upd;
    }).catch(() => {});
    go.onclick = async () => {
      try {
        conn = await req.start();
        conn.onterminate = conn.onclose = () => { conn = null; };
        haptic('success'); toast('Dagen vises nu på TV\'et 📺'); close();
      } catch (e) {
        if (e?.name !== 'AbortError' && e?.name !== 'NotAllowedError') toast('Det lykkedes ikke at caste. Prøv "Åbn TV-skærmen her" i stedet', true);
      }
    };
  }
}
