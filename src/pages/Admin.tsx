// src/pages/Admin.tsx
import React, { useState } from "react";

const LS_PLAYERS = "padel.players.v1";
const LS_MATCHES = "padel.matches.v1";

type Player = { id: string; name: string; elo: number };

const demoPlayers: Player[] = [
  { id: "p-emma", name: "Emma Christensen", elo: 1040 },
  { id: "p-michael", name: "Michael Sørensen", elo: 1020 },
  { id: "p-julie", name: "Julie Rasmussen", elo: 1005 },
  { id: "p-lars", name: "Lars Petersen", elo: 1010 },
  { id: "p-thomas", name: "Thomas Nielsen", elo: 990 },
  { id: "p-anne", name: "Anne Møller", elo: 995 },
  { id: "p-mette", name: "Mette Hansen", elo: 1000 },
  { id: "p-alex", name: "Alex Hansen", elo: 980 },
  { id: "p-sara", name: "Sara Nielsen", elo: 985 },
  { id: "p-demo", name: "Demo Bruger", elo: 1000 },
  { id: "p-anders", name: "Anders Beck Jensen", elo: 1015 },
  { id: "p-bettina", name: "Bettina Linnemann", elo: 975 },
];

export default function Admin() {
  const [msg, setMsg] = useState<string>("");

  const write = (k: string, v: unknown) =>
    localStorage.setItem(k, JSON.stringify(v));

  const seedPlayers = () => {
    write(LS_PLAYERS, demoPlayers);
    // behold kampe hvis du vil – eller nulstil:
    if (!localStorage.getItem(LS_MATCHES)) write(LS_MATCHES, []);
    setMsg("Demo-spillere oprettet. Genindlæs/åbn Resultater – nu kan du vælge spillere.");
  };

  const wipeAll = () => {
    localStorage.removeItem(LS_PLAYERS);
    localStorage.removeItem(LS_MATCHES);
    setMsg("Alle data er ryddet.");
  };

  return (
    <div className="page">
      <div className="card" style={{ padding: 16 }}>
        <h2 style={{ margin: 0 }}>Admin</h2>
        <p className="muted" style={{ marginTop: 6 }}>
          Brug disse knapper hvis spillere mangler i select-felterne.
        </p>

        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <button className="btn primary" onClick={seedPlayers}>
            Gendan demo-spillere
          </button>
          <button className="btn outline" onClick={wipeAll}>
            Ryd alle data
          </button>
        </div>

        {msg && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 10,
              background: "#f1f5ff",
              color: "#1f2a56",
              border: "1px solid #dfe6ff",
            }}
          >
            {msg}
          </div>
        )}

        <style>{`
          .page .card { border:1px solid #e6e8ef; border-radius:14px; background:#fff; }
          .btn { height:36px; border-radius:10px; padding:0 14px; border:1px solid transparent; cursor:pointer; }
          .btn.primary { background:#2563eb; color:#fff; }
          .btn.outline { background:#fff; border-color:#d9dbe6; color:#111827; }
          .muted { color:#6b7280; }
        `}</style>
      </div>
    </div>
  );
}
