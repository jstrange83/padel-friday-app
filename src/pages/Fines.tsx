// src/pages/Fines.tsx
import React, { useMemo, useState } from 'react'
import type { FineDraft, FineType, MatchRec, Player } from '../lib/types'
import {
  defaultFineTypes, LS_FINE_DRAFTS, LS_FINE_TYPES,
  humanFineLabel, matchLabel, buildFine, calcOutstandingForPlayer, playerName
} from '../lib/fines'
import { load, save } from '../lib/storage'

const CURRENT_PLAYER_ID = 'me';
const IS_ADMIN = true; // demo: vis admin-funktioner

// --- Helper der holder status som literal union ---
function applyStatus(d: FineDraft, status: FineDraft['status']): FineDraft {
  if (status === 'approved') {
    return { ...d, status, approvedAt: new Date().toISOString() }
  }
  if (status === 'paid') {
    return { ...d, status, paidAt: new Date().toISOString() }
  }
  return { ...d, status }
}

export default function FinesPage({
  players, matches,
  fineTypes, setFineTypes,
  drafts, setDrafts
}:{
  players: Player[]; matches: MatchRec[];
  fineTypes: FineType[]; setFineTypes: React.Dispatch<React.SetStateAction<FineType[]>>;
  drafts: FineDraft[]; setDrafts: React.Dispatch<React.SetStateAction<FineDraft[]>>;
}) {

  const [assignList, setAssignList] = useState<Array<{toPlayerId:string; matchId:string; fineCode:string; note?:string}>>([
    { toPlayerId:'', matchId:'', fineCode:'' }
  ]);

  function addAssignRow(){ setAssignList(prev => [...prev, { toPlayerId:'', matchId:'', fineCode:'' }]) }
  function updateAssign(i:number, patch: Partial<{toPlayerId:string; matchId:string; fineCode:string; note?:string}>){
    setAssignList(prev => prev.map((row,idx)=> idx===i ? {...row, ...patch} : row));
  }
  function submitAssign(){
    const cleaned = assignList.filter(r => r.toPlayerId && r.matchId && r.fineCode);
    if (cleaned.length===0) { alert('Vælg mindst én bøde (modtager, kamp og type)'); return; }
    const newOnes: FineDraft[] = cleaned.map(r =>
      buildFine(`fd_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, CURRENT_PLAYER_ID, r.toPlayerId, r.matchId, r.fineCode, r.note)
    );
    setDrafts(prev => {
      const next: FineDraft[] = [...newOnes, ...prev];
      save(LS_FINE_DRAFTS, next);
      return next;
    });
    alert('Bøder sendt til godkendelse');
    setAssignList([{ toPlayerId:'', matchId:'', fineCode:'' }]);
  }

  // --- ADMIN: approve / reject / mark paid ---
  function approve(id: string){
    setDrafts(prev => {
      const next: FineDraft[] = prev.map(d => d.id===id ? applyStatus(d, 'approved') : d);
      save(LS_FINE_DRAFTS, next);
      return next;
    })
  }
  function reject(id: string){
    setDrafts(prev => {
      const next: FineDraft[] = prev.map(d => d.id===id ? applyStatus(d, 'rejected') : d);
      save(LS_FINE_DRAFTS, next);
      return next;
    })
  }
  function markPaid(id: string){
    setDrafts(prev => {
      const next: FineDraft[] = prev.map(d => d.id===id ? applyStatus(d, 'paid') : d);
      save(LS_FINE_DRAFTS, next);
      return next;
    })
  }

  const outstandingMe = useMemo(()=>calcOutstandingForPlayer(CURRENT_PLAYER_ID, drafts, fineTypes), [drafts, fineTypes]);
  const outstandingAll = useMemo(()=>{
    const res = players.map(p => ({ id:p.id, name:p.name, amount: calcOutstandingForPlayer(p.id, drafts, fineTypes) }));
    return res.filter(x => x.amount>0).sort((a,b)=>b.amount-a.amount);
  }, [players, drafts, fineTypes]);

  return (
    <div className="grid">
      {/* Bruger: opret bøder */}
      <div className="card">
        <div className="row spread" style={{marginBottom:8}}>
          <h2>Bøder</h2>
          <span className="pill">Dine ubetalte: {outstandingMe} kr</span>
        </div>

        {assignList.map((row, i)=>(
          <div key={i} className="row" style={{gap:12, flexWrap:'wrap', marginBottom:8}}>
            <select className="chip" style={{padding:'8px 10px'}} value={row.toPlayerId} onChange={e=>updateAssign(i, {toPlayerId:e.target.value})}>
              <option value="">Vælg spiller</option>
              {players.filter(p=>p.id!==CURRENT_PLAYER_ID).map(p=>(
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <select className="chip" style={{padding:'8px 10px', minWidth:300}} value={row.matchId} onChange={e=>updateAssign(i, {matchId:e.target.value})}>
              <option value="">Vælg kamp</option>
              {matches.map(m=>(
                <option key={m.id} value={m.id}>
                  {new Date(m.when).toLocaleString('da-DK')}: {m.aNames.join(' & ')} vs {m.bNames.join(' & ')} ({m.scoreA}–{m.scoreB})
                </option>
              ))}
            </select>

            <select className="chip" style={{padding:'8px 10px'}} value={row.fineCode} onChange={e=>updateAssign(i, {fineCode:e.target.value})}>
              <option value="">Vælg bødetype</option>
              {fineTypes.map(ft=>(
                <option key={ft.code} value={ft.code}>{ft.label} ({ft.amount} kr)</option>
              ))}
            </select>

            <input className="chip" placeholder="Note (valgfri)" style={{padding:'8px 10px', width:240}} value={row.note ?? ''} onChange={e=>updateAssign(i, {note:e.target.value})} />
          </div>
        ))}

        <div className="row" style={{gap:8}}>
          <button className="btn ghost" onClick={addAssignRow}>Tilføj flere bøder</button>
          <button className="btn primary" onClick={submitAssign}>Send til godkendelse</button>
        </div>
      </div>

      {/* Oversigt ubetalte pr. spiller */}
      <div className="card">
        <h2>Ubetalte bøder (godkendte)</h2>
        {outstandingAll.length===0 ? <div style={{color:'var(--muted)'}}>Ingen ubetalte bøder.</div> : (
          <table>
            <thead><tr><th>Spiller</th><th>Beløb</th></tr></thead>
            <tbody>
              {outstandingAll.map(x=>(
                <tr key={x.id}><td>{x.name}</td><td>{x.amount} kr</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Admin sektion */}
      {IS_ADMIN && (
        <>
          <div className="card">
            <div className="row spread" style={{marginBottom:8}}>
              <h2>Admin – Godkendelser</h2>
            </div>
            <table>
              <thead>
                <tr><th>Dato</th><th>Fra</th><th>Til</th><th>Kamp</th><th>Bøde</th><th>Status</th><th>Handling</th></tr>
              </thead>
              <tbody>
                {drafts.length===0 ? (
                  <tr><td colSpan={7} style={{color:'var(--muted)'}}>Ingen bøder</td></tr>
                ) : drafts.map(d=>{
                  const m = matches.find(x=>x.id===d.matchId);
                  return (
                    <tr key={d.id}>
                      <td>{new Date(d.createdAt).toLocaleString('da-DK')}</td>
                      <td>{playerName(players,d.fromPlayerId)}</td>
                      <td>{playerName(players,d.toPlayerId)}</td>
                      <td>{m ? `${new Date(m.when).toLocaleString('da-DK')}: ${m.aNames.join(' & ')} vs ${m.bNames.join(' & ')} (${m.scoreA}–${m.scoreB})` : d.matchId}</td>
                      <td>{humanFineLabel(d.fineCode, fineTypes)}</td>
                      <td>{d.status}</td>
                      <td className="row" style={{gap:6}}>
                        {d.status==='pending'  && (<>
                          <button className="btn primary" onClick={()=>approve(d.id)}>Godkend</button>
                          <button className="btn ghost" onClick={()=>reject(d.id)}>Afvis</button>
                        </>)}
                        {d.status==='approved' && (
                          <button className="btn ghost" onClick={()=>markPaid(d.id)}>Marker betalt</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="row spread" style={{marginBottom:8}}>
              <h2>Admin – Bødetype katalog</h2>
            </div>
            <FineTypesEditor fineTypes={fineTypes} setFineTypes={setFineTypes} />
          </div>
        </>
      )}
    </div>
  )
}

function FineTypesEditor({ fineTypes, setFineTypes }:{
  fineTypes: FineType[]; setFineTypes: React.Dispatch<React.SetStateAction<FineType[]>>;
}){
  const [draft, setDraft] = useState<{code:string;label:string;amount:number}>({code:'',label:'',amount:0});

  function saveTypes(next: FineType[]){
    setFineTypes(next);
    save(LS_FINE_TYPES, next);
  }

  function addType(){
    if (!draft.code || !draft.label || !draft.amount) { alert('Udfyld alle felter'); return; }
    if (fineTypes.some(f=>f.code===draft.code)) { alert('Kode findes allerede'); return; }
    saveTypes([{...draft}, ...fineTypes]);
    setDraft({code:'',label:'',amount:0});
  }

  function delType(code: string){
    saveTypes(fineTypes.filter(f=>f.code!==code));
  }

  return (
    <>
      <div className="row" style={{gap:8, flexWrap:'wrap', marginBottom:10}}>
        <input className="chip" style={{padding:'8px 10px'}} placeholder="Kode (eks. no_show)"
               value={draft.code} onChange={e=>setDraft({...draft, code:e.target.value})}/>
        <input className="chip" style={{padding:'8px 10px', minWidth:240}} placeholder="Label"
               value={draft.label} onChange={e=>setDraft({...draft, label:e.target.value})}/>
        <input type="number" className="chip" style={{padding:'8px 10px', width:140}} placeholder="Beløb (kr)"
               value={draft.amount} onChange={e=>setDraft({...draft, amount:Number(e.target.value)})}/>
        <button className="btn primary" onClick={addType}>Tilføj</button>
      </div>
      <table>
        <thead><tr><th>Kode</th><th>Label</th><th>Beløb</th><th/></tr></thead>
        <tbody>
          {fineTypes.map(f=>(
            <tr key={f.code}>
              <td>{f.code}</td>
              <td>{f.label}</td>
              <td>{f.amount} kr</td>
              <td><button className="btn ghost" onClick={()=>delType(f.code)}>Slet</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
