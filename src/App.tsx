import React, { useMemo, useState } from "react";

/** -------------------- Typer & dummy-data -------------------- */
type Player = { id: string; name: string; elo: number; fridays: string[] }; // fridays = datoer (YYYY-MM-DD) spilleren deltog
type Match = {
  id: string;
  when: string; // ISO
  a: string[];  // A-hold (2 ids)
  b: string[];  // B-hold (2 ids)
  scoreA: number;
  scoreB: number;
};

const PLAYERS: Player[] = [
  { id: "p1", name: "Emma Christensen", elo: 1520, fridays: ["2024-08-23","2024-08-30","2024-09-06"] },
  { id: "p2", name: "Michael Sørensen", elo: 1490, fridays: ["2024-08-23","2024-09-06"] },
  { id: "p3", name: "Julie Rasmussen", elo: 1460, fridays: ["2024-08-23"] },
  { id: "p4", name: "Lars Petersen", elo: 1440, fridays: ["2024-08-23","2024-08-30","2024-09-06","2024-09-13"] },
  { id: "p5", name: "Mette Hansen", elo: 1430, fridays: ["2024-09-06"] },
  { id: "p6", name: "Sara Nielsen", elo: 1420, fridays: ["2024-08-30","2024-09-06"] },
  { id: "p7", name: "Alex Hansen", elo: 1410, fridays: ["2024-08-23","2024-08-30"] },
  { id: "p8", name: "Demo Bruger", elo: 1480, fridays: ["2024-08-30","2024-09-06"] },
];

// 55 kampe (vi laver bare et antal med tilfældig score for demo)
function demoMatches(): Match[] {
  const ids = PLAYERS.map(p => p.id);
  const list: Match[] = [];
  for (let i=0;i<55;i++){
    const shuffled = [...ids].sort(()=>Math.random()-0.5);
    const a = shuffled.slice(0,2);
    const b = shuffled.slice(2,4);
    const scoreA = Math.floor(Math.random()*8); // 0..7
    const scoreB = Math.floor(Math.random()*8);
    // undgå helt lige
    if (scoreA===scoreB) (Math.random()<0.5 ? ( (scoreA+1)<=7 ? ( (list.push as any) : null) : null ) : null);
    list.push({
      id:`m${i}`,
      when: new Date(Date.now()-i*86400000).toISOString(),
      a,b,scoreA,scoreB
    });
  }
  return list;
}
const MATCHES: Match[] = demoMatches();

/** -------------------- Hjælpere -------------------- */
const PAGES = {
  DASHBOARD: "Dashboard",
  FRIDAY: "Fredagspadel",
  RANKING: "Ranglisten",
  FINES: "Bøder",
  PROFILE: "Profil",
  ADMIN: "Admin",
} as const;
type Page = typeof PAGES[keyof typeof PAGES];

