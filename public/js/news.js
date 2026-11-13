// "Nyt i appen": vises én gang som popup, når der er kommet nye funktioner, ting er flyttet, eller større fejl er rettet.
// Små justeringer skrives IKKE her. Nyeste øverst. id = dato (+ evt. bogstav), så de kan sammenlignes som tekst.
// admin: true = kun for admins og superbrugere. centers: ['Gilleleje'] = kun for voksne i grupper, der spiller i det center.
import { sb, S, q, esc, canRun, isSuper } from './core.js';

export const NEWS = [
  {
    id: '2026-11-13g', date: '13. november 2026', admin: true, groups: true, title: 'Flere spilledage, cast til TV og store skærme',
    items: ['📅 Når du opretter spilledage, kan du trykke <b>＋ En dag mere</b>. Dagen lægges ned som et lille kort, og du kan lave den næste, med sit eget sted, baner, spiltype og tid. Til sidst opretter du dem alle på én gang.', '📺 TV-knappen på spilledagen kan nu <b>caste</b> dagen direkte til et TV med Chromecast eller Google TV, ligesom fra telefonen. TV\'et viser banerne set fra oven med navnene i hvert felt, ligesom på computeren. Du kan også åbne TV-skærmen i et nyt vindue.', '🖥 På store skærme bruger appen nu mere af pladsen, og banerne står side om side.'],
  },
  {
    id: '2026-11-13f', date: '13. november 2026', groups: true, title: 'Banerne set fra oven på computeren',
    items: ['🎾 På computeren vises hver bane nu som en padelbane set fra oven, med spillernes navne i hvert felt, så man kan se, hvem der står i venstre og højre side. Resultatet står på nettet. På telefonen er det som før.'],
  },
  {
    id: '2026-11-13e', date: '13. november 2026', admin: true, title: 'Punktlister i nyhedsbreve',
    items: ['📝 Skriver du linjer i et nyhedsbrev, der starter med en bindestreg, bliver de nu til en pæn punktliste i mailen.'],
  },
  {
    id: '2026-11-13d', date: '13. november 2026', admin: true, groups: true, title: 'Opret flere spilledage på én gang',
    items: ['📅 Når du opretter spilledage, kan du nu trykke <b>＋ Tilføj en dag mere</b>, fx hvis I spiller både tirsdag og fredag. Hver dag får sin egen dato og tid og gentages det antal uger, du vælger.'],
  },
  {
    id: '2026-11-13c', date: '13. november 2026', admin: true, title: 'Nyhedsbreve på mail',
    items: ['📰 Under <b>Admin → Nyhedsbrev</b> kan du nu skrive et flot nyhedsbrev til hele gruppen eller klubben, med overskrift, afsnit og knapper med links. Du ser mailen, mens du skriver, kan sende en test til dig selv og gemme som kladde.', '🔑 Andre end admin kan få lov med fluebenet <b>Nyhedsbrev</b> under Admin → Rettigheder.', '🔕 Alle kan afmelde sig nederst i mailen eller under Notifikationer og mails.'],
  },
  {
    id: '2026-11-13b', date: '13. november 2026', admin: true, club: true, title: 'Invitér bestyrelsen med mail',
    items: ['✉️ Under <b>Admin → Indstillinger → Bestyrelse og børneattest</b> kan du nu invitere resten af bestyrelsen med deres mail og vælge deres post. Er de allerede i appen, kommer de med med det samme. Ellers får de en mail, og når de opretter sig med samme mail, kommer de automatisk med.', '🧑‍💼 Man kan nu have <b>flere poster</b>, fx både bestyrelsesmedlem og kasserer, og en træner kan også sidde i bestyrelsen.', '🛠 Posten <b>Udvikler af appen</b> kan vælges, og trænere i én klub bliver ikke længere vist som trænere i andre klubber.'],
  },
  {
    id: '2026-11-13', date: '13. november 2026', title: 'Min padel',
    items: ['👤 <b>Profil</b> hedder nu <b>Min padel</b> og viser dit spillerkort: point, placering, form og stime, sæsonens tal, dit næste mål, din bedste makker og din nemesis.', '⚙️ Indstillingerne (navn, telefon, notifikationer, udseende m.m.) ligger bag tandhjulet øverst på Min padel.', '💸 Bødekassen ligger nu på Min padel, så der højst er 4 knapper i bunden.'],
  },
  {
    id: '2026-11-12e', date: '12. november 2026', admin: true, groups: true, title: 'Indsæt en liste med tilmeldte',
    items: ['📋 På en spilledag kan du nu trykke <b>Indsæt en liste</b> og sætte navne, mails eller telefonnumre ind, fx fra MATCHi, Excel eller en besked. Alle, appen kender, bliver tilmeldt med det samme, og du får at vide, hvem den ikke kender.'],
  },
  {
    id: '2026-11-12d', date: '12. november 2026', title: 'Nyt og på vej',
    items: ['🆕 Under <b>Min padel → Nyt og på vej</b> kan du nu se, hvad der er bygget, hvad vi arbejder på lige nu, og hvad der er på tegnebrættet.', '👍 Tryk 👍 ved det, du gerne vil have, så ved vi, hvad der er vigtigst. Har du selv en idé, så skriv i Forslagskassen.'],
  },
  {
    id: '2026-11-12c', date: '12. november 2026', admin: true, title: 'Ny Admin med rettigheder',
    items: ['🧭 <b>Admin</b> starter nu med en oversigt, hvor hver del har sin egen flise. Det, der venter på dig, er markeret.', '🔑 Under <b>Admin → Rettigheder</b> sætter du flueben ved, hvad hver person må. I en klub fx <b>Træninger</b> (se alle hold og krydse fremmøde af), <b>Medlemmer</b>, <b>Kontingent</b>, <b>Opslag</b> og <b>Arrangementer</b>. I en spillegruppe <b>Køre spilledagen</b>, <b>Spilledage</b>, <b>Spillere</b> og <b>Bødekasse</b>.', '⚙️ Indstillinger, mails og bestyrelse ligger nu under <b>Admin → Indstillinger</b>.'],
  },
  {
    id: '2026-11-12b', date: '12. november 2026', title: 'Notifikationer i Android-appen',
    items: ['🔔 Bruger du <b>Padelklubben-appen fra Google Play</b>, kan du nu få notifikationer på telefonen. Opdater appen, tryk <b>🔔</b> og slå <b>Notifikationer på denne enhed</b> til. Tryk på en notifikation for at komme direkte til siden.', '📡 Mister telefonen nettet, står der nu en rød bjælke øverst, og siden opdateres selv, når nettet er tilbage.'],
  },
  {
    id: '2026-11-12', date: '12. november 2026', groups: true, title: 'Aflyste spilledage',
    items: ['🚫 En spilledag kan nu <b>aflyses</b> i stedet for at blive slettet. Den bliver stående som <b>Aflyst</b> med årsagen, så den kan ses bagefter.', '🔔 Alle tilmeldte får besked på telefonen og på mail, og ingen får bøde for at melde fra efter aflysningen. Bøder til dem, der meldte fra inden, bliver stående. En aflyst dag bryder ikke din stime.'],
  },
  {
    id: '2026-11-11c', date: '11. november 2026', groups: true, title: 'Fredage i træk og kampdetaljer',
    items: ['🔥 Under <b>Rangliste → Streak</b> kan du nu også se, hvem der har været med flest fredage i træk.', '📊 Tryk <b>Detaljer</b> på en spillet kamp for at se banen, resultatet og point før → efter for alle fire.'],
  },
  {
    id: '2026-11-11b', date: '11. november 2026', title: 'Flottere på computeren',
    items: ['💻 På en computer har appen nu menuen i venstre side og bruger hele skærmen: spilledage og træninger i flere kolonner, dagsplanen med pris og tilmeldte ved siden af, top 5 på ranglisten, og admin i to spalter. På telefonen er alt som før.'],
  },
  {
    id: '2026-11-11', date: '11. november 2026', admin: true, title: 'Påmindelser på mail',
    items: ['✉️ Under <b>Admin → Påmindelser på mail</b> kan du slå til, at dem, der ikke har svaret på en træning, også får påmindelsen på mail. I en spillegruppe får dem, der ikke er tilmeldt, en mail 4 dage før, 2 dage før og dagen før spilledagen. Mailen kommer med gruppens navn, og svar går til gruppens egen mail.'],
  },
  {
    id: '2026-11-10b', date: '10. november 2026', club: true, title: 'Familie og børns eget login',
    items: ['👪 Under <b>Min padel → Mine børn</b> hedder knappen nu <b>Familie</b>. Send linket til den anden forælder, bedsteforældre eller andre, der henter og bringer. Du kan se, hvem der har adgang, og fjerne nogen igen.', '📱 Børn kan nu få <b>eget login uden e-mail</b>. Tryk <b>Eget login</b>, lad barnet scanne koden og trykke <b>Kom i gang</b>.', '🔔 Skilte forældre (fx 7/7): hver forælder kan vælge kun at få påmindelser i sine egne uger eller dage, under <b>🔔 Påmindelser</b> ved barnet.'],
  },
  {
    id: '2026-11-10', date: '10. november 2026', admin: true, title: 'Grafer på fremmøde og kontingent',
    items: ['📊 Under <b>Admin → Fremmøde</b> kan du nu se <b>alle hold samlet</b> eller ét hold ad gangen, med lagkager, en graf uge for uge og en bjælke pr. hold.', '💳 <b>Kontingent</b> har fået overblik: hvor mange kroner der er betalt, lagkage, pr. hold og indbetalinger over tid.'],
  },
  {
    id: '2026-11-07', date: '7. november 2026', title: 'Vælg dine egne farver',
    items: ['🎨 Husk, at du selv kan vælge, hvordan appen ser ud. Synes du, den er for mørk, kan du vælge en af de lyse: <b>Lys, Lyserød, Himmelblå, Mint, Sand eller Lavendel</b>. Der er også flere mørke, fx Pink, Hav, Skov og Rubin. Du finder det under <b>Min padel → ⚙️ Indstillinger → Udseende</b>.'],
    link: ['🎨 Vælg farver', '#/udseende'],
  },
  {
    id: '2026-11-06', date: '6. november 2026', groups: true, title: 'Pris pr. spiller',
    items: ['💰 Når dagsplanen er lavet, kan du se, hvad bane og bolde koster pr. spiller, og betale med MobilePay til den, der har booket banen. Prisen står også i beskeden om dagsplanen.'],
  },
  {
    id: '2026-10-31', date: '31. oktober 2026', admin: true, groups: true, title: 'Bødeansvarlig',
    items: ['💸 Under <b>Bøder → Indstillinger</b> kan du vælge en <b>bødeansvarlig</b>, som godkender betalinger sammen med admin. Superbrugere kan stadig give bøder, men ikke godkende betalinger. En admins egen bøde skal godkendes af en anden.'],
  },
  {
    id: '2026-10-30', date: '30. oktober 2026', groups: true, title: 'Besked når dagsplanen er klar',
    items: ['📋 Når admin laver dagsplanen, får alle tilmeldte en notifikation om, hvilken bane de starter på, og hvem de spiller med og mod.'],
  },
  {
    id: '2026-10-29b', date: '29. oktober 2026', groups: true, title: 'Billeder i beskeder',
    items: ['📷 Når du skriver til admin, kan du nu også sende et billede. Tryk <b>📷 Billede</b> under beskeden.'],
  },
  {
    id: '2026-10-29', date: '29. oktober 2026', groups: true, title: 'Ledige pladser',
    items: ['🎾 Er der ledige pladser på en spilledag de næste 3 dage, spørger appen, om du vil være med. Ét tryk, så er du tilmeldt. "Ikke denne gang" giver aldrig bøde.'],
  },
  {
    id: '2026-10-26', date: '26. oktober 2026', groups: true, title: 'Skriv til admin',
    items: ['💬 Under <b>Min padel → Skriv til admin</b> kan du nu sende en besked til gruppens admin. Svaret kommer samme sted, og du får en notifikation.'],
  },
  {
    id: '2026-10-25c', date: '25. oktober 2026', admin: true, title: 'Se appen som almindelig bruger',
    items: ['👁 Under <b>Min padel → ⚙️ Indstillinger → Visning</b> kan du nu vælge at se appen som en almindelig spiller. Så kan du se, hvordan den ser ud for de andre. En bjælke øverst fører dig tilbage.'],
  },
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
      '🔔 <b>Notifikationer</b>: få besked, når du får en plads fra ventelisten. Slå til under Min padel → Beskeder.',
      '🏆 <b>Én fælles rangliste</b> for alle grupper, med samme point uanset hvor du spiller.',
      '🎨 Vælg dine egne farver under <b>Min padel → ⚙️ Indstillinger → Udseende</b> (fx pink).',
      '💡 Har du en idé? Skriv den i <b>Forslagskassen</b> under Profil.',
      '💻 Appen virker nu også fint på computeren.',
    ],
  },
];

