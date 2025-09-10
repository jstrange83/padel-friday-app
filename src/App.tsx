import React, { useEffect, useMemo, useState } from "react";

/* =========================================================
   Typer
   ======================================================= */
type Player = { id: string; name: string; elo: number; initials: string };
type Match = {
  id: string;
  when: string;       // ISO
  court: string;      // "Bane 1"
  isFriday: boolean;  // brugt til fredags-streaks
  a: string[];        // A-hold (player ids)
  b: string[];        // B-hold (player ids)
  scoreA: number;
  scoreB: number;
  points?: { id: string; name: string; value: number }[];  // ELO-point pr. spiller
};
type Fine = { id: string; toPlayerId: string; amount: number; status: "unpaid"|"paid"; matchId?: string };

/* =========================================================
   Storage helpers (localStorage)
   ======================================================= */
const LS_PLAYERS = "padel.players.v1";
const LS_MATCHES = "padel.matches.v1";

function load<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    if (!s) return fallback;
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
function save<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/* =========================================================
   Demo-data (første load). Derefter lever data i localStorage.
   ======================================================= */
const DEMO_PLAYERS: Player[] = [
  { id: "p1", name: "Emma Christensen", elo: 1520, initials: "EC" },
  { id: "p2", name: "Michael Sørensen", elo: 1490, initials: "MS" },
  { id: "p3", name: "Julie Rasmussen", elo: 1460, initials: "JR" },
  { id: "p4", name: "Lars Petersen", elo: 1440, initials: "LP" },
  { id: "p5", name: "Mette Hansen", elo: 1430, initials: "MH" },
  { id: "me", name: "Demo Bruger", elo: 1480, initials: "DB" },
];
const CURRENT_PLAYER_ID = "me";

const start = new Date(); start.setMonth(start.getMonth()-1); start.setHours(19,0,0,0);
const plusDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate()+n); return x.toISOString(); };

const DEMO_MATCHES: Match[] = [
  // Kommende
  { id:"u1", when: plusDays(start, 2), court:"Bane 3", isFriday:false, a:["p1","me"], b:["p3","p4"], scoreA:0, scoreB:0 },
  { id:"u2", when: plusDays(start, 5), court:"Bane 2", isFriday:false, a:["p1","p2"], b:["me","p3"], scoreA:0, scoreB:0 },
  { id:"u3", when: plusDays(start, 7), court:"Bane 1", isFriday:false, a:["p1","p2"], b:["p3","p4"], scoreA:0, scoreB:0 },
  // Fredage (spillede)
  { id:"f1", when: plusDays(start,-2),  court:"Bane 1", isFriday:true,  a:["p1","p2"], b:["p3","p4"], scoreA:6, scoreB:3 },
  { id:"f2", when: plusDays(start,-9),  court:"Bane 2", isFriday:true,  a:["p1","p3"], b:["p2","p4"], scoreA:7, scoreB:6 },
  { id:"f3", when: plusDays(start,-16), court:"Bane 2", isFriday:true,  a:["p1","me"], b:["p3","p2"], scoreA:6, scoreB:2 },
  // Øvrige
  { id:"m1", when: plusDays(start,-1),  court:"Bane 1", isFriday:false, a:["p1","p3"], b:["p2","me"], scoreA:6, scoreB:4 },
  { id:"m2", when: plusDays(start,-3),  court:"Bane 3", isFriday:false, a:["p1","p2"], b:["me","p5"], scoreA:2, scoreB:6 },
  { id:"m3", when: plusDays(start,-6),  court:"Bane 1", isFriday:false, a:["me","p1"], b:["p2","p3"], scoreA:6, scoreB:5 },
];

const DEMO_FINES: Fine[] = [
  { id:"fine1", toPlayerId:"me", amount:125, status:"unpaid", matchId:"m1" },
  { id:"fine2", toPlayerId:"me", amount: 75, status:"unpaid", matchId:"m2" },
  { id:"fine3", toPlayerId:"p2", amount: 50, status:"paid",   matchId:"m3" },
];

/* =========================================================
   Små hjælpere
   ======================================================= */
const nameOf = (players: Player[], id: string) => players.find(p => p.id === id)?.name ?? id;
const byNewest = (a: Match, b: Match) => new Date(b.when).getTime() - new Date(a.when).getTime();

/* =========================================================
   ELO (dobbelt) — individuelt med margin & underdog bonus
   ======================================================= */
