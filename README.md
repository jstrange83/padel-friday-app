# Fredagspadel

Padelapp til fredagspadel: rangliste med Elo, tilmelding, automatisk holdsætning (side, makkerhistorik, mix, Elo), timer og resultater.

- **Frontend:** statiske filer i `public/` (vanilla JS + supabase-js). Ingen build.
- **Database:** Supabase (lige nu i TaskHero-projektet, alle tabeller og funktioner har præfikset `padel_`).
- **Hosting:** Vercel. Hver ændring på `main` udgives automatisk.

## Elo
Holdets styrke = gennemsnit af de to spillere, K = 32, start 1000.
Rotation på tid: resultat = andel vundne partier (9-3 = 0,75, 8-8 = 0,5). Klassisk: sejr/uafgjort/nederlag.