function Card({title, icon, children}: {title: React.ReactNode; icon?: React.ReactNode; children: React.ReactNode}) {
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">{icon && <span className="card-icon">{icon}</span>}{title}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function pct(n: number){ return Math.round(n*100); }
function formatDate(dISO: string){
  const d = new Date(dISO);
  const yyyy = d.getFullYear();
  const mm = `${d.getMonth()+1}`.padStart(2,"0");
  const dd = `${d.getDate()}`.padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Mest aktive: top 3 på antal kampe */
function useMostActiveTop3(matches: Match[]){
  return useMemo(()=>{
    const count = new Map<string,number>();
    for (const m of matches){
      for (const id of [...m.a, ...m.b]){
        count.set(id, (count.get(id) ?? 0)+1);
      }
    }
    const arr = PLAYERS.map(p => ({
      id: p.id, name: p.name, count: count.get(p.id) ?? 0
    })).sort((a,b)=>b.count-a.count).slice(0,3);
    return arr;
  }, [matches]);
}

/** Flest fredage i træk (aktuel streak) – top 3 */
function useFridayStreakTop3(players: Player[]){
  return useMemo(()=>{
    // find længste *aktuelle* streak baglæns fra seneste fredag
    function currentStreak(fridays: string[]){
      if (fridays.length===0) return 0;
      const set = new Set(fridays);
      // find seneste fredag (fra i dag baglæns)
      const DAY=86400000, now = new Date();
      let d = new Date(now);
      // hop til seneste fredag
      while(d.getDay()!==5){ d = new Date(d.getTime()-DAY); }
      let streak=0;
      while(set.has(formatDate(d.toISOString()))){
        streak++;
        d = new Date(d.getTime()-7*DAY);
      }
      return streak;
    }
    const arr = players.map(p=>({id:p.id,name:p.name,streak:currentStreak(p.fridays)}))
      .sort((a,b)=>b.streak-a.streak)
      .slice(0,3);
    return arr;
  }, [players]);
}

/** Winrate & total */
function useWinStats(matches: Match[]){
  return useMemo(()=>{
    let wins=0, total=matches.length;
    for (const m of matches){
      if (m.scoreA>m.scoreB) wins++; // vi tæller bare A som “vores hold” i demo
    }
    return {wins, total, pct: total? Math.round((wins/total)*100) : 0};
  },[matches]);
}

/** -------------------- App -------------------- */
export default function App(){
  const [page, setPage] = useState<Page>(PAGES.DASHBOARD);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">PadelApp</div>
        <nav className="nav">
          {Object.values(PAGES).map(p=>(
            <button key={p} onClick={()=>setPage(p)} className={`nav-btn ${page===p?"active":""}`}>{p}</button>
          ))}
        </nav>
      </aside>

      <main className="main">
        {page===PAGES.DASHBOARD && <Dashboard />}
        {page!==PAGES.DASHBOARD && (
          <div className="placeholder">“{page}” siden er ikke bygget færdig endnu i denne deployment – vi fokuserer på Dashboard her.</div>
        )}
      </main>
    </div>
  );
}

/** -------------------- Dashboard -------------------- */
function Dashboard(){
  const upcoming = useMemo(()=>{
    // tre kommende dummy-kampe i UI-venligt format
    const base = new Date();
    const add = (days: number) => new Date(base.getTime()+days*86400000).toISOString();
    return [
      { when:add(2), title:"vs Emma Christensen & Michael Sørensen — Julie Rasmussen & Lars Petersen", court:"Bane 3", time:"19:00" },
      { when:add(4), title:"vs Emma Christensen & Michael Sørensen — Julie Rasmussen & Lars Petersen", court:"Bane 2", time:"19:00" },
      { when:add(6), title:"vs Emma Christensen & Michael Sørensen — Julie Rasmussen & Lars Petersen", court:"Bane 1", time:"19:00" },
    ];
  }, []);

  const mostActive = useMostActiveTop3(MATCHES);
  const streaks = useFridayStreakTop3(PLAYERS);
  const win = useWinStats(MATCHES);

  return (
    <div className="page">
      <h1>Dashboard</h1>

      {/* Velkomst */}
      <div className="welcome">
        <div className="welcome-title">Velkommen tilbage, Demo! <span>👋</span></div>
        <div className="welcome-sub">Du har spillet {MATCHES.length} kampe og vundet {win.wins} af dem. Fortsæt den gode udvikling!</div>
      </div>

      <div className="grid-2">
        {/* Kommende kampe */}
        <Card title="Kommende Kampe" icon={<span>📅</span>}>
          <ul className="list">
            {upcoming.map((k,idx)=>(
              <li className="list-item" key={idx}>
                <div className="list-date">{formatDate(k.when)} <span className="badge">{k.time}</span></div>
                <div className="list-title">{k.title}</div>
                <div className="list-muted">{k.court}</div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Månedens spiller (statisk demo) */}
        <Card title="Månedens Spiller" icon={<span>⭐</span>}>
          <div className="player-row">
            <div className="avatar">EC</div>
            <div>
              <div className="player-name">Emma Christensen</div>
              <div className="list-muted">18/22 sejre</div>
            </div>
          </div>
          <div className="bar">
            <div className="bar-fill" style={{width:"85%"}} />
          </div>
        </Card>
      </div>

      <div className="grid-2">
        {/* Mest aktive */}
        <Card title="Mest Aktive (Top 3)" icon={<span>📈</span>}>
          <ul className="top-list">
            {mostActive.map((m, i)=>(
              <li key={m.id} className="top-row">
                <span className="rank">{i+1}</span>
                <span className="name">{m.name}</span>
                <span className="pill">{m.count}</span>
                <span className="muted">kampe</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Flest fredage i træk */}
        <Card title="Flest fredage i træk (Top 3)" icon={<span>🟢</span>}>
          <ul className="top-list">
            {streaks.map((s,i)=>(
              <li key={s.id} className="top-row">
                <span className="rank">{i+1}</span>
                <span className="name">{s.name}</span>
                <span className="pill">{s.streak}</span>
                <span className="muted">fredage i træk</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid-2">
        {/* Vinderprocent */}
        <Card title="Vinderprocent" icon={<span>🏆</span>}>
          <div className="kpi">
            <div className="kpi-value">{win.pct}%</div>
            <div className="list-muted">{win.wins} sejre af {win.total} kampe</div>
          </div>
        </Card>

        {/* Kampe spillet */}
        <Card title="Kampe spillet" icon={<span>🎯</span>}>
          <div className="kpi">
            <div className="kpi-value">{MATCHES.length}</div>
            <div className="list-muted">+3 denne måned</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
