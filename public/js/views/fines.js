// Bødekasse pr. gruppe. Admin slår den til og fra og bestemmer taksterne.
// Admin og superbruger giver bøder og godkender betalinger. Spilleren melder selv "Jeg har betalt".
import { sb, S, app, hooks, esc, nameOf, toast, q, busy, fmtDate, group, groupBar, isAdmin, canRun, activeMembers, plural } from '../core.js';

export const kr = (n) => `${new Intl.NumberFormat('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(+n || 0)} kr.`;
const STATUS = { ubetalt: 'Ubetalt', afventer: 'Afventer', betalt: 'Betalt' };
const sum = (fs) => fs.reduce((s, f) => s + Number(f.amount), 0);
const TABS = [['ubetalt', 'Ubetalte'], ['afventer', 'Afventer'], ['betalt', 'Betalte'], ['alle', 'Alle']];

async function load(g) {
  const [types, fines] = await Promise.all([
    q(sb.from('padel_fine_types').select('*').eq('group_id', g).order('sort')),
    q(sb.from('padel_fines').select('*').eq('group_id', g).neq('status', 'annulleret').order('created_at', { ascending: false })),
  ]);
  return { types, fines };
}

export async function viewFines() {
  const g = S.groupId, gr = group();
  const admin = isAdmin(), run = canRun(), me = S.me.id;
  if (!gr?.fines_enabled && !admin) {
    app.innerHTML = `<div class="page">${groupBar(viewFines)}<h1>Bødekasse</h1><p class="muted">${esc(gr?.name || 'Gruppen')} har ikke en bødekasse.</p></div>`;
    return;
  }
  const { types, fines } = await load(g);
  const by = (st) => fines.filter((f) => f.status === st);
  const mine = fines.filter((f) => f.player_id === me);
  const myOpen = mine.filter((f) => f.status !== 'betalt');
  S.fineTab ||= 'ubetalt';
  const shown = S.fineTab === 'alle' ? fines : by(S.fineTab);

  // Bødekonger: flest kroner i alt
  const tot = {};
  for (const f of fines) tot[f.player_id] = (tot[f.player_id] || 0) + Number(f.amount);
  const kings = Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const tile = (cls, label, fs) => `<div class="ftile ${cls}"><small>${label}</small><b>${kr(sum(fs))}</b><span>${plural(fs.length, 'bøde', 'bøder')}</span></div>`;
  const row = (f) => `<div class="fine ${f.status}">
    <div class="ftop"><b class="fname">${esc(nameOf(f.player_id))}</b><span class="famt">${kr(f.amount)}</span></div>
    <div class="ftitle">${esc(f.title)}${f.minutes ? ` <span class="muted">(${f.minutes} min)</span>` : ''}</div>
    ${f.note ? `<div class="muted small">${esc(f.note)}</div>` : ''}
    <div class="fmeta"><span class="badge st-${f.status}">${STATUS[f.status]}</span><small class="muted">${fmtDate(f.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</small></div>
    ${run && f.status !== 'betalt' ? `<div class="mact">
      <button class="btn sm primary" data-paid="${f.id}">${f.status === 'afventer' ? 'Godkend betaling' : 'Markér betalt'}</button>
      ${f.status === 'afventer' ? `<button class="btn sm" data-fstatus="${f.id}" data-to="ubetalt">Ikke betalt</button>` : `<button class="btn sm ghost danger" data-fstatus="${f.id}" data-to="annulleret">Annuller</button>`}
    </div>` : ''}
  </div>`;

  app.innerHTML = `
  <div class="page fines">
    ${groupBar(viewFines)}
    <h1>💸 Bødekasse</h1>
    ${gr.fines_note ? `<p class="muted">${esc(gr.fines_note)}</p>` : ''}
    ${!gr.fines_enabled ? '<div class="card warnbox">Bødekassen er slået fra, så spillerne kan ikke se den. Slå den til under <b>Admin</b>.</div>' : ''}

    <div class="card mine-card ${myOpen.length ? 'wait' : ''}">
      <div class="mtitle">Dit udestående</div>
      <div class="fbig">${kr(sum(myOpen))}</div>
      ${myOpen.length ? `${myOpen.map((f) => `<div class="myfine"><span class="grow">${esc(f.title)}${f.minutes ? ` (${f.minutes} min)` : ''}<span class="muted small"> · ${fmtDate(f.created_at, { day: 'numeric', month: 'short' })}</span></span><b>${kr(f.amount)}</b></div>`).join('')}
        ${myOpen.some((f) => f.status === 'ubetalt') ? `<p class="small">${gr.fines_pay_to ? `Betal til <b>${esc(gr.fines_pay_to)}</b>, og tryk så` : 'Når du har betalt, så tryk'} <b>Jeg har betalt</b>.</p>` : ''}
        ${myOpen.some((f) => f.status === 'ubetalt') ? '<div class="mact"><button class="btn sm primary" id="iPaid">✅ Jeg har betalt</button></div>' : ''}
        ${myOpen.some((f) => f.status === 'afventer') ? '<p class="small muted">⏳ Venter på, at en admin godkender din betaling.</p>' : ''}`
        : '<p>😇 Du har opført dig pænt.</p>'}
    </div>

    <div class="ftiles">${tile('red', 'Ubetalte', by('ubetalt'))}${tile('amber', 'Afventer', by('afventer'))}${tile('green', 'Betalte', by('betalt'))}</div>

    ${run && by('afventer').length ? `<div class="card approvals"><div class="mtitle">✋ Venter på godkendelse (${by('afventer').length})</div>
      ${by('afventer').map(row).join('')}</div>` : ''}

    ${run && gr.fines_enabled ? giveForm(types) : ''}

    <h3>Bøder</h3>
    <div class="tabbar inner">${TABS.map(([k, t]) => `<button class="tab ${k === S.fineTab ? 'on' : ''}" data-ftab="${k}">${t}</button>`).join('')}</div>
    <div class="flist">${shown.map(row).join('') || '<p class="muted">Ingen bøder her.</p>'}</div>

    ${kings.length ? `<h3>🏆 Bødekonger</h3><div class="list">${kings.map(([pid, a], i) => `<div class="row ${pid === me ? 'me' : ''}"><div class="pos">${i + 1}</div><div class="grow">${esc(nameOf(pid))}</div><b>${kr(a)}</b></div>`).join('')}</div>` : ''}

    <details class="card faq"><summary><b>📋 Takster</b></summary><div>
      ${types.filter((t) => t.active).map((t) => `<div class="myfine"><span class="grow">${esc(t.name)}</span><b>${kr(t.amount)}${t.per_minute ? ' pr. minut' : ''}</b></div>`).join('') || '<p class="muted">Ingen takster endnu.</p>'}
    </div></details>

    ${admin ? settings(gr, types) : ''}
  </div>`;
  bind(g, types, fines, myOpen);
}

