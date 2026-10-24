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
<p>I 30‑minutters kampe, ét sæt pr. runde og Americano tæller det også, <b>hvor meget</b> I vandt med. Vinder I kun 8‑7 over et svagere hold, kan I faktisk miste et par point, fordi I klarede jer dårligere end forventet.</p>`,
  },
  {
    cat: 'Point og rangliste',
    q: 'Hvordan tæller resultatet i de forskellige formater?',
    a: `<ul><li><b>Rotation (30 min):</b> andelen af vundne partier tæller. 9‑3 tæller som 75 %, 8‑8 er uafgjort.</li>
<li><b>Ét sæt pr. runde:</b> andelen af partier i sættet tæller. 6‑4 tæller som 60 %, 6‑0 som 100 %.</li>
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
    q: 'Hvad er "Ét sæt pr. runde"?',
    a: `<p>I spiller <b>ét sæt</b> (først til 6 partier, 7‑5 eller 7‑6 ved tiebreak), og når sættet er færdigt, skifter alle makker og modstandere. Et hold kan højst få 7. Løber I tør for tid, indtaster I bare stillingen, fx 4‑4 eller 3‑1.</p>
<p>Indtast antal partier hvert hold vandt i sættet, fx 6‑4. Jo større sejren er, jo flere point giver den på ranglisten.</p>
<p>Der er ingen nedtælling, og ingen skal starte runderne. Når jeres sæt er færdigt, trykker I på jeres kamp og taster resultatet. Så går I videre til jeres næste kamp, selv om de andre baner ikke er færdige endnu.</p>`,
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
    a: `<p>Almindelig padel med sæt. Indtast hvor mange <b>sæt</b> hvert hold vandt, fx 2‑1. Der er ingen nedtælling. Hver bane taster selv sit resultat, når kampen er færdig, og går videre til næste kamp.</p>`,
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
<p>Spillere på samme niveau kommer i samme kamp, og <b>de stærkeste spiller på den bedste bane</b> (fx Center Court i Helsinge og Bane 1 i Gilleleje), derefter nedad.</p>
<p>Admin kan altid rette holdene bagefter.</p>`,
  },
  {
    cat: 'Hold og runder',
    q: 'Hvad betyder venstre og højre side?',
    a: `<p>I padel står man fast i enten venstre eller højre side. Vælg din favorit under profilen. Står du "Begge sider", kan du sættes ind hvor som helst. På kampkortet står <b>V</b> og <b>H</b> ved hver spiller.</p>`,
  },
  {
    cat: 'Hold og runder',
    q: 'Hvad er dagsplanen?',
    a: `<p>Når spillerne er tilmeldt, kan admin eller en superbruger trykke <b>Lav dagsplan</b>. Så lægger appen alle dagens runder ud på forhånd med hold, baner, pauser og cirka‑tider.</p>
<p>Et sæt tager ca. 20 minutter, så 2 timer giver 6 runder. En 30‑minutters rotation giver 4. Du kan altså se hele aftenen, inden I går på banen.</p>
<p>Ingen skal starte runderne (undtagen ved Rotation på tid, hvor der er fælles nedtælling). Tryk på jeres kamp og tast resultatet, når I er færdige. Kortet <b>Din næste kamp</b> øverst viser runde, bane, tid og holdene, og du taster eller siger resultatet direkte i kortet. Runderne vælges med knapperne <b>1–6</b>; spillede runder får et ✓, og en prik viser, hvor du selv spiller.</p>
<p>Melder nogen til eller fra, kan dagsplanen laves om, og runder der allerede er påbegyndt, bliver ikke rørt.</p>`,
  },
  {
    cat: 'Hold og runder',
    q: 'Hvorfor holder jeg pause?',
    a: `<p>Er der flere tilmeldte, end der er plads til på banerne, må nogle sidde over. Appen fordeler pauserne, så det går på skift, og den der har holdt flest pauser, spiller først.</p>`,
  },
  {
    cat: 'Resultater',
    q: 'Hvordan indtaster jeg et resultat?',
    a: `<p>Tryk <b>Indtast resultat</b> på kampkortet. Alle fire spillere i kampen kan indtaste, og resultatet tæller med det samme. Skal det rettes bagefter, skal rettelsen godkendes af en fra <b>modstanderholdet</b>.</p>`,
  },
  {
    cat: 'Resultater',
    q: 'Kan jeg sige resultatet i stedet for at skrive det?',
    a: `<p>Ja. Tryk <b>🎤 Sig resultat</b> på kampkortet og sig fx:</p>
