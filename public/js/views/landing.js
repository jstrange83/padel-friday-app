// Forsiden før login (kun på hjemmesiden, ikke i Android-/iPhone-appen og ikke når man kommer fra en invitation).
// Fortæller kort, hvad appen kan for private padelgrupper, klubber og foreninger, og padelcentre.

const shots = [
  ['skaerm-1', 'Tilmelding med ét tryk og venteliste'],
  ['skaerm-2', 'Holdene sættes automatisk'],
  ['skaerm-3', 'Ranglisten med point efter hver kamp'],
  ['skaerm-4', 'Din statistik: makkere, modstandere og stimer'],
  ['skaerm-5', 'Bødekassen med MobilePay'],
  ['skaerm-6', 'Lyst eller mørkt, du vælger farverne'],
];

const steps = [
  ['Opret gruppen', 'Giv den et navn, vælg jeres center og del linket i jeres chat.'],
  ['Alle melder sig til', 'Spillerne trykker sig på spilledagen. Er der fyldt op, kommer de på venteliste.'],
  ['Appen laver holdene', 'Lige stærke hold og baner ud fra point, så kampene bliver tætte.'],
  ['Resultater og rangliste', 'Spillerne skriver resultatet ind, og ranglisten opdateres med det samme.'],
];

const audiences = [
  ['🎾', 'Private padelgrupper', 'Fredagspadel, firmaholdet eller vennerne. Slut med at styre tilmelding og hold i en chat.', [
    'Tilmelding, venteliste og påmindelser',
    'Fair hold og baner efter point',
    'Americano, rotation, sæt eller klassisk',
    'Rangliste, stimer og æg 🥚',
    'Pris pr. spiller for bane og bolde, og bødekasse med MobilePay',
  ]],
  ['🧒', 'Klubber og foreninger', 'Juniorafdelingen eller klubbens voksne. Træninger, hold og kontingent samlet ét sted.', [
    'Træninger med afbud og fremmøde',
    'Hold, trænere og træningstider',
    'Kontingent, opslag, arrangementer og nyhedsbreve på mail',
    'Beskeder, hvor forældrene altid er med',
    'Flueben til bestyrelse og trænere: hvem må hvad',
  ]],
  ['🏟', 'Padelcentre', 'Hold jeres officielle ranglisteaftener, så kører resten af sig selv.', [
    'Centrets egen officielle rangliste',
    'TV-skærm med baner og live resultater',
    'Jeres farve og besked på skærmen',
    'Indsæt tilmeldte fra MATCHi eller Excel',
    'Lige stærke baner, resultater fra spillernes telefoner',
  ]],
];

// Fordele: hvad man får ud af det (ingen tal eller løfter, vi ikke kan stå inde for)
const gains = [
  ['🏟', 'For padelcentre', [
    ['Flere faste kunder', 'En fast ranglisteaften giver spillerne en grund til at komme igen uge efter uge, og de inviterer vennerne med.'],
    ['Fyld de stille timer', 'Læg ranglisteaftener og events på de tider, hvor banerne ellers står tomme, så de giver omsætning.'],
    ['Mindre arbejde i receptionen', 'Tilmelding, venteliste, hold og resultater kører af sig selv, og TV-skærmen viser, hvor alle skal spille.'],
  ]],
  ['🤝', 'For klubber og foreninger', [
    ['Frivillige sparer tid', 'Træninger, afbud, fremmøde og kontingent samlet ét sted, i stedet for lister, chats og regneark.'],
    ['Alle ved, hvad der sker', 'Opslag, arrangementer og nyhedsbreve når ud til alle medlemmer og forældre.'],
    ['Et stærkere klubliv', 'Rangliste, statistik og fælles arrangementer får medlemmerne til at blive og til at tage nye med.'],
  ]],
  ['🎾', 'For spillerne', [
    ['Det sociale', 'Man møder nye makkere og modstandere hver gang og bliver en del af et fællesskab.'],
    ['Tætte kampe', 'Holdene sættes efter point, så kampene bliver lige, uanset om man er ny eller øvet.'],
    ['Noget at spille for', 'Rangliste, form, stimer og statistik gør det sjovt at blive bedre og at komme igen.'],
  ]],
];

const faq = [
  ['Skal alle hente en app?', 'Nej. Padelklubben virker i browseren på både telefon og computer, og kan lægges på hjemmeskærmen som en app. Appen til Android og iPhone er på vej i Google Play og App Store.'],
  ['Hvordan regnes pointene ud?', 'Alle starter på 1000 point. Efter hver kamp får vinderne point fra taberne, og det giver flest point at slå nogen, der er bedre end en selv. Derfor kan holdene sættes, så kampene bliver lige.'],
  ['Kan børn bruge appen?', 'Ja, i en klub. Forældrene melder barnet ind og kan give det sit eget login. Et barn er aldrig alene i en samtale med en voksen, for forældrene får altid beskeden med.'],
  ['Hvor gemmes vores oplysninger?', 'På servere i EU. Der er ingen reklamer og ingen sporing, og oplysningerne bliver ikke solgt eller givet videre.'],
  ['Vi har allerede en liste i Excel. Kan vi tage den med?', 'Ja. Sæt listen ind med navne, mails eller telefonnumre, så tilmelder appen dem, den kender, og fortæller hvem der mangler.'],
];

