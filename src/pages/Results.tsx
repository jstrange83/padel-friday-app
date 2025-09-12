// src/pages/Results.tsx
import React, { useMemo, useState } from "react";

/** ========== Types & LS helpers ========== */
type Player = { id: string; name: string; elo: number };

type SetDraft = {
  id: string;
  whenISO: string;   // ISO datetime for sættet
  a1?: string;       // playerId
  a2?: string;       // playerId
  b1?: string;       // playerId
  b2?: string;       // playerId
  scoreA: number;    // 0..7
  scoreB: number;    // 0..7
  court?: string;
  isFriday?: boolean;
};

type MatchRec = {
  id: string;
  when: string;               // ISO datetime
  aNames: string[];           // hold A navne
  bNames: string[];           // hold B navne
  scoreA: number;
  scoreB: number;
  court?: string;
  isFriday?: boolean;
};

const LS_PLAYERS = "padel.players.v1";
const LS_MATCHES = "padel.matches.v1";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function dateInputValueFromISO(iso: string) {
  const d = new Date(iso);
  const pad = (x: number) => x.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
function isoFromDateInputValue(v: string) {
  const d = new Date(v);
  return d.toISOString();
}
function fmtDateKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10); // yyyy-mm-dd
}

/** ========== Små UI helpers ========== */
function SectionCard(props: React.PropsWithChildren<{ title?: string; icon?: React.ReactNode }>) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        boxShadow: "0 6px 20px rgba(15, 23, 42, 0.06)",
        border: "1px solid rgba(2, 6, 23, 0.06)",
        padding: 18,
      }}
    >
      {props.title && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          {props.icon}
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{props.title}</h3>
        </div>
      )}
      {props.children}
    </div>
  );
}
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: "#334155",
        display: "block",
        marginBottom: 6,
      }}
    >
      {children}
    </label>
  );
}
function Select({
  value,
  onChange,
  children,
  placeholder,
}: {
  value?: string;
  onChange: (v?: string) => void;
  children: React.ReactNode;
  placeholder?: string;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #E5E7EB",
        background: "#fff",
        fontSize: 14,
      }}
    >
      <option value="">{placeholder ?? "Vælg spiller…"}</option>
      {children}
    </select>
  );
}
function pill(active: boolean) {
  return {
    width: 38,
    height: 38,
    borderRadius: "999px",
    border: active ? "2px solid #2563EB" : "1px solid #E5E7EB",
    background: active ? "#2563EB" : "#fff",
    color: active ? "#fff" : "#111827",
    fontWeight: 600,
    transition: "all .15s ease",
  } as React.CSSProperties;
}
function btn(kind: "primary" | "secondary" | "danger" | "ghost") {
  const base: React.CSSProperties = {
    height: 44,
    padding: "0 16px",
    borderRadius: 12,
    fontWeight: 700,
    border: "1px solid transparent",
  };
  if (kind === "primary")
    return { ...base, background: "#2563EB", color: "#fff", boxShadow: "0 8px 22px rgba(37,99,235,.25)" };
  if (kind === "secondary")
    return { ...base, background: "#F1F5FF", color: "#2563EB", border: "1px solid rgba(37,99,235,.25)" };
  if (kind === "danger")
    return { ...base, background: "#fff", color: "#EF4444", border: "1px solid #EF4444" };
  return { ...base, background: "transparent", border: "1px solid #E5E7EB" };
}

/** Scorevælger 0–7 (runde knapper) */
function ScorePicker({
  value,
  onChange,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  ariaLabel: string;
}) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }} aria-label={ariaLabel}>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} style={pill(n === value)}>
          {n}
        </button>
      ))}
    </div>
  );
}