<ul><li>"seks fire" eller "otte otte": første tal er holdet til venstre på kortet</li><li>"vi vandt ni tre" eller "vi tabte fire seks": så ved appen selv, hvilket hold der er jeres</li><li>"uafgjort tolv"</li></ul>
<p>Resultatet bliver udfyldt, og du trykker <b>Gem</b>, når det ser rigtigt ud. Første gang skal du give appen lov til at bruge mikrofonen. Virker knappen ikke på din telefon, kan du bruge mikrofonen på tastaturet.</p>`,
  },
  {
    cat: 'Resultater',
    q: 'Hvad hvis resultatet er forkert?',
    a: `<p>Alle fire spillere i kampen kan trykke <b>Ret</b>. Ændringen skal så godkendes af en fra <b>modstanderholdet</b> (din makker kan ikke). Indtil da tæller kampen ikke, og afviser de ændringen, gælder det gamle resultat igen.</p>
<p>Admin og superbruger kan rette et resultat direkte, og pointene bliver regnet om med det samme.</p>`,
  },
  {
    cat: 'Tilmelding og konto',
    q: 'Hvordan tilmelder jeg mig en fredag?',
    a: `<p>Alle fredage er åbne for tilmelding. Gå til <b>Fredage</b>, åbn dagen og tryk <b>Tilmeld mig</b>. Du kan afmelde dig igen, indtil dagen er gået i gang. Derefter skal en admin gøre det.</p>`,
  },
  {
    cat: 'Tilmelding og konto',
    q: 'Hvorfor står jeg på venteliste?',
    a: `<p>Der spilles 4 på hver bane, og det er først til mølle. Hver gang der er 4 tilmeldte, er en bane klar. Er I fx 6, er 4 klar til bane 1, og 2 står på venteliste, indtil der kommer 2 mere.</p>
<p>Er alle dagens baner fyldt, kommer resten også på venteliste. Melder nogen fra, rykker ventelisten automatisk op. Du kan se dit nummer på ventelisten på fredagen.</p>`,
  },
  {
    cat: 'Tilmelding og konto',
    q: 'Hvordan inviterer jeg en ven?',
    a: `<p>Det er kun gruppens admin, der kan invitere. Spørg en admin, så sender de et link. Din ven opretter en profil (eller logger ind), og når admin har godkendt, kan de tilmelde sig.</p>`,
  },
  {
    cat: 'Tilmelding og konto',
    q: 'Hvad er grupper, og kan jeg være med i flere?',
    a: `<p>Hver gruppe, fx Fredagspadel og Lørdagspadel, har sine egne spilledage, spillere og sin egen rangliste. Du ser kun de grupper, du er med i.</p>
<p>Du kan godt være med i flere grupper, hvis gruppens admin har godkendt dig. Har du flere grupper, skifter du mellem dem med knapperne øverst på Spilledage og Rangliste. Dine point er separate i hver gruppe.</p>`,
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
    q: 'Hvad kan en superbruger og en admin?',
    a: `<p>Roller gælder pr. gruppe.</p>
<p><b>Superbruger</b> kan køre en spilledag: lave dagsplan, starte runder ved Rotation på tid, lave en runde om, rette hold og baner, til‑ og afmelde spillere, indtaste, godkende og rette resultater direkte og afslutte dagen.</p>
<p><b>Admin</b> kan det samme for sin gruppe og desuden oprette spilledage, ændre spiltype, invitere og godkende spillere, give roller, lægge Americano på ranglisten og styre bødekassen. Superbrugere kan også give bøder og godkende betalinger.</p>
<p><b>Superadmin</b> opretter grupper, vælger hvilke centre hver gruppe må bruge, og kan se den fælles rangliste på tværs af grupper.</p>`,
  },
  {
    cat: 'Tilmelding og konto',
    q: 'Kan admin oprette en spiller, der ikke selv har oprettet sig?',
    a: `<p>Ja. Under <b>Admin → Spillere</b> kan gruppens admin trykke <b>Opret spiller</b> og skrive navn, telefonnummer, køn og side. Spilleren er med i gruppen med det samme, kan tilmeldes spilledage, sættes på hold og få point. Der står "Uden login" ved navnet.</p>
