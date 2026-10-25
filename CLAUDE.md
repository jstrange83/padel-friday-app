# Padel-app – arbejdsregler

- Jimmy skriver dansk. Svar og alle tekster i appen på dansk. Skriv altid "bat", aldrig "ketsjer".
- **Nyt i appen:** Når der laves nye funktioner, når noget flyttes, eller når en større fejl rettes, skal der tilføjes et indslag øverst i `public/js/news.js` (id = dato, fx `2026-11-02`; `admin: true` for ting kun admins skal vide). Små justeringer skrives ikke.
- Opdater også Spørgsmål og svar (`public/js/faq-data.js`), når appen ændres.
- Supabase: sletninger (DELETE/DROP) og opdateringer uden WHERE bliver afvist. Brug statusfelter, `create or replace` og nye funktionsnavne (`_v2`).
- Test før push: `node tests/e2e.mjs` (og `W=320 node tests/e2e.mjs` for små telefoner). Push til `main` (Vercel deployer selv).
