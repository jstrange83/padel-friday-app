// src/pages/Results.tsx
import React, { useEffect, useMemo, useState } from 'react'

/** ——— Types (holdt kompatible med app’en) ——— */
type Player = { id: string; name: string; elo: number }
type MatchRec = {
  id: string
  when: string            // ISO date
  aNames: string[]
  bNames: string[]
  scoreA: number
  scoreB: number
  // ELO point pr. spiller for denne "kampdag"/set-indsendelse
  points?: { id: string; name: string; value: number }[]
}

/** ——— localStorage keys (samme som App.tsx) ——— */
const LS_PLAYERS = 'padel.players.v1'
const LS_MATCHES = 'padel.matches.v1'

/** ——— Små utils ——— */
const fmtDateDK = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
const isoDayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10)

/** Runde score-knapper */
function ScoreButtons({
  value,
  onChange
}: {
  value: number
  onChange: (v: number) => void
}) {
  const opts = [0, 1, 2, 3, 4, 5, 6, 7]
  return (
    <div className="score-row">
      {opts.map((n) => (
        <button
          key={n}
          type="button"
          className={`chip ${value === n ? 'active' : ''}`}
          onClick={() => onChange(n)}
          aria-label={`Score ${n}`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

/** ——— Hovedside ——— */
export default function ResultsPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<MatchRec[]>([])

  // Form state til ét sæt; “Tilføj sæt” kloner denne blok
  type SetForm = {
    when: string
    a1?: string
    a2?: string
    b1?: string
    b2?: string
    aScore: number
    bScore: number
  }
  const newSet = (): SetForm => ({
    when: new Date().toISOString(),
    aScore: 0,
    bScore: 0
  })
  const [sets, setSets] = useState<SetForm[]>([newSet()])

  // Hent fra LS
  useEffect(() => {
    try {
      const P = localStorage.getItem(LS_PLAYERS)
      const M = localStorage.getItem(LS_MATCHES)
      if (P) setPlayers(JSON.parse(P))
      if (M) setMatches(JSON.parse(M))
    } catch {}
  }, [])

  // Aktiv bruger for “Mine resultater” (demo-profil hvis ingen findes)
  const activePlayerId = players[0]?.id ?? ''

  // Group matches per dag
  const groupedAll = useMemo(() => {
    const map = new Map<string, MatchRec[]>()
    for (const m of matches) {
      const k = isoDayKey(m.when)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(m)
    }
    // Seneste øverst
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, arr]) => ({ day: key, items: arr }))
  }, [matches])

  const groupedMine = useMemo(() => {
    if (!activePlayerId) return []
    const isMine = (m: MatchRec) => {
      // Find navn(e) for aktiv spiller
      const me = players.find((p) => p.id === activePlayerId)?.name
      if (!me) return false
      return m.aNames.includes(me) || m.bNames.includes(me)
    }
    const mine = matches.filter(isMine)
    const map = new Map<string, MatchRec[]>()
    for (const m of mine) {
      const k = isoDayKey(m.when)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(m)
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, arr]) => ({ day: key, items: arr }))
  }, [matches, players, activePlayerId])

  /** ——— UI helpers til rendering af kort ——— */

  /** Viser spillerlinje “navn  Elo: før  (+/-delta)” for en given dag */
  function PlayerEloRow({
    name,
    points
  }: {
    name: string
    points?: { id: string; name: string; value: number }[]
  }) {
    // slå “før-ELO” op fra players
    const pl = players.find((p) => p.name === name)
    const base = pl?.elo ?? 0
    const delta = points?.find((x) => x.name === name)?.value ?? 0
    const after = base + delta

    const sign = delta > 0 ? '+' : delta < 0 ? '' : ''
    const deltaCls = delta > 0 ? 'pos' : delta < 0 ? 'neg' : ''
    return (
      <div className="elo-row">
        <div className="elo-name">{name}</div>
        <div className="elo-meta">
          <span className="muted">Elo:</span> {after.toFixed(1)}{' '}
          {delta !== 0 && <span className={`delta ${deltaCls}`}>({sign}{delta.toFixed(1)})</span>}
        </div>
      </div>
    )
  }

  /** Render af en “kampdag”: spillere (før), alle sæt, spiller-ELO (efter) + delta, samt fejlrapport */
  function DayCard({ day, items }: { day: string; items: MatchRec[] }) {
    const first = items[0]
    // Saml unikke spillernavne fra dags-sættene (til oversigt)
    const uniqueNames = Array.from(
      new Set(items.flatMap((m) => [...m.aNames, ...m.bNames]))
    )

    // Tag points fra første match på dagen (vi gemmer dagssummen dér)
    const pts = first?.points

    return (
      <div className="card mt16">
        <div className="card-h">
          <span className="badge icon">📅</span>
          <div className="title">{fmtDateDK(first.when)}</div>
        </div>

        {/* spillerliste (før-oversigt) */}
        <div className="players-before">
          {uniqueNames.map((n) => (
            <div key={n} className="before-row">
              <span className="icon-sm">🎾</span>
              <span className="name">{n}</span>
              <span className="elo-before muted">
                Elo før:{' '}
                {(players.find((p) => p.name === n)?.elo ?? 0).toFixed(1)}
              </span>
            </div>
          ))}
        </div>

        {/* sæt-liste */}
        <div className="sets">
          {items.map((m) => (
            <div key={m.id} className="set-row">
              <div className="set-line">
                {m.aNames.join(' & ')} <span className="muted">vs.</span> {m.bNames.join(' & ')}
              </div>
              <div className="set-score">
                {m.scoreA} - {m.scoreB}
              </div>
            </div>
          ))}
        </div>

        <div className="divider" />

        {/* spiller-elo efter + delta */}
        <div className="elo-after">
          {uniqueNames.map((n) => (
            <PlayerEloRow key={n} name={n} points={pts} />
          ))}
        </div>

        {/* Fejlrapport */}
        <details className="report">
          <summary>Indberet fejl i kampen</summary>
          <textarea placeholder="Skriv hvad der er forkert..." />
          <button type="button" className="btn ghost small">
            Send besked
          </button>
        </details>
      </div>
    )
  }

  /** ——— UI: Indtast sæt (øverst) ———
   *  Her ændrer vi *ikke* logikken – vi bevarer eksisterende “gem” flow.
   *  Fokus i denne fil er at bringe kort-layoutet tilbage.
   */
  function SetEditor({
    idx,
    model,
    onChange
  }: {
    idx: number
    model: SetForm
    onChange: (patch: Partial<SetForm>) => void
  }) {
    return (
      <div className="card">
        <div className="card-h">
          <span className="title">Sæt #{idx + 1}</span>
          <input
            type="datetime-local"
            className="dt"
            value={new Date(model.when).toISOString().slice(0, 16)}
            onChange={(e) => {
              const v = e.target.value
              // local -> ISO
              onChange({ when: new Date(v).toISOString() })
            }}
          />
        </div>

        <div className="grid2">
          <div>
            <div className="label">Hold A</div>
            <select
              className="input"
              value={model.a1 ?? ''}
              onChange={(e) => onChange({ a1: e.target.value })}
            >
              <option value="">Vælg spiller…</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              className="input mt8"
              value={model.a2 ?? ''}
              onChange={(e) => onChange({ a2: e.target.value })}
            >
              <option value="">Vælg spiller…</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ScoreButtons
              value={model.aScore}
              onChange={(v) => onChange({ aScore: v })}
            />
          </div>

          <div>
            <div className="label">Hold B</div>
            <select
              className="input"
              value={model.b1 ?? ''}
              onChange={(e) => onChange({ b1: e.target.value })}
            >
              <option value="">Vælg spiller…</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              className="input mt8"
              value={model.b2 ?? ''}
              onChange={(e) => onChange({ b2: e.target.value })}
            >
              <option value="">Vælg spiller…</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ScoreButtons
              value={model.bScore}
              onChange={(v) => onChange({ bScore: v })}
            />
          </div>
        </div>
      </div>
    )
  }

  /** ——— Fake “gem” (bevarer nuværende matches-format)
   *  Vi lægger settene ind som enkeltstående MatchRec, og tilføjer en samlet points[] på første set,
   *  så dag-kortet kan vise ELO-deltaer (hvis de allerede var beregnet andetsteds).
   *  Her sætter vi points tomt – selve ELO-beregningen har I i jeres eksisterende flow.
   */
  function saveAllSets() {
    const items: MatchRec[] = sets.map((s, i) => {
      const A = [s.a1, s.a2].map((id) => players.find((p) => p.id === id)?.name ?? '').filter(Boolean)
      const B = [s.b1, s.b2].map((id) => players.find((p) => p.id === id)?.name ?? '').filter(Boolean)
      return {
        id: `${isoDayKey(s.when)}-${i}-${Date.now()}`,
        when: s.when,
        aNames: A,
        bNames: B,
        scoreA: s.aScore,
        scoreB: s.bScore,
        points: i === 0 ? [] : undefined, // plads til dagssum hvis I sætter den andetsteds
      }
    })
    const next = [...items, ...matches]
    setMatches(next)
    try { localStorage.setItem(LS_MATCHES, JSON.stringify(next)) } catch {}
    setSets([newSet()])
  }

  return (
    <div className="page results">
      {/* ————— Indtast resultater ————— */}
      <div className="card">
        <div className="card-h">
          <span className="title">Indtast resultater</span>
        </div>

        {sets.map((s, i) => (
          <div key={i} className="mt8">
            <SetEditor
              idx={i}
              model={s}
              onChange={(patch) =>
                setSets((prev) => prev.map((x, ix) => (ix === i ? { ...x, ...patch } : x)))
              }
            />
          </div>
        ))}

        <div className="row mt8">
          <button
            type="button"
            className="btn outline"
            onClick={() => setSets((prev) => [...prev, newSet()])}
          >
            + Tilføj sæt
          </button>
          <div className="flex1" />
          <button type="button" className="btn primary" onClick={saveAllSets}>
            Indsend resultater
          </button>
        </div>

        <div className="hint">
          Tip: Tilføj flere sæt før du indsender – de samles under samme kamp-dag.
        </div>
      </div>

      {/* ————— Mine resultater ————— */}
      <div className="card mt24">
        <div className="card-h">
          <span className="title">Mine resultater</span>
        </div>
        {groupedMine.length === 0 ? (
          <div className="muted p12">Ingen aktive spiller valgt eller ingen kampe endnu.</div>
        ) : (
          groupedMine.map((g) => <DayCard key={g.day} day={g.day} items={g.items} />)
        )}
      </div>

      {/* ————— Alle resultater ————— */}
      <div className="card mt24">
        <div className="card-h">
          <span className="title">Alle resultater</span>
        </div>
        {groupedAll.length === 0 ? (
          <div className="muted p12">Der er endnu ikke registreret kampe.</div>
        ) : (
          groupedAll.map((g) => <DayCard key={g.day} day={g.day} items={g.items} />)
        )}
      </div>

      {/* ——— Lille side-specifik styling (kun for denne side) ——— */}
      <style>{`
        .results .card { border-radius: 14px; border: 1px solid #e6e8ef; padding: 12px 14px; background: #fff; }
        .results .card-h { display:flex; align-items:center; gap:10px; padding-bottom:6px; }
        .results .card-h .title { font-weight:600; font-size:16px; }
        .results .badge.icon { font-size:14px; }
        .results .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap:16px; }
        .results .label { font-size:12px; color:#6b7280; margin-bottom:6px; }
        .results .input { width:100%; height:36px; border:1px solid #e4e6ed; border-radius:10px; padding:0 10px; }
        .results .dt { height:34px; border:1px solid #e4e6ed; border-radius:10px; padding:0 8px; }
        .results .score-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
        .results .chip { min-width:36px; height:36px; border-radius:999px; border:1px solid #d9dbe6; background:#fff; }
        .results .chip.active { background:#2563eb; color:#fff; border-color:#2563eb; }
        .results .row { display:flex; align-items:center; gap:12px; }
        .results .btn { height:36px; border-radius:10px; padding:0 14px; border:1px solid transparent; }
        .results .btn.primary { background:#2563eb; color:#fff; }
        .results .btn.outline { background:#fff; border-color:#d9dbe6; color:#111827; }
        .results .btn.ghost.small { height:32px; padding:0 10px; border:1px solid #d9dbe6; background:#fff; }
        .results .hint { color:#6b7280; font-size:12px; margin-top:10px; }

        .results .players-before .before-row { display:flex; align-items:center; gap:8px; padding:4px 0; }
        .results .players-before .icon-sm { width:18px; }
        .results .players-before .name { font-weight:500; }
        .results .players-before .elo-before { margin-left:auto; }

        .results .sets { margin-top:10px; }
        .results .set-row { display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px dashed #eceef5; }
        .results .set-row:last-child { border-bottom:none; }
        .results .set-line { color:#111827; }
        .results .set-score { font-weight:600; color:#111827; }

        .results .divider { height:1px; background:#eef0f6; margin:8px 0 6px; }

        .results .elo-row { display:flex; align-items:center; justify-content:space-between; padding:4px 0; }
        .results .elo-row .elo-meta { color:#111827; }
        .results .muted { color:#6b7280; }
        .results .delta.pos { color:#16a34a; margin-left:6px; }
        .results .delta.neg { color:#dc2626; margin-left:6px; }

        .results .report { margin-top:10px; }
        .results .report summary { cursor:pointer; color:#374151; margin-bottom:8px; }
        .results .report textarea { width:100%; min-height:70px; border:1px solid #e4e6ed; border-radius:10px; padding:8px; margin-bottom:8px; }
        
        .mt8{margin-top:8px;} .mt16{margin-top:16px;} .mt24{margin-top:24px;}
        .p12{padding:12px;}
        .flex1{flex:1}
      `}</style>
    </div>
  )
}
