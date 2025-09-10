// src/App.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { buildFairSchedule, type Player as PlayerBase, type Game } from './lib/fairPairing'
import { updateEloDoubles } from './lib/elo'
import type { MatchRec, FineType, FineDraft } from './lib/types'
import { defaultFineTypes, LS_FINE_DRAFTS, LS_FINE_TYPES } from './lib/fines'
import { load, save } from './lib/storage'
import ProfilePage from './pages/Profile'
import FinesPage from './pages/Fines'

const CURRENT_PLAYER_ID = 'me'
export type Player = PlayerBase

const INITIAL_PLAYERS: Player[] = [
  { id: 'p1', name: 'Emma Christensen', elo: 1520 },
  { id: 'p2', name: 'Michael Sørensen', elo: 1490 },
  { id: 'p3', name: 'Julie Rasmussen', elo: 1460 },
  { id: 'p4', name: 'Lars Petersen', elo: 1440 },
  { id: 'p5', name: 'Mette Hansen', elo: 1430 },
  { id: 'p6', name: 'Jonas Mikkelsen', elo: 1400 },
  { id: 'p7', name: 'Camilla Falk', elo: 1380 },
  { id: 'p8', name: 'Nikolaj Friis', elo: 1350 },
  { id: 'me', name: 'Demo Bruger', elo: 1480 },
]

type Page = 'Dashboard'|'Fredagspadel'|'Ranglisten'|'Bøder'|'Profil'|'Admin'

const LS_PLAYERS = 'padel.players.v1'
const LS_MATCHES = 'padel.matches.v1'

export default function App() {
  const [players, setPlayers]     = useState<Player[]>(() => load(LS_PLAYERS, INITIAL_PLAYERS))
  const [matches, setMatches]     = useState<MatchRec[]>(() => load(LS_MATCHES, [] as MatchRec[]))
  const [fineTypes, setFineTypes] = useState<FineType[]>(() => load(LS_FINE_TYPES, defaultFineTypes()))
  const [drafts, setDrafts]       = useState<FineDraft[]>(() => load(LS_FINE_DRAFTS, [] as FineDraft[]))
  const [page, setPage]           = useState<Page>('Dashboard')

  useEffect(()=>{ save(LS_PLAYERS, players) }, [players])
  useEffect(()=>{ save(LS_MATCHES, matches) }, [matches])
  useEffect(()=>{ save(LS_FINE_TYPES, fineTypes) }, [fineTypes])
  useEffect(()=>{ save(LS_FINE_DRAFTS, drafts) }, [drafts])

  function resetAll(){ localStorage.clear(); location.reload() }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">PadelApp</div>
        <nav className="nav">
          {(['Dashboard','Fredagspadel','Ranglisten','Bøder','Profil','Admin'] as Page[]).map(p=>(
            <button key={p} onClick={()=>setPage(p)} className={page===p?'active':''}>{p}</button>
          ))}
        </nav>
      </aside>

      <main>
        {page==='Dashboard' && (
          <Dashboard
            players={players}
            matches={matches}
            drafts={drafts}
            fineTypes={fineTypes}
          />
        )}

        {page==='Fredagspadel' && (
          <FridayPadel
            players={players}
            setPlayers={setPlayers}
            onSaveMatch={(m)=>setMatches(prev=>[m, ...prev].slice(0,100))}
          />
        )}

        {page==='Ranglisten' && <Ranking players={players} matches={matches} />}

        {page==='Bøder' && (
          <FinesPage
            players={players}
            matches={matches}
            fineTypes={fineTypes}
            setFineTypes={setFineTypes}
            drafts={drafts}
            setDrafts={setDrafts}
          />
        )}

        {page==='Profil' && <ProfilePage players={players} setPlayers={setPlayers} />}

        {page==='Admin' && <Admin onReset={resetAll} />}
      </main>
    </div>
  )
}

/* ----------------- UI helpers ----------------- */
function Card(props:{title?:string; right?:React.ReactNode; children:React.ReactNode}) {
  return (
    <div className="card">
      {(props.title || props.right) && (
        <div className="row spread" style={{marginBottom:8}}>
          {props.title ? <h2>{props.title}</h2> : <div/>}
          {props.right}
        </div>
      )}
      {props.children}
    </div>
  )
}