/** ========== Oversigt (kort i kort) ========== */
function DayCard({ date, items }: { date: string; items: MatchRec[] }) {
  return (
    <div
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: 14,
        background: "#fff",
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span>📅</span>
        <div style={{ fontWeight: 700 }}>{date}</div>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {items.map((m) => {
          const aWon = m.scoreA > m.scoreB;
          const bWon = m.scoreB > m.scoreA;
          const diff = Math.abs(m.scoreA - m.scoreB);
          // lille visuel pointindikator (dummy)
          const delta = Math.max(-20, Math.min(20, diff * 2));
          const aDelta = aWon ? `+${delta}` : bWon ? `-${delta}` : "0";
          const bDelta = bWon ? `+${delta}` : aWon ? `-${delta}` : "0";

          return (
            <div
              key={m.id}
              style={{
                border: "1px solid #F1F5F9",
                borderRadius: 12,
                padding: "10px 12px",
                background: "#FAFAFA",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: 14, color: "#0F172A" }}>
                  <span style={{ fontWeight: 700 }}>{m.aNames.join(" & ")}</span>{" "}
                  <span style={{ color: "#64748B" }}>vs</span>{" "}
                  <span style={{ fontWeight: 700 }}>{m.bNames.join(" & ")}</span>
                  {m.court ? <span style={{ color: "#94A3B8" }}> — {m.court}</span> : null}
                </div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 15,
                    color: aWon ? "#16A34A" : bWon ? "#EF4444" : "#0F172A",
                  }}
                >
                  {m.scoreA}–{m.scoreB}
                </div>
              </div>

              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge label={`A: ${aDelta}`} tone={aWon ? "green" : bWon ? "red" : "gray"} />
                <Badge label={`B: ${bDelta}`} tone={bWon ? "green" : aWon ? "red" : "gray"} />
                {m.isFriday && <Badge label="fredag" tone="blue" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function Badge({ label, tone }: { label: string; tone: "green" | "red" | "blue" | "gray" }) {
  const tones: Record<string, { bg: string; fg: string; bd: string }> = {
    green: { bg: "rgba(16,185,129,.12)", fg: "#065F46", bd: "rgba(16,185,129,.35)" },
    red: { bg: "rgba(239,68,68,.12)", fg: "#7F1D1D", bd: "rgba(239,68,68,.35)" },
    blue: { bg: "rgba(37,99,235,.12)", fg: "#1E3A8A", bd: "rgba(37,99,235,.35)" },
    gray: { bg: "rgba(148,163,184,.15)", fg: "#334155", bd: "rgba(148,163,184,.35)" },
  };
  const t = tones[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.bd}`,
      }}
    >
      {label}
    </span>
  );
}

/** ========== Hovedkomponent ========== */
export default function Results() {
  const players = useMemo<Player[]>(
    () =>
      load<Player[]>(LS_PLAYERS, [
        // fallback demo spillere hvis LS er tomt
        { id: "p1", name: "Emma Christensen", elo: 1520 },
        { id: "p2", name: "Michael Sørensen", elo: 1480 },
        { id: "p3", name: "Julie Rasmussen", elo: 1390 },
        { id: "p4", name: "Lars Petersen", elo: 1500 },
      ]),
    []
  );

  const newSet = (): SetDraft => ({
    id: crypto.randomUUID(),
    whenISO: new Date().toISOString(),
    a1: undefined,
    a2: undefined,
    b1: undefined,
    b2: undefined,
    scoreA: 0,
    scoreB: 0,
    court: "Bane 1",
    isFriday: false,
  });

  const [sets, setSets] = useState<SetDraft[]>([newSet()]);
  const [successMsg, setSuccessMsg] = useState<string>("");

  const matches = useMemo<MatchRec[]>(
    () => load<MatchRec[]>(LS_MATCHES, []),
    []
  );
  const [_, forceRerender] = useState(0); // til at trigge visning efter gem

  const playerOptions = players.map((p) => (
    <option key={p.id} value={p.id}>
      {p.name}
    </option>
  ));
  const playerById = (id?: string) => players.find((p) => p.id === id)?.name || "";

  function updateSet(id: string, patch: Partial<SetDraft>) {
    setSets((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function addSet() {
    setSets((prev) => [...prev, newSet()]);
  }
  function removeSet(id: string) {
    setSets((prev) => prev.filter((s) => s.id !== id));
  }
  function validSet(s: SetDraft) {
    return !!(s.a1 && s.a2 && s.b1 && s.b2);
  }

  function submitAll() {
    if (sets.length === 0) return;
    for (const s of sets) {
      if (!validSet(s)) {
        alert("Udfyld venligst alle spillere for hvert sæt.");
        return;
      }
    }

    const existing = load<MatchRec[]>(LS_MATCHES, []);
    const now = Date.now();

    const newRecs: MatchRec[] = sets.map((s, i) => ({
      id: `${s.id}-${now}-${i}`,
      when: s.whenISO,
      aNames: [playerById(s.a1), playerById(s.a2)].filter(Boolean),
      bNames: [playerById(s.b1), playerById(s.b2)].filter(Boolean),
      scoreA: s.scoreA,
      scoreB: s.scoreB,
      court: s.court,
      isFriday: s.isFriday,
    }));

    const next = [...newRecs, ...existing]; // nyeste først
    save(LS_MATCHES, next);

    setSuccessMsg(
      sets.length === 1
        ? "Sættet er gemt. Du kan se det i oversigten herunder samt på Dashboard og Ranglisten."
        : `${sets.length} sæt er gemt. Du kan se dem i oversigten herunder samt på Dashboard og Ranglisten.`
    );

    setSets([newSet()]);
    // force visning til at opdatere (matches er memo-læst fra LS)
    forceRerender((x) => x + 1);
    setTimeout(() => setSuccessMsg(""), 4500);
  }

  /** ---- grupper til oversigten ---- */
  const allMatches = useMemo(() => load<MatchRec[]>(LS_MATCHES, []), [_, successMsg]);
  const myName = useMemo(() => {
    // bruger "me" hvis den findes, ellers første spiller
    const me = players.find((p) => p.id === "me");
    return me?.name || players[0]?.name || "";
  }, [players]);

  const groupsAll = useMemo(() => groupByDate(allMatches), [allMatches]);
  const groupsMine = useMemo(
    () =>
      groupByDate(allMatches.filter((m) => m.aNames.includes(myName) || m.bNames.includes(myName))),
    [allMatches, myName]
  );

  return (
    <div style={{ padding: 18, maxWidth: 980 }}>
      <h1 style={{ margin: "10px 0 18px", fontSize: 24 }}>Indtast resultater</h1>

      {/* Tidligere sæt i kladden (preview af alt undtagen sidste) */}
      {sets.length > 1 && (
        <SectionCard title="Tidligere sæt" icon={<span>🗂️</span>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sets.slice(0, -1).map((s, idx) => {
              const aNames = [playerById(s.a1), playerById(s.a2)].filter(Boolean).join(" & ");
              const bNames = [playerById(s.b1), playerById(s.b2)].filter(Boolean).join(" & ");
              const label = aNames && bNames ? `${aNames} vs ${bNames} — ${s.scoreA}-${s.scoreB}` : "Udfyldt sæt";
              const date = new Date(s.whenISO).toISOString().slice(0, 10);

              return (
                <div
                  key={s.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    alignItems: "center",
                    gap: 10,
                    border: "1px solid #E5E7EB",
                    padding: 12,
                    borderRadius: 12,
                    background: "#FAFAFA",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>Sæt #{idx + 1} • {date}</div>
                    <div style={{ color: "#374151" }}>{label}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSet(s.id)}
                    style={btn("danger")}
                    aria-label={`Fjern sæt #${idx + 1}`}
                  >
                    Fjern
                  </button>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Aktive sæt (sidste i listen) */}
      {sets.map((s, i) => {
        const isLast = i === sets.length - 1;
        return (
          <SectionCard key={s.id} title={`Sæt #${i + 1}`} icon={<span>🎾</span>}>
            <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              <input
                type="datetime-local"
                value={dateInputValueFromISO(s.whenISO)}
                onChange={(e) => updateSet(s.id, { whenISO: isoFromDateInputValue(e.target.value) })}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #E5E7EB",
                  background: "#fff",
                  fontSize: 14,
                }}
                aria-label="Dato og tid for sættet"
              />
              <Select
                value={s.court}
                onChange={(v) => updateSet(s.id, { court: v })}
                placeholder="Vælg bane…"
              >
                <option value="Bane 1">Bane 1</option>
                <option value="Bane 2">Bane 2</option>
                <option value="Bane 3">Bane 3</option>
                <option value="Bane 4">Bane 4</option>
              </Select>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={!!s.isFriday}
                  onChange={(e) => updateSet(s.id, { isFriday: e.target.checked })}
                />
                Fredagskamp
              </label>
            </div>

            {/* Hold A */}
            <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
              <FieldLabel>Hold A</FieldLabel>
              <Select value={s.a1} onChange={(v) => updateSet(s.id, { a1: v })} placeholder="Spiller A1">
                {playerOptions}
              </Select>
              <Select value={s.a2} onChange={(v) => updateSet(s.id, { a2: v })} placeholder="Spiller A2">
                {playerOptions}
              </Select>
              <FieldLabel>Score A</FieldLabel>
              <ScorePicker value={s.scoreA} onChange={(v) => updateSet(s.id, { scoreA: v })} ariaLabel="Score til Hold A"/>
            </div>

            {/* Hold B */}
            <div style={{ display: "grid", gap: 12 }}>
              <FieldLabel>Hold B</FieldLabel>
              <Select value={s.b1} onChange={(v) => updateSet(s.id, { b1: v })} placeholder="Spiller B1">
                {playerOptions}
              </Select>
              <Select value={s.b2} onChange={(v) => updateSet(s.id, { b2: v })} placeholder="Spiller B2">
                {playerOptions}
              </Select>
              <FieldLabel>Score B</FieldLabel>
              <ScorePicker value={s.scoreB} onChange={(v) => updateSet(s.id, { scoreB: v })} ariaLabel="Score til Hold B"/>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "space-between", flexWrap: "wrap" }}>
              <button type="button" onClick={addSet} style={btn("secondary")}>＋ Tilføj sæt</button>
              {isLast && (
                <button type="button" onClick={submitAll} style={btn("primary")}>
                  Indsend resultater
                </button>
              )}
            </div>
          </SectionCard>
        );
      })}

      {successMsg && (
        <div
          role="status"
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 12,
            background: "#ECFDF5",
            color: "#065F46",
            border: "1px solid #A7F3D0",
            fontWeight: 600,
          }}
        >
          ✅ {successMsg}
        </div>
      )}

      {/* ------- Oversigter: Mine / Alle ------- */}
      <div style={{ height: 14 }} />

      <SectionCard title="Mine resultater" icon={<span>👤</span>}>
        {groupsMine.length === 0 ? (
          <div style={{ padding: 10, background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 13 }}>
            Ingen kampe endnu for din profil.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {groupsMine.map(([date, items]) => (
              <DayCard key={date} date={date} items={items} />
            ))}
          </div>
        )}
      </SectionCard>

      <div style={{ height: 10 }} />

      <SectionCard title="Alle resultater" icon={<span>📋</span>}>
        {groupsAll.length === 0 ? (
          <div style={{ padding: 10, background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 13 }}>
            Der er endnu ikke registreret kampe.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {groupsAll.map(([date, items]) => (
              <DayCard key={date} date={date} items={items} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/** --- Gruppering pr. dato (yyyy-mm-dd) --- */
function groupByDate(ms: MatchRec[]): [string, MatchRec[]][] {
  const m = new Map<string, MatchRec[]>();
  for (const x of ms) {
    const key = fmtDateKey(x.when);
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(x);
  }
  const out: [string, MatchRec[]][] = [...m.entries()];
  out.sort((a, b) => (a[0] < b[0] ? 1 : -1)); // nyeste dato øverst
  for (const [, arr] of out) arr.sort((a, b) => (a.when < b.when ? 1 : -1));
  return out;
}
