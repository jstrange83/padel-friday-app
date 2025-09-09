// src/App.tsx
import React, { useEffect, useState } from 'react'
import { buildFairSchedule, type Player as P0, type Game } from './lib/fairPairing'
import { updateEloDoubles } from './lib/elo'

export type Player = P0;

type MatchRec = {
  id: string;
  when: string;          // ISO string
  aNames: string[];
  bNames: string[];
  scoreA: number;
  scoreB: number;
  deltas?: { id: string; name: string; delta: number }[]; // ELO-ændring pr. spiller
};

const INITIAL_PLAYERS: Player[] = [
  { id: 'p1', name: 'Emma Christensen', elo: 1520 },
  { id: 'p2', name: 'Michael Sørensen', elo: 1490 },
  { id: 'p3', name: 'Julie Rasmussen', elo: 1460 },
  { id: 'p4', name: 'Lars Petersen', elo: 1440 },
  { id: 'p5', name: 'Mette Hansen', elo: 1430 },
  { id: 'p6', name: 'Jonas Mikkelsen', elo: 1400 },
  { id: 'p7', name: 'Camilla Falk', elo: 1380 },
  { id: 'p8', name: 'Nikolaj Friis', elo: 1350 }
];

type Page = 'Dashboard'|'Fredagspadel'|'Ranglisten'|'Admin';

const LS_PLAYERS = 'padel.players.v1';
const LS_MATCHES = 'padel.matches.v1';

export default function App(){
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS);
  const [matches, setMatches] = useState<MatchRec[]>([]);
  const [page, setPage] = useState<Page>('Fredagspadel');

  // --- localStorage: load once on mount ---
  useEffect(()=>{
    try {
      const P = localStorage.getItem(LS_PLAYERS);
      const M = localStorage.getItem(LS_MATCHES);
      if (P) setPlayers(JSON.parse(P));
      if (M) setMatches(JSON.parse(M));
    } catch {}
  }, []);

  // --- localStorage: save on changes ---
  useEffect(()=>{
    try { localStorage.setItem(LS_PLAYERS, JSON.stringify(players)); } catch {}
  }, [players]);
  useEffect(()=>{
    try { localStorage.setItem(LS_MATCHES, JSON.stringify(matches)); } catch {}
  }, [matches]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">PadelApp</div>
        <nav className="nav">
          {(['Dashboard','Fredagspadel','Ranglisten','Admin'] as Page[]).map(p=>(
            <button key={p} onClick={()=>setPage(p)} className={page===p?'active':''}>{p}</button>
          ))}
        </nav>
      </aside>
      <main>
        {page==='Dashboard'   && <Dashboard matches={matches} />}
        {page==='Fredagspadel' && (
          <FridayPadel
            players={players}
            setPlayers={setPlayers}
            onSaveMatch={(m)=>setMatches(prev=>[m, ...prev].slice(0,50))}
          />
        )}
        {page==='Ranglisten'  && <Ranking players={players} />}
        {page==='Admin'       && <Admin onReset={()=>{localStorage.clear(); location.reload();}} />}
      </main>
    </div>
  );
}

function Card(props: {title?: string, children: React.ReactNode, right?: React.ReactNode}){
  return (
    <div className="card">
      <div className="row spread" style={{marginBottom:8}}>
        {props.title ? <h2>{props.title}</h2> : <div />}
        {props.right}
      </div>
      {props.children}
    </div>
  )
}

