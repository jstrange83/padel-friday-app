// src/lib/playerStore.ts
export type Player = {
  id: string;
  name: string;
  elo: number;         // nuværende ELO
  initialElo?: number; // valgfri historik
  createdAt: string;
};

const LS_KEY = "pf.players";

function read(): Player[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Player[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(players: Player[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(players));
}

export function getPlayers(): Player[] {
  return read().sort((a, b) => a.name.localeCompare(b.name));
}

export function upsertPlayer(p: Omit<Player, "id" | "createdAt"> & { id?: string }) {
  const list = read();
  if (p.id) {
    const idx = list.findIndex(x => x.id === p.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...p };
      write(list);
      return list[idx];
    }
  }
  const created: Player = {
    id: crypto.randomUUID(),
    name: p.name,
    elo: p.elo,
    initialElo: p.initialElo ?? p.elo,
    createdAt: new Date().toISOString(),
  };
  list.push(created);
  write(list);
  return created;
}

export function removePlayer(id: string) {
  const list = read().filter(p => p.id !== id);
  write(list);
}

export function ensureSeedPlayers() {
  const existing = read();
  if (existing.length > 0) return;

  const seedNames = [
    "Emma Christensen",
    "Michael Sørensen",
    "Julie Rasmussen",
    "Lars Petersen",
    "Mette Hansen",
    "Anders Beck Jensen",
    "Bettina Linnemann",
    "Anne Louise von Ripperda",
    "Alex Hansen",
    "Demo Bruger"
  ];
  const baseElo = 1000;

  const seeded: Player[] = seedNames.map((name, i) => ({
    id: crypto.randomUUID(),
    name,
    elo: baseElo + (i % 5) * 20,       // lidt variation
    initialElo: baseElo,
    createdAt: new Date().toISOString(),
  }));

  write(seeded);
}
