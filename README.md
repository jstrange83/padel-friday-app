# Fredagspadel

Padelapp til fredagspadel: rangliste med Elo, tilmelding, automatisk holdsætning (side, makkerhistorik, mix, Elo), timer og resultater.

- **Frontend:** statiske filer i `public/` (vanilla JS-moduler + supabase-js). Ingen build.
  - `js/app.js` opstart og navigation · `js/core.js` fælles hjælpere · `js/views/*` én fil pr. skærm
  - `js/pairing.js` holdsætning · `js/lineup.js` baner/venteliste · `js/voice.js` sig resultatet · `js/viewas.js` admin "se som"
- **Test:** `node tests/e2e.mjs` klikker hele forløbet igennem i en browser mod en lokal mock-database (`tests/mock-supabase.js`).
- **Database:** Supabase (lige nu i TaskHero-projektet, alle tabeller og funktioner har præfikset `padel_`).
- **Hosting:** Vercel. Hver ændring på `main` udgives automatisk.

## Elo
Holdets styrke = gennemsnit af de to spillere, K = 32, start 1000.
Rotation på tid: resultat = andel vundne partier (9-3 = 0,75, 8-8 = 0,5). Klassisk: sejr/uafgjort/nederlag.
