// src/lib/demoData.ts
export type Player = { id: string; name: string; elo: number };
export type MatchRec = {
  id: string;
  when: string; // ISO
  aNames: string[];
  bNames: string[];
  scoreA: number;
  scoreB: number;
  isFriday?: boolean;
  points?: { id: string; name: string; value: number }[];
};

export const LS_PLAYERS = 'padel.players.v1';
export const LS_MATCHES = 'padel.matches.v1';

export const DEMO_PLAYERS: Player[] = [
  { id: 'p1', name: 'Emma Christensen',   elo: 1520 },
  { id: 'p2', name: 'Michael Sørensen',   elo: 1490 },
  { id: 'p3', name: 'Julie Rasmussen',    elo: 1460 },
  { id: 'p4', name: 'Lars Petersen',      elo: 1440 },
  { id: 'p5', name: 'Mette Hansen',       elo: 1430 },
  { id: 'me', name: 'Demo Bruger',        elo: 1480 },
];

function iso(d: Date){ return d.toISOString(); }
function daysAgo(n:number){ const d=new Date(); d.setDate(d.getDate()-n); return d; }
function daysAhead(n:number){ const d=new Date(); d.setDate(d.getDate()+n); return d; }

export const DEMO_MATCHES: MatchRec[] = [
  // Nylige kampe
  { id:'m1', when: iso(daysAgo(1)), aNames:['Emma Christensen','Michael Sørensen'], bNames:['Julie Rasmussen','Lars Petersen'], scoreA:6, scoreB:4, isFriday:true,
    points:[{id:'p1',name:'Emma Christensen',value:+9},{id:'p2',name:'Michael Sørensen',value:+9},{id:'p3',name:'Julie Rasmussen',value:-9},{id:'p4',name:'Lars Petersen',value:-9}] },
  { id:'m2', when: iso(daysAgo(2)), aNames:['Emma Christensen','Julie Rasmussen'], bNames:['Mette Hansen','Lars Petersen'], scoreA:3, scoreB:6, isFriday:false,
    points:[{id:'p1',name:'Emma Christensen',value:-8},{id:'p3',name:'Julie Rasmussen',value:-8},{id:'p5',name:'Mette Hansen',value:+8},{id:'p4',name:'Lars Petersen',value:+8}] },
  { id:'m3', when: iso(daysAgo(6)), aNames:['Michael Sørensen','Mette Hansen'], bNames:['Demo Bruger','Julie Rasmussen'], scoreA:7, scoreB:5, isFriday:true,
    points:[{id:'p2',name:'Michael Sørensen',value:+10},{id:'p5',name:'Mette Hansen',value:+10},{id:'me',name:'Demo Bruger',value:-10},{id:'p3',name:'Julie Rasmussen',value:-10}] },

  // Kommende (til “Kommende kampe”)
  { id:'u1', when: iso(daysAhead(1)), aNames:['Emma Christensen','Michael Sørensen'], bNames:['Julie Rasmussen','Lars Petersen'], scoreA:0, scoreB:0 },
  { id:'u2', when: iso(daysAhead(3)), aNames:['Emma Christensen','Julie Rasmussen'],  bNames:['Mette Hansen','Lars Petersen'], scoreA:0, scoreB:0 },
  { id:'u3', when: iso(daysAhead(5)), aNames:['Emma Christensen','Mette Hansen'],     bNames:['Michael Sørensen','Lars Petersen'], scoreA:0, scoreB:0 },
];

export function load<T>(key:string, fallback:T): T {
  try { const s = localStorage.getItem(key); if(!s) return fallback; return JSON.parse(s) as T; }
  catch { return fallback; }
}

export function save<T>(key:string, value:T){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch{} }
