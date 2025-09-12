// --- REPLACE WHOLE FILE: src/pages/Results.tsx ---
import React, { useEffect, useMemo, useState } from 'react';

// ====== Types ======
export type Player = { id: string; name: string; elo: number };
export type MatchRec = {
  id: string;
  when: string;
  aNames: string[];
  bNames: string[];
  scoreA: number;
  scoreB: number;
  points?: { id: string; name: string; value: number }[];
  eloBefore?: { [playerId: string]: number };
  eloAfter?: { [playerId: string]: number };
  isFriday?: boolean;
};

const LS_PLAYERS = 'padel.players.v1';
const LS_MATCHES = 'padel.matches.v1';
const LS_REPORTS = 'padel.reports.v1';

// ====== storage helpers ======
function load<T>(k: string, fallback: T): T {
  try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) as T : fallback; }
  catch { return fallback; }
}
function save<T>(k: string, v: T) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

// ====== small helpers ======
function fmtDate(dIso: string) {
  const d = new Date(dIso);
  return d.toLocaleDateString('da-DK', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function sameDay(a: string, b: string) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear()===db.getFullYear() && da.getMonth()===db.getMonth() && da.getDate()===db.getDate();
}
function uniq<T>(arr: T[]) { return Array.from(new Set(arr)); }

// ====== reports ======
type Report = { id: string; matchId: string; message: string; createdAt: string; reporterName?: string };
function useReports() {
  const [reports, setReports] = useState<Report[]>(() => load(LS_REPORTS, [] as Report[]));
  const add = (r: Report) => { const next = [r, ...reports]; setReports(next); save(LS_REPORTS, next); };
  return { reports, add };
}

// ====== UI blocks (ResultCards, ReportBox, EnterSets) ======
function ResultCards({ players, matches, currentUserName }:{
  players: Player[]; matches: MatchRec[]; currentUserName?: string;
}) {
  const sorted = useMemo(()=> [...matches].sort((a,b)=> new Date(b.when).getTime() - new Date(a.when).getTime()), [matches]);
  const groups = useMemo(()=>{
    const out: {dateIso:string; list:MatchRec[]}[] = [];
    for (const m of sorted) {
      const g = out.find(x => sameDay(x.dateIso, m.when));
      g ? g.list.push(m) : out.push({dateIso:m.when, list:[m]});
    }
    return out;
  }, [sorted]);
  const pMap = useMemo(()=> new Map(players.map(p=>[p.id, p])), [players]);

  function calcEloBeforeAfter(m: MatchRec) {
    if (m.eloBefore || m.eloAfter) return { before: m.eloBefore ?? {}, after: m.eloAfter ?? {} };
    const before: Record<string, number> = {}; const after: Record<string, number> = {};
    if (!m.points || m.points.length===0) return { before, after };
    for (const pt of m.points) {
      const curr = pMap.get(pt.id)?.elo;
      if (typeof curr === 'number') { const b = curr - pt.value; before[pt.id]=b; after[pt.id]=curr; }
    }
    return { before, after };
  }

  return (
    <div className="result-cards">
      {groups.map(group=>{
        const involvedIds = uniq(group.list.flatMap(m=> m.points?.map(p=>p.id) ?? []));
        const first = group.list[group.list.length-1];
        const { before } = calcEloBeforeAfter(first);

        return (
          <div key={group.dateIso} className="res-card">
            <div className="res-card__hdr">
              <div className="res-card__date"><span className="ico">📅</span> {fmtDate(group.dateIso)}</div>
              {!!involvedIds.length && (
                <div className="res-card__players">
                  {involvedIds.map(pid=>{
                    const p = pMap.get(pid); if (!p) return null;
                    const eloFør = before[pid];
                    return (
                      <div key={pid} className="res-card__playerRow">
                        <span className="ico">🔎</span><strong>{p.name}</strong>
                        <span className="muted">ELO før: {typeof eloFør==='number'? eloFør.toFixed(1) : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="res-card__sets">
              {group.list.map(m=>(
                <div key={m.id} className="res-card__setRow">
                  <div className="line">
                    <span className="teams">{m.aNames.join(' & ')} <span className="muted">vs.</span> {m.bNames.join(' & ')}</span>
                    <span className="score">{m.scoreA} - {m.scoreB}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="res-card__after">
              {involvedIds.map(pid=>{
                const p = pMap.get(pid); if (!p) return null;
                let delta = 0;
                for (const m of group.list) { const hit = m.points?.find(x=>x.id===pid); if (hit) delta += hit.value; }
                const bef = (before[pid] ?? (p.elo - delta)); const aft = bef + delta;
                return (
                  <div key={pid} className="afterRow">
                    <span className="ico">{delta>=0?'🏆':'🧯'}</span><strong>{p.name}</strong>
                    <span className="muted">Elo: {aft.toFixed(1)}</span>
                    <span className={`delta ${delta>=0?'pos':'neg'}`}>({delta>=0?'+':''}{delta.toFixed(1)})</span>
                  </div>
                );
              })}
            </div>

            <ReportBox matchIds={group.list.map(m=>m.id)} currentUserName={currentUserName}/>
          </div>
        );
      })}
    </div>
  );
}

function ReportBox({ matchIds, currentUserName }:{ matchIds:string[]; currentUserName?:string }) {
  const { add } = useReports();
  const [open,setOpen] = useState(false); const [txt,setTxt] = useState('');
  const send = () => {
    if (!txt.trim()) return;
    add({ id:'r_'+Date.now(), matchId: matchIds.join(','), message: txt.trim(), createdAt: new Date().toISOString(), reporterName: currentUserName || 'Ukendt' });
    setTxt(''); setOpen(false); alert('Tak! Din besked er gemt til admin.');
  };
  return (
    <div className="reportBox">
      <label className="chk"><input type="checkbox" checked={open} onChange={e=>setOpen(e.target.checked)} />Indberet fejl i kampen</label>
      {open && (<>
        <textarea placeholder="Skriv hvad der er forkert…" value={txt} onChange={e=>setTxt(e.target.value)} />
        <button className="btn danger" onClick={send}>📩 Send besked</button>
      </>)}
    </div>
  );
}

type DraftSet = { id:string; when:string; A1?:string; A2?:string; B1?:string; B2?:string; sA:number; sB:number; };

function ScorePicker({value,onChange}:{value:number; onChange:(v:number)=>void}) {
  const opts=[0,1,2,3,4,5,6,7];
  return <div className="scorePicker">{opts.map(n=>(
    <button key={n} type="button" className={`chip ${value===n?'active':''}`} onClick={()=>onChange(n)}>{n}</button>
  ))}</div>;
}

function toLocalInputValue(iso:string){ const d=new Date(iso); const pad=(n:number)=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fromLocalInputValue(v:string){ return new Date(v).toISOString(); }

function EnterSets({ players, onSaved }:{ players:Player[]; onSaved:()=>void }) {
  const [drafts,setDrafts]=useState<DraftSet[]>([{ id:'s1', when:new Date().toISOString(), sA:0, sB:0 }]);
  const addSet=()=>{ setDrafts(d=>[...d,{ id:'s'+(d.length+1), when:d[0]?.when ?? new Date().toISOString(), sA:0, sB:0 }]); window.scrollTo({ top: document.body.scrollHeight, behavior:'smooth' }); };
  const upd=(id:string,patch:Partial<DraftSet>)=> setDrafts(d=>d.map(x=>x.id===id?{...x,...patch}:x));
  const saveAll=()=> {
    const prev=load<MatchRec[]>(LS_MATCHES, []);
    const newMatches:MatchRec[] = drafts.map((s,i)=>({
      id:`m_${Date.now()}_${i}`, when:s.when,
      aNames:[players.find(p=>p.id===s.A1)?.name ?? '—', players.find(p=>p.id===s.A2)?.name ?? '—'].filter(Boolean),
      bNames:[players.find(p=>p.id===s.B1)?.name ?? '—', players.find(p=>p.id===s.B2)?.name ?? '—'].filter(Boolean),
      scoreA:s.sA, scoreB:s.sB, points:[]
    }));
    const next=[...newMatches, ...prev].slice(0,200); save(LS_MATCHES,next);
    alert('Resultater gemt. (Demo-lagring i browseren)');
    setDrafts([{ id:'s1', when:new Date().toISOString(), sA:0, sB:0 }]); onSaved();
  };
  const opts = [...players].sort((a,b)=>a.name.localeCompare(b.name)).map(p=><option key={p.id} value={p.id}>{p.name}</option>);
  return (
    <div className="enterSets">
      <h2>🔎 Indtast resultater</h2>
      {drafts.map((s,idx)=>(
        <div key={s.id} className="setCard">
          <div className="setHdr">
            <strong>Sæt #{idx+1}</strong>
            <input type="datetime-local" value={toLocalInputValue(s.when)} onChange={e=>upd(s.id,{when:fromLocalInputValue(e.target.value)})}/>
          </div>
          <div className="teams">
            <div className="team">
              <div className="lbl">Hold A</div>
              <select value={s.A1 ?? ''} onChange={e=>upd(s.id,{A1:e.target.value||undefined})}><option value="">Vælg spiller…</option>{opts}</select>
              <select value={s.A2 ?? ''} onChange={e=>upd(s.id,{A2:e.target.value||undefined})}><option value="">Vælg spiller…</option>{opts}</select>
              <ScorePicker value={s.sA} onChange={(v)=>upd(s.id,{sA:v})}/>
            </div>
            <div className="team">
              <div className="lbl">Hold B</div>
              <select value={s.B1 ?? ''} onChange={e=>upd(s.id,{B1:e.target.value||undefined})}><option value="">Vælg spiller…</option>{opts}</select>
              <select value={s.B2 ?? ''} onChange={e=>upd(s.id,{B2:e.target.value||undefined})}><option value="">Vælg spiller…</option>{opts}</select>
              <ScorePicker value={s.sB} onChange={(v)=>upd(s.id,{sB:v})}/>
            </div>
          </div>
        </div>
      ))}
      <div className="setActions">
        <button className="btn ghost" onClick={addSet}>➕ Tilføj sæt</button>
        <button className="btn primary" onClick={saveAll}>Indsend resultater</button>
      </div>
      <p className="tip">Tip: Tilføj flere sæt før du indsender – de samles under samme kamp-dag.</p>
    </div>
  );
}

// ====== Page ======
export default function ResultsPage() {
  const [players, setPlayers] = useState<Player[]>(() => load(LS_PLAYERS, [] as Player[]));
  const [matches, setMatches] = useState<MatchRec[]>(() => load(LS_MATCHES, [] as MatchRec[]));

  // 🔹 AUTO-SEED: fyld demo-spillere hvis tomt
  useEffect(() => {
    if (players.length === 0) {
      const seed: Player[] = [
        { id:'p-emma',   name:'Emma Christensen',  elo:1123.0 },
        { id:'p-michael',name:'Michael Sørensen',  elo:1072.5 },
        { id:'p-julie',  name:'Julie Rasmussen',   elo:1044.2 },
        { id:'p-lars',   name:'Lars Petersen',     elo:1088.9 },
        { id:'p-mette',  name:'Mette Hansen',      elo:1019.7 },
        { id:'p-alex',   name:'Alex Hansen',       elo:1036.1 },
        { id:'p-sara',   name:'Sara Nielsen',      elo:998.4 },
        { id:'p-thomas', name:'Thomas Nielsen',    elo:1052.3 },
        { id:'p-anne',   name:'Anne Møller',       elo:1003.6 },
        { id:'p-demo',   name:'Demo Bruger',       elo:1000.0 },
      ];
      save(LS_PLAYERS, seed);
      setPlayers(seed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentUser = players[0];
  const myMatches = useMemo(()=> {
    if (!currentUser) return [] as MatchRec[];
    const name = currentUser.name;
    return matches.filter(m => m.aNames.includes(name) || m.bNames.includes(name));
  }, [matches, currentUser]);

  const refresh = () => {
    setMatches(load(LS_MATCHES, [] as MatchRec[]));
    setPlayers(load(LS_PLAYERS, [] as Player[]));
  };

  return (
    <div className="resultsPage container">
      <EnterSets players={players} onSaved={refresh} />

      <section className="panel">
        <div className="panel__hdr"><span className="ico">👤</span><h3>Mine resultater</h3></div>
        {currentUser ? (myMatches.length===0 ? <div className="empty">Ingen kampe endnu for din profil.</div> :
          <ResultCards players={players} matches={myMatches} currentUserName={currentUser.name}/>) :
          <div className="empty">Ingen aktiv spiller valgt.</div>}
      </section>

      <section className="panel">
        <div className="panel__hdr"><span className="ico">🗂</span><h3>Alle resultater</h3></div>
        {matches.length===0 ? <div className="empty">Der er endnu ikke registreret kampe.</div> :
          <ResultCards players={players} matches={matches}/>}
      </section>

      <style>{`
        .resultsPage.container { max-width: 1100px; margin: 0 auto; padding: 16px; }
        .panel { background:#fff; border:1px solid #e6e8eb; border-radius:12px; padding:16px; margin-top:16px; }
        .panel__hdr { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
        .panel__hdr h3 { margin:0; font-size:18px; }
        .ico { opacity:.9; margin-right:6px; }
        .empty { padding:12px; color:#64748b; background:#f8fafc; border:1px dashed #e2e8f0; border-radius:10px; }

        .enterSets { background:#fff; border:1px solid #e6e8eb; border-radius:12px; padding:16px; }
        .enterSets h2 { margin:0 0 12px; font-size:20px; }
        .setCard { border:1px solid #eef1f4; border-radius:12px; padding:12px; margin-top:12px; }
        .setHdr { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; }
        .teams { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        .team .lbl { font-weight:600; margin-bottom:6px; }
        .team select { width:100%; height:38px; border:1px solid #e5e7eb; border-radius:10px; padding:0 10px; background:#fff; }
        .scorePicker { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
        .chip { min-width:38px; height:38px; border-radius:19px; border:1px solid #dbe1e6; background:#fff; }
        .chip.active { background:#2563eb; color:#fff; border-color:#2563eb; }
        .setActions { display:flex; gap:12px; margin-top:12px; }
        .btn { height:40px; border-radius:10px; border:1px solid #dbe1e6; padding:0 14px; background:#fff; font-weight:600; }
        .btn.ghost { background:#fff; }
        .btn.primary { background:#2563eb; color:#fff; border-color:#2563eb; }
        .btn.danger { background:#ef4444; color:#fff; border-color:#ef4444; }
        .tip { color:#64748b; font-size:13px; margin-top:8px; }

        .result-cards { display:grid; gap:14px; }
        .res-card { border:1px solid #e9eef3; border-radius:12px; padding:12px; background:#fff; }
        .res-card__hdr { display:flex; gap:16px; flex-wrap:wrap; }
        .res-card__date { font-weight:700; }
        .res-card__players { display:grid; gap:4px; }
        .res-card__playerRow { display:flex; gap:8px; align-items:center; font-size:14px; }
        .muted { color:#6b7280; margin-left:8px; }
        .res-card__sets { margin-top:10px; border-top:1px dashed #e5e7eb; padding-top:10px; display:grid; gap:8px; }
        .res-card__setRow .line { display:flex; justify-content:space-between; gap:8px; }
        .res-card__setRow .teams { font-weight:500; }
        .res-card__after { margin-top:10px; border-top:1px dashed #e5e7eb; padding-top:10px; display:grid; gap:6px; }
        .afterRow { display:flex; align-items:center; gap:8px; }
        .afterRow .delta { margin-left:auto; }
        .afterRow .delta.pos { color:#16a34a; }
        .afterRow .delta.neg { color:#dc2626; }

        .reportBox { margin-top:10px; border-top:1px dashed #e5e7eb; padding-top:10px; display:grid; gap:8px; }
        .reportBox .chk { display:flex; gap:8px; align-items:center; user-select:none; }
        .reportBox textarea { min-height:72px; padding:10px; border-radius:10px; border:1px solid #e5e7eb; resize:vertical; }
      `}</style>
    </div>
  );
}
