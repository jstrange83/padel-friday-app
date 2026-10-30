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
    q: 'Er der én rangliste for alle grupper?',
    a: `<p>Ja. Alle har ét pointtal, som gælder i alle grupper, og kampe i alle grupper tæller med.</p>
<p>Gruppens admin vælger under <b>Admin</b>, om gruppens rangliste viser <b>alle spillere</b>, <b>kun gruppens spillere</b> eller <b>ingen rangliste</b>. Med "ingen" er ranglisten skjult i gruppen, men kampene giver stadig point.</p>`,
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
<p>Alle tilmeldte får en <b>notifikation</b>, når dagsplanen er lavet (og hvis den laves om), fx <i>"Du starter på Bane 2 med Dorthe mod Steen og Thomas"</i>.</p>
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
<ul><li>"seks to": første tal er <b>dit eget hold</b>, uanset om I står til venstre eller højre på kortet</li><li>"vi vandt seks to" eller "vi tabte to seks" virker også</li><li>"uafgjort fire"</li></ul>
<p>Når du skriver resultatet, står dit eget hold øverst. Tjek tallene, og tryk <b>Gem resultat</b>.</p>
<p>Resultatet bliver udfyldt, og du trykker <b>Gem</b>, når det ser rigtigt ud. Første gang skal du give appen lov til at bruge mikrofonen. Virker knappen ikke på din telefon, kan du bruge mikrofonen på tastaturet.</p>`,
  },
  {
    cat: 'Resultater',
    q: 'Hvad hvis resultatet er forkert?',
    a: `<p>Alle fire spillere i kampen kan trykke <b>Ret</b>. Ændringen skal så godkendes af en fra <b>modstanderholdet</b> (din makker kan ikke). Indtil da tæller kampen ikke, og afviser de ændringen, gælder det gamle resultat igen.</p>
<p>Admin og superbruger kan rette et resultat direkte, og pointene bliver regnet om med det samme.</p>`,
  },
  {
    cat: 'Tilmelding og konto', group: true,
    q: 'Hvordan tilmelder jeg mig en fredag?',
    a: `<p>Alle fredage er åbne for tilmelding. Gå til <b>Fredage</b>, åbn dagen og tryk <b>Tilmeld mig</b>. Du kan afmelde dig igen, indtil dagen er gået i gang. Derefter skal en admin gøre det.</p>`,
  },
  {
    cat: 'Tilmelding og konto', group: true,
    q: 'Hvorfor spørger appen, om jeg vil være med?',
    a: `<p>Er der ledige pladser på en spilledag inden for de næste 3 dage, og er du ikke tilmeldt, spørger appen, når du åbner den: <b>Der er 3 ledige pladser. Vil du være med?</b></p>
<p>Tryk <b>Meld mig til</b>, så er du med. Trykker du <b>Ikke denne gang</b>, spørger appen ikke igen om den dag, og det giver aldrig bøde.</p>`,
  },
  {
    cat: 'Tilmelding og konto', group: true,
    q: 'Hvorfor står jeg på venteliste?',
    a: `<p>Der spilles 4 på hver bane, og det er først til mølle. Hver gang der er 4 tilmeldte, er en bane klar. Er I fx 6, er 4 klar til bane 1, og 2 står på venteliste, indtil der kommer 2 mere.</p>
<p>Er alle dagens baner fyldt, kommer resten også på venteliste. Melder nogen fra, rykker ventelisten automatisk op. Du kan se dit nummer på ventelisten på fredagen.</p>`,
  },
  {
    cat: 'Tilmelding og konto', group: true,
    q: 'Hvordan inviterer jeg en ven?',
    a: `<p>Det er kun gruppens admin, der kan invitere. Spørg en admin, så sender de et link. Din ven opretter en profil (eller logger ind), og når admin har godkendt, kan de tilmelde sig.</p>`,
  },
  {
    cat: 'Tilmelding og konto', group: true,
    q: 'Hvad er grupper, og kan jeg være med i flere?',
    a: `<p>Hver gruppe, fx Fredagspadel og Lørdagspadel, har sine egne spilledage og spillere. Du ser kun de grupper, du er med i.</p>
