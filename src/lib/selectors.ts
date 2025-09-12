// src/lib/selectors.ts
export type Player = { id: string; name: string; elo: number };
export type MatchRec = {
  id: string;
  when: string;               // ISO
  aNames: string[];
  bNames: string[];
  scoreA: number;
  scoreB: number;
  court?: string;
  isFriday?: boolean;
};

// Fines (valgfrit – hvis du allerede har disse filer/typer et andet sted, er det ok)
export type FineType = { code: string; label: string; amount: number };
export type FineDraft = {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  matchId: string;
  fineCode: string;
  note?: string;
  status: "pending" | "approved" | "rejected" | "paid";
  createdAt: string;          // ISO
  approvedAt?: string;        // ISO
  paidAt?: string;            // ISO
};

export const LS_PLAYERS    = "padel.players.v1";
export const LS_MATCHES    = "padel.matches.v1";
export const LS_FINE_TYPES = "padel.fine_types.v1";
export const LS_FINE_DRAFTS= "padel.fine_drafts.v1";

/** Base helpers */
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getPlayers(): Player[] {
  return load<Player[]>(LS_PLAYERS, []);
}
export function getMatches(): MatchRec[] {
  return load<MatchRec[]>(LS_MATCHES, []);
}
export function getFineTypes(): FineType[] {
  return load<FineType[]>(LS_FINE_TYPES, []);
}
export function getFineDrafts(): FineDraft[] {
  return load<FineDraft[]>(LS_FINE_DRAFTS, []);
}

/** ---- Bøder: total ubetalt beløb (approved men ikke paid) ---- */
export function getUnpaidFinesTotalDKK(): number {
  const types = getFineTypes();
  const typeMap = new Map(types.map(t => [t.code, t.amount] as const));
  const drafts = getFineDrafts();

  let sum = 0;
  for (const d of drafts) {
    if (d.status === "approved" && !d.paidAt) {
      sum += typeMap.get(d.fineCode) ?? 0;
    }
  }
  return sum;
}
export function getUnpaidFinesCount(): number {
  const drafts = getFineDrafts();
  return drafts.filter(d => d.status === "approved" && !d.paidAt).length;
}

/** ---- Mest aktive spillere (top N) baseret på antal sæt (kampe) ---- */
export type ActivityRow = { name: string; count: number };
export function getMostActive(topN = 3): ActivityRow[] {
  const ms = getMatches();
  const counts = new Map<string, number>();

  for (const m of ms) {
    for (const n of m.aNames) counts.set(n, (counts.get(n) ?? 0) + 1);
    for (const n of m.bNames) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  const rows = [...counts.entries()].map(([name, count]) => ({ name, count }));
  rows.sort((a,b)=> b.count - a.count);
  return rows.slice(0, topN);
}

/** ---- Aktuelle fredag-streaks (top N) ----
 * En spiller har en streak på X, hvis vedkommende har spillet fredag(e) i træk,
 * målt på kalenderfredage (7 dages mellemrum), og streaken slutter på spillerens seneste fredag.
 */
export type StreakRow = { name: string; streak: number };
export function getCurrentFridayStreaks(topN = 3): StreakRow[] {
  const ms = getMatches().filter(m => m.isFriday);
  // Byg map: playerName -> Set af datoer (yyyy-mm-dd) hvor spilleren har spillet en fredagskamp
  const perPlayer = new Map<string, Set<string>>();
  for (const m of ms) {
    const dateKey = toDateKey(m.when);
    for (const n of new Set([...m.aNames, ...m.bNames])) {
      if (!perPlayer.has(n)) perPlayer.set(n, new Set());
      perPlayer.get(n)!.add(dateKey);
    }
  }

  const out: StreakRow[] = [];
  for (const [name, days] of perPlayer.entries()) {
    if (days.size === 0) continue;
    const sorted = [...days].sort((a,b)=> (a<b?1:-1)); // nyeste først
    // count consecutive fridays ending at most recent one
    let streak = 1;
    let last = sorted[0];
    for (let i=1; i<sorted.length; i++) {
      const expectedPrev = shiftDateKey(last, -7);
      if (sorted[i] === expectedPrev) {
        streak++;
        last = sorted[i];
      } else {
        break; // kun den aktuelle (seneste) streak tæller
      }
    }
    out.push({ name, streak });
  }
  out.sort((a,b)=> b.streak - a.streak || a.name.localeCompare(b.name));
  return out.slice(0, topN);
}

/** ---- små dato helpers ---- */
function toDateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0,10);
}
function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y,m,d] = dateKey.split("-").map(n=>parseInt(n,10));
  const dt = new Date(Date.UTC(y, m-1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0,10);
}

/** Format DK */
export function formatDKK(v: number) {
  try {
    return v.toLocaleString("da-DK", { style: "currency", currency: "DKK" });
  } catch {
    return `${Math.round(v)} kr.`;
  }
}