function giveForm(types) {
  const act = types.filter((t) => t.active);
  return `<details class="card givebox" ${S.fineGiveOpen ? 'open' : ''}><summary><b>➕ Giv en bøde</b></summary>
    <form id="giveFine">
      <label>Spiller<input type="search" id="fineWho" placeholder="Søg på navn…" autocomplete="off" required></label>
      <div id="fineHits" class="hits"></div>
      <input type="hidden" name="player">
      <label>Hvad for<select name="type">${act.map((t) => `<option value="${t.id}" data-pm="${t.per_minute ? 1 : ''}">${esc(t.name)} · ${kr(t.amount)}${t.per_minute ? '/min' : ''}</option>`).join('')}<option value="">Andet…</option></select></label>
      <label class="fmin" hidden>Antal minutter<input type="number" name="minutes" min="1" max="600" inputmode="numeric"></label>
      <div class="fother" hidden>
        <label>Beskrivelse<input name="title" maxlength="80" placeholder="Fx Glemt bolde"></label>
        <label>Beløb (kr.)<input type="number" name="amount" min="1" max="100000" step="0.5" inputmode="decimal"></label>
      </div>
      <label>Note <small class="muted">(valgfri)</small><input name="note" maxlength="300"></label>
      <button class="btn primary">Giv bøden</button>
    </form></details>`;
}

function settings(gr, types) {
  return `<details class="card faq fset"><summary><b>⚙️ Indstillinger (admin)</b></summary><div>
    <form id="fineSettings">
      <label>Betal til <small class="muted">(fx MobilePay-nummer)</small><input name="payto" value="${esc(gr.fines_pay_to || '')}" maxlength="60"></label>
      <label>Tekst øverst <small class="muted">(fx hvad pengene går til)</small><input name="note" value="${esc(gr.fines_note || '')}" maxlength="200"></label>
      <button class="btn">Gem</button>
    </form>
    <div class="lbl">Takster</div>
    ${types.map((t) => `<form class="ftype ${t.active ? '' : 'off'}" data-id="${t.id}">
      <input name="name" value="${esc(t.name)}" maxlength="80" required aria-label="Navn">
      <div class="frow"><input type="number" name="amount" value="${+t.amount}" min="0" step="0.5" required aria-label="Beløb"><span>kr.</span>
        <label class="inl"><input type="checkbox" name="pm" ${t.per_minute ? 'checked' : ''}> pr. minut</label></div>
      <div class="mact"><button class="btn sm">Gem</button><button type="button" class="btn sm ghost" data-tactive="${t.id}" data-on="${t.active ? '' : 1}">${t.active ? 'Skjul' : 'Vis igen'}</button></div>
    </form>`).join('')}
    <form class="ftype" data-id="">
      <input name="name" maxlength="80" required placeholder="Ny takst, fx Glemt bat">
      <div class="frow"><input type="number" name="amount" min="0" step="0.5" required placeholder="Beløb"><span>kr.</span>
        <label class="inl"><input type="checkbox" name="pm"> pr. minut</label></div>
      <div class="mact"><button class="btn sm primary">＋ Tilføj takst</button></div>
    </form>
  </div></details>`;
}