<p>Når spilleren senere selv opretter sig med <b>samme telefonnummer</b>, overtager de profilen med alle kampe, point, grupper og bøder.</p>`,
  },
  {
    cat: 'Bødekasse',
    q: 'Hvad er bødekassen?',
    a: `<p>Hver gruppe kan have sin egen bødekasse. Gruppens admin bestemmer, om den er slået til (under <b>Admin</b>), og slår de takster til, gruppen bruger, fx for sent fremmøde eller afbud på dagen.</p>
<p>Har gruppen en MobilePay Box, finder admin linket i MobilePay ved at åbne boksen og trykke <b>Del boks</b>. Linket sættes ind under <b>Bøder → Indstillinger</b>.</p>
<p>Når den er slået til, kan alle i gruppen se bøderne under <b>💸 Bøder</b> i menuen. Admin og superbrugere giver bøderne, enten i bødekassen eller med <b>💸 Giv en bøde</b> nederst på spilledagen.</p>
<p>Får du en bøde, vises den næste gang du åbner appen.</p>`,
  },
  {
    cat: 'Bødekasse',
    q: 'Får jeg automatisk en bøde, hvis jeg melder fra?',
    a: `<p>Ja, hvis gruppen har en takst, der er sat til <b>automatisk</b>. Som standard koster det <b>Afbud efter tilmelding</b>, når du melder fra, og <b>Afbud på dagen</b>, hvis du melder fra samme dag. Appen skriver beløbet, før du bekræfter afmeldingen.</p>
<p>Der kommer ingen bøde, hvis du står på venteliste, eller hvis du melder fra inden for 15 minutter efter, du meldte dig til (fx hvis du trykkede forkert). Admin kan altid annullere en bøde.</p>`,
  },
  {
    cat: 'Bødekasse',
    q: 'Hvordan betaler jeg en bøde?',
    a: `<p>Under <b>Bøder</b> kan du se <b>Dit udestående</b>. Har admin lagt et link til gruppens <b>MobilePay Box</b> ind, trykker du <b>Betal i MobilePay Box</b>, så åbner boksen, og du skriver beløbet. Har admin i stedet skrevet et mobilnummer, åbner knappen MobilePay med nummer og beløb udfyldt. Når du trykker på MobilePay-knappen, bliver dine bøder automatisk meldt betalt og står som <b>Afventer</b>, til en admin har set pengene. Virker knappen ikke på din telefon, så tryk <b>Kopiér nummer</b>, betal i MobilePay selv, og tryk derefter <b>Jeg har betalt</b>.</p>`,
  },
  {
    cat: 'Bødekasse',
    q: 'Kan en bøde fjernes igen?',
    a: `<p>Ja. Admin og superbrugere kan annullere en bøde, der er givet ved en fejl. Har nogen trykket "Jeg har betalt" uden at betale, eller er en bøde markeret som betalt ved en fejl, kan den sættes tilbage til ubetalt med <b>Fortryd betalt</b>.</p>
<p>Bøder har intet med dine point på ranglisten at gøre.</p>`,
  },

  // ---------- Padelregler (efter FIP's officielle regler, skrevet kort) ----------
  {
    cat: 'Padelregler',
    q: 'Hvordan skal man serve?',
    a: `<ul><li>Stå med fødderne bag servelinjen i din egen halvdel af banen (mellem midterlinjen og sidevæggen). Du må ikke træde på linjerne</li>
