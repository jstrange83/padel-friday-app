import React, { useMemo } from "react";

// ───────────────────────────────────────────────────────────────────────────────
// Typer
// ───────────────────────────────────────────────────────────────────────────────
type Player = { id: string; name: string; elo: number };
type Match = {
  id: string;
  when: string; // ISO
  court?: string;
  a: string[];  // 2 spillere (ids)
  b: string[];  // 2 spillere (ids)
  score?: { a: number; b: number };
};

// ───────────────────────────────────────────────────────────────────────────────
// Dummy data (mange kampe + fredage)
// ───────────────────────────────────────────────────────────────────────────────
const PLAYERS: Player[] = [
  { id: "p1", name: "Emma Christensen", elo: 1520 },
  { id: "p2", name: "Michael Sørensen", elo: 1490 },
  { id: "p3", name: "Julie Rasmussen", elo: 1460 },
  { id: "p4", name: "Lars Petersen", elo: 1440 },
  { id: "p5", name: "Mette Hansen", elo: 1430 },
  { id: "p6", name: "Thomas Nielsen", elo: 1420 },
  { id: "p7", name: "Sara Nielsen", elo: 1410 },
  { id: "p8", name: "Nikolaj Friis", elo: 1380 },
  { id: "p9", name: "Alex Hansen", elo: 1470 },
  { id: "p10", name: "Mark Larsen", elo: 1400 },
];

function d(dts: string) {
  return new Date(dts);
}
function addDays(base: Date, days: number) {
  const t = new Date(base);
  t.setDate(t.getDate() + days);
  return t;
}
function iso(date: Date) {
  return date.toISOString();
}

// Generér 14 fredage + blandede hverdage
function generateMatches(): Match[] {
  const now = new Date();
  // Find sidste fredag
  const lastFriday = addDays(now, -((now.getDay() + 2) % 7) - 1); // smule hacky men virker
  const matches: Match[] = [];

  let id = 1;

  // 14 fredage bagud (så vi kan lave streaks)
  for (let i = 13; i >= 0; i--) {
    const day = addDays(lastFriday, -7 * i);
    // to kampe pr. fredag
    matches.push({
      id: `F${id++}`,
      when: iso(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 18, 0)),
      court: "Bane 1",
      a: ["p1", "p3"],
      b: ["p2", "p4"],
      score: { a: 6, b: i % 2 === 0 ? 4 : 7 }, // lidt varians
    });
    matches.push({
      id: `F${id++}`,
      when: iso(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 19, 0)),
      court: "Bane 2",
      a: ["p5", "p7"],
      b: ["p6", "p8"],
      score: { a: i % 3 === 0 ? 7 : 6, b: 5 },
    });

    // nogle fredage deltager også p9/p10 for at skabe streaks
    if (i <= 6) {
      matches.push({
        id: `F${id++}`,
        when: iso(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 20, 0)),
        court: "Bane 3",
        a: ["p9", "p2"],
        b: ["p10", "p1"],
        score: { a: 6, b: 3 },
      });
    }
  }

  // 20 hverdags-kampe for at give “mest aktive”
  for (let i = 0; i < 20; i++) {
    const day = addDays(now, -(i * 2 + 1));
    matches.push({
      id: `W${id++}`,
      when: iso(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 18, 0)),
      court: `Bane ${1 + (i % 3)}`,
      a: [PLAYERS[(i + 1) % 10].id, PLAYERS[(i + 2) % 10].id],
      b: [PLAYERS[(i + 3) % 10].id, PLAYERS[(i + 4) % 10].id],
      score: { a: 6, b: (i % 4) + 2 },
    });
  }

  // Lidt fremtidige kampe
  for (let i = 1; i <= 3; i++) {
    const future = addDays(now, i * 2);
    matches.push({
      id: `U${id++}`,
      when: iso(new Date(future.getFullYear(), future.getMonth(), future.getDate(), 19, 0)),
      court: `Bane ${i}`,
      a: ["p1", "p2"],
      b: ["p3", "p4"],
    });
  }

  // nyeste først
  return matches.sort((a, b) => +d(b.when) - +d(a.when));
}

const MATCHES = generateMatches();

// ───────────────────────────────────────────────────────────────────────────────
// Beregninger til dashboard
// ───────────────────────────────────────────────────────────────────────────────
function isFriday(date: Date) {
  return date.getDay() === 5;
}

function groupCountBy<T extends string | number>(arr: T[]) {
  const m = new Map<T, number>();
  arr.forEach((k) => m.set(k, (m.get(k) ?? 0) + 1));
  return m;
}

function topN<K>(map: Map<K, number>, n: number): Array<{ key: K; count: number }> {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

// Aktuel streak af på hinanden følgende fredage (nyt → gammelt)
function currentFridayStreak(playerId: string, matches: Match[]): number {
  // alle fredage spilleren deltog i (dato uden tid)
  const fridays = matches
    .filter((m) => isFriday(d(m.when)) && [...m.a, ...m.b].includes(playerId))
    .map((m) => {
      const dt = d(m.when);
      return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()); // strip time
    })
    .sort((a, b) => +b - +a);

  if (fridays.length === 0) return 0;

  // finder seneste fredag i systemet
  const allFridayDates = matches
    .filter((m) => isFriday(d(m.when)))
    .map((m) => {
      const dt = d(m.when);
      return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    })
    .sort((a, b) => +b - +a);
  if (allFridayDates.length === 0) return 0;

  const lastF = allFridayDates[0]; // seneste fredag der har været kampe
  // bygger et sæt af spillerens fredage i milliseconds for hurtig lookup
  const set = new Set(fridays.map((x) => x.getTime()));

  // tæl baglæns i 7-dages hop
  let streak = 0;
  let cursor = new Date(lastF);
  while (set.has(cursor.getTime())) {
    streak++;
    cursor = addDays(cursor, -7);
  }
  return streak;
}

