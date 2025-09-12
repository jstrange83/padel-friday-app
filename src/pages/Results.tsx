import React, { useMemo, useState } from 'react';

// ====== Types (holdt kompatible med app'en) ======
export type Player = {
  id: string;
  name: string;
  elo: number;
};

export type MatchRec = {
  id: string;
  when: string;           // ISO string
  aNames: string[];
  bNames: string[];
  scoreA: number;
  scoreB: number;
  // pr. spiller ELO-delta for denne kamp (positiv/negativ)
  points?: { id: string; name: string; value: number }[];
  // valgfrit snapshot, hvis vi begynder at gemme det fremover
  eloBefore?: { [playerId: string]: number };
  eloAfter?:  { [playerId: string]: number };
  isFriday?: boolean;
};

const LS_PLAYERS = 'padel.players.v1';
const LS_MATCHES = 'padel.matches.v1';
const LS_REPORTS = 'padel.reports.v1';

// ====== Små helpers ======
function load<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save<T>(k: string, v: T) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
}

function fmtDate(dIso: string) {
  const d = new Date(dIso);
  return d.toLocaleDateString('da-DK', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function sameDay(a: string, b: string) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear()===db.getFullYear() &&
         da.getMonth()===db.getMonth() &&
         da.getDate()===db.getDate();
}
function uniq<T>(arr: T[]) { return Array.from(new Set(arr)); }

// ====== “Rapportér fejl” gemmes i localStorage ======
type Report = {
  id: string;          // report id
  matchId: string;
  message: string;
  createdAt: string;   // ISO
  reporterName?: string;
};

function useReports() {
  const [reports, setReports] = useState<Report[]>(() => load(LS_REPORTS, [] as Report[]));
  const add = (r: Report) => {
    const next = [r, ...reports];
    setReports(next);
    save(LS_REPORTS, next);
  };
  return { reports, add };
}

// ====== Result cards ======
function ResultCards({
  players,
  matches,
  currentUserName,
}:{
  players: Player[];
  matches: MatchRec[];
  currentUserName?: string;
}) {

  // Sortér nyeste først
  const sorted = useMemo(() =>
    [...matches].sort((a,b)=> new Date(b.when).getTime() - new Date(a.when).getTime())
  , [matches]);

  // Gruppér på dato
  const groups = useMemo(()=>{
    const out: { dateIso: string; list: MatchRec[] }[] = [];
    for (const m of sorted) {
      const g = out.find(x => sameDay(x.dateIso, m.when));
      if (g) g.list.push(m);
      else out.push({ dateIso: m.when, list:[m] });
    }
    return out;
  }, [sorted]);

  // Find spiller-objekt
  const pMap = useMemo(()=> new Map(players.map(p=>[p.id, p])), [players]);

  // Hjælp til at udlede eloBefore/after når det ikke findes
  function calcEloBeforeAfter(m: MatchRec) {
    // hvis vi allerede har snapshots, brug dem
    if (m.eloBefore || m.eloAfter) return { before: m.eloBefore ?? {}, after: m.eloAfter ?? {} };

    const before: Record<string, number> = {};
    const after:  Record<string, number> = {};
    if (!m.points || m.points.length === 0) return { before, after };

    for (const pt of m.points) {
      const curr = pMap.get(pt.id)?.elo;
      if (typeof curr === 'number') {
        const b = curr - pt.value; // naive-estimat
        before[pt.id] = b;
        after[pt.id]  = curr;
      }
    }
    return { before, after };
  }

  // UI
  return (
    <div className="result-cards">
      {groups.map(group => {
        // saml alle involverede spillere (til header med ELO før)
        const involvedIds = uniq(group.list.flatMap(m => m.points?.map(p=>p.id) ?? []));
        const { before, after } = (() => {
          // for headeren giver det mening at vise “før” pr. spiller ud fra første match i gruppen
          const first = group.list[group.list.length-1]; // ældste i gruppen
          return calcEloBeforeAfter(first);
        })();

        return (
          <div key={group.dateIso} className="res-card">
            <div className="res-card__hdr">
              <div className="res-card__date">
                <span className="ico">📅</span> {fmtDate(group.dateIso)}
              </div>
              {involvedIds.length>0 && (
                <div className="res-card__players">
                  {involvedIds.map(pid=>{
                    const p = pMap.get(pid);
                    if (!p) return null;
                    const eloFør = before[pid];
                    return (
                      <div key={pid} className="res-card__playerRow">
                        <span className="ico">🔎</span>
                        <strong>{p.name}</strong>
                        <span className="muted">ELO før: {typeof eloFør==='number' ? eloFør.toFixed(1) : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sætlinjer */}
            <div className="res-card__sets">
              {group.list.map(m=>(
                <div key={m.id} className="res-card__setRow">
                  <div className="line">
                    <span className="teams">
                      {m.aNames.join(' & ')} <span className="muted">vs.</span> {m.bNames.join(' & ')}
                    </span>
                    <span className="score">
                      {m.scoreA} - {m.scoreB}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* ELO efter + delta */}
            <div className="res-card__after">
              {involvedIds.map(pid=>{
                const p = pMap.get(pid);
                if (!p) return null;

                // beregn samlet delta for gruppens matcher til visning
                let delta = 0;
                for (const m of group.list) {
                  const hit = m.points?.find(x=>x.id===pid);
                  if (hit) delta += hit.value;
                }
                const bef = (before[pid] ?? (p.elo - delta));
                const aft = bef + delta;

                return (
                  <div key={pid} className="afterRow">
                    <span className="ico">{delta >= 0 ? '🏆' : '🧯'}</span>
                    <strong>{p.name}</strong>
                    <span className="muted">Elo: {aft.toFixed(1)}</span>
                    <span className={`delta ${delta>=0?'pos':'neg'}`}>
                      ({delta>=0?'+':''}{delta.toFixed(1)})
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Indberet fejl */}
            <ReportBox matchIds={group.list.map(m=>m.id)} currentUserName={currentUserName}/>
          </div>
        );
      })}
    </div>
  );
}

// ====== Report component ======
function ReportBox({ matchIds, currentUserName }:{ matchIds:string[]; currentUserName?:string }) {
  const { add } = useReports();
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState('');

  function send() {
    if (!txt.trim()) return;
    add({
      id: 'r_' + Date.now(),
      matchId: matchIds.join(','),
      message: txt.trim(),
      createdAt: new Date().toISOString(),
      reporterName: currentUserName || 'Ukendt',
    });
    setTxt('');
    setOpen(false);
    alert('Tak! Din besked er gemt til admin.');
  }

  return (
    <div className="reportBox">
      <label className="chk">
        <input type="checkbox" checked={open} onChange={e=>setOpen(e.target.checked)} />
        Indberet fejl i kampen
      </label>
      {open && (
        <>
          <textarea
            placeholder="Skriv hvad der er forkert…"
            value={txt}
            onChange={e=>setTxt(e.target.value)}
          />
          <button className="btn danger" onClick={send}>
            📩 Send besked
          </button>
        </>
      )}
    </div>
  );
}

// ====== Indtast resultater (kort “light” version – sætvis) ======
type DraftSet = {
  id: string;
  when: string; // ISO
  A1?: string; A2?: string;
  B1?: string; B2?: string;
  sA: number; sB: number;
};

function ScorePicker({ value, onChange }:{ value:number; onChange:(v:number)=>void }) {
  const opts = [0,1,2,3,4,5,6,7];
  return (
    <div className="scorePicker">
      {opts.map(n=>(
        <button
          key={n}
          type="button"
          className={`chip ${value===n?'active':''}`}
          onClick={()=>onChange(n)}
        >{n}</button>
      ))}
    </div>
  );
}

function EnterSets({
  players,
  onSaved
}:{ players: Player[]; onSaved: ()=>void }) {

  const [drafts, setDrafts] = useState<DraftSet[]>([{
    id: 's1', when: new Date().toISOString(), sA: 0, sB: 0
  }]);

  function addSet() {
    setDrafts(d => [...d, { id: 's'+(d.length+1), when: d[0]?.when ?? new Date().toISOString(), sA:0, sB:0 }]);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }
  function upd(id:string, patch: Partial<DraftSet>) {
    setDrafts(d => d.map(x => x.id===id ? {...x, ...patch} : x));
  }
  function saveAll() {
    // Mapper drafts -> MatchRec og gemmer i localStorage
    const prev = load<MatchRec[]>(LS_MATCHES, []);
    const now = new Date().toISOString();

    const newMatches: MatchRec[] = drafts.map((s,i)=>({
      id: `m_${Date.now()}_${i}`,
      when: s.when,
      aNames: [players.find(p=>p.id===s.A1)?.name ?? '—', players.find(p=>p.id===s.A2)?.name ?? '—'].filter(Boolean),
      bNames: [players.find(p=>p.id===s.B1)?.name ?? '—', players.find(p=>p.id===s.B2)?.name ?? '—'].filter(Boolean),
      scoreA: s.sA,
      scoreB: s.sB,
      points: [], // ELO-opdatering sker allerede andetsteds i din app – her lader vi feltet være
    }));

    const next = [...newMatches, ...prev].slice(0, 200);
    save(LS_MATCHES, next);
    alert('Resultater gemt. (Demo-lagring i browseren)');
    setDrafts([{ id: 's1', when: now, sA:0, sB:0 }]);
    onSaved();
  }

  const opts = players.map(p=> <option key={p.id} value={p.id}>{p.name}</option> );

  return (
    <div className="enterSets">
      <h2>🔎 Indtast resultater</h2>
      {drafts.map((s,idx)=>(
        <div key={s.id} className="setCard">
          <div className="setHdr">
            <strong>Sæt #{idx+1}</strong>
            <input
              type="datetime-local"
              value={toLocalInputValue(s.when)}
              onChange={e=>upd(s.id, { when: fromLocalInputValue(e.target.value) })}
            />
          </div>

          <div className="teams">
            <div className="team">
              <div className="lbl">Hold A</div>
              <select value={s.A1 ?? ''} onChange={e=>upd(s.id, {A1: e.target.value||undefined})}>
                <option value="">Vælg spiller…</option>
                {opts}
              </select>
              <select value={s.A2 ?? ''} onChange={e=>upd(s.id, {A2: e.target.value||undefined})}>
                <option value="">Vælg spiller…</option>
                {opts}
              </select>
              <ScorePicker value={s.sA} onChange={(v)=>upd(s.id, {sA:v})}/>
            </div>

            <div className="team">
              <div className="lbl">Hold B</div>
              <select value={s.B1 ?? ''} onChange={e=>upd(s.id, {B1: e.target.value||undefined})}>
                <option value="">Vælg spiller…</option>
                {opts}
              </select>
              <select value={s.B2 ?? ''} onChange={e=>upd(s.id, {B2: e.target.value||undefined})}>
                <option value="">Vælg spiller…</option>
                {opts}
              </select>
              <ScorePicker value={s.sB} onChange={(v)=>upd(s.id, {sB:v})}/>
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

function toLocalInputValue(iso:string){
  const d = new Date(iso);
  const pad = (n:number)=> String(n).padStart(2,'0');
  const Y=d.getFullYear(), M=pad(d.getMonth()+1), D=pad(d.getDate());
  const h=pad(d.getHours()), m=pad(d.getMinutes());
  return `${Y}-${M}-${D}T${h}:${m}`;
}
function fromLocalInputValue(v:string){
  // v er "YYYY-MM-DDTHH:mm" i lokal tid
  const d = new Date(v);
  return d.toISOString();
}

// ====== Side-komponent ======
export default function ResultsPage() {
  const [players, setPlayers] = useState<Player[]>(() => load(LS_PLAYERS, [] as Player[]));
  const [matches, setMatches] = useState<MatchRec[]>(() => load(LS_MATCHES, [] as MatchRec[]));

  // Demo “current user”: vælg første spiller hvis der er nogen
  const currentUser = players[0];

  const myMatches = useMemo(()=>{
    if (!currentUser) return [] as MatchRec[];
    const name = currentUser.name;
    return matches.filter(m =>
      m.aNames.includes(name) || m.bNames.includes(name)
    );
  }, [matches, currentUser]);

  function refresh() {
    setMatches(load(LS_MATCHES, [] as MatchRec[]));
    setPlayers(load(LS_PLAYERS, [] as Player[]));
  }

  return (
    <div className="resultsPage container">
      {/* Indtast resultater */}
      <EnterSets players={players} onSaved={refresh} />

      {/* Mine resultater */}
      <section className="panel">
        <div className="panel__hdr">
          <span className="ico">👤</span>
          <h3>Mine resultater</h3>
        </div>
        {currentUser ? (
          myMatches.length === 0 ? (
            <div className="empty">Ingen kampe endnu for din profil.</div>
          ) : (
            <ResultCards players={players} matches={myMatches} currentUserName={currentUser.name}/>
          )
        ) : (
          <div className="empty">Ingen aktiv spiller valgt.</div>
        )}
      </section>

      {/* Alle resultater */}
      <section className="panel">
        <div className="panel__hdr">
          <span className="ico">🗂</span>
          <h3>Alle resultater</h3>
        </div>
        {matches.length === 0 ? (
          <div className="empty">Der er endnu ikke registreret kampe.</div>
        ) : (
          <ResultCards players={players} matches={matches}/>
        )}
      </section>

      {/* Page styles – lille “scoped” CSS så designet matcher appen */}
      <style>{`
        .resultsPage.container { max-width: 1100px; margin: 0 auto; padding: 16px; }
        .panel { background: #fff; border: 1px solid #e6e8eb; border-radius: 12px; padding: 16px; margin-top: 16px; }
        .panel__hdr { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
        .panel__hdr h3 { margin:0; font-size: 18px; }
        .ico { opacity:.9; margin-right:6px; }
        .empty { padding:12px; color:#64748b; background:#f8fafc; border:1px dashed #e2e8f0; border-radius:10px; }

        .enterSets { background:#fff; border:1px solid #e6e8eb; border-radius:12px; padding:16px; }
        .enterSets h2 { margin:0 0 12px; font-size:20px; }
        .setCard { border:1px solid #eef1f4; border-radius:12px; padding:12px; margin-top:12px; }
        .setHdr { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; }
        .teams { display:grid; grid-template-columns: 1fr 1fr; gap:16px; }
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