/**
 * Regler vi bruger (enkle & stabile):
 * - Team ELO = gennemsnit af to spillere
 * - Forventning E = 1 / (1 + 10^((opp - team)/400))
 * - K_base = 24
 * - Margin bonus: K = K_base + 4 * (sejrsmargin)
 * - Underdog-bonus: hvis vinder-team har lavere team-ELO end modstander, multiplicér K med 1.15
 * - Fordel delt ligeligt mellem de 2 spillere på teamet
 */
function updateEloAfterMatch(
  players: Player[],
  aIds: string[],
  bIds: string[],
  scoreA: number,
  scoreB: number
): { newElo: Record<string, number>, deltas: Record<string, number> } {
  const getElo = (id: string) => players.find(p => p.id === id)!.elo;

  const aElo = (getElo(aIds[0]) + getElo(aIds[1])) / 2;
  const bElo = (getElo(bIds[0]) + getElo(bIds[1])) / 2;

  const margin = Math.abs(scoreA - scoreB);
  const K_base = 24;
  const K_margin = K_base + 4 * margin;

  const aExp = 1 / (1 + Math.pow(10, (bElo - aElo) / 400));
  const bExp = 1 / (1 + Math.pow(10, (aElo - bElo) / 400));

  const aWon = scoreA > scoreB;
  const bWon = scoreB > scoreA;

  const aUnderdog = aWon && aElo < bElo;
  const bUnderdog = bWon && bElo < aElo;

  const aK = aUnderdog ? K_margin * 1.15 : K_margin;
  const bK = bUnderdog ? K_margin * 1.15 : K_margin;

  const aDeltaTeam = aK * ((aWon ? 1 : 0) - aExp);
  const bDeltaTeam = bK * ((bWon ? 1 : 0) - bExp);

  const aEach = aDeltaTeam / 2;
  const bEach = bDeltaTeam / 2;

  const deltas: Record<string, number> = {
    [aIds[0]]: aEach,
    [aIds[1]]: aEach,
    [bIds[0]]: bEach,
    [bIds[1]]: bEach,
  };

  const newElo: Record<string, number> = {};
  for (const p of players) {
    newElo[p.id] = p.elo + (deltas[p.id] ?? 0);
  }
  return { newElo, deltas };
}

/* =========================================================
   UI Components (Card/Badge)
   ======================================================= */
function Card({children, title, icon, tone}:{children:React.ReactNode; title?:React.ReactNode; icon?:React.ReactNode; tone?:'blue'|'green'|'purple'|'yellow'|'red'|'none'}){
  return (
    <section className={`card ${tone??'none'}`}>
      {title && (
        <header className="card__header">
          <div className="card__title">
            {icon ? <span className="card__icon">{icon}</span> : null}
            <span>{title}</span>
          </div>
        </header>
      )}
      <div className="card__body">{children}</div>
    </section>
  );
}
function Badge({children}:{children:React.ReactNode}){ return <span className="badge">{children}</span> }

/* =========================================================
   App shell
   ======================================================= */
type Page = "Dashboard"|"Resultater"|"Ranglisten"|"Bøder"|"Admin";

export default function App(){
  const [players, setPlayers] = useState<Player[]>(() => load(LS_PLAYERS, DEMO_PLAYERS));
  const [matches, setMatches] = useState<Match[]>(() => load(LS_MATCHES, DEMO_MATCHES));
  const [page,setPage] = useState<Page>("Dashboard");

  useEffect(()=>{ save(LS_PLAYERS, players); }, [players]);
  useEffect(()=>{ save(LS_MATCHES, matches); }, [matches]);

  const fines = DEMO_FINES; // (vi flytter disse til storage senere)
  const outstanding = useMemo(()=>{
    const mine = fines.filter(f=>f.toPlayerId===CURRENT_PLAYER_ID && f.status==="unpaid");
    const amount = mine.reduce((s,f)=>s+f.amount,0);
    return { count: mine.length, amount };
  },[fines]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">PadelApp</div>
        <nav className="nav">
          {(["Dashboard","Resultater","Ranglisten","Bøder","Admin"] as Page[]).map(p=>(
            <button key={p} className={`nav__item ${p===page?'is-active':''}`} onClick={()=>setPage(p)}>{p}</button>
          ))}
        </nav>
        <div className="user">
          <div className="user__avatar">{players.find(p=>p.id===CURRENT_PLAYER_ID)?.initials ?? "ME"}</div>
          <div className="user__meta">
            <div className="user__name">{players.find(p=>p.id===CURRENT_PLAYER_ID)?.name ?? "Demo"}</div>
            <div className="user__sub">ELO {Math.round(players.find(p=>p.id===CURRENT_PLAYER_ID)?.elo ?? 0)}</div>
          </div>
        </div>
      </aside>

      <main className="main">
        {page==="Dashboard"   && <Dashboard players={players} matches={matches} outstanding={outstanding} />}
        {page==="Resultater"  && <ResultsPage players={players} setPlayers={setPlayers} matches={matches} setMatches={setMatches} />}
        {page==="Ranglisten"  && <RankingPage players={players} />}
        {page==="Bøder"       && <FinesPage outstanding={outstanding} />}
        {page==="Admin"       && <Placeholder title="Admin" />}
      </main>
    </div>
  );
}

