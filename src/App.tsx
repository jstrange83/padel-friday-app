// src/App.tsx
import React, { useMemo, useState } from "react";

/* =========================================================
   Demo-data (spillere, kampe, bøder)
   ======================================================= */

type Player = {
  id: string;
  name: string;
  elo: number;
  initials: string;
};

type Match = {
  id: string;
  when: string; // ISO
  court: string;
  isFriday: boolean;
  a: string[]; // player ids
  b: string[];
  scoreA: number;
  scoreB: number;
};

type Fine = {
  id: string;
  toPlayerId: string;
  amount: number;
  status: "unpaid" | "paid";
  matchId?: string;
};

const PLAYERS: Player[] = [
  { id: "p1", name: "Emma Christensen", elo: 1520, initials: "EC" },
  { id: "p2", name: "Michael Sørensen", elo: 1490, initials: "MS" },
  { id: "p3", name: "Julie Rasmussen", elo: 1460, initials: "JR" },
  { id: "p4", name: "Lars Petersen", elo: 1440, initials: "LP" },
  { id: "p5", name: "Mette Hansen", elo: 1430, initials: "MH" },
  { id: "me", name: "Demo Bruger", elo: 1480, initials: "DB" },
];

const CURRENT_PLAYER_ID = "me";

/** Lille helper til at rykke en dato N dage */
const d = (iso: string, days: number) => {
  const t = new Date(iso);
  t.setDate(t.getDate() + days);
  return t.toISOString();
};

// Vi laver en startdato og bygger en liste af kampe (både fredage og andre dage)
const START = new Date();
START.setMonth(START.getMonth() - 1);
START.setHours(19, 0, 0, 0); // 19:00

const MATCHES: Match[] = [
  // Kommende kampe (3 stk) – bruges i "Kommende kampe"
  {
    id: "m-up-1",
    when: d(START.toISOString(), 2),
    court: "Bane 3",
    isFriday: false,
    a: ["p1", "me"],
    b: ["p3", "p4"],
    scoreA: 0,
    scoreB: 0,
  },
  {
    id: "m-up-2",
    when: d(START.toISOString(), 5),
    court: "Bane 2",
    isFriday: false,
    a: ["p1", "p2"],
    b: ["me", "p3"],
    scoreA: 0,
    scoreB: 0,
  },
  {
    id: "m-up-3",
    when: d(START.toISOString(), 7),
    court: "Bane 1",
    isFriday: false,
    a: ["p1", "p2"],
    b: ["p3", "p4"],
    scoreA: 0,
    scoreB: 0,
  },

  // Spillede fredage (seneste først)
  {
    id: "f-1",
    when: d(START.toISOString(), -2), // sidste fredag
    court: "Bane 1",
    isFriday: true,
    a: ["p1", "p2"],
    b: ["p3", "p4"],
    scoreA: 6,
    scoreB: 3,
  },
  {
    id: "f-2",
    when: d(START.toISOString(), -9), // forrige fredag
    court: "Bane 2",
    isFriday: true,
    a: ["p1", "p3"],
    b: ["p2", "p4"],
    scoreA: 7,
    scoreB: 6,
  },
  {
    id: "f-3",
    when: d(START.toISOString(), -16),
    court: "Bane 2",
    isFriday: true,
    a: ["p1", "me"],
    b: ["p3", "p2"],
    scoreA: 6,
    scoreB: 2,
  },

  // Andre kampe (giver volumen til KPI’er og “Mest aktive”)
  {
    id: "m-1",
    when: d(START.toISOString(), -1),
    court: "Bane 1",
    isFriday: false,
    a: ["p1", "p3"],
    b: ["p2", "me"],
    scoreA: 6,
    scoreB: 4,
  },
  {
    id: "m-2",
    when: d(START.toISOString(), -3),
    court: "Bane 3",
    isFriday: false,
    a: ["p1", "p2"],
    b: ["me", "p5"],
    scoreA: 2,
    scoreB: 6,
  },
  {
    id: "m-3",
    when: d(START.toISOString(), -6),
    court: "Bane 1",
    isFriday: false,
    a: ["me", "p1"],
    b: ["p2", "p3"],
    scoreA: 6,
    scoreB: 5,
  },
  {
    id: "m-4",
    when: d(START.toISOString(), -10),
    court: "Bane 1",
    isFriday: false,
    a: ["p1", "p2"],
    b: ["p3", "me"],
    scoreA: 3,
    scoreB: 6,
  },
  {
    id: "m-5",
    when: d(START.toISOString(), -12),
    court: "Bane 2",
    isFriday: false,
    a: ["p1", "p5"],
    b: ["p2", "me"],
    scoreA: 6,
    scoreB: 1,
  },
];

