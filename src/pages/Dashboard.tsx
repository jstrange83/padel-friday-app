// src/pages/Dashboard.tsx
import React, { useMemo } from 'react';
import { DEMO_MATCHES, DEMO_PLAYERS, LS_MATCHES, LS_PLAYERS, load } from '../lib/demoData';

type MatchRec = typeof DEMO_MATCHES[number];
type Player   = typeof DEMO_PLAYERS[number];

function fmtDate(iso:string){
  const d = new Date(iso);
  return d.toLocaleString('da-DK', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function useData(){
  const players = load<Player[]>(LS_PLAYERS, DEMO_PLAYERS);
  const matches = load<MatchRec[]>(LS_MATCHES, DEMO_MATCHES).slice().sort((a,b)=>new Date(b.when).getTime()-new Date(a.when).getTime());
  return { players, matches };
}

function Card({title, icon, children}:{title:string; icon?:React.ReactNode; children:React.ReactNode}){
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        {icon && <div>{icon}</div>}
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function Dashboard(){
  const { players, matches } = useData();

  // Velkomst
  const me = players.find(p=>p.id==='me') ?? players[0];
  const myMatches = matches.filter(m => [...m.aNames, ...m.bNames].some(n=>n===me.name) && m.scoreA+m.scoreB>0);
  const myWins = myMatches.filter(m => (m.aNames.includes(me.name) ? m.scoreA>m.scoreB : m.scoreB>m.scoreA));
  const winPct = myMatches.length ? Math.round((myWins.length/myMatches.length)*100) : 0;

  // Kommende
  const upcoming = matches.filter(m => new Date(m.when).getTime() > Date.now()).slice(0,3);

  // Mest aktive (Top 3) – baseret på matcher (seneste 30 dage)
  const last30 = matches.filter(m => Date.now()-new Date(m.when).getTime() < 30*24*3600*1000 && (m.scoreA+m.scoreB)>0);
  const counts = new Map<string, number>();
  for(const m of last30){
    for(const n of [...m.aNames, ...m.bNames]) counts.set(n, (counts.get(n)||0)+1);
  }
  const mostActive = [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3);

  // Fredags-streaks (aktuelle)
  const isFri = (d:Date)=> d.getDay()===5;
  const fridayByPlayer = new Map<string, string[]>(); // name -> array of ISO for won friday matches
  for(const m of matches){
    if(!(m.isFriday) || (m.scoreA+m.scoreB===0)) continue;
    const winners = m.scoreA>m.scoreB ? m.aNames : m.bNames;
    for(const w of winners){
      const arr = fridayByPlayer.get(w)||[];
      arr.push(m.when);
      fridayByPlayer.set(w, arr);
    }
  }
  function currentStreak(name:string){
    const arr = (fridayByPlayer.get(name)||[]).map(s=>new Date(s)).sort((a,b)=>b.getTime()-a.getTime());
    if(arr.length===0) return 0;
    let streak = 0;
    for(const d of arr){
      if(isFri(d)) streak++;
      else break;
    }
    return streak;
  }
  const streaks = players.map(p=>({name:p.name, s: currentStreak(p.name)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,3);

  // “Månedens spiller” – flest sejre sidste 30 dage
  const wins30 = new Map<string, number>();
  for(const m of last30){
    if(m.scoreA+m.scoreB===0) continue;
    const winners = m.scoreA>m.scoreB ? m.aNames : m.bNames;
    for(const w of winners) wins30.set(w, (wins30.get(w)||0)+1);
  }
  const monthWinner = [...wins30.entries()].sort((a,b)=>b[1]-a[1])[0];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="rounded-2xl p-5 bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-md">
        <div className="text-lg font-semibold">Velkommen tilbage, {me?.name?.split(' ')[0] || 'spiller'}! 👋</div>
        <div className="opacity-90 mt-1">Du har spillet {myMatches.length} kampe og vundet {myWins.length} af dem. Fortsæt den gode udvikling!</div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Kommende Kampe" icon={<span className="text-blue-600">📅</span>}>
          {upcoming.length===0 ? <div className="text-gray-500 text-sm">Ingen planlagte kampe.</div> :
            <div className="space-y-3">
              {upcoming.map(u=>(
                <div key={u.id} className="rounded-xl border border-gray-200 p-3 bg-blue-50/40">
                  <div className="text-sm text-gray-600">{fmtDate(u.when)}</div>
                  <div className="font-medium">{u.aNames.join(' & ')} <span className="text-gray-500">—</span> {u.bNames.join(' & ')}</div>
                </div>
              ))}
            </div>
          }
        </Card>

        <Card title="Månedens spiller" icon={<span className="text-yellow-500">⭐</span>}>
          {monthWinner ? (
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center font-semibold text-yellow-600">
                {monthWinner[0].split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div>
                <div className="font-medium">{monthWinner[0]}</div>
                <div className="text-sm text-gray-600">{monthWinner[1]} sejre</div>
              </div>
            </div>
          ) : <div className="text-gray-500 text-sm">Ingen data endnu.</div>}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Mest Aktive (Top 3)" icon={<span className="text-green-600">📈</span>}>
          {mostActive.length===0 ? <div className="text-gray-500 text-sm">Ingen kampe registreret endnu.</div> :
            <ol className="space-y-2">
              {mostActive.map(([name, cnt], i)=>(
                <li key={name} className="flex items-center justify-between rounded-xl border border-gray-200 p-2">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-sm font-semibold">{i+1}</div>
                    <div className="font-medium">{name}</div>
                  </div>
                  <div className="text-sm text-gray-600">{cnt} kampe</div>
                </li>
              ))}
            </ol>
          }
        </Card>

        <Card title="Flest fredage i træk (Top 3)" icon={<span className="text-emerald-600">✅</span>}>
          {streaks.length===0 ? <div className="text-gray-500 text-sm">Ingen aktuelle streaks.</div> :
            <ol className="space-y-2">
              {streaks.map((s,i)=>(
                <li key={s.name} className="flex items-center justify-between rounded-xl border border-gray-200 p-2">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-semibold">{i+1}</div>
                    <div className="font-medium">{s.name}</div>
                  </div>
                  <div className="text-sm text-gray-600">{s.s} fredage i træk</div>
                </li>
              ))}
            </ol>
          }
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card title="Vinderprocent" icon={<span className="text-purple-600">🏆</span>}>
          <div className="text-3xl font-semibold">{winPct}%</div>
          <div className="text-sm text-gray-600">{myWins.length} sejre af {myMatches.length} kampe</div>
        </Card>
        <Card title="Kampe spillet" icon={<span className="text-sky-600">🎯</span>}>
          <div className="text-3xl font-semibold">{myMatches.length}</div>
          <div className="text-sm text-gray-600">+{matches.filter(m=>new Date(m.when).getMonth()===new Date().getMonth() && (m.scoreA+m.scoreB>0)).length} denne måned</div>
        </Card>
        <Card title="Bøder" icon={<span className="text-rose-600">💸</span>}>
          <div className="text-sm text-gray-700 mb-3">MobilePay-boks til indbetaling af bøder.</div>
          <a
            href="https://qr.mobilepay.dk/box/ad9ee90d-789f-42e9-aad8-b3b3e6ba7a5a/pay-in"
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
          >
            Betal med MobilePay
          </a>
        </Card>
      </div>
    </div>
  );
}