<p>Du kan godt være med i flere grupper, hvis gruppens admin har godkendt dig. Har du flere grupper, skifter du mellem dem med knapperne øverst på Spilledage og Rangliste. Der er <b>én fælles rangliste</b>, så du har de samme point, uanset hvilken gruppe du spiller i.</p>`,
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
    cat: 'Tilmelding og konto', group: true,
    q: 'Hvad kan en superbruger og en admin?',
    a: `<p>Roller gælder pr. gruppe.</p>
<p><b>Superbruger</b> kan køre en spilledag: lave dagsplan, starte runder ved Rotation på tid, lave en runde om, rette hold og baner, til‑ og afmelde spillere, indtaste, godkende og rette resultater direkte og afslutte dagen.</p>
<p><b>Admin</b> kan det samme for sin gruppe og desuden oprette spilledage, ændre spiltype, invitere og godkende spillere, give roller, lægge Americano på ranglisten og styre bødekassen. Superbrugere kan også give bøder og godkende betalinger.</p>
<p><b>Superadmin</b> opretter grupper og vælger, hvilke centre hver gruppe må bruge. Under Admin → Grupper står gruppens admins øverst på kortet, og medlemmer og roller ligger foldet sammen under <b>Medlemmer og roller</b>. Nederst kan superadmin slette (arkivere) gruppen, så ingen kan bruge den længere; kampe og point gemmes, og gruppen kan hentes tilbage. Superadmin kan også slå <b>Redigeringstilstand</b> til under Admin og så rette og slette spilledage, kampe, bøder, takster, point og forslag direkte, hvor de står.</p>`,
  },
  {
    cat: 'Tilmelding og konto',
    q: 'Kan jeg ændre appens farver?',
    a: `<p>Ja, under <b>Profil → 🎨 Udseende</b>. Vælg fx Pink, Lyserød, Lys, Hav, Lilla eller Sort og guld. Det gælder kun for dig og følger med på alle dine telefoner.</p>`,
  },
  {
    cat: 'Tilmelding og konto',
    q: 'Kan jeg få notifikationer på telefonen?',
    a: `<p>Ja. Tryk på <b>🔔</b> på Spilledage (eller <b>Profil → Beskeder og notifikationer</b>) og slå <b>Notifikationer på denne enhed</b> til.</p>
<p>Du får fx besked, når du får en plads fra ventelisten. Admins får besked, når nogen vil være med i gruppen. Alle beskeder står også under 🔔 i appen.</p>
<p>På iPhone skal appen være lagt på hjemmeskærmen først (Del → Føj til hjemmeskærm), og så skal den åbnes derfra.</p>`,
  },
  {
    cat: 'Tilmelding og konto',
    q: 'Kan jeg slette min profil?',
    a: `<p>Ja, under <b>Profil → 🗑 Slet min profil</b>. Du forsvinder fra grupperne og ranglisten.</p>
<p>Dine kampe og point gemmes. Kommer du igen med samme mail (du logger bare ind) eller samme telefonnummer, får du de samme point, som da du gik. En admin skal godkende dig i gruppen igen.</p>
<p>Admin kan også slette en spiller. En gruppeadmin kan kun slette spillere, der ikke er med i andre grupper; ellers fjerner han dem fra sin egen gruppe.</p>`,
  },
  {
    cat: 'Tilmelding og konto', group: true,
    q: 'Hvordan ser admin, at nogen vil være med i gruppen?',
    a: `<p>Når en spiller har brugt invitationslinket, står der et rødt tal ved <b>Admin</b> i menuen, og øverst på <b>Spilledage</b> kommer kortet <b>✋ Vil gerne være med</b>. Tryk <b>Godkend</b> eller <b>Afvis</b> direkte der. Der sendes ingen mails.</p>`,
  },
  {
    cat: 'Tilmelding og konto',
    q: 'Hvor sender jeg et forslag til appen?',
    a: `<p>Under <b>Profil → 💡 Forslagskasse</b>. Skriv dit forslag og tryk <b>Send</b>. Kun den, der står for appen, kan læse det, og svaret kommer i appen (ikke på mail). Når der er et nyt svar, står der <b>Nyt svar</b> ved Forslagskasse.</p>
