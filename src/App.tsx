// src/App.tsx
import React, { useState } from 'react'
import { buildFairSchedule, type Player, type Game } from './lib/fairPairing'

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

function FridayPadel({ initialPlayers }:{ initialPlayers: Player[] }){
  const [signedUp, setSignedUp] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<Game[]>([]);
  const players = initialPlayers;

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
  }

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
          {schedule.length>0 && <button className="btn ghost" onClick={()=>setSchedule([])}>Nulstil</button>}
        </div>
        <div style={{marginTop:8, color:'var(--muted)'}}>Tip: vælg spillere ved at klikke på deres navne.</div>
      </Card>

      <Card title="Kampprogram">
        {schedule.length===0 ? <div style={{color:'var(--muted)'}}>Ingen kampe genereret endnu.</div> : (
          <table>
            <thead>
              <tr><th>Kamp</th><th>Hold A</th><th>Hold B</th><th>ELO-sum</th></tr>
            </thead>
            <tbody>
              {schedule.map(g=>{
                const sumA = g.teams[0].reduce((s,p)=>s+p.elo,0);
                const sumB = g.teams[1].reduce((s,p)=>s+p.elo,0);
                return (
                  <tr key={g.id}>
                    <td>{g.id}</td>
                    <td>{g.teams[0].map(p=>p.name).join(' & ')}</td>
                    <td>{g.teams[1].map(p=>p.name).join(' & ')}</td>
                    <td>{sumA} – {sumB}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

function Admin(){
  return <Card title="Admin">(dummy)</Card>
}