export function landingHtml() {
  return `<div class="landing">
    <section class="lsec lhero">
      <h2>Ugens bedste aften starter her</h2>
      <p class="lintro">Padel er sjovest, når kampene er tætte, alle kender planen, og der er noget at spille for. Det sørger Padelklubben for.</p>
      <ul class="lwhy">
        <li><span>🔥</span><div><b>Spændende kampe hver gang</b><p>Appen sætter holdene efter point, så ingen kamp er afgjort, før den er spillet.</p></div></li>
        <li><span>🏆</span><div><b>Noget at kæmpe for</b><p>Klatr på ranglisten, slå din rekord og se din form, dine stimer og din bedste makker.</p></div></li>
        <li><span>🍻</span><div><b>Fællesskabet</b><p>Nye makkere, faste aftener og en gruppe, der glæder sig til næste gang.</p></div></li>
        <li><span>⚡</span><div><b>Intet bøvl</b><p>Slut med lister i chatten. Ét tryk, så er du med, og appen klarer resten.</p></div></li>
      </ul>
      <a class="btn primary" href="#top" data-lsignup>Kom med nu</a>
    </section>

    <section class="lshots" aria-label="Skærmbilleder fra appen">
      <div class="lscroll">${shots.map(([f, t]) => `<img src="/img/landing/${f}.jpg" alt="${t}" loading="lazy" width="270" height="480">`).join('')}</div>
    </section>

    <section class="lsec lnew">
      <div class="lnewin"><div class="lic">👋</div><div>
        <h2>Aldrig spillet padel?</h2>
        <p>Så er det nu. Padel er nemt at komme i gang med, man spiller altid to og to, og det er lige så meget socialt som sport. Med Padelklubben kommer du på hold med spillere på dit niveau fra første kamp, så det er sjovt med det samme. Find tre venner, opret en gruppe, og book en bane. Resten klarer appen.</p>
        <a class="btn primary" href="#top" data-lsignup>Start jeres gruppe</a>
      </div></div>
    </section>

    <section class="lsec">
      <h2>Fra chat til færdige hold</h2>
      <ol class="lsteps">${steps.map(([h, t], i) => `<li><span class="n">${i + 1}</span><div><b>${h}</b><p>${t}</p></div></li>`).join('')}</ol>
    </section>

    <section class="lsec">
      <h2>Til hvem?</h2>
      <div class="laud">${audiences.map(([ic, h, t, list]) => `<div class="lcard"><div class="lic">${ic}</div><h3>${h}</h3><p>${t}</p>
        <ul>${list.map((x) => `<li>${x}</li>`).join('')}</ul></div>`).join('')}</div>
      <p class="lcta">Er I et center, en klub eller en forening, så skriv til os på <a href="mailto:kontakt@padelklubben.dk?subject=Padelklubben%20til%20os">kontakt@padelklubben.dk</a>, så hjælper vi jer i gang.</p>
    </section>

    <section class="lsec">
      <h2>Mere padel, flere gode aftener</h2>
      <p class="lintro">Padelklubben tager sig af det praktiske, så I kan bruge tiden på banen og på hinanden.</p>
      <div class="lgain">${gains.map(([ic, h, list]) => `<div class="lcard"><div class="lic">${ic}</div><h3>${h}</h3>
        ${list.map(([t, d]) => `<div class="lpro"><b>${t}</b><p>${d}</p></div>`).join('')}</div>`).join('')}</div>
      <div class="lpush">
        <div><b>Klar til at prøve?</b><p>Det tager to minutter at komme i gang, og I kan spille jeres første aften med appen allerede i denne uge.</p></div>
        <a class="btn primary" href="#top" data-lsignup>Kom i gang</a>
      </div>
      <p class="lcta">Er I et center eller en klub, så viser vi gerne, hvordan det kan se ud hos jer: <a href="mailto:kontakt@padelklubben.dk?subject=Padelklubben%20til%20os">kontakt@padelklubben.dk</a></p>
    </section>

    <section class="lsec">
      <h2>Spørgsmål og svar</h2>
      ${faq.map(([q, a]) => `<details class="lfaq"><summary>${q}</summary><p>${a}</p></details>`).join('')}
    </section>

    <section class="lsec lend">
      <h2>Klar til næste kamp?</h2>
      <p>Opret jeres gruppe på et par minutter, del linket med de andre, og spil jeres første aften med appen allerede i denne uge.</p>
      <a class="btn primary" href="#top" data-lsignup>Opret konto</a>
      <p class="lnext"><a href="/nyt">Se hvad der kommer i appen ›</a></p>
    </section>

    <footer class="lfoot">
      <div><b>Padelklubben</b> · FST Gruppen ApS · CVR 43100009</div>
      <div><a href="mailto:kontakt@padelklubben.dk">kontakt@padelklubben.dk</a> · <a href="/support">Hjælp</a> · <a href="/privatliv">Privatliv</a> · <a href="/nyt">Nyt og på vej</a></div>
    </footer>
  </div>`;
}

export function bindLanding(goSignup) {
  document.querySelectorAll('[data-lsignup]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); goSignup(); scrollTo({ top: 0, behavior: 'smooth' }); }));
}
