import React, { useMemo, useState } from "react";

/* =========================
   Typer
   ======================= */
type Player = { id: string; name: string; elo: number; initials: string };
type Match = {
  id: string;
  when: string;
  court: string;
  isFriday: boolean;
  a: string[];
  b: string[];
  scoreA: number;
  scoreB: number;
};
type Fine = { id: string; toPlayerId: string; amount: number; status: "unpaid"|"paid"; matchId?: string };

/* =========================
   Demo-data
   ======================= */
const PLAYERS: Player[] = [
  { id: "p1", name: "Emma Christensen", elo: 1520, initials: "EC" },
  { id: "p2", name: "Michael Sørensen", elo: 1490, initials: "MS" },
  { id: "p3", name: "Julie Rasmussen", elo: 1460, initials: "JR" },
  { id: "p4", name: "Lars Petersen", elo: 1440, initials: "LP" },
  { id: "p5", name: "Mette Hansen", elo: 1430, initials: "MH" },
  { id: "me", name: "Demo Bruger", elo: 1480, initials: "DB" },
];
const CURRENT_PLAYER_ID = "me";

const nameOf = (id: string) => PLAYERS.find(p => p.id === id)?.name ?? id;
const byNewest = (a: Match, b: Match) => new Date(b.when).getTime() - new Date(a.when).getTime();

const start = new Date(); start.setMonth(start.getMonth()-1); start.setHours(19,0,0,0);
const plusDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate()+n); return x.toISOString(); };

const MATCHES: Match[] = [
  { id:"u1", when: plusDays(start, 2), court:"Bane 3", isFriday:false, a:["p1","me"], b:["p3","p4"], scoreA:0, scoreB:0 },
  { id:"u2", when: plusDays(start, 5), court:"Bane 2", isFriday:false, a:["p1","p2"], b:["me","p3"], scoreA:0, scoreB:0 },
  { id:"u3", when: plusDays(start, 7), court:"Bane 1", isFriday:false, a:["p1","p2"], b:["p3","p4"], scoreA:0, scoreB:0 },
  { id:"f1", when: plusDays(start,-2),  court:"Bane 1", isFriday:true,  a:["p1","p2"], b:["p3","p4"], scoreA:6, scoreB:3 },
  { id:"f2", when: plusDays(start,-9),  court:"Bane 2", isFriday:true,  a:["p1","p3"], b:["p2","p4"], scoreA:7, scoreB:6 },
  { id:"f3", when: plusDays(start,-16), court:"Bane 2", isFriday:true,  a:["p1","me"], b:["p3","p2"], scoreA:6, scoreB:2 },
  { id:"m1", when: plusDays(start,-1),  court:"Bane 1", isFriday:false, a:["p1","p3"], b:["p2","me"], scoreA:6, scoreB:4 },
  { id:"m2", when: plusDays(start,-3),  court:"Bane 3", isFriday:false, a:["p1","p2"], b:["me","p5"], scoreA:2, scoreB:6 },
  { id:"m3", when: plusDays(start,-6),  court:"Bane 1", isFriday:false, a:["me","p1"], b:["p2","p3"], scoreA:6, scoreB:5 },
];

const FINES: Fine[] = [
  { id:"fine1", toPlayerId:"me", amount:125, status:"unpaid", matchId:"m1" },
  { id:"fine2", toPlayerId:"me", amount: 75, status:"unpaid", matchId:"m2" },
  { id:"fine3", toPlayerId:"p2", amount: 50, status:"paid",   matchId:"m3" },
];

/* =========================
   Udregninger
   ======================= */
function useKpis(){
  return useMemo(()=>({ total:55, wins:48, percent:Math.round(48/55*100), thisMonthDelta:3 }),[]);
}
function useMostActiveTop3(){
  return useMemo(()=>{
    const counts: Record<string,number> = {};
    MATCHES.forEach(m => [...m.a,...m.b].forEach(id => counts[id]=(counts[id]??0)+1));
    return Object.entries(counts)
      .map(([id,count])=>({id,name:nameOf(id),count}))
      .sort((a,b)=>b.count-a.count)
      .slice(0,3);
  },[]);
}
function useFridayStreaksTop3(){
  return useMemo(()=>{
    const fridays = MATCHES.filter(m=>m.isFriday).sort(byNewest);
    const streaks: Record<string,number> = {};
    for(const p of PLAYERS){
      let s=0;
      for(const f of fridays){
        const played = [...f.a,...f.b].includes(p.id);
        if(played) s++; else break;
      }
      streaks[p.id]=s;
    }
    return Object.entries(streaks)
      .map(([id,streak])=>({id, name:nameOf(id), streak}))
      .sort((a,b)=>b.streak-a.streak)
      .slice(0,3);
  },[]);
}
function useOutstandingFines(){
  return useMemo(()=>{
    const mine = FINES.filter(f=>f.toPlayerId===CURRENT_PLAYER_ID && f.status==="unpaid");
    const amount = mine.reduce((s,f)=>s+f.amount,0);
    return { count: mine.length, amount };
  },[]);
}

