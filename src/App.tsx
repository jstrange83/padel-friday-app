// src/App.tsx
import React, { useState } from 'react'
import { buildFairSchedule, type Player as P0, type Game } from './lib/fairPairing'
import { updateEloDoubles } from './lib/elo'

// Udvid Player til state-styring
export type Player = P0;

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

type Page = 'Dashboard'|'Fredagspadel'|'Admin';

export default function App(){
  const [page, setPage] = useState<Page>('Fredagspadel');
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">PadelApp</div>
        <nav className="nav">
          {(['Dashboard','Fredagspadel','Admin'] as Page[]).map(p=>(
            <button key={p} onClick={()=>setPage(p)} className={page===p?'active':''}>{p}</button>
          ))}
        </nav>
      </aside>
      <main>
        {page==='Dashboard' && <Dashboard />}
        {page==='Fredagspadel' && <FridayPadel initialPlayers={INITIAL_PLAYERS}/>}
        {page==='Admin' && <Admin />}
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

function Dashboard(){
  return (
    <div className="grid grid-2">
      <Card title="Kommende kampe">(dummy)</Card>
      <Card title="Seneste kampe">(dummy)</Card>
    </div>
  )
}

type Result = { a: number; b: number; saved?: boolean };

function FridayPadel({ initialPlayers }:{ initialPlayers: Player[] }){
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
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
    setResults({}); // nulstil tidligere
  }

  function setScore(gid: string, side: 'a'|'b', val: number){
    setResults(prev => ({...prev, [gid]: {...prev[gid], [side]: val} as Result}));
  }

  function saveResult(g: Game){
    const r = results[g.id];
    if (!r || r.a == null || r.b == null) { alert('Vælg score for begge hold (0–7)'); return; }
    if (r.a === r.b) { alert('Uafgjort er ikke tilladt – ét sæt skal have vinder'); return; }
    // find spillere
    const [A1, A2] = g.teams[0];
    const [B1, B2] = g.teams[1];
    // apply elo
    const newMap = updateEloDoubles(
      { id: A1.id, elo: players.find(p=>p.id===A1.id)!.elo },
      { id: A2.id, elo: players.find(p=>p.id===A2.id)!.elo },
      { id: B1.id, elo: players.find(p=>p.id===B1.id)!.elo },
      { id: B2.id, elo: players.find(p=>p.id===B2.id)!.elo },
      r.a, r.b
    );
    setPlayers(prev => prev.map(p => newMap[p.id] != null ? {...p, elo: newMap[p.id]} : p));
    setResults(prev => ({...prev, [g.id]: {...r, saved: true}}));
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

function Admin(){
  return <Card title="Admin">(dummy)</Card>
}
