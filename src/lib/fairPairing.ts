export type Player = { id: string; name: string; elo: number };
export type Team = Player[]; // size 2
export type Game = { id: string; teams: [Team, Team] };

/**
 * "Fair" parring:
 * - sorter efter ELO
 * - vælg partner/opponent, så teams' ELO-summer bliver så tætte som muligt
 */
export function buildFairSchedule(players: Player[]): Game[] {
  const pool = [...players].sort((a,b)=>b.elo-a.elo);
  const games: Game[] = [];
  let gid = 1;
  while (pool.length >= 4) {
    const p1 = pool.shift()!; // stærkeste

    const avg = pool.reduce((s,p)=>s+p.elo,0)/pool.length;
    const idxPartner = pool.reduce((bestIdx, p, i) =>
      Math.abs(p.elo - avg) < Math.abs(pool[bestIdx].elo - avg) ? i : bestIdx
    , 0);
    const p2 = pool.splice(idxPartner,1)[0];

    let bestPair:[number,number] = [0,1], bestDiff = Infinity;
    for (let i=0;i<pool.length;i++){
      for (let j=i+1;j<pool.length;j++){
        const diff = Math.abs((p1.elo+p2.elo) - (pool[i].elo+pool[j].elo));
        if (diff < bestDiff){ bestDiff = diff; bestPair = [i,j]; }
      }
    }
    const [i,j] = bestPair;
    const opp2 = pool.splice(j,1)[0];
    const opp1 = pool.splice(i,1)[0];

    const opt1 = Math.abs((p1.elo+opp1.elo) - (p2.elo+opp2.elo));
    const opt2 = Math.abs((p1.elo+opp2.elo) - (p2.elo+opp1.elo));
    const A = opt1<=opt2 ? [p1,opp1] : [p1,opp2];
    const B = opt1<=opt2 ? [p2,opp2] : [p2,opp1];

    games.push({ id: `g${gid++}`, teams: [A,B] });
  }
  return games;
}
