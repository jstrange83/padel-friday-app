// Spørgsmål og svar til FAQ under profilen. Hold teksterne korte og i samme tone som appen.
export const FAQ = [
  {
    cat: 'Point og rangliste',
    q: 'Hvordan fungerer point på ranglisten?',
    a: `<p>Alle starter på <b>1000 point</b>. Efter hver godkendt kamp får vinderholdet point, og taberholdet mister lige så mange.</p>
<p>Hvor mange point der er på spil, afhænger af, hvor stærke de to hold er. Holdets styrke er gennemsnittet af de to spilleres point. Appen regner ud, hvor sandsynligt det er, at hvert hold vinder:</p>
<ul><li>Slår I et <b>stærkere</b> hold, får I mange point</li><li>Slår I et <b>svagere</b> hold, får I få point</li><li>Taber I til et stærkere hold, mister I kun lidt</li></ul>
<p>Der kan højst flyttes 32 point i én kamp. Begge spillere på et hold får det samme.</p>`,
  },
  {
    cat: 'Point og rangliste',
    q: 'Hvorfor fik jeg kun få point, selvom vi vandt?',
    a: `<p>Det sker, når I var favoritter på forhånd. Hvis jeres hold samlet havde flere point end modstanderne, forventede systemet allerede, at I ville vinde, og så giver sejren ikke så meget.</p>
<p>I 30‑minutters kampe og Americano tæller det også, <b>hvor meget</b> I vandt med. Vinder I kun 8‑7 over et svagere hold, kan I faktisk miste et par point, fordi I klarede jer dårligere end forventet.</p>`,
  },
  {
    cat: 'Point og rangliste',
    q: 'Hvordan tæller resultatet i de forskellige formater?',
    a: `<ul><li><b>Rotation (30 min):</b> andelen af vundne partier tæller. 9‑3 tæller som 75 %, 8‑8 er uafgjort.</li>
<li><b>Americano:</b> andelen af point tæller på samme måde, fx 16‑8 = 67 %.</li>
<li><b>Klassisk:</b> kun sejr, uafgjort eller nederlag tæller, ikke hvor mange sæt.</li></ul>`,
  },
  {
    cat: 'Point og rangliste',
    q: 'Hvad viser prikkerne ved mit navn på ranglisten?',
    a: `<p>De viser dine seneste 5 kampe. Grøn betyder, at du fik point, rød at du mistede point.</p>`,
  },
  {
    cat: 'Formater',
    q: 'Hvad er en 30‑minutters kamp (rotation)?',
    a: `<p>I spiller i <b>30 minutter</b>, og når tiden er gået, stopper kampen, uanset stillingen. Resultatet kan derfor sagtens blive 9‑3 eller 8‑8.</p>
<p>Efter hver runde får alle en <b>ny makker</b> og nye modstandere. En fredag på 2 timer giver 4 runder.</p>
<p>Appen viser en nedtælling og siger til med lyd og vibration, når tiden er gået. Tæl antal vundne partier (games) og indtast dem.</p>`,
  },
  {
    cat: 'Formater',
    q: 'Hvad er Americano?',
    a: `<p>Americano er et socialt format, hvor alle spiller med alle. Hver kamp spilles til et fast antal point i alt, fx <b>24 point</b>.</p>
<ul><li>Hver bold er ét point, uanset hvem der server</li><li>Man server typisk 4 gange i træk og skifter så</li><li>Kampen slutter, når de to hold tilsammen har 24 point, fx 15‑9 eller 12‑12</li><li>Efter hver kamp skifter man makker</li></ul>
<p>Du samler dine egne point hele dagen. Den med flest point til sidst vinder dagen.</p>`,
  },
  {
    cat: 'Formater',
    q: 'Tæller Americano på ranglisten?',
    a: `<p>Ikke automatisk. Americano er ofte mere for sjov, så en admin bestemmer bagefter, om dagen skal med på den officielle rangliste.</p>
<p>Indtil da viser "Dagens stilling" med et ≈, cirka hvor mange point hver spiller ville få. Trykker admin på <b>Tilføj til officiel rangliste</b>, regnes alle kampe om til point. Det kan også fjernes igen.</p>`,
  },
  {
    cat: 'Formater',
    q: 'Hvad er klassisk?',
    a: `<p>Almindelig padel med sæt. Indtast hvor mange <b>sæt</b> hvert hold vandt, fx 2‑1. Der er ingen nedtælling, og admin starter næste runde, når kampene er færdige.</p>`,
  },
  {
    cat: 'Formater',
    q: 'Hvad betyder åben, mix, herre og dame?',
    a: `<ul><li><b>Åben:</b> alle spiller med alle</li><li><b>Mix:</b> hvert hold er så vidt muligt en mand og en kvinde</li><li><b>Herre / dame:</b> kun mænd eller kun kvinder kan tilmelde sig</li></ul>
<p>Er der ikke lige mange mænd og kvinder til mix, laver appen så mange mixhold som muligt.</p>`,
  },
  {
    cat: 'Hold og runder',
    q: 'Hvordan bliver holdene sat?',
    a: `<p>Appen sætter holdene automatisk og prøver i denne rækkefølge at:</p>
<ol><li>Undgå at du spiller med samme makker igen, både i dag og fra tidligere fredage</li><li>Give dig din favoritside (venstre eller højre)</li><li>Lave mixhold, hvis dagen er mix</li><li>Gøre holdene nogenlunde lige stærke</li><li>Undgå de samme modstandere</li></ol>
<p>Admin kan altid rette holdene bagefter.</p>`,
  },
  {
    cat: 'Hold og runder',
    q: 'Hvad betyder venstre og højre side?',
    a: `<p>I padel står man fast i enten venstre eller højre side. Vælg din favorit under profilen. Står du "Begge sider", kan du sættes ind hvor som helst. På kampkortet står <b>V</b> og <b>H</b> ved hver spiller.</p>`,
  },
  {
    cat: 'Hold og runder',
    q: 'Hvorfor holder jeg pause?',
    a: `<p>Er der flere tilmeldte, end der er plads til på banerne, må nogle sidde over. Appen fordeler pauserne, så det går på skift, og den der har holdt flest pauser, spiller først.</p>`,
  },
  {
    cat: 'Resultater',
    q: 'Hvordan indtaster jeg et resultat?',
    a: `<p>Tryk <b>Indtast resultat</b> på kampkortet. Én spiller fra kampen indtaster, og så skal en fra <b>modstanderholdet</b> trykke <b>Godkend</b>. Først når resultatet er godkendt, tæller det.</p>`,
  },
  {
    cat: 'Resultater',
    q: 'Hvad hvis resultatet er forkert?',
    a: `<p>Er det ikke godkendt endnu, kan modstanderne trykke <b>Afvis</b>, så skal det indtastes igen. Er det allerede godkendt, kan en admin rette det, og pointene bliver regnet om.</p>`,
  },
  {
    cat: 'Tilmelding og konto',
    q: 'Hvordan tilmelder jeg mig en fredag?',
    a: `<p>Gå til <b>Fredage</b>, åbn dagen og tryk <b>Tilmeld mig</b>. Du kan afmelde dig igen, indtil dagen er gået i gang. Derefter skal en admin gøre det.</p>`,
  },
  {
    cat: 'Tilmelding og konto',
    q: 'Hvordan inviterer jeg en ven?',
    a: `<p>Åbn en fredag og tryk <b>Del fredagen</b>. Din ven får et link, opretter en profil og lander direkte på den fredag, så de kan tilmelde sig.</p>`,
  },
  {
    cat: 'Tilmelding og konto',
    q: 'Hvordan får jeg appen på hjemmeskærmen?',
    a: `<p><b>iPhone:</b> åbn appen i Safari, tryk på del‑ikonet og vælg "Føj til hjemmeskærm".</p><p><b>Android:</b> åbn appen i Chrome, tryk på de tre prikker og vælg "Føj til startskærm".</p>`,
  },
  {
    cat: 'Tilmelding og konto',
    q: 'Jeg har glemt min adgangskode',
    a: `<p>Log ud, skriv din e‑mail på loginsiden og tryk <b>Glemt adgangskode?</b>. Du får en mail med et link til at vælge en ny.</p>`,
  },
  {
    cat: 'Tilmelding og konto',
    q: 'Hvad kan en admin?',
    a: `<p>En admin opretter fredage, starter runder, retter hold og resultater, tilmelder og afmelder spillere og bestemmer, om Americano skal tælle på ranglisten.</p>`,
  },
];