function bind(g, types, fines, myOpen) {
  const reload = async () => { const y = scrollY; await viewFines(); scrollTo(0, y); };
  const run = async (btn, fn, msg) => { busy(btn, true); try { await fn(); if (msg) toast(msg); await reload(); } catch { busy(btn, false); } };

  app.querySelectorAll('[data-ftab]').forEach((b) => (b.onclick = () => { S.fineTab = b.dataset.ftab; reload(); }));
  app.querySelectorAll('[data-paid]').forEach((b) => (b.onclick = () => run(b, () => q(sb.rpc('padel_fine_paid', { p_fine: b.dataset.paid })), 'Bøden er betalt')));
  app.querySelectorAll('[data-fstatus]').forEach((b) => (b.onclick = () => {
    if (b.dataset.to === 'annulleret' && !confirm('Annuller bøden? Den forsvinder fra listen.')) return;
    run(b, () => q(sb.rpc('padel_fine_set_status', { p_fine: b.dataset.fstatus, p_status: b.dataset.to })), b.dataset.to === 'ubetalt' ? 'Bøden står som ubetalt igen' : 'Bøden er annulleret');
  }));
  const ip = document.getElementById('iPaid');
  if (ip) ip.onclick = () => run(ip, async () => {
    for (const f of myOpen.filter((x) => x.status === 'ubetalt')) await q(sb.rpc('padel_fine_paid', { p_fine: f.id }));
  }, 'Tak! En admin godkender din betaling');

  // Giv bøde: søg spiller, vælg takst
  const gf = document.getElementById('giveFine');
  if (gf) {
    const box = gf.closest('details');
    box.ontoggle = () => (S.fineGiveOpen = box.open);
    const who = document.getElementById('fineWho'), hits = document.getElementById('fineHits');
    const people = activeMembers(g).map((m) => S.profiles[m.player_id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
    who.oninput = () => {
      gf.player.value = '';
      const t = who.value.trim().toLowerCase();
      const hs = t ? people.filter((p) => p.name.toLowerCase().includes(t)).slice(0, 6) : [];
      hits.innerHTML = hs.map((p) => `<button type="button" class="hit" data-pick="${p.id}">${esc(p.name)}</button>`).join('') || (t ? '<p class="muted small">Ingen i gruppen matcher.</p>' : '');
      hits.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => { gf.player.value = b.dataset.pick; who.value = nameOf(b.dataset.pick); hits.innerHTML = ''; }));
    };
    const sync = () => {
      const o = gf.type.selectedOptions[0];
      gf.querySelector('.fmin').hidden = !o?.dataset.pm;
      gf.querySelector('.fother').hidden = !!o?.value;
    };
    gf.type.onchange = sync; sync();
    gf.onsubmit = (e) => {
      e.preventDefault();
      if (!gf.player.value) return toast('Vælg en spiller fra listen', true);
      const btn = gf.querySelector('button.primary');
      run(btn, () => q(sb.rpc('padel_give_fine', {
        g, p_player: gf.player.value, p_type: gf.type.value || null, p_minutes: gf.minutes.value ? +gf.minutes.value : null,
        p_title: gf.title.value || null, p_amount: gf.amount.value ? +gf.amount.value : null, p_note: gf.note.value || null, p_event: null,
      })), `${nameOf(gf.player.value)} har fået en bøde`);
    };
  }

  // Admin: indstillinger og takster
  const fs = document.getElementById('fineSettings');
  if (fs) fs.onsubmit = (e) => {
    e.preventDefault();
    run(fs.querySelector('button'), async () => {
      await q(sb.rpc('padel_set_fines', { g, p_enabled: !!group().fines_enabled, p_pay_to: fs.payto.value, p_note: fs.note.value }));
      await hooks.loadBase();
    }, 'Gemt');
  };
  app.querySelectorAll('form.ftype').forEach((f) => (f.onsubmit = (e) => {
    e.preventDefault();
    run(f.querySelector('button'), () => q(sb.rpc('padel_save_fine_type', { p_id: f.dataset.id || null, g, p_name: f.name.value, p_amount: +f.amount.value, p_per_minute: f.pm.checked })),
      f.dataset.id ? 'Taksten er gemt' : 'Taksten er tilføjet');
  }));
  app.querySelectorAll('[data-tactive]').forEach((b) => (b.onclick = () =>
    run(b, () => q(sb.rpc('padel_set_fine_type_active', { p_id: b.dataset.tactive, p_active: !!b.dataset.on })), b.dataset.on ? 'Taksten vises igen' : 'Taksten er skjult')));
}
