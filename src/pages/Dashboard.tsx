// src/pages/Dashboard.tsx
import React, {useMemo} from "react";

/** Datatyper som vi allerede bruger andre steder */
type MatchRec = {
  id: string;
  when: string;          // ISO string
  aNames: string[];
  bNames: string[];
  scoreA: number;
  scoreB: number;
  points?: { id: string; name: string; value: number }[];
};

type Player = { id: string; name: string; elo: number };

const LS_PLAYERS = "padel.players.v1";
const LS_MATCHES = "padel.matches.v1";

// Utils
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function formatDateShort(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("da-DK", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return iso;
  }
}

export default function Dashboard() {
  const players = load<Player[]>(LS_PLAYERS, []);
  const matches = load<MatchRec[]>(LS_MATCHES, []);

  // Aggreger data til kortene
  const {
    welcomeName,
    totalGames,
    totalWins,
    winPct,
    gamesThisMonth,
    upcoming,
    mostActiveTop3,
    fridaysTop3,
    playerOfMonth,
  } = useMemo(() => {
    const name = "Demo"; // (senere fra login/profil)
    const total = matches.length;
    const wins = matches.filter((m) => m.scoreA !== m.scoreB && m.scoreA > m.scoreB).length; // place­holder
    const pct = total ? Math.round((wins / total) * 100) : 0;

    const now = new Date();
    const ym = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
    const inMonth = matches.filter((m) => (m.when || "").startsWith(ym)).length;

    // Kommende kampe (vi bruger future dates, hvis du senere laver booking-kalender)
    const up = matches
      .filter((m) => new Date(m.when) > new Date())
      .slice(0, 3);

    // Mest aktive – tæl pr. spiller i hele datasættet
    const counts = new Map<string, number>();
    for (const m of matches) {
      for (const n of [...m.aNames, ...m.bNames]) {
        counts.set(n, (counts.get(n) || 0) + 1);
      }
    }
    const mostActive = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, c]) => ({ name, c }));

    // Fredags-streak (place­holder: sortér på hvem der har spillet flest kampe med weekday=5)
    const fridayCounts = new Map<string, number>();
    for (const m of matches) {
      const d = new Date(m.when);
      if (d.getDay() === 5) {
        for (const n of [...m.aNames, ...m.bNames]) {
          fridayCounts.set(n, (fridayCounts.get(n) || 0) + 1);
        }
      }
    }
    const fridaysTop = [...fridayCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, c]) => ({ name, c }));

    // Månedens spiller – tag den med flest sejre i denne måned (simpel placeholder)
    const winsByName = new Map<string, number>();
    const monthMatches = matches.filter((m) => (m.when || "").startsWith(ym));
    for (const m of monthMatches) {
      const winnerNames = m.scoreA > m.scoreB ? m.aNames : m.bNames;
      for (const n of winnerNames) winsByName.set(n, (winsByName.get(n) || 0) + 1);
    }
    const best = [...winsByName.entries()].sort((a, b) => b[1] - a[1])[0];
    const playerOfMonth =
      best ? { name: best[0], wins: best[1] } : { name: "Emma Christensen", wins: 2 }; // demo default

    return {
      welcomeName: name,
      totalGames: total,
      totalWins: wins,
      winPct: pct,
      gamesThisMonth: inMonth,
      upcoming: up,
      mostActiveTop3: mostActive,
      fridaysTop3: fridaysTop,
      playerOfMonth,
    };
  }, [players, matches]);

  return (
    <div className="page">
      {/* Blå velkomst-card */}
      <div className="card hero gradient">
        <div className="hero-title">Velkommen tilbage, {welcomeName}! 👋</div>
        <div className="hero-sub">
          Du har spillet {totalGames} kampe og vundet {totalWins} af dem. Fortsæt den gode udvikling!
        </div>
      </div>

      {/* Øverste række: kommende kampe + månedens spiller */}
      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">
            <span className="icon">📅</span> Kommende Kampe
          </div>
          {upcoming.length === 0 ? (
            <div className="muted">Ingen planlagte kampe.</div>
          ) : (
            <ul className="list">
              {upcoming.map((m) => (
                <li key={m.id}>
                  <div className="small muted">{formatDateShort(m.when)}</div>
                  <div>
                    {m.aNames.join(" & ")} <span className="muted">vs</span> {m.bNames.join(" & ")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="card-title">
            <span className="icon">⭐</span> Månedens spiller
          </div>
          <div className="row center">
            <div className="avatar">{initials(playerOfMonth.name)}</div>
            <div>
              <div className="strong">{playerOfMonth.name}</div>
              <div className="muted">{playerOfMonth.wins} sejre</div>
            </div>
          </div>
        </div>
      </div>

      {/* Midterste række: mest aktive + fredag-streak */}
      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">
            <span className="icon">✅</span> Mest Aktive (Top 3)
          </div>
          {mostActiveTop3.length === 0 ? (
            <div className="muted">Ingen data endnu.</div>
          ) : (
            <ol className="rank">
              {mostActiveTop3.map((r, i) => (
                <li key={r.name}>
                  <span className="badge">{i + 1}</span>
                  <span>{r.name}</span>
                  <span className="muted">{r.c} kampe</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="card">
          <div className="card-title">
            <span className="icon">☑️</span> Flest fredage i træk (Top 3)
          </div>
          {fridaysTop3.length === 0 ? (
            <div className="muted">Ingen aktuelle streaks.</div>
          ) : (
            <ol className="rank">
              {fridaysTop3.map((r, i) => (
                <li key={r.name}>
                  <span className="badge">{i + 1}</span>
                  <span>{r.name}</span>
                  <span className="muted">{r.c} fredage i træk</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Nederste række: vinderprocent + kampe spillet + bøder (med blå knap) */}
      <div className="grid grid-3">
        <div className="card kpi">
          <div className="card-title">🏆 Vinderprocent</div>
          <div className="kpi-value">{winPct}%</div>
          <div className="muted">
            {totalWins} sejre af {totalGames} kampe
          </div>
        </div>

        <div className="card kpi">
          <div className="card-title">🎯 Kampe spillet</div>
          <div className="kpi-value">{totalGames}</div>
          <div className="muted">+{gamesThisMonth} denne måned</div>
        </div>

        <div className="card">
          <div className="card-title">🧾 Bøder</div>
          <div className="muted">MobilePay-boks til indbetaling af bøder.</div>
          <a
            className="btn primary"
            href="https://qr.mobilepay.dk/box/ad9ee90d-789f-42e9-aad8-b3b3e6ba7a5a/pay-in"
            target="_blank"
            rel="noreferrer"
          >
            Betal med MobilePay
          </a>
        </div>
      </div>
    </div>
  );
}

// små UI helpers (genbruger eksisterende classes fra appens css)
function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "")).toUpperCase();
}
