import React, { useEffect, useMemo, useState } from 'react'
import type { Player } from '../lib/types'
import { save, load } from '../lib/storage'

const LS_PROFILE = 'padel.profile.me.v1';
const CURRENT_PLAYER_ID = 'me'; // demo: dig som “aktuel bruger”

export default function ProfilePage({ players, setPlayers }:{ players: Player[]; setPlayers: React.Dispatch<React.SetStateAction<Player[]>> }) {
  // hvis “me” ikke findes, lav en default spiller og læg i players
  useEffect(()=>{
    if (!players.find(p => p.id === CURRENT_PLAYER_ID)) {
      setPlayers(prev => [...prev, { id: CURRENT_PLAYER_ID, name: 'Demo Bruger', elo: 1480 }]);
    }
  }, []);

  const me = useMemo(()=>players.find(p=>p.id===CURRENT_PLAYER_ID) ?? { id: CURRENT_PLAYER_ID, name:'Demo Bruger', elo:1480 }, [players]);
  const [form, setForm] = useState<Player>(() => load<Player>(LS_PROFILE, me));

  useEffect(()=>{ save(LS_PROFILE, form) }, [form]);

  function updateField<K extends keyof Player>(k: K, v: Player[K]) {
    setForm(prev => ({...prev, [k]: v}));
  }

  function saveToRoster(){
    setPlayers(prev => prev.map(p => p.id===CURRENT_PLAYER_ID ? {...p, ...form} : p));
    alert('Profil opdateret');
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="row spread" style={{marginBottom:8}}>
          <h2>Brugerprofil</h2>
          <span className="pill">ELO {me.elo}</span>
        </div>

        <div className="row" style={{gap:16, flexWrap:'wrap'}}>
          <div style={{minWidth:260}}>
            <label className="row" style={{gap:6, alignItems:'center'}}>
              <span style={{width:120}}>Fulde navn</span>
              <input className="chip" style={{padding:'8px 10px', width:220}} value={form.name || ''} onChange={e=>updateField('name', e.target.value)} />
            </label>
          </div>

          <div style={{minWidth:260}}>
            <label className="row" style={{gap:6, alignItems:'center'}}>
              <span style={{width:120}}>Kaldenavn</span>
              <input className="chip" style={{padding:'8px 10px', width:220}} value={form.nickname || ''} onChange={e=>updateField('nickname', e.target.value)} />
            </label>
          </div>

          <div style={{minWidth:260}}>
            <label className="row" style={{gap:6, alignItems:'center'}}>
              <span style={{width:120}}>Email</span>
              <input className="chip" style={{padding:'8px 10px', width:220}} value={form.email || ''} onChange={e=>updateField('email', e.target.value)} />
            </label>
          </div>

          <div style={{minWidth:260}}>
            <label className="row" style={{gap:6, alignItems:'center'}}>
              <span style={{width:120}}>Telefon</span>
              <input className="chip" style={{padding:'8px 10px', width:220}} value={form.phone || ''} onChange={e=>updateField('phone', e.target.value)} />
            </label>
          </div>

          <div style={{minWidth:260}}>
            <label className="row" style={{gap:6, alignItems:'center'}}>
              <span style={{width:120}}>Køn</span>
              <select className="chip" style={{padding:'8px 10px', width:220}} value={form.gender || ''} onChange={e=>updateField('gender', e.target.value as any)}>
                <option value="">—</option>
                <option>Mand</option>
                <option>Kvinde</option>
                <option>Andet</option>
              </select>
            </label>
          </div>

          <div style={{minWidth:260}}>
            <label className="row" style={{gap:6, alignItems:'center'}}>
              <span style={{width:120}}>Profilbillede (URL)</span>
              <input className="chip" style={{padding:'8px 10px', width:220}} value={form.avatarUrl || ''} onChange={e=>updateField('avatarUrl', e.target.value)} />
            </label>
          </div>
        </div>

        <div className="row" style={{marginTop:12}}>
          <button className="btn primary" onClick={saveToRoster}>Gem profil</button>
        </div>
      </div>
    </div>
  )
}
