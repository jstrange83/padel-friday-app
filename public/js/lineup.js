// Først til mølle: hver gang 4 er tilmeldt, er en bane klar. Resten står på venteliste,
// indtil der er 4 igen, eller alle baner er fyldt.
export function lineup(ids, nCourts) {
  const courts = Math.min(nCourts, Math.floor(ids.length / 4));
  return { courts, playing: ids.slice(0, courts * 4), waiting: ids.slice(courts * 4), full: courts >= nCourts };
}

export function lineupText(L, nCourts) {
  if (!L.courts) { const m = 4 - L.waiting.length; return `Mangler ${m} spiller${m === 1 ? '' : 'e'} til første bane`; }
  let t = `${L.courts} ${L.courts === 1 ? 'bane' : 'baner'} klar`;
  if (L.waiting.length) t += L.full ? ` · alle ${nCourts} baner er fyldt, ${L.waiting.length} på venteliste` : ` · ${L.waiting.length} på venteliste, mangler ${4 - L.waiting.length} til næste bane`;
  return t;
}
