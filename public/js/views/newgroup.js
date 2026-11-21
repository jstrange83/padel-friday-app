// Opret din egen private padelgruppe (alle brugere). Man bliver selv admin og kan skrive spillerne ind med navn,
// så de ikke behøver appen (gæster). Senere kan de selv oprette sig og overtage profilen.
import { sb, S, app, hooks, esc, toast, q, busy, setGroup, radios } from '../core.js';

export function viewNewGroup() {
  const centers = (S.centers || []).filter((c) => !c.archived);
  app.innerHTML = `<div class="page newgrp">
    <div class="head"><button class="back" onclick="history.back()">‹ Tilbage</button></div>
    <h1>Opret en padelgruppe</h1>
    <p class="muted">Til vennegruppen, firmaholdet eller fredagspadel. Du bliver selv admin. Spillerne skriver du bare ind med navn, så de behøver ikke appen. De kan altid hente den senere.</p>
    <form class="card" id="ownGroup">
      <label>Gruppens navn<input name="name" required maxlength="60" placeholder="Fx Fredagspadel eller Firmaholdet" autocomplete="off"></label>
      <div class="lbl">Hvor spiller I?</div>
      <div class="checks">${centers.map((c) => `<label><input type="checkbox" name="nc" value="${c.id}"><span>${esc(c.name)}</span></label>`).join('')}</div>
      <p class="muted small">Mangler jeres center? Skriv til <a href="mailto:kontakt@padelklubben.dk">kontakt@padelklubben.dk</a>, så sætter vi det op.</p>
      <label>Spillere <small class="muted">(valgfrit, ét navn pr. linje)</small><textarea name="names" rows="5" placeholder="Mikkel&#10;Rasmus&#10;Sara"></textarea></label>
      <div class="lbl">Køn for spillerne ovenfor</div>
      ${radios('gender', { mand: 'Mænd', kvinde: 'Kvinder' }, 'mand')}
      <p class="muted small">Har I både mænd og kvinder, så skriv dem ind ad to omgange under Admin → Spillere bagefter.</p>
      <button class="btn primary">Opret gruppen</button>
    </form></div>`;
  const f = document.getElementById('ownGroup');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const ids = [...f.querySelectorAll('[name=nc]:checked')].map((x) => x.value);
    if (!ids.length) return toast('Vælg mindst ét center', true);
    const btn = f.querySelector('button.primary'); busy(btn, true);
    try {
      const g = await q(sb.rpc('padel_create_own_group_v2', { p_name: f.name.value, p_centers: ids }));
      const names = f.names.value.split(/\r?\n|,/).map((x) => x.trim()).filter(Boolean);
      if (names.length) await q(sb.rpc('padel_add_guests_v2', { g, p_names: names, p_gender: f.gender.value, p_event: null }));
      await hooks.loadBase();
      setGroup(g);
      toast(`${f.name.value.trim()} er oprettet${names.length ? ` med ${names.length} spillere` : ''}. Lav jeres første spilledag her.`);
      location.hash = '#/fredage';
    } catch { busy(btn, false); }
  };
}
