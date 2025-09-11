import React, { useMemo, useState } from "react";

/**
 * LocalStorage keys (samme som vi har brugt i app'en)
 */
const LS_PLAYERS = "padel.players.v1";
const LS_MATCHES = "padel.matches.v1";

/**
 * Typer (holdt lokalt her for at undgå at ændre andre filer)
 */
type Player = { id: string; name: string; elo: number };

type MatchRec = {
  id: string;
  when: string; // ISO datetime
  court?: string;
  isFriday?: boolean;
  aNames: string[]; // [A1, A2]
  bNames: string[]; // [B1, B2]
  scoreA: number; // 0..7 (sæt)
  scoreB: number; // 0..7 (sæt)
  points?: { id?: string; name: string; value: number }[]; // ELO-delta pr. spiller
};

/**
 * Utils
 */
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
function fmtDate(d: string) {
  // yyyy-mm-dd
  return new Date(d).toISOString().slice(0, 10);
}
function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/**
 * Runde score-knapper
 */
function ScorePicker({
  value,
  onChange,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  ariaLabel?: string;
}) {
  const opts = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <div className="flex items-center gap-2">
      {opts.map((v) => (
        <button
          type="button"
          key={v}
          aria-label={ariaLabel ? `${ariaLabel} ${v}` : undefined}
          onClick={() => onChange(v)}
          className={classNames(
            "h-8 w-8 rounded-full border text-sm",
            v === value
              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
              : "bg-white hover:bg-gray-50 border-gray-300 text-gray-700"
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

/**
 * Ét dato-kort med alle sæt den dag + ELO-ændringer
 */
function DayCard({
  date,
  matches,
}: {
  date: string;
  matches: MatchRec[];
}) {
  // Saml ELO-delta pr. spiller for dagen
  const dayDeltas = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of matches) {
      for (const p of m.points ?? []) {
        const k = p.name;
        map.set(k, (map.get(k) ?? 0) + p.value);
      }
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }, [matches]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-rose-600">📅</span>
        <div className="text-lg font-semibold">{date}</div>
      </div>

      <div className="divide-y divide-gray-100">
        {matches.map((m) => (
          <div key={m.id} className="py-3">
            <div className="text-[13.5px] text-gray-800">
              <span className="font-medium">{m.aNames.join(" & ")}</span>{" "}
              <span className="text-gray-400">vs.</span>{" "}
              <span className="font-medium">{m.bNames.join(" & ")}</span>
              {m.court ? (
                <span className="text-gray-400"> — {m.court}</span>
              ) : null}
            </div>
            <div className="mt-1 flex items-center justify-between">
              <div className="text-base font-semibold">
                {m.scoreA} - {m.scoreB}
              </div>
              {typeof m.isFriday === "boolean" && m.isFriday && (
                <span className="text-[12px] text-green-600">fredagskamp</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {dayDeltas.length > 0 && (
        <>
          <div className="h-px bg-gray-100 my-3" />
          <div className="grid sm:grid-cols-2 gap-2">
            {dayDeltas.map((d) => (
              <div
                key={d.name}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
              >
                <div className="text-sm text-gray-700">{d.name}</div>
                <div
                  className={classNames(
                    "text-sm font-semibold",
                    d.value > 0 ? "text-green-600" : d.value < 0 ? "text-rose-600" : "text-gray-500"
                  )}
                >
                  {d.value > 0 ? `(+${Math.round(d.value)})` : `(${Math.round(d.value)})`}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Fejl-rapport (placeholder) */}
      <div className="mt-3">
        <label className="block text-[13px] text-gray-600 mb-1">
          🚫 Indberet fejl i kampen:
        </label>
        <textarea
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Skriv hvad der er forkert… (kommer i en senere version)"
        />
      </div>
    </div>
  );
}

/**
 * Resultatsiden
 */
export default function Results() {
  const players = load<Player[]>(LS_PLAYERS, [
    { id: "p1", name: "Emma Christensen", elo: 1520 },
    { id: "p2", name: "Michael Sørensen", elo: 1490 },
    { id: "p3", name: "Julie Rasmussen", elo: 1460 },
    { id: "p4", name: "Lars Petersen", elo: 1440 },
    { id: "me", name: "Demo Bruger", elo: 1480 },
  ]);
  const [matches, setMatches] = useState<MatchRec[]>(
    () => load<MatchRec[]>(LS_MATCHES, [])
  );

  // --------- Formular state (et sæt pr. gem) ----------
  const [a1, setA1] = useState(players[0]?.id ?? "");
  const [a2, setA2] = useState(players[1]?.id ?? "");
  const [b1, setB1] = useState(players[2]?.id ?? "");
  const [b2, setB2] = useState(players[3]?.id ?? "");
  const [scoreA, setScoreA] = useState(6);
  const [scoreB, setScoreB] = useState(3);
  const [when, setWhen] = useState(() =>
    new Date().toISOString().slice(0, 16)
  ); // input[type=datetime-local]
  const [court, setCourt] = useState("Bane 1");
  const [isFriday, setIsFriday] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  function idToName(id: string) {
    return players.find((p) => p.id === id)?.name ?? id;
  }

  function onSave() {
    const aNames = [idToName(a1), idToName(a2)];
    const bNames = [idToName(b1), idToName(b2)];

    // (Dummy) fordeling af ELO-deltaer – indtil vi kobler rigtig ELO på
    const delta = Math.max(-20, Math.min(20, (scoreA - scoreB) * 2)); // bare en visuel indikator
    const points = [
      { name: aNames[0], value: delta / 2 },
      { name: aNames[1], value: delta / 2 },
      { name: bNames[0], value: -delta / 2 },
      { name: bNames[1], value: -delta / 2 },
    ];

    const rec: MatchRec = {
      id: `m_${Date.now()}`,
      when: new Date(when).toISOString(),
      court,
      isFriday,
      aNames,
      bNames,
      scoreA,
      scoreB,
      points,
    };

    const next = [rec, ...matches].slice(0, 200); // hold lidt historik
    setMatches(next);
    save(LS_MATCHES, next);
    setSaved("Resultat gemt ✅ — se det på Dashboard og Ranglisten.");

    // (valgfrit) nulstil kun scores
    // setScoreA(0); setScoreB(0);
  }

  // --------- “Mine resultater” / “Alle resultater” ----------
  const myName = useMemo(
    () => players.find((p) => p.id === "me")?.name ?? "Demo Bruger",
    [players]
  );

  const groupsAll = useMemo(() => groupByDate(matches), [matches]);
  const groupsMine = useMemo(
    () =>
      groupByDate(
        matches.filter(
          (m) =>
            m.aNames.includes(myName) ||
            m.bNames.includes(myName)
        )
      ),
    [matches, myName]
  );

  return (
    <div className="space-y-6">
      {/* Formular-kort */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <span>📝</span>
          <div className="text-lg font-semibold">Indtast resultat</div>
        </div>

        {/* Hold A / Hold B */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium text-gray-700 mb-1">Hold A</div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={a1}
                onChange={(e) => setA1(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={a2}
                onChange={(e) => setA2(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 text-[13px] text-gray-600">Score til Hold A</div>
            <ScorePicker value={scoreA} onChange={setScoreA} ariaLabel="Score A" />
          </div>

          <div>
            <div className="text-sm font-medium text-gray-700 mb-1">Hold B</div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={b1}
                onChange={(e) => setB1(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={b2}
                onChange={(e) => setB2(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 text-[13px] text-gray-600">Score til Hold B</div>
            <ScorePicker value={scoreB} onChange={setScoreB} ariaLabel="Score B" />
          </div>
        </div>

        {/* Tid, bane, fredag */}
        <div className="mt-3 grid md:grid-cols-3 gap-2">
          <div>
            <div className="text-[13px] text-gray-600 mb-1">Hvornår</div>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <div className="text-[13px] text-gray-600 mb-1">Bane</div>
            <input
              value={court}
              onChange={(e) => setCourt(e.target.value)}
              placeholder="Bane"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 mt-6 md:mt-0">
            <input
              type="checkbox"
              checked={isFriday}
              onChange={(e) => setIsFriday(e.target.checked)}
            />
            Dette var en fredagskamp
          </label>
        </div>

        {/* Gem */}
        <div className="mt-4 flex items-center justify-between gap-4">
          <div
            className={classNames(
              "text-[13px]",
              saved ? "text-blue-700" : "text-gray-400"
            )}
          >
            {saved ?? "—"}
          </div>
          <button
            onClick={onSave}
            className="rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Gem resultat
          </button>
        </div>
      </div>

      {/* Mine resultater */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <span>👤</span>
          <div className="text-lg font-semibold">Mine resultater</div>
        </div>

        {groupsMine.length === 0 ? (
          <div className="rounded-lg bg-gray-50 text-[13.5px] text-gray-600 px-3 py-2">
            Ingen kampe endnu for din profil.
          </div>
        ) : (
          <div className="space-y-3">
            {groupsMine.map(([date, ms]) => (
              <DayCard key={date} date={date} matches={ms} />
            ))}
          </div>
        )}
      </div>

      {/* Alle resultater */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <span>📋</span>
          <div className="text-lg font-semibold">Alle resultater</div>
        </div>

        {groupsAll.length === 0 ? (
          <div className="rounded-lg bg-gray-50 text-[13.5px] text-gray-600 px-3 py-2">
            Der er endnu ikke registreret kampe.
          </div>
        ) : (
          <div className="space-y-3">
            {groupsAll.map(([date, ms]) => (
              <DayCard key={date} date={date} matches={ms} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Gruppeér kampe efter dato (yyyy-mm-dd), nyeste først.
 */
function groupByDate(ms: MatchRec[]): [string, MatchRec[]][] {
  const m = new Map<string, MatchRec[]>();
  for (const x of ms) {
    const key = fmtDate(x.when);
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(x);
  }
  const out: [string, MatchRec[]][] = [...m.entries()];
  out.sort((a, b) => (a[0] < b[0] ? 1 : -1)); // nyeste øverst
  for (const [, arr] of out) {
    arr.sort((a, b) => (a.when < b.when ? 1 : -1));
  }
  return out;
}