/* =========================
   UI Components
   ======================= */
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

/* =========================
   App
   ======================= */
type Page = "Dashboard"|"Fredagspadel"|"Ranglisten"|"Bøder"|"Admin";

export default function App(){
  const [page,setPage] = useState<Page>("Dashboard");
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">PadelApp</div>
        <nav className="nav">
          {(["Dashboard","Fredagspadel","Ranglisten","Bøder","Admin"] as Page[]).map(p=>(
            <button key={p} className={`nav__item ${p===page?'is-active':''}`} onClick={()=>setPage(p)}>{p}</button>
          ))}
        </nav>
        <div className="user">
          <div className="user__avatar">{PLAYERS.find(p=>p.id===CURRENT_PLAYER_ID)?.initials ?? "ME"}</div>
          <div className="user__meta">
            <div className="user__name">{nameOf(CURRENT_PLAYER_ID)}</div>
            <div className="user__sub">#15 · Demo</div>
          </div>
        </div>
      </aside>

      <main className="main">
        {page==="Dashboard"   && <Dashboard />}
        {page==="Fredagspadel"&& <Placeholder title="Fredagspadel" />}
        {page==="Ranglisten"  && <RankingPage />}
        {page==="Bøder"       && <FinesPage />}
        {page==="Admin"       && <Placeholder title="Admin" />}
      </main>
    </div>
  );
}

/* =========================
   Pages
   ======================= */
function Dashboard(){
  const kpi = useKpis();
  const most = useMostActiveTop3();
  const streaks = useFridayStreaksTop3();
  const outstanding = useOutstandingFines();

  const upcoming = MATCHES.filter(m=>m.scoreA===0 && m.scoreB===0)
    .sort((a,b)=>new Date(a.when).getTime()-new Date(b.when).getTime())
    .slice(0,3);

  return (
    <>
      <div className="welcome">
        <div className="welcome__title">Velkommen tilbage, Demo! 👋</div>
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
                 target="_blank">
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
                  <div className="event__line"><b>vs {nameOf(m.a[0])} & {nameOf(m.a[1])}</b></div>
                  <div className="event__line">— {nameOf(m.b[0])} & {nameOf(m.b[1])}</div>
                  <div className="muted"> {m.court}</div>
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
    </>
  );
}

function RankingPage(){
  const rows = [...PLAYERS].sort((a,b)=>b.elo-a.elo);
  return (
    <Card title="Ranglisten" icon={<span>📊</span>}>
      <table className="table">
        <thead><tr><th>#</th><th>Spiller</th><th>ELO</th></tr></thead>
        <tbody>
          {rows.map((p,i)=>(
            <tr key={p.id}><td>{i+1}</td><td>{p.name}</td><td>{p.elo}</td></tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function FinesPage(){
  const mine = FINES.filter(f=>f.toPlayerId===CURRENT_PLAYER_ID);
  return (
    <Card title="Bøder" icon={<span>💸</span>}>
      {mine.length===0 ? (
        <div className="muted">Du har ingen bøder 👍</div>
      ) : (
        <table className="table">
          <thead><tr><th>Match</th><th>Beløb</th><th>Status</th></tr></thead>
          <tbody>
            {mine.map(f=>(
              <tr key={f.id}>
                <td>{f.matchId ?? "-"}</td>
                <td>{f.amount.toLocaleString("da-DK",{style:"currency",currency:"DKK"})}</td>
                <td>{f.status==="unpaid"?"Ubetalt":"Betalt"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function Placeholder({title}:{title:string}){
  return <Card title={title}><div className="muted">Kommer snart…</div></Card>;
}