const FINES: Fine[] = [
  { id: "fine-1", toPlayerId: "me", amount: 125, status: "unpaid", matchId: "m-1" },
  { id: "fine-2", toPlayerId: "me", amount: 75, status: "unpaid", matchId: "m-2" },
  { id: "fine-3", toPlayerId: "p2", amount: 50, status: "paid", matchId: "m-3" },
];

/* =========================================================
   Hjælpefunktioner
   ======================================================= */

// hent spiller-navn
const nameOf = (id: string) => PLAYERS.find((p) => p.id === id)?.name ?? id;

// sortér nyeste først
const byNewest = (a: Match, b: Match) =>
  new Date(b.when).getTime() - new Date(a.when).getTime();

// KPI: vinderprocent & kampe
function useKpis() {
  return useMemo(() => {
    // demo: brug de seneste 55/48 som du havde på screenshot
    const total = 55;
    const wins = 48;
    const percent = Math.round((wins / total) * 100);
    return { total, wins, percent, thisMonthDelta: 3 };
  }, []);
}

// “Mest aktive (Top 3)” – antal kampe for hver spiller
function useMostActiveTop3() {
  return useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of MATCHES) {
      [...m.a, ...m.b].forEach((pid) => (counts[pid] = (counts[pid] ?? 0) + 1));
    }
    const rows = Object.entries(counts)
      .map(([pid, cnt]) => ({ id: pid, name: nameOf(pid), count: cnt }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    return rows;
  }, []);
}

// “Flest fredage i træk (Top 3)” – AKTUELLE streaks
function useCurrentFridayStreakTop3() {
  return useMemo(() => {
    // find alle fredage sorteret nyeste → ældste
    const fridays = MATCHES.filter((m) => m.isFriday).sort(byNewest);

    // for hver spiller går vi baglæns fra nyeste fredag, og tæller
    // hvor mange fredage i træk spilleren har deltaget, indtil første
    // fredag hvor spilleren IKKE deltager.
    const streaks: Record<string, number> = {};
    for (const p of PLAYERS) {
      let streak = 0;
      for (const f of fridays) {
        const played = [...f.a, ...f.b].includes(p.id);
        if (played) streak++;
        else break;
      }
      streaks[p.id] = streak;
    }

    const rows = Object.entries(streaks)
      .map(([pid, s]) => ({ id: pid, name: nameOf(pid), streak: s }))
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 3);
    return rows;
  }, []);
}

// Bøder (manglende betaling for CURRENT_PLAYER_ID)
function useOutstandingFines() {
  return useMemo(() => {
    const mine = FINES.filter(
      (f) => f.toPlayerId === CURRENT_PLAYER_ID && f.status === "unpaid"
    );
    const amount = mine.reduce((sum, f) => sum + f.amount, 0);
    return { count: mine.length, amount };
  }, []);
}

/* =========================================================
   UI helpers
   ======================================================= */

function Card({
  title,
  icon,
  children,
}: {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      {title && (
        <div className="card__header">
          <div className="card__title">
            {icon ? <span className="card__icon">{icon}</span> : null}
            <span>{title}</span>
          </div>
        </div>
      )}
      <div className="card__body">{children}</div>
    </div>
  );
}

function MiniPill({ children }: { children: React.ReactNode }) {
  return <span className="pill">{children}</span>;
}

/* =========================================================
   Pages
   ======================================================= */