<p>Når du har spillet et vist antal kampe, spørger appen også én gang, om du har et forslag.</p>`,
  },
  {
    cat: 'Tilmelding og konto', group: true,
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
  {
    cat: 'Juniorklub', club: true,
    q: 'Hvad er en juniorklub i appen?',
    a: `<p>En juniorklub (fx Gribskov Padelklub Junior) er en særlig slags gruppe til børn og unge. I stedet for spilledage og rangliste har den <b>Træning</b>, <b>Opslag</b> fra trænerne, indmeldelse af børn og kontingent.</p>
<p>Forældre og juniorer kommer ikke på voksnes rangliste.</p>`,
  },
  {
    cat: 'Juniorklub', club: true,
    q: 'Hvordan melder jeg mit barn ind?',
    a: `<p>Åbn klubbens invitationslink (eller scan QR-koden fra træneren), opret dig som forælder, og udfyld barnets navn og fødselsår. Har du flere børn, trykker du <b>Tilføj et barn mere</b>.</p>
<p>En træner godkender indmeldelsen og sætter barnet på et hold. Du får besked i appen. Senere kan du melde flere børn ind under <b>Profil → Mine børn</b>.</p>`,
  },
  {
    cat: 'Juniorklub', club: true,
    q: 'Kan voksne også melde sig ind i en klub?',
    a: `<p>Ja, hvis klubben også er for voksne. Åbn klubbens link, opret dig, og vælg <b>Mig selv</b> på indmeldelsen. Navnet tages fra din profil, og du udfylder fødselsdato, køn, billeder og evt. hvad trænerne skal vide. I en klub for både børn og voksne kan du også vælge <b>Et barn</b> og melde dine børn ind samme sted.</p>
<p>En træner godkender dig og sætter dig på et hold. Bagefter svarer du selv <b>✓ Kommer</b> eller <b>Afbud</b> under Træning, ligesom forældre gør for deres børn. Dine oplysninger retter du under <b>Profil → Mit medlemskab</b>.</p>
<p>Klubbens admin vælger under <b>Admin → Medlemmer → Klubbens indstillinger</b>, om klubben er for børn, voksne eller begge dele.</p>`,
  },
  {
    cat: 'Juniorklub', club: true,
    q: 'Hvordan melder jeg mit barn til eller fra træning?',
    a: `<p>Under <b>Træning</b> står de næste træninger. Ingen er meldt til automatisk: tryk <b>✓ Kommer</b> eller <b>Afbud</b> ud for barnet ved hver træning. Har du ikke svaret, står der <b>Ikke svaret</b>, og træneren kan se det. Du kan altid skifte dit svar.</p>
<p>Har du ikke svaret på den næste træning, spørger appen, når du åbner den: <b>Kommer Frederik?</b> Tryk Kommer eller Afbud direkte i beskeden. Den spørger kun om dine egne børn og kun om den næste træning.</p>
<p>Aflyser træneren en træning, står den som aflyst, og du får en notifikation.</p>`,
  },
  {
    cat: 'Juniorklub', club: true,
    q: 'Kan mit barn få sit eget login? Og den anden forælder?',
    a: `<p>Ja. Under <b>Profil → Mine børn</b> trykker du på barnet:</p>
<ul><li><b>📱 Eget login</b> viser en QR-kode, som barnet scanner med sin telefon og opretter sig med. Så kan barnet selv se træninger og give afbud.</li>
<li><b>👪 Forælder 2</b> sender et link til den anden forælder, som så får samme adgang som dig.</li></ul>`,
  },
  {
    cat: 'Juniorklub', club: true,
    q: 'Hvordan betaler jeg kontingent?',
    a: `<p>Når klubben har sat kontingent op, står det øverst under <b>Træning</b>. Tryk <b>💳 MobilePay</b> for at betale til klubbens MobilePay Box, eller <b>Har betalt</b> hvis du har betalt på anden måde. Træneren bekræfter betalingen.</p>`,
  },
  {
    cat: 'Juniorklub', club: true,
    q: 'Jeg er træner. Hvad kan jeg?',
    a: `<p>Klubbens admin gør dig til <b>Træner</b> og sætter dig på dine hold under Admin → Hold og tider. Som træner kan du på dine egne hold:</p>
