# Padel-app – arbejdsregler

- Jimmy skriver dansk. Svar og alle tekster i appen på dansk. Skriv altid "bat", aldrig "ketsjer".
- **Nyt i appen:** Når der laves nye funktioner, når noget flyttes, eller når en større fejl rettes, skal der tilføjes et indslag øverst i `public/js/news.js` (id = dato, fx `2026-11-02`; `admin: true` for ting kun admins skal vide). Små justeringer skrives ikke.
- Opdater også Spørgsmål og svar (`public/js/faq-data.js`), når appen ændres.
- Supabase: sletninger (DELETE/DROP) og opdateringer uden WHERE bliver afvist. Brug statusfelter, `create or replace` og nye funktionsnavne (`_v2`).
- Test før push: `node tests/e2e.mjs` (og `W=320 node tests/e2e.mjs` for små telefoner). Push til `main` (Vercel deployer selv).
- **Nyt og på vej (køreplan):** Ligger i Supabase-tabellen `padel_roadmap_v2` (status `plan` = på tegnebrættet, `igang`, `bygget`; `hidden = true` = kun synlig for superadmin; `audience` alle/admin/klub/gruppe). Når Jimmy skriver en idé, lægges den ind som `plan` med `source = 'jimmy'` (synlig for alle, medmindre han siger, den er hemmelig eller kun for centre/admins). Når vi går i gang, sættes `igang`; når det er lagt ud, sættes `bygget` (og `done_at`), og der skrives et indslag i `news.js` som altid.
