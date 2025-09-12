// src/pages/Results.tsx
import React, { useMemo, useState } from 'react';
import { applySets, SetInput } from '../lib/elo';
import { load, save } from '../lib/storage';

// typer i appen
type Player = { id: string; name: string; elo: number };
type MatchRec = {
  id: string;                 // unik id
  when: string;               // ISO dato (dag)
  sets: Array<{
    a1: string; a2: string; b1: string; b2: string;
    scoreA: number; scoreB: number;
  }>;
  // snapshot af ELO før kamp for de 4 spillere (til visning)
  before: Record<string, number>;
  // delta pr. spiller for hele kampen
  delta: Record<string, number>;
  // evt. fejlmelding
  report?: string;
};

const LS_PLAYERS = 'padel.players.v1';
const LS_MATCHES = 'padel.matches.v1';

// små UI hjælpekomponenter
function SegBtn({ active, onClick, children }:{ active:boolean; onClick:()=>void; children:React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`segbtn ${active ? 'active' : ''}`}
      style={{
        minWidth: 36, height: 36, borderRadius: 18,
        border: '1px solid var(--border)',
        background: active ? 'var(--primary-600)' : 'white',
        color: active ? 'white' : 'var(--text)',
        display:'inline-flex', alignItems:'center', justifyContent:'center'
      }}
    >{children}</button>
  );
}