<ul><li>godkende nye børn og sætte dem på hold (Admin → Børn)</li>
<li>oprette nye hold og rette træningstider (Admin → Hold og tider). Opretter du et hold, bliver du selv træner på det</li>
<li>se hvem der kommer, krydse fremmøde af og aflyse en træning (Træning)</li>
<li>skrive opslag til hele klubben eller dine hold (Opslag)</li></ul>
<p>🚫📷 betyder, at barnet ikke må være på billeder, og ⚠️ at forældrene har skrevet noget, som er godt at vide om barnet (tryk på barnet for at læse det).</p>`,
  },
  {
    cat: 'Juniorklub', club: true,
    q: 'Hvem gør hvad i klubben?',
    a: `<ul><li><b>Admin</b> styrer klubbens indstillinger, kontingent, hold, trænere og kasserer og ser alle børn.</li>
<li><b>Træner</b> styrer sine egne hold.</li>
<li><b>Kasserer</b> ser og bekræfter kontingent, sender påmindelser og henter en liste til regnskabet (Admin → Kontingent).</li>
<li><b>Forældre</b> ser kun deres egne børn, giver afbud og retter barnets oplysninger under Profil → Mine børn.</li></ul>
<p>Admin registrerer også, hvornår der er indhentet børneattest på trænerne (Admin → Medlemmer → Trænere og kasserer). Læs mere om, hvad der gemmes, under Profil → Privatliv.</p>`,
  },
  {
    cat: 'Juniorklub', club: true,
    q: 'Kan jeg få træningerne i min kalender?',
    a: `<p>Ja. Tryk <b>📅 Få træningerne i din kalender</b> nederst under Træning (eller under Profil). Vælg iPhone/Outlook eller Google Kalender. Så kommer træningerne i telefonens kalender og opdateres selv, hvis en tid ændres eller en træning aflyses.</p>
<p>Linket er personligt. Har du delt det ved en fejl, kan du lave et nyt samme sted.</p>`,
  },
  {
    cat: 'Juniorklub', club: true,
    q: 'Får jeg en påmindelse før træning? Og hvad er afbudsfristen?',
    a: `<p>Hvis klubben har slået det til, får du en notifikation om eftermiddagen dagen før træning. Har du ikke svaret, bliver du bedt om at trykke Kommer eller Afbud. Har du givet afbud, får du ingen påmindelse.</p>
<p>Klubben kan sætte en <b>afbudsfrist</b>, fx 2 timer før. Du kan stadig give afbud efter fristen, men så får holdets trænere besked, og du kan skrive en kort grund.</p>`,
  },
  {
    cat: 'Juniorklub', club: true,
    q: 'Hvor ser jeg fremmøde?',
    a: `<p>Trænere ser under <b>Admin → Fremmøde</b>, hvor ofte hvert barn er kommet de sidste 4, 8 eller 16 uger. Det tæller de træninger, hvor fremmødet er krydset af under Træning. Børn med lavt fremmøde står øverst.</p>`,
  },
  {
    cat: 'Juniorklub', club: true,
    q: 'Hvordan virker arrangementer og forældrehjælp?',
    a: `<p>Trænerne kan oprette arrangementer, fx stævner, klubmesterskab eller sommerafslutning, med <b>➕ Arrangement</b> under Træning. De står mellem træningerne med 📅.</p>
<ul><li>Tryk <b>Tilmeld</b> ud for dit barn. Er der maks. antal, står der "Fuldt", når pladserne er brugt.</li>
<li>Koster det noget, kan du betale med MobilePay eller trykke "Har betalt". Træneren bekræfter.</li>
<li>Under <b>🙋 Forældrehjælp</b> kan du melde dig til fx kørsel eller kage. Alle kan se, hvem der hjælper.</li></ul>`,
  },
  {
    cat: 'Juniorklub', club: true,
    q: 'Hvad er venteliste og prøvetræning?',
    a: `<p>Admin kan sætte <b>maks. antal børn</b> på et hold. Er holdet fuldt, kan træneren sætte et nyt barn på <b>venteliste</b>. Forældrene får besked, og trænerne får besked, når der bliver plads.</p>
