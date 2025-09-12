// src/pages/Admin.tsx
import React from "react";

type Player = {
  id: string;
  name: string;
  initials: string;
  elo: number;
};

const DEMO_PLAYERS: Player[] = [
  { id: "p1", name: "Emma Christensen", initials: "EC", elo: 1020 },
  { id: "p2", name: "Michael Sørensen", initials: "MS", elo: 1010 },
  { id: "p3", name: "Julie Rasmussen", initials: "JR", elo: 1000 },
  { id: "p4", name: "Lars Petersen", initials: "LP", elo: 995 },
  { id: "p5", name: "Demo Bruger", initials: "DB", elo: 980 },
];

function save<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}
function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function Admin() {
  const [players, setPlayers] = React.useState<Player[]>(
    load<Player[]>("players", [])
  );
  const [notice, setNotice] = React.useState<string>("");

  const seedDemoPlayers = () => {
    save("players", DEMO_PLAYERS);
    // clear any demo matches/results to avoid confusion
    localStorage.removeItem("matches");
    localStorage.removeItem("sets");
    setPlayers(DEMO_PLAYERS);
    setNotice("Demo-spillere gendannet.");
  };

  const resetAll = () => {
    localStorage.clear();
    setPlayers([]);
    setNotice("Al lokal data er nulstillet.");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Admin</h2>
        <p className="text-slate-600 mt-1">
          Brug disse værktøjer til at nulstille data eller gendanne demo-spillere.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={seedDemoPlayers}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Gendan demo-spillere
          </button>
          <button
            onClick={resetAll}
            className="rounded-lg bg-rose-600 px-4 py-2 text-white hover:bg-rose-700"
          >
            Nulstil ALT (localStorage)
          </button>
        </div>

        {notice && (
          <div className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-emerald-700">
            {notice}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-medium mb-3">Aktuelle spillere</h3>
        {players.length === 0 ? (
          <p className="text-slate-500">Ingen spillere i systemet.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {players.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-slate-200 p-3 flex items-center gap-3"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-semibold">
                  {p.initials}
                </span>
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-slate-500">ELO: {p.elo}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