const inCenter = (names) => S.members.some((m) => m.player_id === S.realMe?.id && m.status === 'aktiv' && S.groups.find((g) => g.id === m.group_id && g.kind !== 'klub' && !g.archived)
  && S.groupCenters.some((c) => c.group_id === m.group_id && c.enabled && names.includes(S.centers.find((x) => x.id === c.center_id)?.name)));
// groups: true = kun for voksne i en almindelig gruppe (ikke dem, der kun er med i en juniorklub)
const inGroup = () => S.members.some((m) => m.player_id === S.realMe?.id && m.status === 'aktiv' && S.groups.some((g) => g.id === m.group_id && g.kind !== 'klub' && !g.archived));
// club: true = kun for dem, der er med i en klub
const inClub = () => S.members.some((m) => m.player_id === S.realMe?.id && m.status === 'aktiv' && S.groups.some((g) => g.id === m.group_id && g.kind === 'klub' && !g.archived));
export const forMe = () => NEWS.filter((n) => (!n.club || isSuper() || inClub()) && (!n.admin || canRun() || isSuper()) && (!n.centers || isSuper() || inCenter(n.centers)) && (!n.groups || isSuper() || inGroup()));
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

export const entry = (n) => `<div class="news-entry"><div class="news-head"><b>${esc(n.title)}</b><small class="muted">${esc(n.date)}</small></div>
  <ul>${n.items.map((i) => `<li>${i}</li>`).join('')}</ul>
  ${n.link ? `<div class="mact"><a class="btn sm" href="${n.link[1]}" data-newslink>${esc(n.link[0])}</a></div>` : ''}</div>`;

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
  // Knap i en nyhed (fx Vælg farver): luk popuppen, marker som set, og gå derhen
  wrap.querySelectorAll('[data-newslink]').forEach((a) => (a.onclick = () => { wrap.remove(); markNewsSeen(); }));
  return true;
}

// Siden med alle nyheder (Min padel → Nyt i appen)
export function viewNews(app) {
  app.innerHTML = `<div class="page">
    <button class="back" onclick="location.hash='#/profil'">‹ Min padel</button>
    <h1>🆕 Nyt i appen</h1>
    ${forMe().map((n) => `<div class="card">${entry(n)}</div>`).join('') || '<p class="muted">Ingen nyheder endnu.</p>'}
  </div>`;
  markNewsSeen();
}
