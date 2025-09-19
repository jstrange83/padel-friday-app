// src/pages/Admin.tsx
import React from "react";
import { getPlayers, upsertPlayer, removePlayer, Player } from "../lib/playerStore";

export default function Admin() {
  const [players, setPlayers] = React.useState<Player[]>([]);
  const [name, setName] = React.useState("");
  const [elo, setElo] = React.useState(1000);

  const reload = () => setPlayers(getPlayers());
  React.useEffect(() => { reload(); }, []);

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    upsertPlayer({ name: trimmed, elo });
    setName("");
    setElo(1000);
    reload();
  };

  const del = (id: string) => {
    if (!confirm("Slet spiller?")) return;
    removePlayer(id);
    reload();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-3">Admin</h2>
        <p className="text-slate-600 mb-4">Tilføj eller slet spillere. Disse gemmes i browserens localStorage og bruges af alle sider.</p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[260px]">
            <label className="block text-sm text-slate-600 mb-1">Navn</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Spillers navn"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Start ELO</label>
            <input
              type="number"
              className="w-[140px] rounded-lg border border-slate-300 px-3 py-2"
              value={elo}
              onChange={(e) => setElo(Number(e.target.value))}
            />
          </div>
          <button
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            onClick={add}
          >
            Tilføj spiller
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold mb-3">Spillere ({players.length})</h3>
        <ul className="divide-y divide-slate-200">
          {players.map(p => (
            <li key={p.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-slate-600">ELO: {p.elo}</div>
              </div>
              <button
                className="rounded-lg border border-red-300 px-3 py-1 text-red-600 hover:bg-red-50"
                onClick={() => del(p.id)}
              >
                Slet
              </button>
            </li>
          ))}
          {players.length === 0 && <li className="py-2 text-slate-600">Ingen spillere endnu.</li>}
        </ul>
      </div>
    </div>
  );
}