function StatCard({
  title, value, sub, color='blue'
}:{
  title:string; value:React.ReactNode; sub?:React.ReactNode; color?:'blue'|'purple'|'orange'|'green'
}){
  const palette: Record<string,{bg:string;fg:string;chip:string}> = {
    blue:   { bg:'linear-gradient(135deg,#E8F1FF,#F3F7FF)', fg:'#0B63F6', chip:'#E2EDFF' },
    purple: { bg:'linear-gradient(135deg,#F3E8FF,#F9F5FF)', fg:'#6D28D9', chip:'#EFE7FF' },
    orange: { bg:'linear-gradient(135deg,#FFF1E6,#FFF7F0)', fg:'#C2410C', chip:'#FFE7D6' },
    green:  { bg:'linear-gradient(135deg,#E8FFF1,#F2FFF7)', fg:'#166534', chip:'#E6F8ED' },
  }
  const p = palette[color]
  return (
    <div className="card" style={{background:p.bg}}>
      <div className="row spread" style={{marginBottom:6}}>
        <h2 style={{color:p.fg}}>{title}</h2>
      </div>
      <div style={{fontSize:32, fontWeight:700, color:p.fg}}>{value}</div>
      {sub && <div style={{marginTop:6, color:'#475569'}}>{sub}</div>}
    </div>
  )
}

function Hero({title, subtitle}:{title:string;subtitle:string}){
  return (
    <div className="card" style={{
      background:'linear-gradient(135deg,#0B63F6,#3B82F6)',
      color:'#fff'
    }}>
      <div style={{fontSize:26, fontWeight:800, marginBottom:6}}>{title} 👋</div>
      <div style={{opacity:0.95, fontSize:16}}>{subtitle}</div>
    </div>
  )
}