export default function ResultsPage(){
  const [players, setPlayers] = useState<Player[]>(()=>load(LS_PLAYERS, [] as Player[]));
  const [matches, setMatches] = useState<MatchRec[]>(()=>load(LS_MATCHES, [] as MatchRec[]));

  // --- formular state (et eller flere sæt) -------------------------------
  const [when, setWhen] = useState(()=> {
    const d = new Date();
    d.setSeconds(0,0);
    return d.toISOString();
  });

  type SetForm = { a1?:string; a2?:string; b1?:string; b2?:string; scoreA:number; scoreB:number };
  const [forms, setForms] = useState<SetForm[]>([
    { scoreA: 0, scoreB: 0 }
  ]);

  function addSet(){
    setForms(f => [...f, { scoreA: 0, scoreB: 0 }]);
  }

  function updateSet(ix:number, patch:Partial<SetForm>){
    setForms(f => f.map((s,i)=> i===ix ? {...s, ...patch} : s));
  }

  const canSubmit = useMemo(()=>{
    if (forms.length===0) return false;
    for (const f of forms){
      if (!f.a1 || !f.a2 || !f.b1 || !f.b2) return false;
      if (f.a1===f.a2 || f.b1===f.b2) return false;
      // samme spiller må ikke stå på begge hold
      const all = [f.a1,f.a2,f.b1,f.b2];
      if (new Set(all).size !== 4) return false;
    }
    return true;
  }, [forms]);

  function handleSubmit(){
    if (!canSubmit) return;

    // ratings-map før kamp
    const ratings: Record<string, number> = {};
    for (const p of players) ratings[p.id] = p.elo;

    // konverter formular til SetInput’s
    const sets: SetInput[] = forms.map(f=>({
      a1: f.a1!, a2: f.a2!, b1: f.b1!, b2: f.b2!,
      scoreA: f.scoreA, scoreB: f.scoreB,
      whenISO: when
    }));

    // gem snapshot før kamp for de spillere der deltager
    const before: Record<string, number> = {};
    for (const f of sets){
      [f.a1,f.a2,f.b1,f.b2].forEach(id=>{
        if (before[id]==null) before[id] = ratings[id] ?? 1500;
      });
    }

    // kør ELO opdateringer
    const { ratings: newRatings, totalDelta } = applySets(ratings, sets);

    // opdater spillerliste
    const updatedPlayers = players.map(p => newRatings[p.id] != null ? ({...p, elo: Math.round(newRatings[p.id])}) : p);
    setPlayers(updatedPlayers);
    save(LS_PLAYERS, updatedPlayers);

    // lav kamp-record (grupperer alle sæt under samme dato/id)
    const id = `m-${Date.now()}`;
    const match: MatchRec = {
      id,
      when: new Date(when).toISOString().slice(0,10), // dag
      sets: sets.map(s=>({ a1:s.a1, a2:s.a2, b1:s.b1, b2:s.b2, scoreA:s.scoreA, scoreB:s.scoreB })),
      before,
      delta: Object.fromEntries(Object.entries(totalDelta).map(([id,v])=>[id, Math.round(v*10)/10]))
    };

    const next = [match, ...matches].slice(0,200);
    setMatches(next);
    save(LS_MATCHES, next);

    // nulstil formular (behold sidste spillervalg for hurtig indtastning)
    setForms([{ scoreA: 0, scoreB: 0 }]);
  }

  // --- visning ------------------------------------------------------------

  function nameOf(id:string){ return players.find(p=>p.id===id)?.name ?? '—'; }

  return (
    <div className="page">
      {/* Indtast sæt */}
      <div className="card">
        <div className="card-title">Indtast resultater</div>

        <div className="row" style={{gap:16, alignItems:'center', margin:'8px 0 16px'}}>
          <label style={{opacity:.7}}>Dato/Tid</label>
          <input
            type="datetime-local"
            value={toLocal(when)}
            onChange={e=>setWhen(fromLocal(e.target.value))}
          />
        </div>

        {forms.map((f,ix)=>(
          <div key={ix} className="setbox">
            <div className="sethead">Sæt #{ix+1}</div>

            <div className="grid2">
              <div>
                <div className="label">Hold A</div>
                <SelectPlayer value={f.a1} onChange={v=>updateSet(ix,{a1:v})} players={players}/>
                <SelectPlayer value={f.a2} onChange={v=>updateSet(ix,{a2:v})} players={players}/>
                <div className="label" style={{marginTop:8}}>Score</div>
                <ScoreRow value={f.scoreA} onChange={v=>updateSet(ix,{scoreA:v})}/>
              </div>
              <div>
                <div className="label">Hold B</div>
                <SelectPlayer value={f.b1} onChange={v=>updateSet(ix,{b1:v})} players={players}/>
                <SelectPlayer value={f.b2} onChange={v=>updateSet(ix,{b2:v})} players={players}/>
                <div className="label" style={{marginTop:8}}>Score</div>
                <ScoreRow value={f.scoreB} onChange={v=>updateSet(ix,{scoreB:v})}/>
              </div>
            </div>
          </div>
        ))}

        <div className="row" style={{gap:12, marginTop:8}}>
          <button className="btn ghost" onClick={addSet}>+ Tilføj sæt</button>
          <div style={{flex:1}} />
          <button className="btn primary" disabled={!canSubmit} onClick={handleSubmit}>Indsend resultater</button>
        </div>
        <div className="muted" style={{marginTop:8}}>Tip: Tilføj flere sæt før du indsender – de samles under samme kamp-dag.</div>
      </div>

      {/* Alle resultater */}
      <div className="card">
        <div className="card-title">Alle resultater</div>

        {matches.length===0 && <div className="muted">Der er endnu ikke registreret kampe.</div>}

        {matches.map(m=>(
          <div key={m.id} className="match">
            <div className="match-date">
              <span className="cal">📅</span> {formatDate(m.when)}
            </div>

            {/* spillere + ELO før */}
            <div className="players-before">
              {playersRowFromMatch(m).map(p=>(
                <div key={p.id} className="pchip">
                  <span className="r">🎾</span>
                  <span className="nm">{nameOf(p.id)}</span>
                  <span className="elo">ELO før: {Math.round(m.before[p.id] ?? 1500)}</span>
                </div>
              ))}
            </div>

            {/* sæt-rækker */}
            <div className="sets">
              {m.sets.map((s, i)=>(
                <div key={i} className="setrow">
                  <div className="teams">
                    {nameOf(s.a1)} & {nameOf(s.a2)} <span className="vs">vs.</span> {nameOf(s.b1)} & {nameOf(s.b2)}
                  </div>
                  <div className="score">{s.scoreA} – {s.scoreB}</div>
                </div>
              ))}
            </div>

            {/* delta pr. spiller */}
            <div className="delta">
              {playersRowFromMatch(m).map(p=>{
                const before = m.before[p.id] ?? 1500;
                const d = m.delta[p.id] ?? 0;
                const after = before + d;
                return (
                  <div key={p.id} className="deltarow">
                    <span className="tag">{nameOf(p.id)}</span>
                    <span className={`chg ${d>=0?'pos':'neg'}`}>
                      {d>=0?'+':''}{(Math.round(d*10)/10).toFixed(1)}
                    </span>
                    <span className="after">ELO: {Math.round(after)}</span>
                  </div>
                );
              })}
            </div>

            {/* fejlrapport */}
            <ReportBox match={m} onChange={(txt)=>{
              const next = matches.map(x=>x.id===m.id ? {...x, report: txt} : x);
              setMatches(next); save(LS_MATCHES, next);
            }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// --- små komponenter -------------------------------------------------------

function SelectPlayer({ value, onChange, players }:{
  value?:string, onChange:(id:string)=>void, players:Player[]
}){
  return (
    <select value={value ?? ''} onChange={e=>onChange(e.target.value)} style={{width:'100%'}}>
      <option value="" disabled>Vælg spiller…</option>
      {players.map(p=>(
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}

function ScoreRow({ value, onChange }:{ value:number; onChange:(v:number)=>void }){
  return (
    <div className="row" style={{gap:8, flexWrap:'wrap'}}>
      {[0,1,2,3,4,5,6,7].map(n=>(
        <SegBtn key={n} active={value===n} onClick={()=>onChange(n)}>{n}</SegBtn>
      ))}
    </div>
  );
}

function ReportBox({ match, onChange }:{ match:MatchRec; onChange:(t:string)=>void }){
  return (
    <div className="report">
      <label className="muted">🚫 Indberet fejl i kampen:</label>
      <textarea
        placeholder="Skriv hvad der er forkert…"
        value={match.report ?? ''}
        onChange={e=>onChange(e.target.value)}
      />
      <div className="muted">Indberettet gemmes kun lokalt indtil vi forbinder til admin backend.</div>
    </div>
  );
}

// --- utils / styling -------------------------------------------------------

function playersRowFromMatch(m: MatchRec){
  const ids = new Set<string>();
  m.sets.forEach(s=>[s.a1,s.a2,s.b1,s.b2].forEach(id=>ids.add(id)));
  return Array.from(ids).map(id=>({id}));
}

function toLocal(iso:string){
  const d = new Date(iso);
  const pad = (n:number)=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocal(local:string){
  // tolkes som lokal tid -> ISO
  const d = new Date(local);
  return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString();
}
function formatDate(yyyyMMDD:string){
  const d = new Date(yyyyMMDD);
  return d.toLocaleDateString('da-DK');
}