<li>Lad bolden hoppe én gang på jorden i dit servefelt, og slå den, mens den er i <b>hoftehøjde eller lavere</b></li>
<li>Mindst én fod skal røre jorden, når du rammer bolden</li>
<li>Server <b>diagonalt</b> over nettet. Første bold i et parti serveres fra højre side</li>
<li>Du har to forsøg. Fejler begge, mister I bolden</li></ul>`,
  },
  {
    cat: 'Padelregler',
    q: 'Må man løbe eller hoppe, når man server?',
    a: `<p>Nej. Du skal stå bag servelinjen og blive der, indtil du har ramt bolden, og mindst én fod skal røre jorden i slaget. Du må altså hverken tage tilløb, hoppe eller træde ind over linjen.</p>`,
  },
  {
    cat: 'Padelregler',
    q: 'Hvornår er en serv fejl?',
    a: `<ul><li>Bolden lander uden for modstanderens servefelt (rammer den linjen, er den god)</li>
<li>Bolden lander i feltet, men rammer så <b>hegnet/metalnettet</b>, før den hopper anden gang</li>
<li>Du slår over hoftehøjde, træder på linjen eller rammer slet ikke bolden</li>
<li>Bolden rammer dig selv eller din makker</li></ul>
<p>Rammer bolden <b>glasset</b> efter at have landet i feltet, er serven god.</p>`,
  },
  {
    cat: 'Padelregler',
    q: 'Serven rammer nettet. Hvad nu?',
    a: `<p>Rammer serven nettet og lander i det rigtige felt (uden at ramme hegnet bagefter), er det en <b>net‑bold</b>, og serven tages om. Det gælder også, hvis den rammer en modspiller efter nettet. En net‑bold tæller ikke som et forsøg.</p>`,
  },
  {
    cat: 'Padelregler',
    q: 'Må man tage serven på flugt?',
    a: `<p>Nej. Modtageren skal lade serven hoppe i sit felt og slå den, før den hopper anden gang. Rammer serven modtageren eller battet, før den hopper, vinder serveholdet bolden.</p>`,
  },
  {
    cat: 'Padelregler',
    q: 'Var bolden ude eller inde?',
    a: `<p>I padel er der stort set kun linjer ved serven. Under en bold gælder:</p>
<ul><li>Dit slag skal <b>hoppe på jorden i modstandernes halvdel</b>, før det rammer deres glas eller hegn. Rammer det glasset eller hegnet direkte, er bolden ude, og I taber den</li>
<li>Når bolden har hoppet på deres side, må den gerne ramme glas og hegn bagefter. Så er det et godt slag</li>
<li>Går bolden ud over glasset eller ud af banen efter at have hoppet på jeres side, mister I bolden</li>
<li>Lander bolden præcis i hjørnet mellem gulv og glas, er den god</li></ul>
<p><b>God skik</b> (ikke en officiel regel): uden dommer afgør hvert par de bolde, der lander på deres egen side. Er I i tvivl, så tag bolden om.</p>`,
  },
  {
    cat: 'Padelregler',
    q: 'Må man røre nettet?',
    a: `<p>Nej. Rører du eller dit bat nettet, stolperne eller modstandernes banehalvdel, mens bolden er i spil, taber I bolden. Det gælder også tøj og ting, du har på. Du må heller ikke hoppe over nettet.</p>`,
  },
  {
    cat: 'Padelregler',
    q: 'Må man slå bolden, før den er kommet over nettet?',
    a: `<p>Nej. Du må gerne tage bolden på flugt (før den hopper), men først når den er kommet over nettet til din side. Rækker du ind over nettet og slår den på modstandernes side, taber I bolden.</p>`,
  },
  {
    cat: 'Padelregler',
    q: 'Hvad med glasset og hegnet på min egen side?',
    a: `<ul><li>Når bolden har hoppet på din side, må du gerne lade den ramme dit glas eller hegn og spille den bagefter, så længe den ikke hopper på gulvet igen</li>
<li>Du må også slå bolden ind i dit <b>eget glas</b>, så den derfra går over nettet. Den skal så hoppe i modstandernes halvdel som normalt</li>
<li>Rammer dit slag dit eget <b>hegn</b> (metalnettet) på vej over, taber I bolden</li></ul>`,
  },
  {
    cat: 'Padelregler',
    q: 'Bolden rammer en spiller. Hvem får bolden?',
    a: `<ul><li>Rammer modstandernes slag dig eller din makker (andet end battet), taber I bolden, også selvom du stod uden for banen</li>
