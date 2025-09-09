import type { FineType, FineDraft, MatchRec, Player } from './types';

export const LS_FINE_TYPES = 'padel.fines.types.v1';
export const LS_FINE_DRAFTS = 'padel.fines.drafts.v1';

export function defaultFineTypes(): FineType[] {
  return [
    { code: 'no_show',    label: 'Udeblivelse',       amount: 100 },
    { code: 'late_cancel',label: 'Sen afbud (<24t)',  amount: 50  },
    { code: 'unsports',   label: 'Usportslig opførsel', amount: 75 },
  ];
}

export function calcOutstandingForPlayer(playerId: string, fines: FineDraft[], types: FineType[]) {
  const map = new Map(types.map(t => [t.code, t.amount]));
  let total = 0;
  for (const f of fines) {
    if (f.toPlayerId !== playerId) continue;
    if (f.status === 'approved') total += map.get(f.fineCode) ?? 0;
  }
  return total;
}

export function humanFineLabel(code: string, types: FineType[]) {
  const t = types.find(x => x.code === code);
  return t ? `${t.label} (${t.amount} kr)` : code;
}

export function buildFine(id: string, fromId: string, toId: string, matchId: string, fineCode: string, note?: string): FineDraft {
  return {
    id,
    fromPlayerId: fromId,
    toPlayerId: toId,
    matchId,
    fineCode,
    note,
    createdAt: new Date().toISOString(),
    status: 'pending'
  };
}

export function matchLabel(m: MatchRec) {
  return `${new Date(m.when).toLocaleString('da-DK')}: ${m.aNames.join(' & ')} vs ${m.bNames.join(' & ')} (${m.scoreA}–${m.scoreB})`;
}

export function playerName(players: Player[], id: string) {
  return players.find(p => p.id === id)?.name ?? id;
}
