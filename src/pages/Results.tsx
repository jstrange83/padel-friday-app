import React, { useEffect, useMemo, useState } from "react";

/** LocalStorage-keys (samme som resten af appen) */
const LS_PLAYERS = "padel.players.v1";
const LS_MATCHES = "padel.matches.v1";
const CURRENT_PLAYER_ID = "me";

/** Typer */
type Player = { id: string; name: string; elo: number; avatarUrl?: string };
type MatchPoints = { id: string; name: string; value: number };
type MatchRec = {
  id: string;
  when: string;            // ISO
  aNames: string[];
  bNames: string[];
  scoreA: number;
  scoreB: number;
  court?: string;
  isFriday?: boolean;
  points?: MatchPoints[];  // ELO-point pr. spiller
};

/* ---------------- UI helpers ---------------- */

function SectionCard({
  title,
  children,
  icon,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 16,
        boxShadow: "0 2px 10px rgba(16,24,40,.06)",
        padding: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>{icon ?? "📋"}</span>
        <span style={{ fontSize: 16 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Pill({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 34,
        height: 34,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
        marginBottom: 8,
        fontWeight: 600,
        border: active ? "2px solid #2563EB" : "1px solid #E5E7EB",
        background: active ? "#EFF6FF" : "#fff",
        color: active ? "#1D4ED8" : "#111827",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "good" | "bad" | "neutral";
  children: React.ReactNode;
}) {
  const styles: Record<string, React.CSSProperties> = {
    good: { background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0" },
    bad: { background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" },
    neutral: { background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB" },
  };
  return (
    <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 600, ...styles[tone] }}>
      {children}
    </span>
  );
}

function SubCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #E5E7EB", background: "#F9FAFB", borderRadius: 12, padding: 12 }}>
      {children}
    </div>
  );
}

/* ---------------- Resultatside ---------------- */

export default function ResultsPage() {
  const [players] = useState<Player[]>(() => {
    try {
      const raw = localStorage.getItem(LS_PLAYERS);
      return raw ? (JSON.parse(raw) as Player[]) : [];
    } catch {
      return [];
    }
  });

  const [matches, setMatches] = useState<MatchRec[]>(() => {
    try {
      const raw = localStorage.getItem(LS_MATCHES);
      return raw ? (JSON.parse(raw) as MatchRec[]) : [];
    } catch {
      return [];
    }
  });

  /* -------- Formular (indtast resultat) -------- */
  const [a1, setA1] = useState<string>("");
  const [a2, setA2] = useState<string>("");
  const [b1, setB1] = useState<string>("");
  const [b2, setB2] = useState<string>("");   // korrekt generisk syntaks
  const [scoreA, setScoreA] = useState<number>(0);
  const [scoreB, setScoreB] = useState<number>(0);
  const [when, setWhen] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16); // yyyy-mm-ddThh:mm
  });
  const [court, setCourt] = useState<string>("Bane 1");
  const [isFriday, setIsFriday] = useState<boolean>(false);
  const [savedMsg, setSavedMsg] = useState<string>("");

  useEffect(() => {
    if (players.length >= 4) {
      setA1(players[0].id);
      setA2(players[1].id);
      setB1(players[2].id);
      setB2(players[3].id);
    }
  }, [players]);

  function playerName(id: string) {
    return players.find((p) => p.id === id)?.name ?? "Ukendt";
  }

  function saveMatch() {
    if (!a1 || !a2 || !b1 || !b2) {
      alert("Vælg alle 4 spillere");
      return;
    }
    if (scoreA === scoreB) {
      alert("Uafgjort er ikke tilladt – vælg en vinder.");
      return;
    }

    const rec: MatchRec = {
      id: `m_${Date.now()}`,
      when: new Date(when).toISOString(),
      aNames: [playerName(a1), playerName(a2)],
      bNames: [playerName(b1), playerName(b2)],
      scoreA,
      scoreB,
      court,
      isFriday,
    };

    setMatches((prev) => {
      const nxt = [rec, ...prev];
      try {
        localStorage.setItem(LS_MATCHES, JSON.stringify(nxt));
      } catch {}
      return nxt;
    });

    setSavedMsg("Resultat gemt ✅ — se det herunder, på Dashboard og Ranglisten.");
    setTimeout(() => setSavedMsg(""), 4000);
    setScoreA(0);
    setScoreB(0);
  }

  /* -------- Lister (mine / alle) -------- */
  const me = players.find((p) => p.id === CURRENT_PLAYER_ID);
  const myName = me?.name;

  const groupedAll = useMemo(() => groupByDate(matches), [matches]);
  const groupedMine = useMemo(() => {
    if (!myName) return [];
    const mine = matches.filter((m) => [...m.aNames, ...m.bNames].includes(myName));
    return groupByDate(mine);
  }, [matches, myName]);

  return (
    <div style={{ padding: 16, display: "grid", gap: 16 }}>
      {/* Formular */}
      <SectionCard title="Indtast resultat" icon="📝">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Hold A</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <select value={a1} onChange={(e) => setA1(e.target.value)} style={selectStyle}>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select value={a2} onChange={(e) => setA2(e.target.value)} style={selectStyle}>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: "#6B7280" }}>Score til Hold A</div>
            <div style={{ marginTop: 6 }}>
              {[0,1,2,3,4,5,6,7].map((n) => (
                <Pill key={n} active={scoreA===n} onClick={() => setScoreA(n)}>{n}</Pill>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Hold B</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <select value={b1} onChange={(e) => setB1(e.target.value)} style={selectStyle}>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select value={b2} onChange={(e) => setB2(e.target.value)} style={selectStyle}>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: "#6B7280" }}>Score til Hold B</div>
            <div style={{ marginTop: 6 }}>
              {[0,1,2,3,4,5,6,7].map((n) => (
                <Pill key={n} active={scoreB===n} onClick={() => setScoreB(n)}>{n}</Pill>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="datetime-local" value={when} onChange={(e)=>setWhen(e.target.value)} style={inputStyle}/>
            <input type="text" value={court} onChange={(e)=>setCourt(e.target.value)} placeholder="Bane" style={inputStyle}/>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={isFriday} onChange={(e)=>setIsFriday(e.target.checked)} />
              <span>Dette var en fredagskamp</span>
            </label>
            <button
              onClick={saveMatch}
              style={{ padding: "10px 14px", borderRadius: 12, background: "#2563EB", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer" }}
            >
              Gem resultat
            </button>
          </div>
        </div>

        {savedMsg && (
          <div style={{ marginTop: 12, border: "1px dashed #BFDBFE", background: "#EFF6FF", color: "#1D4ED8", padding: 10, borderRadius: 10 }}>
            {savedMsg}
          </div>
        )}
      </SectionCard>

      {/* Mine resultater */}
      <SectionCard title="Mine resultater" icon="🙋">
        {groupedMine.length === 0 ? <EmptyState text="Ingen kampe endnu for din profil." /> : <DateGroups groups={groupedMine} myName={myName} />}
      </SectionCard>

      {/* Alle resultater */}
      <SectionCard title="Alle resultater" icon="📅">
        {groupedAll.length === 0 ? <EmptyState text="Der er endnu ikke registreret kampe." /> : <DateGroups groups={groupedAll} />}
      </SectionCard>
    </div>
  );
}

/* ---------------- Lister ---------------- */

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ border: "1px dashed #E5E7EB", borderRadius: 12, padding: 16, color: "#6B7280", background: "#F9FAFB" }}>
      {text}
    </div>
  );
}

