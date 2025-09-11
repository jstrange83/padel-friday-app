// src/pages/Dashboard.tsx
import React, { useEffect, useMemo, useState } from "react";

/** ---------- Storage keys (samme som tidligere) ---------- */
const LS_PLAYERS = "padel.players.v1";
const LS_MATCHES = "padel.matches.v1";

/** ---------- Typer ---------- */
type Player = {
  id: string;
  name: string;
  elo: number;
};

type MatchRec = {
  id: string;
  when: string; // ISO
  aNames: string[]; // ["Emma Christensen","..."]
  bNames: string[];
  scoreA: number;
  scoreB: number;
  friday?: boolean;
  court?: string; // Bane 1 etc.
};

/** ---------- Hjælpere ---------- */
const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("da-DK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const nextDatesFirst = (a: MatchRec, b: MatchRec) =>
  new Date(a.when).getTime() - new Date(b.when).getTime();

const sortNewestFirst = (a: MatchRec, b: MatchRec) =>
  new Date(b.when).getTime() - new Date(a.when).getTime();

/** ---------- Demo seed hvis tomt ---------- */
function seedIfEmpty() {
  try {
    const hasPlayers = !!localStorage.getItem(LS_PLAYERS);
    const hasMatches = !!localStorage.getItem(LS_MATCHES);
    if (hasPlayers && hasMatches) return;

    const players: Player[] = [
      { id: "p1", name: "Emma Christensen", elo: 1520 },
      { id: "p2", name: "Michael Sørensen", elo: 1490 },
      { id: "p3", name: "Julie Rasmussen", elo: 1460 },
      { id: "p4", name: "Lars Petersen", elo: 1440 },
      { id: "p5", name: "Mette Hansen", elo: 1430 },
      { id: "me", name: "Demo Bruger", elo: 1480 },
    ];

    // Et sæt kampe (både historiske og et par kommende)
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const matches: MatchRec[] = [
      // Kommende (2 stk)
      {
        id: "g_future_1",
        when: new Date(now + 2 * day).toISOString(),
        aNames: ["Thomas Nielsen", "Anne Møller"],
        bNames: ["Lars Petersen", "Mette Hansen"],
        scoreA: 0,
        scoreB: 0,
        court: "Bane 1",
      },
      {
        id: "g_future_2",
        when: new Date(now + 5 * day).toISOString(),
        aNames: ["Lars Petersen", "Mette Hansen"],
        bNames: ["Emma Christensen", "Julie Rasmussen"],
        scoreA: 0,
        scoreB: 0,
        court: "Bane 2",
      },
      // Historiske – masser, så “Mest aktive” og streaks giver mening
      ...Array.from({ length: 18 }).map((_, i) => ({
        id: `g_past_${i}`,
        when: new Date(now - (i + 2) * day).toISOString(),
        aNames: i % 2 === 0 ? ["Emma Christensen", "Michael Sørensen"] : ["Julie Rasmussen", "Lars Petersen"],
        bNames: i % 2 === 0 ? ["Julie Rasmussen", "Lars Petersen"] : ["Emma Christensen", "Mette Hansen"],
        scoreA: (i % 7) + 1,
        scoreB: ((i + 3) % 7) + 1,
        friday: (new Date(now - (i + 2) * day).getDay() === 5), // fredag
        court: `Bane ${(i % 3) + 1}`,
      })),
    ];

    localStorage.setItem(LS_PLAYERS, JSON.stringify(players));
    localStorage.setItem(LS_MATCHES, JSON.stringify(matches));
  } catch {
    // ignore
  }
}

/** ---------- Card UI wrapper ---------- */
function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

/** ---------- Komponent ---------- */
export default function Dashboard() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchRec[]>([]);

  // Seed hvis tomt + load
  useEffect(() => {
    seedIfEmpty();
    try {
      const P = JSON.parse(localStorage.getItem(LS_PLAYERS) || "[]");
      const M = JSON.parse(localStorage.getItem(LS_MATCHES) || "[]");
      setPlayers(P);
      setMatches(M);
    } catch {
      setPlayers([]);
      setMatches([]);
    }
  }, []);

  // Velkomst-statistik for “Demo Bruger”
  const me = useMemo(
    () => players.find((p) => p.id === "me") || { id: "me", name: "Demo Bruger", elo: 1480 },
    [players]
  );

  const myStats = useMemo(() => {
    const myName = me.name;
    const done = matches.filter((m) => m.scoreA !== 0 || m.scoreB !== 0);
    const mine = done.filter(
      (m) => [...m.aNames, ...m.bNames].includes(myName)
    );
    const wins = mine.filter((m) =>
      (m.aNames.includes(myName) && m.scoreA > m.scoreB) ||
      (m.bNames.includes(myName) && m.scoreB > m.scoreA)
    ).length;
    const pct = mine.length ? Math.round((wins / mine.length) * 100) : 0;
    return { total: mine.length, wins, pct };
  }, [matches, me]);

  // Kommende kampe
  const upcoming = useMemo(
    () => matches.filter((m) => new Date(m.when).getTime() > Date.now()).sort(nextDatesFirst).slice(0, 5),
    [matches]
  );

  // Mest aktive (top 3)
  const mostActive = useMemo(() => {
    const count: Record<string, number> = {};
    matches.forEach((m) => {
      if (m.scoreA === 0 && m.scoreB === 0) return; // ikke spillede
      [...m.aNames, ...m.bNames].forEach((n) => (count[n] = (count[n] || 0) + 1));
    });
    return Object.entries(count)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [matches]);

  // Flest fredage i træk (top 3, aktuelle streaks)
  const fridayStreaks = useMemo(() => {
    // grupper pr. spiller efter dato, tjek om dag==fredag, og lav “aktuel” streak
    const byPlayer: Record<string, MatchRec[]> = {};
    matches
      .filter((m) => m.scoreA !== 0 || m.scoreB !== 0)
      .sort(sortNewestFirst)
      .forEach((m) => {
        const allNames = [...m.aNames, ...m.bNames];
        allNames.forEach((n) => {
          byPlayer[n] = byPlayer[n] || [];
          byPlayer[n].push(m);
        });
      });

    const result: { name: string; streak: number }[] = [];
    Object.entries(byPlayer).forEach(([name, ms]) => {
      let streak = 0;
      for (const m of ms) {
        const d = new Date(m.when);
        const isFriday = d.getDay() === 5;
        if (isFriday) streak++;
        else break; // aktuel streak stopper
      }
      result.push({ name, streak });
    });

    return result
      .filter((r) => r.streak > 0)
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 3);
  }, [matches]);

  return (
    <div className="space-y-6">
      {/* Velkomst */}
      <div className="rounded-2xl p-5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow">
        <div className="text-2xl font-semibold mb-1">Velkommen tilbage, {me.name.split(" ")[0]}! 👋</div>
        <div className="opacity-95">
          Du har spillet {myStats.total || 55} kampe og vundet {myStats.wins || 48} af dem. Fortsæt den gode udvikling!
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kommende kampe */}
        <Card
          title="Kommende Kampe"
          icon={<span className="text-blue-600">📅</span>}
        >
          {upcoming.length === 0 ? (
            <div className="text-sm text-gray-500">Ingen planlagte kampe.</div>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((m) => (
                <li key={m.id} className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                  <div className="text-sm font-medium">{formatDate(m.when)} {m.court ? `• ${m.court}` : ""}</div>
                  <div className="text-gray-800">
                    vs {m.aNames.join(" & ")} — {m.bNames.join(" & ")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Månedens spiller (dummy indikator baseret på flest sejre i nyeste 30 dage) */}
        <Card title="Månedens Spiller" icon={<span className="text-yellow-500">⭐</span>}>
          <MonthPlayer matches={matches} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mest aktive */}
        <Card title="Mest Aktive (Top 3)" icon={<span className="text-green-600">📈</span>}>
          <ol className="space-y-2">
            {mostActive.length === 0 ? (
              <div className="text-sm text-gray-500">Ingen kampe endnu.</div>
            ) : (
              mostActive.map(([name, count], idx) => (
                <li key={name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 grid place-items-center text-xs font-semibold">
                      {idx + 1}
                    </span>
                    <span>{name}</span>
                  </div>
                  <span className="text-sm text-gray-600">{count} kampe</span>
                </li>
              ))
            )}
          </ol>
        </Card>

        {/* Flest fredage i træk */}
        <Card title="Flest fredage i træk (Top 3)" icon={<span className="text-emerald-600">✅</span>}>
          <ol className="space-y-2">
            {fridayStreaks.length === 0 ? (
              <div className="text-sm text-gray-500">Ingen aktuelle streaks.</div>
            ) : (
              fridayStreaks.map((r, idx) => (
                <li key={r.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center text-xs font-semibold">
                      {idx + 1}
                    </span>
                    <span>{r.name}</span>
                  </div>
                  <span className="text-sm text-gray-600">{r.streak} fredage i træk</span>
                </li>
              ))
            )}
          </ol>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vinderprocent */}
        <Card title="Vinderprocent" icon={<span className="text-amber-600">🏆</span>}>
          <div className="text-3xl font-semibold">{myStats.pct}%</div>
          <div className="text-sm text-gray-500">{myStats.wins} sejre af {myStats.total} kampe</div>
        </Card>

        {/* Kampe spillet */}
        <Card title="Kampe spillet" icon={<span className="text-sky-600">🎯</span>}>
          <div className="text-3xl font-semibold">{myStats.total}</div>
          <div className="text-sm text-gray-500">+3 denne måned</div>
        </Card>
      </div>

      {/* Bøder + MobilePay */}
      <Card title="Bøder" icon={<span className="text-rose-600">💸</span>}>
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            MobilePay-boks til indbetaling af bøder.
          </div>
          <a
            href="https://qr.mobilepay.dk/box/ad9ee90d-789f-42e9-aad8-b3b3e6ba7a5a/pay-in"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm"
          >
            Betal med MobilePay
          </a>
        </div>
      </Card>
    </div>
  );
}

/** ---------- Underkomponent: Månedens spiller ---------- */
function MonthPlayer({ matches }: { matches: MatchRec[] }) {
  // simpel heuristik: flest sejre de sidste 30 dage
  const from = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = matches.filter(
    (m) => new Date(m.when).getTime() >= from && (m.scoreA !== 0 || m.scoreB !== 0)
  );

  const wins: Record<string, number> = {};
  recent.forEach((m) => {
    const aWin = m.scoreA > m.scoreB;
    const winners = aWin ? m.aNames : m.bNames;
    winners.forEach((n) => (wins[n] = (wins[n] || 0) + 1));
  });

  const best = Object.entries(wins).sort((a, b) => b[1] - a[1])[0];
  if (!best) {
    return <div className="text-sm text-gray-500">Ingen kampe den seneste måned.</div>;
  }
  const [name, winCount] = best;
  const total = recent.reduce((acc, m) => acc + ([...m.aNames, ...m.bNames].includes(name) ? 1 : 0), 0);
  const pct = total ? Math.round((winCount / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-yellow-100 text-yellow-700 grid place-items-center font-semibold">
        {name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1">
        <div className="font-medium">{name}</div>
        <div className="text-sm text-gray-500">
          {winCount}/{total} sejre
        </div>
        <div className="mt-2 h-2 w-full bg-yellow-100 rounded-full overflow-hidden">
          <div
            className="h-2 bg-yellow-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
