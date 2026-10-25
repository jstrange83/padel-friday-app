// "Nyt i appen": vises én gang som popup, når der er kommet nye funktioner, ting er flyttet, eller større fejl er rettet.
// Små justeringer skrives IKKE her. Nyeste øverst. id = dato (+ evt. bogstav), så de kan sammenlignes som tekst.
// admin: true = kun for admins og superbrugere.
import { sb, S, q, esc, canRun, isSuper } from './core.js';

export const NEWS = [
  {
    id: '2026-10-25a', date: '25. oktober 2026', admin: true, title: 'Nyt for admins',
    items: [
      '➕ <b>Opret spiller</b> ligger nu ved siden af Inviter, for spillere der ikke selv har oprettet sig.',
      '⚙️ <b>Gruppens indstillinger</b> (rangliste og bødekasse) er samlet i ét kort under Admin.',
      '✋ Du får besked (tal på Admin og en notifikation), når nogen vil være med i gruppen.',
      '💸 Bødekassen kan give <b>automatiske bøder</b> ved afmelding, og spillerne kan betale med <b>MobilePay</b>.',
    ],
  },
  {
    id: '2026-10-25', date: '25. oktober 2026', title: 'Nyt i appen',
    items: [
      '🎾 <b>Tast resultatet direkte på din kamp</b>. Ingen skal starte runderne, så hver bane kan spille i sit eget tempo.',
      '🔢 Runderne vælges med knapperne <b>1–6</b>, og <b>Din næste kamp</b> står øverst på spilledagen.',
      '🔔 <b>Notifikationer</b>: få besked, når du får en plads fra ventelisten. Slå til under Profil → Beskeder.',
      '🏆 <b>Én fælles rangliste</b> for alle grupper, med samme point uanset hvor du spiller.',
      '🎨 Vælg dine egne farver under <b>Profil → Udseende</b> (fx pink).',
      '💡 Har du en idé? Skriv den i <b>Forslagskassen</b> under Profil.',
      '💻 Appen virker nu også fint på computeren.',
    ],
  },
];

const forMe = () => NEWS.filter((n) => !n.admin || canRun() || isSuper());
export const latestNewsId = () => NEWS[0]?.id || '';

// Nyheder jeg ikke har set. Har man aldrig set nogen, vises kun den seneste opdatering.
function unseen() {
  const seen = S.realMe?.news_seen;
  const mine = forMe();
  if (!seen) return mine.filter((n) => n.id.slice(0, 10) === mine[0]?.id.slice(0, 10));
  return mine.filter((n) => n.id > seen);
}

export async function markNewsSeen() {
  const id = latestNewsId();
  if (!id || !S.realMe) return;
  S.realMe.news_seen = id;
  try { await q(sb.rpc('padel_set_news_seen', { p_id: id })); } catch {}
}

const entry = (n) => `<div class="news-entry"><div class="news-head"><b>${esc(n.title)}</b><small class="muted">${esc(n.date)}</small></div>
  <ul>${n.items.map((i) => `<li>${i}</li>`).join('')}</ul></div>`;

// Popup én gang, når appen åbnes efter en større opdatering
export function maybeShowNews() {
  if (S.viewAs || !S.realMe || document.getElementById('newsModal')) return false;
  const list = unseen().slice(0, 3);
  if (!list.length) return false;
  const wrap = document.createElement('div');
  wrap.id = 'newsModal';
  wrap.className = 'modal';
  wrap.innerHTML = `<div class="modal-card news-card" role="dialog" aria-modal="true" aria-labelledby="newsTitle">
    <div class="fgicon">🆕</div><h2 id="newsTitle">Nyt i appen</h2>
    ${list.map(entry).join('')}
    <div class="mact"><button class="btn primary" id="newsOk">Forstået</button></div></div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('#newsOk').onclick = async () => { wrap.remove(); await markNewsSeen(); };
  return true;
}

// Siden med alle nyheder (Profil → Nyt i appen)
export function viewNews(app) {
  app.innerHTML = `<div class="page">
    <button class="back" onclick="location.hash='#/profil'">‹ Profil</button>
    <h1>🆕 Nyt i appen</h1>
    ${forMe().map((n) => `<div class="card">${entry(n)}</div>`).join('') || '<p class="muted">Ingen nyheder endnu.</p>'}
  </div>`;
  markNewsSeen();
}
