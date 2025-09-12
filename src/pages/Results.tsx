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
};

type MatchRec = {
  id: string;
  when: string;               // ISO datetime
  aNames: string[];           // hold A navne
  bNames: string[];           // hold B navne
  scoreA: number;
  scoreB: number;
  points?: { id: string; name: string; value: number }[]; // (placeholder – kan udfyldes senere)
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
      {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => {
        const active = n === value;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            style={{
              width: 38,
              height: 38,
              borderRadius: "999px",
              border: active ? "2px solid #2563EB" : "1px solid #E5E7EB",
              background: active ? "#2563EB" : "#fff",
              color: active ? "#fff" : "#111827",
              fontWeight: 600,
              boxShadow: active ? "0 6px 20px rgba(37,99,235,.25)" : "none",
              transition: "all .15s ease",
            }}
            aria-pressed={active}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function dateInputValueFromISO(iso: string) {
  // return yyyy-MM-ddThh:mm (input type="datetime-local")
  const d = new Date(iso);
  const pad = (x: number) => x.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function isoFromDateInputValue(v: string) {
  // assume local time → to ISO with timezone offset applied
  const d = new Date(v);
  return d.toISOString();
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
  });

  const [sets, setSets] = useState<SetDraft[]>([newSet()]);
  const [successMsg, setSuccessMsg] = useState<string>("");

  const playerOptions = players.map((p) => (
    <option key={p.id} value={p.id}>
      {p.name}
    </option>
  ));

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
    // Valider
    if (sets.length === 0) return;
    for (const s of sets) {
      if (!validSet(s)) {
        alert("Udfyld venligst alle spillere for hvert sæt.");
        return;
      }
    }

    const matches = load<MatchRec[]>(LS_MATCHES, []);
    const now = Date.now();

    const asMatchRecs: MatchRec[] = sets.map((s, i) => {
      const aNames = [s.a1, s.a2]
        .map((id) => players.find((p) => p.id === id)?.name || "")
        .filter(Boolean);
      const bNames = [s.b1, s.b2]
        .map((id) => players.find((p) => p.id === id)?.name || "")
        .filter(Boolean);

      return {
        id: `${s.id}-${now}-${i}`,
        when: s.whenISO,
        aNames,
        bNames,
        scoreA: s.scoreA,
        scoreB: s.scoreB,
      };
    });

    const next = [...asMatchRecs, ...matches]; // nyeste først
    save(LS_MATCHES, next);

    setSuccessMsg(
      sets.length === 1
        ? "Sættet er gemt. Du kan se det på Dashboard og Ranglisten."
        : `${sets.length} sæt er gemt. Du kan se dem på Dashboard og Ranglisten.`
    );

    // Nulstil til én tom sektion igen
    setSets([newSet()]);
    // Auto-clear success efter lidt tid
    setTimeout(() => setSuccessMsg(""), 4500);
  }

  return (
    <div style={{ padding: 18, maxWidth: 980 }}>
      <h1 style={{ margin: "10px 0 18px", fontSize: 24 }}>Indtast resultater</h1>

      {/** Tidligere sæt i kladden (de sæt man er ved at indtaste) */}
      {sets.length > 1 && (
        <SectionCard title="Tidligere sæt" icon={<span>🗂️</span>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sets.slice(0, -1).map((s, idx) => {
              const aNames = [s.a1, s.a2]
                .map((id) => players.find((p) => p.id === id)?.name || "")
                .filter(Boolean)
                .join(" & ");
              const bNames = [s.b1, s.b2]
                .map((id) => players.find((p) => p.id === id)?.name || "")
                .filter(Boolean)
                .join(" & ");
              const label =
                aNames && bNames
                  ? `${aNames} vs ${bNames} — ${s.scoreA}-${s.scoreB}`
                  : "Udfyldt sæt";
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
                    style={{
                      border: "1px solid #EF4444",
                      color: "#EF4444",
                      background: "#fff",
                      padding: "8px 12px",
                      borderRadius: 10,
                      fontWeight: 600,
                    }}
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

      {/** Aktive sæt (sidste i listen) */}
      {sets.map((s, i) => {
        const isLast = i === sets.length - 1;
        return (
          <SectionCard
            key={s.id}
            title={`Sæt #${i + 1}`}
            icon={<span>🎾</span>}
          >
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
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
            </div>

            {/* Hold A */}
            <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
              <FieldLabel>Hold A</FieldLabel>
              <div style={{ display: "grid", gap: 10 }}>
                <FieldLabel>Spiller A1</FieldLabel>
                <Select
                  value={s.a1}
                  onChange={(v) => updateSet(s.id, { a1: v })}
                  placeholder="Vælg spiller…"
                >
                  {playerOptions}
                </Select>

                <FieldLabel>Spiller A2</FieldLabel>
                <Select
                  value={s.a2}
                  onChange={(v) => updateSet(s.id, { a2: v })}
                  placeholder="Vælg spiller…"
                >
                  {playerOptions}
                </Select>

                <FieldLabel>Score til Hold A</FieldLabel>
                <ScorePicker
                  value={s.scoreA}
                  onChange={(v) => updateSet(s.id, { scoreA: v })}
                  ariaLabel="Score til Hold A"
                />
              </div>
            </div>

            {/* Hold B */}
            <div style={{ display: "grid", gap: 12 }}>
              <FieldLabel>Hold B</FieldLabel>
              <div style={{ display: "grid", gap: 10 }}>
                <FieldLabel>Spiller B1</FieldLabel>
                <Select
                  value={s.b1}
                  onChange={(v) => updateSet(s.id, { b1: v })}
                  placeholder="Vælg spiller…"
                >
                  {playerOptions}
                </Select>

                <FieldLabel>Spiller B2</FieldLabel>
                <Select
                  value={s.b2}
                  onChange={(v) => updateSet(s.id, { b2: v })}
                  placeholder="Vælg spiller…"
                >
                  {playerOptions}
                </Select>

                <FieldLabel>Score til Hold B</FieldLabel>
                <ScorePicker
                  value={s.scoreB}
                  onChange={(v) => updateSet(s.id, { scoreB: v })}
                  ariaLabel="Score til Hold B"
                />
              </div>
            </div>

            {/* Knapper */}
            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 14,
                justifyContent: "space-between",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={addSet}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #EA580C",
                  color: "#EA580C",
                  background: "#fff",
                  fontWeight: 700,
                }}
              >
                <span>＋</span> Tilføj sæt
              </button>

              {isLast && (
                <button
                  type="button"
                  onClick={submitAll}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 12,
                    border: "1px solid #2563EB",
                    background: "#2563EB",
                    color: "#fff",
                    fontWeight: 700,
                    boxShadow: "0 8px 22px rgba(37,99,235,.25)",
                  }}
                >
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
    </div>
  );
}