/* =========================================================
   Dashboard (bruger state-data)
   ======================================================= */
function Dashboard({ players, matches, outstanding }:{
  players: Player[]; matches: Match[]; outstanding: {count:number; amount:number};
}){
  const kpi = useMemo(()=>{
    const played = matches.filter(m=>m.scoreA>0 || m.scoreB>0);
    const wins = played.filter(m=>m.scoreA>m.scoreB).length; // simpelt: A er “vores” i demo
    const total = played.length;
    const percent = total ? Math.round((wins/total)*100) : 0;
    return { total: Math.max(55, total), wins: Math.max(48, wins), percent, thisMonthDelta: 3 };
  },[matches]);

  const upcoming = matches
    .filter(m=>m.scoreA===0 && m.scoreB===0)
    .sort((a,b)=>new Date(a.when).getTime()-new Date(b.when).getTime())
    .slice(0,3);

  const recent = matches
    .filter(m=>m.scoreA>0 || m.scoreB>0)
    .sort(byNewest)
    .slice(0,5);

  // Mest aktive
  const most = useMemo(()=>{
    const counts: Record<string,number> = {};
    matches.forEach(m => [...m.a,...m.b].forEach(id => counts[id]=(counts[id]??0)+1));
    return Object.entries(counts)
      .map(([id,count])=>({id,name:nameOf(players,id),count}))
      .sort((a,b)=>b.count-a.count)
      .slice(0,3);
  },[matches,players]);

  // Aktuelle fredags-streaks
  const streaks = useMemo(()=>{
    const fridays = matches.filter(m=>m.isFriday).sort(byNewest);
    const res = players.map(p=>{
      let s=0;
      for(const f of fridays){
        const played = [...f.a,...f.b].includes(p.id);
        if (played) s++; else break;
      }
      return { id:p.id, name:p.name, streak:s };
    }).sort((a,b)=>b.streak-a.streak).slice(0,3);
    return res;
  },[matches,players]);

  return (
    <>
      <div className="welcome">
        <div className="welcome__title">Velkommen tilbage, {players.find(p=>p.id===CURRENT_PLAYER_ID)?.name?.split(" ")[0] ?? "Demo"}! 👋</div>
        <div className="welcome__text">
          Du har spillet <b>{kpi.total}</b> kampe og vundet <b>{kpi.wins}</b> af dem.
        </div>
      </div>

      <div className="grid grid--2">
        {/* Bøder øverst */}
        <Card title="Bøder" icon={<span>💸</span>}>
          <div className="fines">
            <div>
              Manglende betaling:{" "}
              <b>{outstanding.amount.toLocaleString("da-DK",{style:"currency",currency:"DKK"})}</b>{" "}
              <span className="muted">({outstanding.count} ubetalt)</span>
            </div>
            <div className="fines__actions">
              <a className="btn btn--ghost" href="#" onClick={(e)=>e.preventDefault()}>Se dine bøder</a>
              <a className="btn btn--primary"
                 href="https://qr.mobilepay.dk/box/ad9ee90d-789f-42e9-aad8-b3b3e6ba7a5a/pay-in"
                 target="_blank" rel="noreferrer">
                Betal med MobilePay
              </a>
            </div>
          </div>
        </Card>

        <Card title="Kommende kampe" icon={<span>📅</span>} tone="blue">
          <ul className="events">
            {upcoming.map(m=>(
              <li key={m.id} className="event">
                <div className="event__date">
                  {new Date(m.when).toISOString().slice(0,10)} <Badge>{new Date(m.when).toTimeString().slice(0,5)}</Badge>
                </div>
                <div className="event__who">
                  <div className="event__line"><b>vs {nameOf(players,m.a[0])} & {nameOf(players,m.a[1])}</b></div>
                  <div className="event__line">— {nameOf(players,m.b[0])} & {nameOf(players,m.b[1])}</div>
                  <div className="muted">{m.court}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Månedens spiller" icon={<span>⭐</span>} tone="yellow">
          <div className="month">
            <div className="avatar avatar--lg">EC</div>
            <div className="month__col">
              <div className="month__name">Emma Christensen</div>
              <div className="bar"><span style={{width:"82%"}}/></div>
              <div className="muted">18/22 sejre</div>
            </div>
          </div>
        </Card>

        <Card title="Mest aktive (Top 3)" icon={<span>📈</span>} tone="green">
          <ol className="ranked">
            {most.map((r,i)=>(
              <li key={r.id} className="ranked__row">
                <span className="ranked__dot">{i+1}</span>
                <span className="ranked__name">{r.name}</span>
                <span className="ranked__badge">{r.count}</span>
                <span className="muted">kampe</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Flest fredage i træk (Top 3)" icon={<span>✅</span>} tone="purple">
          <ol className="ranked">
            {streaks.map((r,i)=>(
              <li key={r.id} className="ranked__row">
                <span className="ranked__dot">{i+1}</span>
                <span className="ranked__name">{r.name}</span>
                <span className="ranked__badge">{r.streak}</span>
                <span className="muted">fredage i træk</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Vinderprocent" icon={<span>🏆</span>}>
          <div className="kpi">
            <div className="kpi__value">{kpi.percent}%</div>
            <div className="muted">{kpi.wins} sejre af {kpi.total} kampe</div>
          </div>
        </Card>

        <Card title="Kampe spillet" icon={<span>🎯</span>}>
          <div className="kpi">
            <div className="kpi__value">{kpi.total}</div>
            <div className="muted">+{kpi.thisMonthDelta} denne måned</div>
          </div>
        </Card>
      </div>

      {/* Seneste kampe */}
      <Card title="Seneste kampe" icon={<span>🕓</span>}>
        <ul className="recent">
          {matches.filter(m=>m.scoreA>0 || m.scoreB>0).sort(byNewest).slice(0,5).map(m=>(
            <li key={m.id} className="recent__row">
              <div>
                <div className="muted">{new Date(m.when).toISOString().slice(0,10)} · {m.court}</div>
                <div className="recent__who">
                  {nameOf(players,m.a[0])} & {nameOf(players,m.a[1])} vs {nameOf(players,m.b[0])} & {nameOf(players,m.b[1])}
                </div>
                {m.points && (
                  <div className="muted" style={{marginTop:4}}>
                    Point: {m.points.map(p=>`${p.name} ${p.value>0?'+':''}${Math.round(p.value)}`).join(' · ')}
                  </div>
                )}
              </div>
              <div className="recent__score"><b>{m.scoreA}-{m.scoreB}</b></div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

/* =========================================================
   Resultater (indtast kamp)
   ======================================================= */
function ResultsPage({
  players, setPlayers, matches, setMatches
}:{
  players: Player[]; setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  matches: Match[]; setMatches: React.Dispatch<React.SetStateAction<Match[]>>;
}){
  const [a1,setA1] = useState<string>("p1");
  const [a2,setA2] = useState<string>("p2");
  const [b1,setB1] = useState<string>("p3");
  const [b2,setB2] = useState<string>("p4");
  const [scoreA,setScoreA] = useState<number>(6);
  const [scoreB,setScoreB] = useState<number>(3);
  const [when,setWhen] = useState<string>(new Date().toISOString().slice(0,16)); // yyyy-MM-ddTHH:mm
  const [court,setCourt] = useState<string>("Bane 1");
  const [isFriday,setIsFriday] = useState<boolean>(false);
  const [msg,setMsg] = useState<string>("");

  const allIds = players.map(p=>p.id);

  function validateScore(a:number,b:number): string | null {
    // ét sæt, gyldige eksempler: 6-0, 6-4, 7-5, 7-6. Ugyldig: 6-5, 7-4, 7-7, 6-6
    const hi = Math.max(a,b), lo = Math.min(a,b);
    if (a===b) return "Uafgjort er ikke tilladt (ét sæt).";
    if (hi===6 && lo<=4) return null;
    if (hi===7 && (lo===5 || lo===6)) return null;
    return "Ugyldig score. Et sæt slutter 6–0..4 eller 7–5/7–6.";
  }
  function distinctTeams(): string | null {
    const set = new Set([a1,a2,b1,b2]);
    if (set.size<4) return "Den samme spiller kan ikke være valgt på begge hold.";
    return null;
  }

  function onSubmit(e: React.FormEvent){
    e.preventDefault();
    setMsg("");
    const err1 = distinctTeams();
    if (err1) { setMsg(err1); return; }
    const err2 = validateScore(scoreA, scoreB);
    if (err2) { setMsg(err2); return; }

    const { newElo, deltas } = updateEloAfterMatch(players, [a1,a2], [b1,b2], scoreA, scoreB);

    // opdater spillere
    setPlayers(prev => prev.map(p => ({...p, elo: Math.round((newElo[p.id] ?? p.elo))})));

    // gem match + points
    const points = [
      { id:a1, name:nameOf(players,a1), value:deltas[a1] },
      { id:a2, name:nameOf(players,a2), value:deltas[a2] },
      { id:b1, name:nameOf(players,b1), value:deltas[b1] },
      { id:b2, name:nameOf(players,b2), value:deltas[b2] },
    ];
    const m: Match = {
      id: `m-${Date.now()}`,
      when: new Date(when).toISOString(),
      court, isFriday,
      a:[a1,a2], b:[b1,b2],
      scoreA, scoreB,
      points
    };
    setMatches(prev => [m, ...prev]);

    setMsg("Resultat gemt ✅ — se det på Dashboard og Ranglisten.");
  }

  return (
    <Card title="Indtast resultat" icon={<span>✍️</span>}>
      <form onSubmit={onSubmit} className="form">
        <div className="form__row">
          <div className="form__col">
            <label className="lbl">Hold A</label>
            <div className="grid2">
              <select value={a1} onChange={e=>setA1(e.target.value)}>{allIds.map(id=><option key={id} value={id}>{nameOf(players,id)}</option>)}</select>
              <select value={a2} onChange={e=>setA2(e.target.value)}>{allIds.map(id=><option key={id} value={id}>{nameOf(players,id)}</option>)}</select>
            </div>
          </div>
          <div className="form__col">
            <label className="lbl">Hold B</label>
            <div className="grid2">
              <select value={b1} onChange={e=>setB1(e.target.value)}>{allIds.map(id=><option key={id} value={id}>{nameOf(players,id)}</option>)}</select>
              <select value={b2} onChange={e=>setB2(e.target.value)}>{allIds.map(id=><option key={id} value={id}>{nameOf(players,id)}</option>)}</select>
            </div>
          </div>
        </div>

        <div className="form__row">
          <div className="form__col">
            <label className="lbl">Score (A–B)</label>
            <div className="grid2">
              <input type="number" min={0} max={7} value={scoreA} onChange={e=>setScoreA(Number(e.target.value))} />
              <input type="number" min={0} max={7} value={scoreB} onChange={e=>setScoreB(Number(e.target.value))} />
            </div>
          </div>
          <div className="form__col">
            <label className="lbl">Hvornår / Bane</label>
            <div className="grid2">
              <input type="datetime-local" value={when} onChange={e=>setWhen(e.target.value)} />
              <input type="text" value={court} onChange={e=>setCourt(e.target.value)} />
            </div>
            <label className="chk"><input type="checkbox" checked={isFriday} onChange={e=>setIsFriday(e.target.checked)} /> Dette var en fredagskamp</label>
          </div>
        </div>

        {msg && <div className="note">{msg}</div>}

        <div className="form__actions">
          <button className="btn btn--primary" type="submit">Gem resultat</button>
        </div>
      </form>
    </Card>
  );
}

/* =========================================================
   Ranglisten
   ======================================================= */
function RankingPage({players}:{players: Player[]}){
  const rows = [...players].sort((a,b)=>b.elo-a.elo);
  return (
    <Card title="Ranglisten" icon={<span>📊</span>}>
      <table className="table">
        <thead><tr><th>#</th><th>Spiller</th><th>ELO</th></tr></thead>
        <tbody>
          {rows.map((p,i)=>(
            <tr key={p.id}><td>{i+1}</td><td>{p.name}</td><td>{Math.round(p.elo)}</td></tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/* =========================================================
   Bøder (læsevisning fra demo)
   ======================================================= */
function FinesPage({outstanding}:{outstanding:{count:number; amount:number}}){
  return (
    <Card title="Bøder" icon={<span>💸</span>}>
      <div className="fines">
        <div>
          Manglende betaling: <b>{outstanding.amount.toLocaleString("da-DK",{style:"currency",currency:"DKK"})}</b>{" "}
          <span className="muted">({outstanding.count} ubetalt)</span>
        </div>
        <div className="fines__actions">
          <a className="btn btn--primary"
             href="https://qr.mobilepay.dk/box/ad9ee90d-789f-42e9-aad8-b3b3e6ba7a5a/pay-in"
             target="_blank" rel="noreferrer">
            Betal med MobilePay
          </a>
        </div>
      </div>
    </Card>
  );
}

/* =========================================================
   Placeholder
   ======================================================= */
function Placeholder({title}:{title:string}){
  return <Card title={title}><div className="muted">Kommer snart…</div></Card>;
}