type Page = "Dashboard" | "Fredagspadel" | "Ranglisten" | "Bøder" | "Admin";

export default function App() {
  const [page, setPage] = useState<Page>("Dashboard");

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">PadelApp</div>
        <nav className="menu">
          {(["Dashboard", "Fredagspadel", "Ranglisten", "Bøder", "Admin"] as Page[]).map(
            (p) => (
              <button
                key={p}
                className={`menu__item ${page === p ? "is-active" : ""}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            )
          )}
        </nav>
        <div className="me">
          <div className="me__avatar">{PLAYERS.find(p=>p.id===CURRENT_PLAYER_ID)?.initials ?? "ME"}</div>
          <div className="me__meta">
            <div className="me__name">{nameOf(CURRENT_PLAYER_ID)}</div>
            <div className="me__rank">Ranking #{PLAYERS.findIndex(p=>p.id===CURRENT_PLAYER_ID)+1}</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="content">
        {page === "Dashboard" && <Dashboard />}
        {page === "Fredagspadel" && <Placeholder title="Fredagspadel" />}
        {page === "Ranglisten" && <RankingPage />}
        {page === "Bøder" && <FinesPage />}
        {page === "Admin" && <Placeholder title="Admin" />}
      </main>
    </div>
  );
}

/* ---------------- Dashboard ---------------- */

function Dashboard() {
  const kpi = useKpis();
  const mostActive = useMostActiveTop3();
  const streaks = useCurrentFridayStreakTop3();
  const outstanding = useOutstandingFines();

  const upcoming = MATCHES.filter((m) => m.scoreA === 0 && m.scoreB === 0)
    .sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime())
    .slice(0, 3);

  const recent = MATCHES.filter((m) => m.scoreA > 0 || m.scoreB > 0)
    .sort(byNewest)
    .slice(0, 5);

  return (
    <>
      {/* Welcome banner */}
      <div className="welcome">
        <div className="welcome__title">Velkommen tilbage, Demo! 👋</div>
        <div className="welcome__text">
          Du har spillet <b>{kpi.total}</b> kampe og vundet <b>{kpi.wins}</b> af dem.
          Fortsæt den gode udvikling!
        </div>
      </div>

      <div className="grid grid--2">
        {/* Kommende kampe */}
        <Card title="Kommende Kampe" icon={<span>📅</span>}>
          <ul className="list list--events">
            {upcoming.map((m) => (
              <li key={m.id} className="event">
                <div className="event__date">
                  {new Date(m.when).toISOString().slice(0, 10)}{" "}
                  <MiniPill>{new Date(m.when).toTimeString().slice(0, 5)}</MiniPill>
                </div>
                <div className="event__who">
                  <b>
                    vs {nameOf(m.a[0])} & {nameOf(m.a[1])} — {nameOf(m.b[0])} & {nameOf(m.b[1])}
                  </b>
                  <div className="event__sub">Bane {m.court}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Månedens spiller */}
        <Card title="Månedens Spiller" icon={<span>⭐</span>}>
          <div className="player-row">
            <div className="avatar">EC</div>
            <div>
              <div className="player-row__name">Emma Christensen</div>
              <div className="bar">
                <span style={{ width: "82%" }} />
              </div>
              <div className="muted">18/22 sejre</div>
            </div>
          </div>
        </Card>

        {/* Mest aktive */}
        <Card title="Mest Aktive (Top 3)" icon={<span>📈</span>}>
          <ol className="ranked">
            {mostActive.map((r, i) => (
              <li key={r.id} className="ranked__row">
                <span className="ranked__dot">{i + 1}</span>
                <span className="ranked__name">{r.name}</span>
                <span className="ranked__badge">{r.count}</span>
                <span className="muted">kampe</span>
              </li>
            ))}
          </ol>
        </Card>

        {/* Flest fredage i træk */}
        <Card title="Flest fredage i træk (Top 3)" icon={<span>✅</span>}>
          <ol className="ranked">
            {streaks.map((r, i) => (
              <li key={r.id} className="ranked__row">
                <span className="ranked__dot">{i + 1}</span>
                <span className="ranked__name">{r.name}</span>
                <span className="ranked__badge">{r.streak}</span>
                <span className="muted">fredage i træk</span>
              </li>
            ))}
          </ol>
        </Card>

        {/* Vinderprocent */}
        <Card title="Vinderprocent" icon={<span>🏆</span>}>
          <div className="kpi">
            <div className="kpi__value">{useKpis().percent}%</div>
            <div className="muted">
              {useKpis().wins} sejre af {useKpis().total} kampe
            </div>
          </div>
        </Card>

        {/* Kampe spillet */}
        <Card title="Kampe spillet" icon={<span>🎯</span>}>
          <div className="kpi">
            <div className="kpi__value">{useKpis().total}</div>
            <div className="muted">+{useKpis().thisMonthDelta} denne måned</div>
          </div>
        </Card>

        {/* Bøder */}
        <Card title="Bøder" icon={<span>💸</span>}>
          <div className="fines">
            <div>
              Manglende betaling:{" "}
              <b>
                {outstanding.amount.toLocaleString("da-DK", {
                  style: "currency",
                  currency: "DKK",
                })}
              </b>{" "}
              <span className="muted">({outstanding.count} ubetalt)</span>
            </div>
            <div className="fines__actions">
              <a className="btn btn--ghost" href="#" onClick={(e)=>e.preventDefault()}>
                Se dine bøder
              </a>
              {/* Erstat linket herunder med jeres rigtige MobilePay link */}
              <a
                className="btn btn--primary"
                href={`https://mobilepay.dk/erhverv/betalingslink?phone=12345678&amount=${outstanding.amount}&comment=B%C3%B8der`}
                target="_blank"
              >
                Betal nu med MobilePay
              </a>
            </div>
          </div>
        </Card>

        {/* Seneste kampe */}
        <Card title="Seneste kampe" icon={<span>🕓</span>}>
          <ul className="list">
            {recent.map((m) => (
              <li key={m.id} className="recent">
                <div className="recent__left">
                  <div className="muted">
                    {new Date(m.when).toISOString().slice(0, 10)} · {m.court}
                  </div>
                  <div className="recent__who">
                    {nameOf(m.a[0])} & {nameOf(m.a[1])} vs {nameOf(m.b[0])} & {nameOf(m.b[1])}
                  </div>
                </div>
                <div className="recent__score">
                  <b>
                    {m.scoreA}-{m.scoreB}
                  </b>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

/* ---------------- Ranglisten (simpel liste) ---------------- */

function RankingPage() {
  const rows = [...PLAYERS].sort((a, b) => b.elo - a.elo);
  return (
    <Card title="Ranglisten" icon={<span>📊</span>}>
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Spiller</th>
            <th>ELO</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p.id}>
              <td>{i + 1}</td>
              <td>{p.name}</td>
              <td>{p.elo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/* ---------------- Bøder side (læsevisning) ---------------- */

function FinesPage() {
  const mine = FINES.filter((f) => f.toPlayerId === CURRENT_PLAYER_ID);
  return (
    <Card title="Bøder" icon={<span>💸</span>}>
      {mine.length === 0 ? (
        <div className="muted">Du har ingen bøder 👍</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Match</th>
              <th>Beløb</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {mine.map((f) => (
              <tr key={f.id}>
                <td>{f.matchId ?? "-"}</td>
                <td>
                  {f.amount.toLocaleString("da-DK", { style: "currency", currency: "DKK" })}
                </td>
                <td>{f.status === "unpaid" ? "Ubetalt" : "Betalt"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/* ---------------- Placeholder sider ---------------- */

function Placeholder({ title }: { title: string }) {
  return (
    <Card title={title}>
      <div className="muted">Kommer snart…</div>
    </Card>
  );
}

/* =========================================================
   Basale styles — disse forventer at din src/index.css
   allerede har vores “card/grid/btn” klasser. Hvis ikke,
   virker det stadig nogenlunde, men pænere med dine CSS’er.
   ======================================================= */