/* ---------------- Dashboard ---------------- */
function Dashboard({
  players, matches, drafts, fineTypes
}:{
  players: Player[]; matches: MatchRec[]; drafts: FineDraft[]; fineTypes: FineType[];
}){
  const me = players.find(p=>p.id===CURRENT_PLAYER_ID)

  const myMatches = useMemo(()=>matches.filter(m=>{
    const names = [...m.aNames,...m.bNames]
    return me ? names.some(n=>n===me.name) : false
  }),[matches, me])

  const wins = myMatches.filter(m=>{
    const aHasMe = me ? m.aNames.includes(me.name) : false
    return aHasMe ? m.scoreA > m.scoreB : m.scoreB > m.scoreA
  }).length
  const winPct = myMatches.length ? Math.round((wins/myMatches.length)*100) : 0
  const playedCount = myMatches.length

  const sortedByElo = [...players].sort((a,b)=>b.elo-a.elo)
  const myRank = me ? (sortedByElo.findIndex(p=>p.id===me.id)+1 || '-') : '-'

  const outstanding = drafts
    .filter(d=>d.status!=='paid' && d.status!=='rejected' && (!!me ? d.toPlayerId===me.id : true))
    .reduce((sum, d)=>{
      const t = fineTypes.find(ft=>ft.code===d.fineCode)
      return sum + (t?.amount ?? 0)
    },0)

  // --- Mest aktive (flest kampe i alt) ---
  const mostActive = useMemo(()=>{
    const counts = new Map<string, number>()
    for (const m of matches){
      for (const n of m.aNames.concat(m.bNames)){
        const p = players.find(x=>x.name===n)
        if (!p) continue
        counts.set(p.id, (counts.get(p.id) || 0) + 1)
      }
    }
    return [...counts.entries()]
      .map(([id,cnt])=>({ id, name: players.find(p=>p.id===id)?.name || id, count: cnt }))
      .sort((a,b)=>b.count-a.count)
      .slice(0,5)
  },[matches, players])

  // --- Flest fredage i træk (AKTUEL streak) ---
  const fridayStreaks = useMemo(()=>{
    // Hjælpere: klip tid væk + seneste fredag i denne uge
    const dayOnly = (d:Date)=> new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const fridayFloor = (d:Date)=>{
      const dd = dayOnly(d)
      const diff = (dd.getDay() + 7 - 5) % 7 // 5 = fredag
      return new Date(dd.getFullYear(), dd.getMonth(), dd.getDate()-diff)
    }
    const thisFriday = fridayFloor(new Date())
    const WEEK = 7*24*3600*1000

    const byId: Record<string, Date[]> = {}
    for (const m of matches){
      const d = new Date(m.when)
      if (d.getDay() !== 5) continue
      const f = dayOnly(d)
      for (const n of m.aNames.concat(m.bNames)){
        const p = players.find(x=>x.name===n)
        if (!p) continue
        if (!byId[p.id]) byId[p.id] = []
        if (!byId[p.id].some(x=>x.getTime()===f.getTime())) byId[p.id].push(f)
      }
    }

    const res = Object.entries(byId).map(([id,dates])=>{
      dates.sort((a,b)=>a.getTime()-b.getTime())
      if (dates.length===0) return { id, name: players.find(p=>p.id===id)?.name || id, streak: 0 }
      const last = dates[dates.length-1]
      // Aktuel streak: kræver at spilleren HAR spillet denne uges fredag.
      if (last.getTime() !== thisFriday.getTime()) return { id, name: players.find(p=>p.id===id)?.name || id, streak: 0 }

      // Tæl baglæns i hop á præcis 7 dage.
      let cur = 1
      for (let i=dates.length-1; i>0; i--){
        const gap = dates[i].getTime() - dates[i-1].getTime()
        if (gap === WEEK) cur += 1
        else break
      }
      return { id, name: players.find(p=>p.id===id)?.name || id, streak: cur }
    }).filter(x=>x.streak>0).sort((a,b)=>b.streak-a.streak).slice(0,5)

    return res
  },[matches, players])

  return (
    <div className="grid" style={{gap:16}}>
      {/* HERO øverst */}
      <Hero
        title={`Velkommen tilbage, ${me?.name?.split(' ')[0] || 'spiller'}!`}
        subtitle={`Du har spillet ${playedCount} kamp${playedCount===1?'':'e'} og vundet ${wins} af dem. Fortsæt den gode udvikling!`}
      />

      {/* Bredt: Kommende kampe */}
      <div className="grid grid-1" style={{gap:16}}>
        <Card title="Kommende kampe">
          <div style={{color:'var(--muted)'}}>Ingen planlagte endnu.</div>
        </Card>
      </div>

      {/* Bredt: Bøder */}
      <div className="grid grid-1" style={{gap:16}}>
        <Card title="Bøder" right={<span className="pill">{outstanding ? 'ubetalt' : 'ok'}</span>}>
          <div className="row" style={{gap:8, alignItems:'baseline'}}>
            <div>Manglende betaling:</div>
            <strong>{outstanding.toLocaleString('da-DK', {style:'currency', currency:'DKK'})}</strong>
          </div>
        </Card>
      </div>

      {/* Smalle kort */}
      <div className="grid grid-2" style={{gap:16}}>
        <StatCard title="Ranking" value={`#${myRank || '-'}`} sub="din aktuelle placering" color="purple" />
        <StatCard title="Næste kamp" value="—" sub="ingen planlagte kampe" color="orange" />
      </div>

      <div className="grid grid-2" style={{gap:16}}>
        <StatCard title="Vinderprocent" value={`${winPct}%`} sub={`${wins} sejre af ${playedCount} kampe`} color="blue" />
        <StatCard title="Kampe spillet" value={playedCount} sub="+0 denne måned" color="green" />
      </div>

      {/* NYT: Mest aktive + Aktuel fredag-streak */}
      <div className="grid grid-2" style={{gap:16}}>
        <Card title="Mest aktive" right={<span className="pill">{mostActive.length}</span>}>
          {mostActive.length===0 ? (
            <div style={{color:'var(--muted)'}}>Ingen data endnu.</div>
          ) : (
            <ol style={{paddingLeft:18, margin:0}}>
              {mostActive.map((r)=>(
                <li key={r.id} style={{margin:'6px 0'}}>
                  <strong>{r.name}</strong> – {r.count} kampe
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title="Flest fredage i træk (aktuel)" right={<span className="pill">{fridayStreaks.length}</span>}>
          {fridayStreaks.length===0 ? (
            <div style={{color:'var(--muted)'}}>Ingen aktuelle streaks.</div>
          ) : (
            <ol style={{paddingLeft:18, margin:0}}>
              {fridayStreaks.map((r)=>(
                <li key={r.id} style={{margin:'6px 0'}}>
                  <strong>{r.name}</strong> – {r.streak} fredage
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* Bredt: Seneste kampe */}
      <div className="grid grid-1" style={{gap:16}}>
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
                  <th>Point</th>
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
                      {m.points?.length ? (
                        <div className="row" style={{gap:6, flexWrap:'wrap'}}>
                          {m.points.map(pd=>{
                            const pos = pd.value >= 0
                            const bg  = pos ? '#eaffea' : '#ffeaea'
                            const fg  = pos ? '#166534' : '#991b1b'
                            const sign = pd.value > 0 ? `+${pd.value}` : `${pd.value}`
                            const first = pd.name.split(' ')[0]
                            return (
                              <span key={pd.id} className="pill" style={{background:bg, color:fg}}>
                                {first} {sign}
                              </span>
                            )
                          })}
                        </div>
                      ) : <span style={{color:'var(--muted)'}}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  )
}

/* ---------------- Ranglisten ---------------- */
function useLastPointsByPlayer(matches: MatchRec[]){
  return useMemo(()=>{
    const map = new Map<string, number>()
    for (const m of matches){
      if (!m.points) continue
      for (const p of m.points){
        if (!map.has(p.id)) map.set(p.id, p.value)
      }
    }
    return map
  },[matches])
}

function Ranking({ players, matches }:{ players:Player[]; matches:MatchRec[] }){
  const lastPoints = useLastPointsByPlayer(matches)
  const sorted = [...players].sort((a,b)=>b.elo-a.elo)
  return (
    <div className="grid">
      <Card title="Ranglisten">
        <table>
          <thead>
            <tr><th>#</th><th>Spiller</th><th>ELO</th></tr>
          </thead>
          <tbody>
            {sorted.map((p,idx)=>{
              const delta = lastPoints.get(p.id)
              const hasDelta = typeof delta==='number' && !Number.isNaN(delta)
              const pos = (delta ?? 0) >= 0
              const color = hasDelta ? (pos ? '#166534' : '#991b1b') : 'var(--muted)'
              const sign = hasDelta ? (delta! > 0 ? `+${delta}` : `${delta}`) : ''
              return (
                <tr key={p.id}>
                  <td>{idx+1}</td>
                  <td>{p.name}</td>
                  <td>{p.elo}<span style={{marginLeft:8, color, fontSize:12}}>{hasDelta?`(${sign})`:''}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

/* ---------------- Fredagspadel ---------------- */
type Result = { a:number; b:number; saved?:boolean }

function FridayPadel({
  players, setPlayers, onSaveMatch
}:{ players:Player[]; setPlayers:React.Dispatch<React.SetStateAction<Player[]>>; onSaveMatch:(m:MatchRec)=>void }){
  const [signedUp, setSignedUp] = useState<string[]>([])
  const [schedule, setSchedule] = useState<Game[]>([])
  const [results, setResults] = useState<Record<string, Result>>({})

  function toggle(id:string){
    setSignedUp(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev,id])
  }
  function generate(){
    const list = players.filter(p=>signedUp.includes(p.id))
    if (list.length < 4){ alert('Minimum 4 spillere kræves'); return }
    const games = buildFairSchedule(list)
    setSchedule(games)
    setResults({})
  }
  function setScore(gid:string, side:'a'|'b', val:number){
    setResults(prev=>({ ...prev, [gid]: { ...(prev[gid]||{a:0,b:0}), [side]: val } as Result }))
  }

  function saveResult(g:Game){
    const r = results[g.id]
    if (!r || r.a==null || r.b==null){ alert('Vælg score for begge hold (0–7)'); return }
    if (r.a===r.b){ alert('Uafgjort er ikke tilladt – ét sæt skal have vinder'); return }

    const [A1,A2] = g.teams[0]
    const [B1,B2] = g.teams[1]

    const newMap = updateEloDoubles(
      { id:A1.id, elo:players.find(p=>p.id===A1.id)!.elo },
      { id:A2.id, elo:players.find(p=>p.id===A2.id)!.elo },
      { id:B1.id, elo:players.find(p=>p.id===B1.id)!.elo },
      { id:B2.id, elo:players.find(p=>p.id===B2.id)!.elo },
      r.a, r.b
    )

    const old: Record<string,number> = {
      [A1.id]: players.find(p=>p.id===A1.id)!.elo,
      [A2.id]: players.find(p=>p.id===A2.id)!.elo,
      [B1.id]: players.find(p=>p.id===B1.id)!.elo,
      [B2.id]: players.find(p=>p.id===B2.id)!.elo,
    }
    const points = [
      { id:A1.id, name:A1.name, value:newMap[A1.id]-old[A1.id] },
      { id:A2.id, name:A2.name, value:newMap[A2.id]-old[A2.id] },
      { id:B1.id, name:B1.name, value:newMap[B1.id]-old[B1.id] },
      { id:B2.id, name:B2.name, value:newMap[B2.id]-old[B2.id] },
    ]

    setPlayers(prev => prev.map(p => newMap[p.id]!=null ? {...p, elo:newMap[p.id]} : p))
    setResults(prev => ({ ...prev, [g.id]: { ...r, saved:true } }))

    onSaveMatch({
      id: `${g.id}-${Date.now()}`,
      when: new Date().toISOString(),
      aNames: [A1.name, A2.name],
      bNames: [B1.name, B2.name],
      scoreA: r.a,
      scoreB: r.b,
      points
    })
  }

  const playerById = (id:string)=>players.find(p=>p.id===id)!

  return (
    <div className="grid grid-2" style={{gap:16}}>
      <Card title="Tilmeldte spillere" right={<span className="pill">{signedUp.length} valgt</span>}>
        <div className="chips">
          {players.map(p=>{
            const on = signedUp.includes(p.id)
            return (
              <button key={p.id} className={'chip '+(on?'active':'')} onClick={()=>toggle(p.id)}>
                {p.name} ({p.elo})
              </button>
            )
          })}
        </div>
        <div className="row" style={{gap:8, marginTop:12}}>
          <button className="btn primary" onClick={generate}>Generér kampprogram</button>
          {schedule.length>0 && <button className="btn ghost" onClick={()=>{setSchedule([]); setResults({})}}>Nulstil</button>}
        </div>
        <div style={{marginTop:8, color:'var(--muted)'}}>Tip: klik på navne for at tilmelde/afmelde.</div>
      </Card>

      <Card title="Kampprogram">
        {schedule.length===0 ? (
          <div style={{color:'var(--muted)'}}>Ingen kampe genereret endnu.</div>
        ) : (
          <div className="grid" style={{gap:12}}>
            {schedule.map(g=>{
              const sumA = g.teams[0].reduce((s,p)=>s+playerById(p.id).elo,0)
              const sumB = g.teams[1].reduce((s,p)=>s+playerById(p.id).elo,0)
              const r = results[g.id] ?? {a:0,b:0}
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
                      <ScorePicker value={r.a} onChange={v=>setScore(g.id,'a',v)} />
                    </div>
                    <div style={{minWidth:260}}>
                      <div style={{fontWeight:600, marginBottom:6}}>Hold B</div>
                      <div>{g.teams[1].map(p=>playerById(p.id).name).join(' & ')}</div>
                      <ScorePicker value={r.b} onChange={v=>setScore(g.id,'b',v)} />
                    </div>
                  </div>

                  <div className="row" style={{marginTop:10}}>
                    <button className="btn primary" onClick={()=>saveResult(g)} disabled={r.saved}>
                      {r.saved?'Resultat gemt':'Gem resultat & opdatér ELO'}
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

/* ---------------- Admin ---------------- */
function Admin({ onReset }:{ onReset:()=>void }){
  return (
    <div className="grid">
      <Card title="Admin">
        <div className="row" style={{gap:10, flexWrap:'wrap'}}>
          <button className="btn ghost" onClick={onReset}>Nulstil localStorage (alle data)</button>
        </div>
        <div style={{marginTop:8, color:'var(--muted)'}}>
          Når vi kobler database på, flytter vi data væk fra localStorage (f.eks. Supabase).
        </div>
      </Card>
    </div>
  )
}
