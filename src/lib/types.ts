// Fælles typer
export type Player = { id: string; name: string; elo: number; email?: string; phone?: string; nickname?: string; gender?: 'Mand'|'Kvinde'|'Andet'; avatarUrl?: string };

export type GameTeam = Player[]; // 2 spillere
export type Game = { id: string; teams: [GameTeam, GameTeam] };

export type MatchRec = {
  id: string;
  when: string;                 // ISO
  aNames: string[];
  bNames: string[];
  scoreA: number;
  scoreB: number;
  points?: { id: string; name: string; value: number }[]; // ELO-ændring i kampen
};

export type FineType = { code: string; label: string; amount: number };

export type FineDraft = {
  id: string;
  fromPlayerId: string;  // den der indrapporterer
  toPlayerId: string;    // den der skal have bøden
  matchId: string;       // hvilken kamp
  fineCode: string;      // ref til FineType
  note?: string;
  createdAt: string;     // ISO
  status: 'pending'|'approved'|'rejected'|'paid';
  approvedAt?: string;
  paidAt?: string;
};
