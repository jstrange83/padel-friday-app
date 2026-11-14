// Admin → Overblik (padelcentre): nøgletal, dagen i gang, næste spilledag, kampe pr. uge og spillerlisten med CSV og print.
// Data fra padel_center_dash_v2 (kun centrets admin og superadmin).
import { sb, S, app, esc, q, group, fmtDate, toast } from '../core.js';

export async function loadCenterDash() {
  try { S.cdash = await q(sb.rpc('padel_center_dash_v2', { g: S.groupId })); } catch { S.cdash = null; }
  S.cdashFor = S.groupId;
}

const sign = (n) => (n > 0 ? `+${n}` : `${n}`);
const pct = (w, n) => (n ? Math.round((w / n) * 100) : 0);

// Kampe pr. uge: søjler for kampe, linje for antal spillere
function weeksChart(weeks) {
  const W = 640, H = 200, pad = { l: 34, r: 34, t: 16, b: 28 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b, n = weeks.length || 1;
  const maxM = Math.max(1, ...weeks.map((w) => w.matches)), maxP = Math.max(1, ...weeks.map((w) => w.players));
  const bw = (iw / n) * 0.62;
  const x = (i) => pad.l + (iw / n) * (i + 0.5);
  const bars = weeks.map((w, i) => { const h = (w.matches / maxM) * ih; return `<rect x="${x(i) - bw / 2}" y="${pad.t + ih - h}" width="${bw}" height="${h}" rx="3" class="cbar"><title>Uge ${fmtDate(w.w, { day: 'numeric', month: 'short' })}: ${w.matches} kampe, ${w.players} spillere</title></rect>`; }).join('');
  const pts = weeks.map((w, i) => `${x(i)},${pad.t + ih - (w.players / maxP) * ih}`).join(' ');
  const labels = weeks.map((w, i) => (i % 2 === (n - 1) % 2 ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="cax">${fmtDate(w.w, { day: 'numeric', month: 'numeric' }).replace('.', '/').replace(/\.$/, '')}</text>` : '')).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="cchart" role="img" aria-label="Kampe og spillere pr. uge de sidste 12 uger">
    <text x="${pad.l - 6}" y="${pad.t + 4}" text-anchor="end" class="cax">${maxM}</text><text x="${pad.l - 6}" y="${pad.t + ih}" text-anchor="end" class="cax">0</text>
    <text x="${W - pad.r + 6}" y="${pad.t + 4}" class="cax cp">${maxP}</text>
    <line x1="${pad.l}" x2="${W - pad.r}" y1="${pad.t + ih}" y2="${pad.t + ih}" class="cbase"/>
    ${bars}<polyline points="${pts}" class="cline" fill="none"/>${weeks.map((w, i) => `<circle cx="${x(i)}" cy="${pad.t + ih - (w.players / maxP) * ih}" r="3" class="cdot"/>`).join('')}
    ${labels}</svg>
    <div class="clegend"><span><i class="lb"></i>Kampe</span><span><i class="ll"></i>Spillere</span></div>`;
}

export function centerDashTab() {
  const d = S.cdash;
  if (!d) return '<p class="muted">Tallene kunne ikke hentes lige nu.</p>';
  const k = d.kpi || {}, players = d.players || [];
  const sort = S.cdSort || 'elo', f = (S.cdFind || '').toLowerCase();
  const list = players.filter((p) => !f || p.name.toLowerCase().includes(f)).slice().sort((a, b) =>
    sort === 'name' ? a.name.localeCompare(b.name) : sort === 'matches' ? b.matches - a.matches : sort === 'delta' ? b.delta30 - a.delta30 : sort === 'last' ? String(b.last || '').localeCompare(String(a.last || '')) : b.elo - a.elo);
  const th = (key, label, cls = '') => `<th class="${cls}"><button class="link sm ${sort === key ? 'on' : ''}" data-cdsort="${key}">${label}${sort === key ? ' ↓' : ''}</button></th>`;
  return `
    <div class="ckpis">
      <div><b>${k.active30 ?? 0}</b><span>Aktive spillere<br><small>sidste 30 dage</small></span></div>
      <div><b>${k.members ?? 0}</b><span>Medlemmer</span></div>
      <div><b>${k.matches_month ?? 0}</b><span>Kampe<br><small>denne måned</small></span></div>
      <div><b>${k.days_month ?? 0}</b><span>Spilledage<br><small>denne måned</small></span></div>
      <div><b>${k.avg_signed ?? 0}</b><span>Tilmeldte i snit<br><small>sidste 8 dage</small></span></div>
    </div>
    <div class="cnow">
      ${d.live ? `<a class="card clive" href="#/fredag/${d.live.id}"><span class="badge live">I gang</span><b>Runde ${d.live.round}</b>
        <small>${d.live.playing} ${d.live.playing === 1 ? 'kamp spilles' : 'kampe spilles'} nu · ${d.live.done} færdige${d.live.pending ? ` · <b class="warn">${d.live.pending} venter på godkendelse</b>` : ''}</small><span class="go">Åbn dagen ›</span></a>`
        : '<div class="card clive idle"><b>Ingen spilledag i gang</b><small>Når en dag går i gang, kan du følge den her.</small></div>'}
      ${d.next ? `<a class="card cnext" href="#/fredag/${d.next.id}"><small>Næste spilledag</small><b>${esc(fmtDate(d.next.starts_at, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))}</b>
        <div class="cfill"><i style="width:${Math.min(100, pct(d.next.signed, d.next.spots))}%"></i></div>
        <small>${d.next.signed} af ${d.next.spots} tilmeldt${d.next.signed > d.next.spots ? ` · ${d.next.signed - d.next.spots} på venteliste` : d.next.spots - d.next.signed ? ` · ${d.next.spots - d.next.signed} ledige` : ' · fuldt'}</small></a>` : '<div class="card cnext idle"><b>Ingen kommende spilledag</b><a href="#/ny-fredag">Opret en spilledag ›</a></div>'}
    </div>
    <div class="card cweeks"><b>Kampe og spillere pr. uge</b><small class="muted">De sidste 12 uger</small>${weeksChart(d.weeks || [])}</div>
    <div class="card cplayers">
      <div class="cphead"><b>Spillere (${players.length})</b>
        <input type="search" id="cdFind" placeholder="Søg spiller" value="${esc(S.cdFind || '')}" autocomplete="off">
        <span class="cpact"><button class="btn sm" id="cdCsv">⬇️ CSV</button><button class="btn sm" id="cdPrint">🖨 Print rangliste</button></span></div>
      <div class="ctable"><table><thead><tr><th>#</th>${th('name', 'Spiller')}${th('elo', 'Point', 'r')}${th('delta', '30 dage', 'r')}${th('matches', 'Kampe', 'r')}<th class="r">Sejre</th><th class="r">Fremmøde</th>${th('last', 'Sidst spillet', 'r')}</tr></thead>
        <tbody>${list.map((p, i) => `<tr><td class="muted">${sort === 'elo' && !f ? i + 1 : ''}</td><td><a href="#/spiller/${p.id}">${esc(p.name)}</a></td><td class="r"><b>${p.elo}</b></td>
          <td class="r ${p.delta30 > 0 ? 'up' : p.delta30 < 0 ? 'dn' : 'muted'}">${p.delta30 ? sign(p.delta30) : '0'}</td><td class="r">${p.matches}</td><td class="r">${pct(p.wins, p.matches)}%</td>
          <td class="r">${p.attended}/8</td><td class="r muted">${p.last ? fmtDate(p.last, { day: 'numeric', month: 'short' }) : '–'}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">Ingen spillere fundet</td></tr>'}</tbody></table></div>
      <p class="muted small">Fremmøde = antal af de sidste 8 spilledage, spilleren var tilmeldt.</p>
    </div>`;
}

export function bindCenterDash(refresh) {
  app.querySelectorAll('[data-cdsort]').forEach((b) => (b.onclick = () => { S.cdSort = b.dataset.cdsort; refresh(); }));
  const fi = document.getElementById('cdFind');
  if (fi) fi.oninput = () => { S.cdFind = fi.value; const pos = fi.selectionStart; refresh(); const n = document.getElementById('cdFind'); n?.focus(); n?.setSelectionRange(pos, pos); };
  document.getElementById('cdCsv')?.addEventListener('click', () => {
    const rows = [['Placering', 'Navn', 'Point', 'Point sidste 30 dage', 'Kampe', 'Sejre', 'Sejrsprocent', 'Fremmøde (af 8)', 'Sidst spillet']]
      .concat((S.cdash?.players || []).map((p, i) => [i + 1, p.name, p.elo, p.delta30, p.matches, p.wins, pct(p.wins, p.matches), p.attended, p.last ? p.last.slice(0, 10) : '']));
    const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const safe = (group()?.name || 'center').replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa').replace(/Æ/g, 'Ae').replace(/Ø/g, 'Oe').replace(/Å/g, 'Aa').replace(/[^A-Za-z0-9 -]/g, '').trim();
    a.download = `${safe || 'center'} - spillere ${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    toast('Spillerlisten er hentet som CSV');
  });
  document.getElementById('cdPrint')?.addEventListener('click', () => {
    const ps = (S.cdash?.players || []).filter((p) => p.matches > 0);
    const w = window.open('', '_blank');
    if (!w) return toast('Tillad pop op-vinduer for at printe', true);
    w.document.write(`<!doctype html><html lang="da"><head><meta charset="utf-8"><title>Rangliste ${esc(group()?.name || '')}</title>
      <style>body{font-family:Arial,sans-serif;margin:32px;color:#111}h1{margin:0 0 4px}p{color:#555;margin:0 0 18px}table{width:100%;border-collapse:collapse}
      th,td{text-align:left;padding:7px 8px;border-bottom:1px solid #ddd}th{font-size:12px;text-transform:uppercase;color:#555}td.r,th.r{text-align:right}tr:nth-child(-n+4) td{font-weight:bold}</style></head>
      <body><h1>Officiel rangliste · ${esc(group()?.name || '')}</h1><p>${esc(fmtDate(new Date(), { day: 'numeric', month: 'long', year: 'numeric' }))} · Padelklubben</p>
      <table><thead><tr><th>#</th><th>Spiller</th><th class="r">Point</th><th class="r">Kampe</th><th class="r">Sejre</th></tr></thead><tbody>
      ${ps.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.name)}</td><td class="r">${p.elo}</td><td class="r">${p.matches}</td><td class="r">${pct(p.wins, p.matches)}%</td></tr>`).join('')}</tbody></table>
      <script>window.onload=()=>{window.print()}<\/script></body></html>`);
    w.document.close();
  });
}