<p>Ved indmeldelse kan man krydse af, at barnet gerne vil <b>prøve 1-2 træninger</b> først. Træneren kan så give barnet prøvetræning. Barnet er med til træning og betaler ikke kontingent, indtil træneren melder det ind som medlem.</p>`,
  },
  {
    cat: 'Juniorklub', club: true,
    q: 'Hvordan sætter formanden bestyrelse og rettigheder op?',
    a: `<p>Klubbens admin (typisk formanden) går til <b>Admin → Medlemmer → Bestyrelse og rettigheder</b>. For hver person vælger man:</p>
<ul><li><b>Post i bestyrelsen</b>: formand, næstformand, kasserer, sekretær, bestyrelsesmedlem, suppleant eller revisor. Kasserer og revisor får automatisk kun adgang til kontingent.</li>
<li><b>Rettigheder</b>: 💳 kontingent, 📣 opslag til alle, 📅 arrangementer og ✅ godkende børn.</li></ul>
<p>Vælger man posten <b>Formand</b>, bliver personen automatisk klubbens admin med alle rettigheder. Admin har altid alle rettigheder, og trænere styrer deres egne hold. Alle i klubben kan se bestyrelse og trænere med telefonnummer under <b>Opslag → Bestyrelse og trænere</b>.</p>`,
  },
  {
    cat: 'Juniorklub', club: true,
    q: 'Hvordan skriver jeg til trænerne eller bestyrelsen?',
    a: `<p>Gå til <b>Profil → Skriv til klubben</b> (eller tryk <b>✉️ Skriv til trænerne</b> på Træning). Vælg om beskeden er til <b>trænerne</b>, <b>bestyrelsen</b>, <b>kassereren</b> eller <b>klubbens admin</b>, og hvilket barn det drejer sig om.</p>
<p>Svarene kommer samme sted, og du får en notifikation. Barnets anden forælder kan også læse med.</p>`,
  },
  {
    cat: 'Juniorklub', club: true,
    q: 'Hvorfor får jeg en besked om nye børn, når jeg åbner appen?',
    a: `<p>Er du træner, viser appen en lille besked, når du åbner den, hvis der er <b>nye børn, der venter på godkendelse</b>, eller <b>optagne børn, der mangler et hold</b>. Tryk <b>Tag stilling nu</b>, så kommer du direkte til Admin → Børn. Trykker du <b>Senere</b>, kommer beskeden igen næste gang, du åbner appen, indtil det er klaret. Admin får ikke beskeden, men ser tallet ved Admin i menuen.</p>`,
  },
  {
    cat: 'Juniorklub', club: true,
    q: 'Kan jeg oprette træninger med tale?',
    a: `<p>Ja. Under <b>Admin → Hold og tider</b> står <b>🎤 Ny træning med tale</b>. Tryk <b>Sig det</b> og sig fx <i>"Begyndere tirsdag fra 16 til 17.30 de næste 6 uger"</i>, eller skriv det i feltet og tryk <b>Udfyld</b>.</p>
<p>Appen udfylder hold, dag, tid, sted og datoer. Tjek det, og tryk <b>Opret træning</b>. Siger du et hold, der ikke findes, bliver det oprettet. Uden antal uger eller slutdato gentages træningen hver uge.</p>`,
  },
  {
    cat: 'Juniorklub', club: true,
    q: 'Hvordan kommer en ny træner eller et bestyrelsesmedlem med i klubben?',
    a: `<p>Send klubbens invitationslink (Admin → Medlemmer → Inviter). Personen opretter sig og trykker <b>🙋 Bed om adgang</b> nederst på siden, hvor man ellers melder et barn ind.</p>
