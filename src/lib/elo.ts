// src/lib/elo.ts
// Individuel ELO for doublekampe (sæt). Højere ELO => mindre udsving.

export type PlayerRating = { id: string; elo: number };

export type SetInput = {
  a1: string; a2: string; b1: string; b2: string;
  scoreA: number; // 0..7
  scoreB: number; // 0..7
  whenISO?: string; // optional
};

export type PerPlayerDelta = { id: string; before: number; after: number; delta: number };
export type SetOutcome = {
  ids: { a1: string; a2: string; b1: string; b2: string };
  scoreA: number;
  scoreB: number;
  expectedA: number;   // hold A's forventede score (0..1)
  teamDeltaA: number;  // samlet delta for hold A (A1 + A2)
  teamDeltaB: number;  // samlet delta for hold B (B1 + B2)
  perPlayer: PerPlayerDelta[];
};

// --- helpers ---------------------------------------------------------------

function expectedScore(rA: number, rB: number) {
  // Klassisk ELO forventning
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

// K-faktor afhænger af spillerens niveau.
// Lavere rating -> større K (flere point i bevægelse).
function kForPlayer(r: number) {
  if (r >= 2100) return 12;
  if (r >= 1900) return 16;
  if (r >= 1700) return 20;
  if (r >= 1500) return 24;
  return 28;
}

// Fordeling mellem makkere:
// Den bedst ratede får MINDRE andel af holdets delta.
function shareForPlayers(r1: number, r2: number) {
  const s1 = r2 / (r1 + r2);
  const s2 = r1 / (r1 + r2);
  return [s1, s2] as const;
}

// Konverter sæt-resultat (fx 6-4) til match-score: 1, 0 eller 0.5
function resultToS(scoreA: number, scoreB: number) {
  if (scoreA > scoreB) return 1;
  if (scoreA < scoreB) return 0;
  return 0.5;
}

// Margin-boost (lille ekstra faktor for klare sejre)
function marginFactor(a: number, b: number) {
  const d = Math.abs(a - b); // 0..7
  if (d <= 1) return 1;
  if (d === 2) return 1.05;
  if (d === 3) return 1.10;
  return 1.15;
}

// --- kernefunktion ---------------------------------------------------------

/**
 * Opdaterer ELO for ét sæt (double).
 * @param ratings  map: playerId -> current elo
 * @returns outcome + nyt elo-map
 */
export function updateEloDoublesIndividual(
  ratings: Record<string, number>,
  set: SetInput
): { newRatings: Record<string, number>; outcome: SetOutcome } {

  const { a1, a2, b1, b2, scoreA, scoreB } = set;

  const rA1 = ratings[a1] ?? 1500;
  const rA2 = ratings[a2] ?? 1500;
  const rB1 = ratings[b1] ?? 1500;
  const rB2 = ratings[b2] ?? 1500;

  // Holdstyrke = gennemsnit
  const rA = (rA1 + rA2) / 2;
  const rB = (rB1 + rB2) / 2;

  const EA = expectedScore(rA, rB);
  const S = resultToS(scoreA, scoreB);
  const mf = marginFactor(scoreA, scoreB);

  // Individuelle K'er
  const kA1 = kForPlayer(rA1);
  const kA2 = kForPlayer(rA2);
  const kB1 = kForPlayer(rB1);
  const kB2 = kForPlayer(rB2);

  // Del holddelta ud – bedste spiller får mindst andel
  const [shaA1, shaA2] = shareForPlayers(rA1, rA2);
  const [shbB1, shbB2] = shareForPlayers(rB1, rB2);

  // Holddelta (til reference/visning)
  const kTeamA = (kA1 + kA2) / 2;
  const kTeamB = (kB1 + kB2) / 2;
  const teamDeltaA = mf * kTeamA * (S - EA);
  const teamDeltaB = -teamDeltaA; // antisymmetri

  // Individuelle deltaværdier – bruger egen K og delingsfaktor
  const dA1 = mf * kA1 * (S - EA) * shaA1;
  const dA2 = mf * kA2 * (S - EA) * shaA2;
  const dB1 = mf * kB1 * ((1 - S) - (1 - EA)) * shbB1; // = -mf*kB1*(S - EA)*shbB1
  const dB2 = mf * kB2 * ((1 - S) - (1 - EA)) * shbB2;

  const afterA1 = rA1 + dA1;
  const afterA2 = rA2 + dA2;
  const afterB1 = rB1 + dB1;
  const afterB2 = rB2 + dB2;

  const newRatings: Record<string, number> = {
    ...ratings,
    [a1]: afterA1,
    [a2]: afterA2,
    [b1]: afterB1,
    [b2]: afterB2,
  };

  const outcome: SetOutcome = {
    ids: { a1, a2, b1, b2 },
    scoreA,
    scoreB,
    expectedA: EA,
    teamDeltaA,
    teamDeltaB,
    perPlayer: [
      { id: a1, before: rA1, after: afterA1, delta: dA1 },
      { id: a2, before: rA2, after: afterA2, delta: dA2 },
      { id: b1, before: rB1, after: afterB1, delta: dB1 },
      { id: b2, before: rB2, after: afterB2, delta: dB2 },
    ],
  };

  return { newRatings, outcome };
}

/**
 * Kører en hel række sæt i rækkefølge og returnerer:
 * - samlede nye ratings
 * - alle delresultater pr. sæt
 * - summeret delta pr. spiller (til “+/- point”)
 */
export function applySets(
  startRatings: Record<string, number>,
  sets: SetInput[]
): {
  ratings: Record<string, number>;
  outcomes: SetOutcome[];
  totalDelta: Record<string, number>;
} {
  let map = { ...startRatings };
  const outcomes: SetOutcome[] = [];
  const totalDelta: Record<string, number> = {};

  for (const s of sets) {
    const r = updateEloDoublesIndividual(map, s);
    map = r.newRatings;
    outcomes.push(r.outcome);
    for (const p of r.outcome.perPlayer) {
      totalDelta[p.id] = (totalDelta[p.id] ?? 0) + p.delta;
    }
  }
  return { ratings: map, outcomes, totalDelta };
}
