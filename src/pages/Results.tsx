// src/pages/Results.tsx
import React from "react";
import { getPlayers, Player } from "../lib/playerStore";

type Team = { a1?: string; a2?: string; b1?: string; b2?: string };
type SetScore = { a: number; b: number };
const SCORE_CHOICES = [0,1,2,3,4,5,6,7];

export default function Results() {
  const [players, setPlayers] = React.useState<Player[]>([]);
  const [date, setDate] = React.useState(() => new Date());
  const [team, setTeam] = React.useState<Team>({});
  const [score, setScore] = React.useState<SetScore>({ a: 0, b: 0 });

  React.useEffect(() => {
    setPlayers(getPlayers());
  }, []);

  const onSelect = (key: keyof Team) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setTeam(t => ({ ...t, [key]: e.target.value || undefined }));

  const selectEl = (value?: string, onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void) => (
    <select
      value={value ?? ""}
      onChange={onChange}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
    >
      <option value="">Vælg spiller…</option>
      {players.map(p => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Indtast resultater</h2>
          <input
            type="datetime-local"
            value={toLocal(date)}
            onChange={(e) => setDate(new Date(e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-4">
          {/* Hold A */}
          <div>
            <div className="font-medium mb-2">Hold A</div>
            <div className="space-y-2">
              {selectEl(team.a1, onSelect("a1"))}
              {selectEl(team.a2, onSelect("a2"))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {SCORE_CHOICES.map(n => (
                <button
                  key={n}
                  onClick={() => setScore(s => ({ ...s, a: n }))}
                  className={`h-10 w-10 rounded-full border ${
                    score.a === n ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 bg-white"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Hold B */}
          <div>
            <div className="font-medium mb-2">Hold B</div>
            <div className="space-y-2">
              {selectEl(team.b1, onSelect("b1"))}
              {selectEl(team.b2, onSelect("b2"))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {SCORE_CHOICES.map(n => (
                <button
                  key={n}
                  onClick={() => setScore(s => ({ ...s, b: n }))}
                  className={`h-10 w-10 rounded-full border ${
                    score.b === n ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 bg-white"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            className="rounded-lg bg-slate-100 px-4 py-2 hover:bg-slate-200"
            onClick={() => {
              // Her kunne man pushe sættet i en kladde-liste før indsending
              setTeam({});
              setScore({ a: 0, b: 0 });
            }}
          >
            + Tilføj sæt
          </button>
          <button
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            onClick={() => {
              // TODO: gem kamp/sæt og opdater ELO (kommer i næste trin i planen)
              alert("Resultat indsendt (demo). Dropdowns er nu drevet af playerStore).");
            }}
          >
            Indsend resultater
          </button>
        </div>

        <p className="text-slate-500 text-sm mt-2">
          Tip: Tilføj flere sæt før du indsender – de samles under samme kamp-dag.
        </p>
      </div>

      {/* simple placeholder sektioner */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold mb-2">Mine resultater</h3>
        <p className="text-slate-600">Ingen aktive spiller valgt (demo).</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold mb-2">Alle resultater</h3>
        <p className="text-slate-600">Der er endnu ikke registreret kampe.</p>
      </div>
    </div>
  );
}

function toLocal(d: Date) {
  // ISO uden sekunder for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