<p>Klubbens admin får en besked og godkender under <b>Admin → Medlemmer → Venter på godkendelse</b>, enten som <b>Træner</b> eller <b>Medlem</b>. En post i bestyrelsen vælges bagefter under Bestyrelse og rettigheder.</p>`,
  },
  {
    cat: 'Juniorklub', club: true,
    q: 'Kan jeg se, hvem der har oprettet en træning eller et arrangement?',
    a: `<p>Ja, hvis du er klubbens admin. Under <b>Admin → Hold og tider</b> og på trænerens kort under Træning står der <b>Oprettet af</b> ved hver træningstid. Det samme står i arrangementerne. Er en træning aflyst, står der også, hvem der aflyste den.</p>
<p>Træningstider, der blev oprettet før denne funktion kom, viser ikke, hvem der har oprettet dem.</p>`,
  },
  {
    cat: 'Juniorklub', club: true,
    q: 'Kan en træner skrive privat til mit barn?',
    a: `<p>Nej. Et barn er aldrig alene i en samtale med en voksen i appen:</p>
<ul><li>Skriver barnet selv (med eget login), er barnets forældre automatisk med i samtalen.</li>
<li>Skriver en træner om et barn, går beskeden til forældrene. Har barnet eget login, kan barnet læse med, men kun sammen med forældrene.</li></ul>
<p>Det sikres i selve databasen, så det kan ikke slås fra.</p>`,
  },
  {
    cat: 'Juniorklub', club: true,
    q: 'Hvordan svarer jeg som træner eller bestyrelse på beskeder?',
    a: `<p>Beskeder til dig står under <b>Profil → Samtaler med medlemmer</b>, og du får en notifikation. Trænere får kun beskeder om børn på deres egne hold.</p>
<p>Når sagen er klaret, kan du trykke <b>✓ Løst</b>. Skriver nogen igen, åbner samtalen igen. Under <b>Admin → Børn</b> kan du også trykke <b>✉️ Skriv til forældrene</b> ud for et barn.</p>`,
  },
  {
    cat: 'Roller og adgang',
    q: 'Der står, at min e-mail allerede er brugt. Hvad gør jeg?',
    a: `<p>Så har du allerede en konto i appen med den e-mail. Tryk <b>Log ind</b> og brug den adgangskode, du har i forvejen. Bagefter udfylder du din profil her i appen.</p>
<p>Kan du ikke huske adgangskoden, så skriv din e-mail og tryk <b>Glemt adgangskode?</b>, så får du en mail med et link.</p>`,
  },
  {
    cat: 'Roller og adgang', group: true,
    q: 'Hvordan skriver jeg til gruppens admin?',
    a: `<p>Gå til <b>Profil → Skriv til admin</b>, og skriv din besked. Alle gruppens admins kan se den og svare. Svaret kommer samme sted, og du får en notifikation.</p>
<p>Beskederne kan kun læses af dem, der er med i samtalen.</p>`,
  },
  {
    cat: 'Roller og adgang',
    q: 'Jeg har oprettet mig, men står ikke i nogen gruppe. Hvad gør jeg?',
    a: `<p>Tryk på invitationslinket igen, mens du er logget ind. Så kommer du med i gruppen (eller kan melde dit barn ind i klubben). I en spillegruppe skal en admin måske godkende dig først.</p>
<p>Har du ikke linket, så bed gruppens admin eller klubbens træner om det.</p>`,
  },
  {
    cat: 'Roller og adgang',
    q: 'Kan jeg sende et billede i en samtale?',
    a: `<p>Ja. Tryk <b>📷 Billede</b> under beskeden eller svaret, og vælg et billede eller tag et med kameraet. Du kan skrive tekst til, eller bare sende billedet alene. Tryk på et billede i samtalen for at se det stort.</p>
<p>Billederne gøres mindre, før de sendes, og kan kun ses af dem, der er med i samtalen.</p>`,
  },
  {
    cat: 'Roller og adgang',
    q: 'Kan jeg se appen som almindelig bruger, selvom jeg er admin?',
    a: `<p>Ja. Under <b>Profil → Visning</b> kan du vælge <b>Bruger</b>, så ser du appen som en almindelig spiller. Superadmin kan også vælge <b>Mine roller</b>, så ser man kun de grupper og klubber, man selv er med i, med den rolle man har dér.</p>
<p>Så længe du ikke ser appen med alle dine rettigheder, står der en bjælke øverst med en knap, som skifter tilbage.</p>`,
  },
];