function DateGroups({ groups, myName }: { groups: { date: string; items: MatchRec[] }[]; myName?: string }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {groups.map((g) => (
        <SubCard key={g.date}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>📆</span>
            <div style={{ fontWeight: 700 }}>{formatDateHuman(g.date)}</div>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {g.items.map((m) => <MatchRow key={m.id} m={m} myName={myName} />)}
          </div>
        </SubCard>
      ))}
    </div>
  );
}

function MatchRow({ m, myName }: { m: MatchRec; myName?: string }) {
  const winnerA = m.scoreA > m.scoreB;
  const court = m.court ? ` · ${m.court}` : "";
  const time = new Date(m.when).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });

  const allPoints = m.points ?? [];
  const pointsMap = new Map(allPoints.map((p) => [p.name, p.value]));

  const playerChip = (name: string) => {
    const v = pointsMap.get(name);
    const tone: "good" | "bad" | "neutral" =
      typeof v === "number" ? (v > 0 ? "good" : v < 0 ? "bad" : "neutral") : "neutral";
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 28, height: 28, borderRadius: 999,
            background: "#EEF2FF", color: "#3730A3",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700,
          }}
          title={name}
        >
          {initials(name)}
        </span>
        <span style={{ fontWeight: name === myName ? 800 : 600 }}>{name}</span>
        {typeof v === "number" && <Badge tone={tone}>{withSign(v)}</Badge>}
      </span>
    );
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#6B7280", fontSize: 12, marginBottom: 6 }}>
        <span>{time}</span>
        <span>·</span>
        <span>{m.isFriday ? "Fredagspadel" : "Træningskamp"}{court}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10 }}>
        <div style={{ display: "grid", gap: 6 }}>
          {playerChip(m.aNames[0])}
          {playerChip(m.aNames[1])}
        </div>

        <div style={{ textAlign: "center", minWidth: 80 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>
            {m.scoreA} — {m.scoreB}
          </div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>
            {winnerA ? "Sejr til Hold A" : "Sejr til Hold B"}
          </div>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          {playerChip(m.bNames[0])}
          {playerChip(m.bNames[1])}
        </div>
      </div>
    </div>
  );
}

/* ---------------- utils ---------------- */

function groupByDate(items: MatchRec[]) {
  const by: Record<string, MatchRec[]> = {};
  for (const m of items) {
    const d = m.when?.slice(0, 10) ?? "ukendt";
    (by[d] ??= []).push(m);
  }
  return Object.entries(by)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, arr]) => ({ date, items: arr.sort((a, b) => (a.when < b.when ? 1 : -1)) }));
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "").toUpperCase() + (parts[parts.length - 1]?.[0] ?? "").toUpperCase();
}
function withSign(v: number) {
  if (v > 0) return `+${trim0(v)}`;
  if (v < 0) return `${trim0(v)}`;
  return "0";
}
function trim0(n: number) {
  const s = n.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}
function formatDateHuman(yyyy_mm_dd: string) {
  try {
    const d = new Date(yyyy_mm_dd + "T00:00:00");
    return d.toLocaleDateString("da-DK", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  } catch {
    return yyyy_mm_dd;
  }
}

/* Små input-styles (inline, så du ikke skal røre CSS-filer) */
const inputStyle: React.CSSProperties = {
  height: 38,
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #E5E7EB",
  background: "#fff",
};
const selectStyle: React.CSSProperties = { ...inputStyle, minWidth: 0 };