function useDashboardData() {
  // Mest aktive (tæller alle kampe pr. spiller)
  const playedByPlayer = groupCountBy(
    MATCHES.flatMap((m) => [...m.a, ...m.b])
  );
  const mostActive = topN(playedByPlayer, 3).map((x) => ({
    player: PLAYERS.find((p) => p.id === x.key)!,
    count: x.count,
  }));

  // Flest fredage i træk (aktuel streak)
  const streaks = PLAYERS.map((p) => ({
    player: p,
    streak: currentFridayStreak(p.id, MATCHES),
  }))
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 3);

  // Kommende kampe (næste 7 dage)
  const upcoming = MATCHES.filter((m) => d(m.when) > new Date()).slice(0, 5);

  return { mostActive, streaks, upcoming };
}

// ───────────────────────────────────────────────────────────────────────────────
// UI helpers
// ───────────────────────────────────────────────────────────────────────────────
function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        {icon && <span aria-hidden className="text-lg">{icon}</span>}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function CircleStat({ value, subtitle }: { value: number; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-12 w-12 place-items-center rounded-full border border-gray-300 bg-gray-50 text-base font-semibold">
        {value}
      </div>
      <div className="text-sm text-gray-600">{subtitle}</div>
    </div>
  );
}

function nameOf(id: string) {
  return PLAYERS.find((p) => p.id === id)?.name ?? id;
}

// ───────────────────────────────────────────────────────────────────────────────
// App (Dashboard)
// ───────────────────────────────────────────────────────────────────────────────
export default function App() {
  const { mostActive, streaks, upcoming } = useDashboardData();

  // Vinderprocent + antal
  const totalWins = MATCHES.filter((m) => m.score && m.score.a > m.score.b).length; // bare fake (hold A)
  const totalGames = MATCHES.filter((m) => m.score).length;
  const winPct = totalGames ? Math.round((totalWins / totalGames) * 100) : 0;

  // Månedens spiller (dummy: Emma)
  const playerOfMonth = PLAYERS[0];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-5xl p-4 md:p-6">
        <h1 className="mb-4 text-2xl font-bold">Dashboard</h1>

        {/* Velkomstkort */}
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 p-5 text-white shadow-sm">
          <div className="text-xl font-semibold">Velkommen tilbage, Demo! 👋</div>
          <div className="mt-1 opacity-95">
            Du har spillet {totalGames} kampe og vundet {totalWins} af dem. Fortsæt den gode
            udvikling!
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Kommende kampe */}
          <Card title="Kommende Kampe" icon="📅">
            {upcoming.length === 0 ? (
              <div className="text-sm text-gray-500">Ingen planlagte kampe.</div>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((m) => (
                  <li key={m.id} className="rounded-xl bg-blue-50 p-3">
                    <div className="text-sm text-gray-600">
                      {d(m.when).toISOString().slice(0, 10)} {d(m.when).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="font-medium">
                      vs {nameOf(m.a[0])} &amp; {nameOf(m.a[1])} — {nameOf(m.b[0])} &amp; {nameOf(m.b[1])}
                    </div>
                    {m.court && <div className="text-sm text-gray-500">{m.court}</div>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Månedens spiller */}
          <Card title="Månedens Spiller" icon="⭐">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-yellow-100 text-yellow-800">
                {playerOfMonth.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
              </div>
              <div>
                <div className="text-base font-medium">{playerOfMonth.name}</div>
                <div className="text-sm text-gray-500">18/22 sejre</div>
              </div>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-yellow-200">
              <div className="h-2 w-4/5 rounded-full bg-yellow-500" />
            </div>
          </Card>

          {/* Mest aktive top 3 */}
          <Card title="Mest Aktive (Top 3)" icon="📈">
            <div className="space-y-3">
              {mostActive.map(({ player, count }, i) => (
                <div key={player.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-green-100 text-sm font-semibold text-green-700">
                      {i + 1}
                    </div>
                    <div className="font-medium">{player.name}</div>
                  </div>
                  <CircleStat value={count} subtitle="kampe" />
                </div>
              ))}
            </div>
          </Card>

          {/* Flest fredage i træk top 3 */}
          <Card title="Flest fredage i træk (Top 3)" icon="🟢">
            <div className="space-y-3">
              {streaks.map(({ player, streak }, i) => (
                <div key={player.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-purple-100 text-sm font-semibold text-purple-700">
                      {i + 1}
                    </div>
                    <div className="font-medium">{player.name}</div>
                  </div>
                  <CircleStat value={streak} subtitle="fredage i træk" />
                </div>
              ))}
            </div>
          </Card>

          {/* Vinderprocent */}
          <Card title="Vinderprocent" icon="🏆">
            <div className="text-3xl font-bold">{winPct}%</div>
            <div className="text-sm text-gray-600">
              {totalWins} sejre af {totalGames} kampe
            </div>
          </Card>

          {/* Kampe spillet */}
          <Card title="Kampe spillet" icon="🎯">
            <div className="text-3xl font-bold">{totalGames}</div>
            <div className="text-sm text-gray-600">+3 denne måned</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
