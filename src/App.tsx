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
