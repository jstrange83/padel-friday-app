// Privatlivspolitik: hvad appen gemmer, hvem der kan se det, og hvordan man får det slettet.
import { app, isClub } from '../core.js';

export function viewPrivacy() {
  app.innerHTML = `
  <div class="page privacy">
    <button class="back" onclick="history.length > 1 ? history.back() : (location.hash = '#/profil')">‹ Tilbage</button>
    <h1>Privatliv</h1>
    <p class="muted">Sådan bruger appen dine oplysninger. Senest opdateret 25. oktober 2026.</p>

    <div class="card"><h3>Hvem står for oplysningerne</h3>
      <p>Appen drives af Jimmy Strange. I en gruppe eller klub er det gruppens eller klubbens admin, der bestemmer, hvem der er med, og som bruger oplysningerne til at styre spilledage, hold og træning.</p>
      <p>Har du spørgsmål, så skriv i <a href="#/forslag">Forslagskassen</a> eller kontakt din gruppes admin.</p></div>

    <div class="card"><h3>Hvad gemmes om dig</h3>
      <ul>
        <li>Din e-mail og adgangskode til login (adgangskoden kan ingen se).</li>
        <li>Navn, telefonnummer, køn og foretrukken side på banen.</li>
        <li>De grupper og klubber, du er med i, og din rolle der.</li>
        <li>Tilmeldinger, kampe, resultater og point, og bøder, hvis gruppen bruger bødekassen.</li>
        <li>Forslag du sender, og beskeder appen sender til dig.</li>
        <li>Hvis du slår notifikationer til: en teknisk adresse til din telefon eller browser.</li>
      </ul></div>

    <div class="card ${isClub() ? 'pinned' : ''}"><h3>I en juniorklub: oplysninger om børn</h3>
      <p>Når en forælder melder et barn ind, gemmes:</p>
      <ul>
        <li>Barnets navn, fødselsdato og køn, og hvilket hold barnet er på.</li>
        <li>Om barnet må være på billeder fra klubben.</li>
        <li>"Vigtigt for træneren", hvis forælderen skriver noget. Det kan kun barnets egne trænere og forældrene se. Skriv kun det, træneren har brug for at vide.</li>
        <li>Adresse, hvis klubben har slået det til (fx til kommunens tilskud).</li>
        <li>Afbud, fremmøde og om kontingentet er betalt.</li>
        <li>Hvem der er barnets forældre i appen.</li>
      </ul>
      <p><b>Hvem kan se det:</b> barnets forældre (og barnet selv med eget login) ser kun deres eget barn. Klubbens trænere ser børnene på deres hold, klubbens admin ser alle børn i klubben, og kassereren ser navne, forældre og om der er betalt. Andre forældre kan ikke se dit barn.</p>
      <p>Trænere kan ikke skrive privat til et barn. Opslag går til hele holdet og forældrene.</p></div>

    <div class="card"><h3>Hvem kan se dine oplysninger</h3>
      <ul>
        <li>Navn og point kan ses af de andre i dine grupper. På den fælles rangliste kan andre spillere se dit navn og dine point, hvis gruppen viser ranglisten.</li>
        <li>Dit telefonnummer kan kun ses af dig selv og admins i dine grupper. I en klub kan forældre se trænernes telefonnummer.</li>
        <li>Appens superadmin kan se alt for at kunne hjælpe og rette fejl.</li>
      </ul></div>

    <div class="card"><h3>Hvor gemmes det</h3>
      <p>Oplysningerne gemmes hos Supabase på servere i EU (Stockholm), og appen ligger hos Vercel. Oplysningerne bliver ikke solgt eller givet videre til andre.</p></div>

    <div class="card"><h3>Ret og slet</h3>
      <ul>
        <li>Du kan selv rette dine oplysninger under Profil, og forældre kan rette deres barns oplysninger under Profil → Mine børn.</li>
        <li>Du kan slette din profil under Profil → Slet min profil. Dine kampe og point gemmes, så ranglisten passer, men du forsvinder fra grupperne.</li>
        <li>Et barn meldes ud under Profil → Mine børn. Vil du have barnets oplysninger helt slettet, så bed klubbens admin om det.</li>
        <li>Du har ret til at få at vide, hvad der er gemt om dig, og til at klage til Datatilsynet (datatilsynet.dk).</li>
      </ul></div>
  </div>`;
}
