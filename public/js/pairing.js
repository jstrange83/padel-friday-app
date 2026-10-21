// Holdsætning til Fredagspadel.
// Prioriteter: 1) ikke samme makker igen, 2) favoritside (venstre/højre), 3) mix hvis valgt,
// 4) lige stærke hold (Elo), 5) ikke de samme modstandere. Pauser fordeles retfærdigt.

const SPLITS = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateRound({ players, courts, history, eventId, mode, roundNo }) {
  const n = players.length;
  const nC = Math.min(courts.length, Math.floor(n / 4));
  if (nC === 0) return { error: 'Der skal være mindst 4 tilmeldte og 1 bane' };

  // Hvor mange runder har hver spiller spillet i dag (til fordeling af pauser)
  const today = history.filter((m) => m.event_id === eventId);
  const played = {};
  for (const m of today) for (const p of [m.a_left, m.a_right, m.b_left, m.b_right]) played[p] = (played[p] || 0) + 1;
  const byes = (id) => roundNo - 1 - (played[id] || 0);

  // Makker- og modstanderhistorik. I dag vægter meget, tidligere fredage mindre jo længere tilbage.
  const ages = {};
  let age = 0;
  for (const m of history) if (m.event_id !== eventId && ages[m.event_id] === undefined) ages[m.event_id] = age++;
  const partner = {}, opp = {};
  for (const m of history) {
    const same = m.event_id === eventId;
    const a = ages[m.event_id] ?? 0;
    const wp = same ? 1000 : Math.max(10, 80 - 15 * a);
    const wo = same ? 50 : Math.max(2, 12 - 3 * a);
    partner[key(m.a_left, m.a_right)] = (partner[key(m.a_left, m.a_right)] || 0) + wp;
    partner[key(m.b_left, m.b_right)] = (partner[key(m.b_left, m.b_right)] || 0) + wp;
    for (const x of [m.a_left, m.a_right]) for (const y of [m.b_left, m.b_right]) opp[key(x, y)] = (opp[key(x, y)] || 0) + wo;
  }

  // Hvem spiller denne runde: dem med flest pauser først, ellers tilfældigt
  const prio = (list) => list.map((p) => ({ p, k: -byes(p.id) + Math.random() * 0.5 })).sort((x, y) => x.k - y.k).map((x) => x.p);
  let playing;
  if (mode === 'mix') {
    const men = prio(players.filter((p) => p.gender === 'mand'));
    const women = prio(players.filter((p) => p.gender === 'kvinde'));
    const total = 4 * nC;
    const mp = Math.min(men.length, Math.max(total - women.length, 2 * nC));
    playing = [...men.slice(0, mp), ...women.slice(0, total - mp)];
  } else {
    playing = prio(players).slice(0, 4 * nC);
  }
  const playingIds = new Set(playing.map((p) => p.id));
  const sitting = players.filter((p) => !playingIds.has(p.id));

  const teamCost = (x, y) => {
    let c = partner[key(x.id, y.id)] || 0;
    if (x.side !== 'begge' && x.side === y.side) c += 70;
    if (mode === 'mix' && x.gender === y.gender) c += 400;
    return c;
  };
  const quadBest = (q) => {
    let best = null;
    for (const [[i, j], [k, l]] of SPLITS) {
      const t1 = [q[i], q[j]], t2 = [q[k], q[l]];
      let c = teamCost(t1[0], t1[1]) + teamCost(t2[0], t2[1]);
      c += Math.abs((t1[0].elo + t1[1].elo) / 2 - (t2[0].elo + t2[1].elo) / 2) * 0.4;
      for (const x of t1) for (const y of t2) c += opp[key(x.id, y.id)] || 0;
      if (!best || c < best.cost) best = { cost: c, t1, t2 };
    }
    return best;
  };

  let best = null;
  for (let r = 0; r < 80; r++) {
    const arr = shuffle(playing.slice());
    const quads = [];
    for (let i = 0; i < nC; i++) quads.push(arr.slice(4 * i, 4 * i + 4));
    const costs = quads.map((q) => quadBest(q).cost);
    let improved = true, guard = 0;
    while (improved && guard++ < 50) {
      improved = false;
      for (let a = 0; a < nC; a++) for (let b = a + 1; b < nC; b++) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        [quads[a][i], quads[b][j]] = [quads[b][j], quads[a][i]];
        const ca = quadBest(quads[a]).cost, cb = quadBest(quads[b]).cost;
        if (ca + cb < costs[a] + costs[b] - 1e-9) {
          costs[a] = ca; costs[b] = cb; improved = true;
        } else {
          [quads[a][i], quads[b][j]] = [quads[b][j], quads[a][i]];
        }
      }
    }
    const total = costs.reduce((s, c) => s + c, 0);
    if (!best || total < best.total) best = { total, quads: quads.map((q) => q.slice()) };
  }

  // Venstre/højre inden for holdet
  const orient = (x, y) => (x.side === 'hojre' || y.side === 'venstre' ? [y, x] : [x, y]);
  const sortedCourts = courts.slice(0, nC);
  const quads = shuffle(best.quads);
  const matches = quads.map((q, i) => {
    const { t1, t2 } = quadBest(q);
    const [al, ar] = orient(t1[0], t1[1]);
    const [bl, br] = orient(t2[0], t2[1]);
    return { court_id: sortedCourts[i].id, a_left: al.id, a_right: ar.id, b_left: bl.id, b_right: br.id };
  });
  return { matches, sitting };
}
