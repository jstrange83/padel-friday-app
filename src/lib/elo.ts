// src/lib/elo.ts
export type Rating = { id: string; elo: number };

/**
 * Simpel ELO for double (1 sæt, 0–7).
 * - Team-rating = gennemsnit af spillernes ELO
 * - K = 24
 * - Margin-bonus: +0..+8 ved større sejr (diff 1..7)
 * - Underdog-bonus: vinder får +10% hvis deres team-rating < modstandernes
 */
export function updateEloDoubles(
  a1: Rating, a2: Rating,
  b1: Rating, b2: Rating,
  scoreA: number, scoreB: number
): Record<string, number> {
  const avgA = (a1.elo + a2.elo) / 2;
  const avgB = (b1.elo + b2.elo) / 2;
  const k = 24;

  const expectedA = 1 / (1 + Math.pow(10, (avgB - avgA) / 400));
  const expectedB = 1 - expectedA;

  const winnerA = scoreA > scoreB;
  const S_A = winnerA ? 1 : 0;
  const S_B = 1 - S_A;

  // Margin bonus (max +8)
  const margin = Math.max(0, Math.min(7, Math.abs(scoreA - scoreB)));
  const marginBonus = Math.round((margin / 7) * 8); // 0..8

  // Underdog (10% ekstra hvis team er svagere)
  const underdogMult = (winnerA ? avgA < avgB : avgB < avgA) ? 1.1 : 1.0;

  const deltaA = Math.round(underdogMult * ((k + marginBonus) * (S_A - expectedA)));
  const deltaB = -deltaA; // symmetrisk

  return {
    [a1.id]: a1.elo + deltaA,
    [a2.id]: a2.elo + deltaA,
    [b1.id]: b1.elo + deltaB,
    [b2.id]: b2.elo + deltaB,
  };
}