/* ---------------- Dashboard ---------------- */
function Dashboard({ matches }:{ matches: MatchRec[] }){
  return (
    <div className="grid grid-2">
      <Card title="Kommende kampe">(dummy)</Card>

      <Card title="Seneste kampe" right={<span className="pill">{matches.length}</span>}>
        {matches.length===0 ? (
          <div style={{color:'var(--muted)'}}>Ingen kampe endnu.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Dato</th>
                <th>Hold A</th>
                <th>Hold B</th>
                <th>Resultat</th>
                <th>Δ pr. spiller</th>
              </tr>
            </thead>
            <tbody>
              {matches.slice(0,8).map(m=>(
                <tr key={m.id}>
                  <td>{new Date(m.when).toLocaleString('da-DK')}</td>
                  <td>{m.aNames.join(' & ')}</td>
                  <td>{m.bNames.join(' & ')}</td>
                  <td>{m.scoreA} – {m.scoreB}</td>
                  <td>
                    {m.deltas && m.deltas.length ? (
                      <div className="row" style={{gap:6, flexWrap:'wrap'}}>
                        {m.deltas.map(pd => {
                          const pos = pd.delta >= 0;
                          const bg  = pos ? '#eaffea' : '#ffeaea';
                          const fg  = pos ? '#166534' : '#991b1b';
                          const sign = pd.delta > 0 ? `+${pd.delta}` : `${pd.delta}`;
                          const first = pd.name.split(' ')[0];
                          return (
                            <span key={pd.id} className="pill" style={{background:bg, color:fg}}>
                              {first} {sign}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span style={{color:'var(--muted)'}}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

/* ---------------- Ranglisten ---------------- */
function Ranking({ players }:{ players: Player[] }){
  const sorted = [...players].sort((a,b)=>b.elo - a.elo);
  return (
    <div className="grid">
      <Card title="Ranglisten">
        <table>
          <thead>
            <tr><th>#</th><th>Spiller</th><th>ELO</th></tr>
          </thead>
          <tbody>
            {sorted.map((p,idx)=>(
              <tr key={p.id}>
                <td>{idx+1}</td>
                <td>{p.name}</td>
                <td>{p.elo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* --------------- Fredagspadel --------------- */
type Result = { a: number; b: number; saved?: boolean };

function FridayPadel({
  players, setPlayers, onSaveMatch
}:{ players: Player[]; setPlayers: React.Dispatch<React.SetStateAction<Player[]>>; onSaveMatch:(m:MatchRec)=>void }){
  const [signedUp, setSignedUp] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<Game[]>([]);
  const [results, setResults] = useState<Record<string, Result>>({}); // game.id -> result

  function toggle(pid: string){
    setSignedUp(prev => prev.includes(pid) ? prev.filter(x=>x!==pid) : [...prev, pid]);
  }
  function generate(){
    const list = players.filter(p => signedUp.includes(p.id));
    if (list.length < 4){
      alert('Minimum 4 spillere kræves');
      return;
    }
    const games = buildFairSchedule(list);
    setSchedule(games);
    setResults({});
  }

  function setScore(gid: string, side: 'a'|'b', val: number){
    setResults(prev => ({...prev, [gid]: {...prev[gid], [side]: val} as Result}));
  }

  function saveResult(g: Game){
    const r = results[g.id];
    if (!r || r.a == null || r.b == null) { alert('Vælg score for begge hold (0–7)'); return; }
    if (r.a === r.b) { alert('Uafgjort er ikke tilladt – ét sæt skal have vinder'); return; }

    const [A1, A2] = g.teams[0];
    const [B1, B2] = g.teams[1];

    // Nye ratings beregnes ud fra aktuelle ELO
    const newMap = updateEloDoubles(
      { id: A1.id, elo: players.find(p=>p.id===A1.id)!.elo },
      { id: A2.id, elo: players.find(p=>p.id===A2.id)!.elo },
      { id: B1.id, elo: players.find(p=>p.id===B1.id)!.elo },
      { id: B2.id, elo: players.find(p=>p.id===B2.id)!.elo },
      r.a, r.b
    );

    // Deltas pr. spiller (ny - gammel)
    const oldRatings: Record<string, number> = {
      [A1.id]: players.find(p=>p.id===A1.id)!.elo,
      [A2.id]: players.find(p=>p.id===A2.id)!.elo,
      [B1.id]: players.find(p=>p.id===B1.id)!.elo,
      [B2.id]: players.find(p=>p.id===B2.id)!.elo,
    };
    const deltas = [
      { id: A1.id, name: A1.name, delta: newMap[A1.id] - oldRatings[A1.id] },
      { id: A2.id, name: A2.name, delta: newMap[A2.id] - oldRatings[A2.id] },
      { id: B1.id, name: B1.name, delta: newMap[B1.id] - oldRatings[B1.id] },
      { id: B2.id, name: B2.name, delta: newMap[B2.id] - oldRatings[B2.id] },
    ];

    // Opdater spillere i state
    setPlayers(prev => prev.map(p => newMap[p.id] != null ? {...p, elo: newMap[p.id]} : p));
    setResults(prev => ({...prev, [g.id]: {...r, saved: true}}));

    // Gem kamp til Dashboard + localStorage
    onSaveMatch({
      id: `${g.id}-${Date.now()}`,
      when: new Date().toISOString(),
      aNames: [A1.name, A2.name],
      bNames: [B1.name, B2.name],
      scoreA: r.a,
      scoreB: r.b,
      deltas
    });
  }

  const playerById = (id:string)=>players.find(p=>p.id===id)!;

  return (
    <div className="grid grid-2">
      <Card title="Tilmeldte spillere" right={<span className="pill">{signedUp.length} valgt</span>}>
        <div className="chips">
          {players.map(p=>{
            const on = signedUp.includes(p.id);
            return (
              <button key={p.id} className={"chip "+(on?'active':'')} onClick={()=>toggle(p.id)}>
                {p.name} ({p.elo})
              </button>
            )
          })}
        </div>
        <div style={{marginTop:12}} className="row">
          <button className="btn primary" onClick={generate}>Generér kampprogram</button>
          {schedule.length>0 && <button className="btn ghost" onClick={()=>{setSchedule([]);setResults({});}}>Nulstil</button>}
        </div>
        <div style={{marginTop:8, color:'var(--muted)'}}>Tip: vælg spillere ved at klikke på deres navne.</div>
      </Card>

      <Card title="Kampprogram">
        {schedule.length===0 ? <div style={{color:'var(--muted)'}}>Ingen kampe genereret endnu.</div> : (
          <div className="grid" style={{gap:12}}>
            {schedule.map(g=>{
              const sumA = g.teams[0].reduce((s,p)=>s+playerById(p.id).elo,0);
              const sumB = g.teams[1].reduce((s,p)=>s+playerById(p.id).elo,0);
              const r = results[g.id] ?? {a:0,b:0};

              return (
                <div key={g.id} className="card">
                  <div className="row spread" style={{marginBottom:8}}>
                    <strong>{g.id}</strong>
                    <span className="pill">{sumA} – {sumB} ELO</span>
                  </div>

                  <div className="row" style={{flexWrap:'wrap', gap:16}}>
                    <div style={{minWidth:260}}>
                      <div style={{fontWeight:600, marginBottom:6}}>Hold A</div>
                      <div>{g.teams[0].map(p=>playerById(p.id).name).join(' & ')}</div>
                      <ScorePicker value={r.a ?? 0} onChange={v=>setScore(g.id,'a',v)} />
                    </div>
                    <div style={{minWidth:260}}>
                      <div style={{fontWeight:600, marginBottom:6}}>Hold B</div>
                      <div>{g.teams[1].map(p=>playerById(p.id).name).join(' & ')}</div>
                      <ScorePicker value={r.b ?? 0} onChange={v=>setScore(g.id,'b',v)} />
                    </div>
                  </div>

                  <div className="row" style={{marginTop:10}}>
                    <button className="btn primary" onClick={()=>saveResult(g)} disabled={r.saved}>
                      {r.saved ? 'Resultat gemt' : 'Gem resultat & opdatér ELO'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

function ScorePicker({ value, onChange }:{ value:number; onChange:(v:number)=>void }){
  return (
    <div className="row" style={{flexWrap:'wrap', gap:8, marginTop:8}}>
      {[0,1,2,3,4,5,6,7].map(n=>(
        <button
          key={n}
          className="chip"
          style={value===n?{background:'#0B63F6',color:'#fff',borderColor:'#0B63F6'}:{}}
          onClick={()=>onChange(n)}
        >{n}</button>
      ))}
    </div>
  )
}

/* ---------------- Admin (med reset) ---------------- */
function Admin({ onReset }:{ onReset:()=>void }){
  return (
    <div className="grid">
      <Card title="Admin">
        <div className="row" style={{gap:10, flexWrap:'wrap'}}>
          <button className="btn ghost" onClick={onReset}>Nulstil localStorage (alle data)</button>
        </div>
        <div style={{marginTop:8, color:'var(--muted)'}}>
          Når vi kobler på database (Supabase), flytter vi data væk fra localStorage.
        </div>
      </Card>
    </div>
  )
}