<li>Rammer dit eget slag dig selv eller din makker, taber I bolden</li>
<li>Rammer dit slag en modspiller, vinder I bolden</li></ul>`,
  },
  {
    cat: 'Padelregler',
    q: 'Hvornår taber man bolden? (oversigt)',
    a: `<ul><li>Bolden hopper to gange på jeres side</li><li>Dit slag rammer modstandernes glas eller hegn uden at hoppe først</li>
<li>Dit slag rammer nettet og bliver på jeres side</li><li>Du rører nettet eller modstandernes banehalvdel</li>
<li>Du slår bolden to gange, eller både du og din makker rammer den</li><li>Bolden rammer dig eller din makker</li>
<li>Du kaster battet efter bolden eller taber den</li></ul>`,
  },
  {
    cat: 'Padelregler',
    q: 'Må man spille bolden uden for banen?',
    a: `<p>Kun på baner, hvor der er sikkerhedszone udenfor, og centret tillader det. Så må du løbe ud gennem døren og slå bolden tilbage, så længe den ikke har hoppet to gange eller ramt noget uden for banen. Er det ikke tilladt i jeres center, er bolden død, når den forlader banen.</p>`,
  },
  {
    cat: 'Padelregler',
    q: 'Bolden hopper tilbage over nettet (backspin). Må modstanderen tage den?',
    a: `<p>Ja. Hopper bolden i modstandernes halvdel og ruller eller hopper tilbage til jeres side, må de gerne slå den, men de må ikke røre nettet eller jeres banehalvdel. Når du har slået et godt slag, der går tilbage over nettet, har du vundet bolden, hvis de ikke når den.</p>`,
  },
  {
    cat: 'Padelregler',
    q: 'Hvordan tæller man point, parti og sæt?',
    a: `<ul><li><b>Point:</b> 15, 30, 40, parti. Ved 40‑40 (lige) skal man vinde to bolde i træk</li>
<li><b>Gyldent point:</b> mange spiller i stedet én afgørende bold ved 40‑40. Modtagerne vælger, hvem af dem der tager serven</li>
<li><b>Sæt:</b> først til 6 partier med 2 i forskel. Ved 5‑5 spilles til 7‑5, ved 6‑6 en tiebreak</li>
<li><b>Kamp:</b> bedst af tre sæt</li></ul>`,
  },
  {
    cat: 'Padelregler',
    q: 'Hvordan spiller man tiebreak?',
    a: `<ul><li>Man tæller 1, 2, 3 … og først til 7 med 2 i forskel vinder sættet 7‑6</li>
<li>Den, der står for tur, server én bold fra højre. Derefter server modstanderne to bolde (første fra venstre), og så skiftes man med to serv hver</li>
<li>Man skifter side for hver 6 point</li></ul>`,
  },
  {
    cat: 'Padelregler',
    q: 'Hvornår skifter man side?',
    a: `<p>Efter 1. parti, 3. parti og derefter efter hvert ulige parti (5., 7. …). I en tiebreak skifter man for hver 6 point.</p>`,
  },
  {
    cat: 'Padelregler',
    q: 'Hvornår tager man bolden om?',
    a: `<ul><li>Bolden går i stykker under spillet</li><li>En bold eller ting fra en anden bane ruller ind og forstyrrer</li>
<li>Noget uventet afbryder spillet, som ikke skyldes spillerne</li><li>Serven var en net‑bold</li></ul>
<p>Sig det med det samme. Spiller I videre, er retten til at tage bolden om væk.</p>`,
  },
  {
    cat: 'Padelregler',
    q: 'Hvor kommer reglerne fra?',
    a: `<p>Svarene bygger på det internationale padelforbund FIP's officielle regler, skrevet kort og i vores egne ord. Er I i tvivl om noget særligt, så tjek <a class="link" href="https://www.padelfip.com/wp-content/uploads/2025/12/FIP_Rules-of-Padel.pdf" target="_blank" rel="noopener">FIP's regler (PDF)</a>. Spørgsmål om at spille uden for banen afhænger også af jeres center.</p>`,
  },
];
