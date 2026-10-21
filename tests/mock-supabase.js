// Lokal udgave af supabase-js til browsertest: samme API som appen bruger, data i sessionStorage.
// Regler (Elo, godkendelse) svarer til databasefunktionerne; adgangsregler (RLS) testes ikke her.
const KEY = 'mockdb', SKEY = 'mock-session';
let tick = Date.parse('2026-10-20T10:00:00Z');
const now = () => new Date((tick += 1000)).toISOString();
const uuid = () => crypto.randomUUID();

function seed() {
  const centers = [{ id: 'c-gil', name: 'Gilleleje' }, { id: 'c-hel', name: 'Helsinge' }];
  const courts = [
    ...['Bane 1', 'Bane 2', 'Bane 3', 'Bane 4', 'Opvisningsbanen'].map((n, i) => ({ id: 'gil-' + i, center_id: 'c-gil', name: n, sort: i + 1 })),
    ...['Bane 1', 'Bane 2', 'Bane 3', 'Center Court'].map((n, i) => ({ id: 'hel-' + i, center_id: 'c-hel', name: n, sort: i + 1 })),
  ];
  const names = ['Anders', 'Bo', 'Carsten', 'Dennis', 'Erik', 'Frank', 'Anne', 'Berit', 'Camilla', 'Dorthe', 'Eva', 'Freja'];
  const sides = ['venstre', 'hojre', 'begge'];
  const profiles = [{ id: 'u-admin', name: 'Jimmy', gender: 'mand', side: 'hojre', elo: 1000, is_admin: true, role: 'admin', email: 'jimmy@test' },
    ...names.map((n, i) => ({ id: 'u-' + (i + 1), name: 'Test ' + n, gender: i < 6 ? 'mand' : 'kvinde', side: sides[i % 3], elo: 1000, is_admin: false, role: 'bruger', email: `test${i + 1}@fredagspadel.test` }))];
  return { padel_centers: centers, padel_courts: courts, padel_profiles: profiles, padel_events: [], padel_signups: [], padel_matches: [], padel_elo_changes: [], padel_signup_log: [] };
}
const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) || seed(); } catch { return seed(); } };
let db = load();
const save = () => sessionStorage.setItem(KEY, JSON.stringify(db));
const uid = () => JSON.parse(sessionStorage.getItem(SKEY) || 'null')?.user.id;
const me = () => db.padel_profiles.find((p) => p.id === uid());
const superuser = () => ['admin', 'superbruger'].includes(me()?.role);

const DEFAULTS = {
  padel_events: () => ({ id: uuid(), status: 'planlagt', current_round: 0, round_started_at: null, ranked: true, duration_minutes: 120, round_minutes: 30, team_mode: 'aaben', format: 'rotation', points_per_match: null, title: null, created_at: now() }),
  padel_matches: () => ({ id: uuid(), status: 'planlagt', score_a: null, score_b: null, reported_by: null, reported_team: null, confirmed_by: null, created_at: now() }),
  padel_signups: () => ({ created_at: now() }),
  padel_centers: () => ({ id: uuid() }),
  padel_courts: () => ({ id: uuid(), sort: 0 }),
};

function applyFilters(rows, filters) {
  return rows.filter((r) => filters.every(([op, col, val]) => {
    if (op === 'eq') return r[col] === val;
    if (op === 'gt') return r[col] > val;
    if (op === 'in') return val.includes(r[col]);
    if (op === 'or') return val.split(',').some((c) => { const [k, , v] = c.split('.'); return r[k] === v; });
    return true;
  }));
}

function embed(table, rows, cols) {
  if (!cols) return rows;
  return rows.map((r) => {
    const o = { ...r };
    if (table === 'padel_events' && cols.includes('padel_signups(')) o.padel_signups = db.padel_signups.filter((s) => s.event_id === r.id).map((s) => ({ ...s }));
    if (table === 'padel_matches' && cols.includes('padel_events(')) o.padel_events = { ...db.padel_events.find((e) => e.id === r.event_id) };
    return o;
  });
}

function logSignup(s, action) {
  db.padel_signup_log.push({ id: db.padel_signup_log.length + 1, event_id: s.event_id, player_id: s.player_id, action, done_by: uid(), created_at: now() });
}

class Query {
  constructor(table) { this.t = table; this.f = []; this.o = []; this.op = 'select'; }
  select(cols) { if (this.op === 'select') this.cols = cols; this.returning = true; return this; }
  insert(v) { this.op = 'insert'; this.v = Array.isArray(v) ? v : [v]; return this; }
  update(v) { this.op = 'update'; this.v = v; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c, v) { this.f.push(['eq', c, v]); return this; }
  gt(c, v) { this.f.push(['gt', c, v]); return this; }
  in(c, v) { this.f.push(['in', c, v]); return this; }
  or(s) { this.f.push(['or', null, s]); return this; }
  order(c, o = {}) { this.o.push([c, o.ascending !== false]); return this; }
  limit(n) { this.n = n; return this; }
  single() { this.one = true; return this; }
  run() {
    const T = (db[this.t] ||= []);
    let data;
    if (this.op === 'insert') {
      data = this.v.map((v) => ({ ...(DEFAULTS[this.t]?.() || {}), ...v }));
      if (this.t === 'padel_signups') for (const s of data) {
        if (T.some((x) => x.event_id === s.event_id && x.player_id === s.player_id)) return { error: { message: 'duplicate key' } };
        logSignup(s, 'til');
      }
      T.push(...data);
    } else if (this.op === 'update') {
      data = applyFilters(T, this.f); data.forEach((r) => Object.assign(r, this.v));
    } else if (this.op === 'delete') {
      data = applyFilters(T, this.f);
      if (this.t === 'padel_signups') data.forEach((s) => logSignup(s, 'fra'));
      if (this.t === 'padel_events') for (const e of data) { db.padel_signups = db.padel_signups.filter((s) => s.event_id !== e.id); db.padel_signup_log = db.padel_signup_log.filter((s) => s.event_id !== e.id); }
      db[this.t] = T.filter((r) => !data.includes(r));
    } else {
      data = applyFilters(T, this.f);
    }
    data = data.map((r) => ({ ...r }));
    for (const [c, asc] of [...this.o].reverse()) data.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
    if (this.n) data = data.slice(0, this.n);
    data = embed(this.t, data, this.cols);
    save();
    if (this.one) return data.length ? { data: data[0], error: null } : { data: null, error: { message: 'Ingen række' } };
    return { data: this.op === 'select' || this.returning ? data : null, error: null };
  }
  then(res, rej) { return Promise.resolve().then(() => this.run()).then(res, rej); }
}

// ---------- Databasefunktioner ----------
function applyElo(m) {
  const ev = db.padel_events.find((e) => e.id === m.event_id);
  if (m.status !== 'bekraeftet' || !ev.ranked || db.padel_elo_changes.some((c) => c.match_id === m.id && c.active)) return;
  if (['rotation', 'americano', 'saet'].includes(ev.format) && m.score_a + m.score_b === 0) return;
  const s = ev.format === 'klassisk' ? (m.score_a > m.score_b ? 1 : m.score_a < m.score_b ? 0 : 0.5) : m.score_a / (m.score_a + m.score_b);
  const P = (id) => db.padel_profiles.find((p) => p.id === id);
  const ra = (P(m.a_left).elo + P(m.a_right).elo) / 2, rb = (P(m.b_left).elo + P(m.b_right).elo) / 2;
  const d = Math.round(32 * (s - 1 / (1 + 10 ** ((rb - ra) / 400))));
  for (const [id, dd] of [[m.a_left, d], [m.a_right, d], [m.b_left, -d], [m.b_right, -d]]) {
    db.padel_elo_changes = db.padel_elo_changes.filter((c) => !(c.match_id === m.id && c.player_id === id));
    db.padel_elo_changes.push({ match_id: m.id, player_id: id, elo_before: P(id).elo, delta: dd, active: true, created_at: now() });
    P(id).elo += dd;
  }
}
function revertElo(id) {
  for (const c of db.padel_elo_changes.filter((x) => x.match_id === id && x.active)) { db.padel_profiles.find((p) => p.id === c.player_id).elo -= c.delta; c.active = false; }
}
const M = (id) => db.padel_matches.find((m) => m.id === id);
const teamOf = (m) => ([m.a_left, m.a_right].includes(uid()) ? 'a' : [m.b_left, m.b_right].includes(uid()) ? 'b' : null);

const RPC = {
  padel_save_profile: ({ p_name, p_gender, p_side }) => {
    const p = me();
    if (p) Object.assign(p, { name: p_name, gender: p_gender, side: p_side });
    else db.padel_profiles.push({ id: uid(), name: p_name, gender: p_gender, side: p_side, elo: 1000, is_admin: false, role: 'bruger' });
  },
  padel_set_role: ({ p_user, p_role }) => { Object.assign(db.padel_profiles.find((p) => p.id === p_user), { role: p_role, is_admin: p_role === 'admin' }); },
  padel_admin_update_player: ({ p_user, p_name, p_gender, p_side }) => { Object.assign(db.padel_profiles.find((p) => p.id === p_user), { name: p_name, gender: p_gender, side: p_side }); },
  padel_report_result: ({ p_match, p_a, p_b }) => {
    const m = M(p_match);
    if (superuser()) { if (m.status === 'bekraeftet') revertElo(m.id); Object.assign(m, { score_a: p_a, score_b: p_b, status: 'bekraeftet' }); return applyElo(m); }
    const t = teamOf(m); if (!t) throw new Error('Du spiller ikke i denne kamp');
    Object.assign(m, { score_a: p_a, score_b: p_b, status: 'indtastet', reported_team: t });
  },
  padel_confirm_result: ({ p_match }) => {
    const m = M(p_match), t = teamOf(m);
    if (!superuser() && (!t || t === m.reported_team)) throw new Error('Resultatet skal godkendes af modstanderholdet');
    m.status = 'bekraeftet'; applyElo(m);
  },
  padel_reject_result: ({ p_match }) => { Object.assign(M(p_match), { status: 'planlagt', score_a: null, score_b: null, reported_team: null }); },
  padel_admin_reset_match: ({ p_match }) => { revertElo(p_match); Object.assign(M(p_match), { status: 'planlagt', score_a: null, score_b: null, reported_team: null }); },
  padel_admin_set_teams: ({ p_match, p_al, p_ar, p_bl, p_br, p_court }) => { Object.assign(M(p_match), { a_left: p_al, a_right: p_ar, b_left: p_bl, b_right: p_br, court_id: p_court }); },
  padel_start_round: ({ p_event, p_round }) => { Object.assign(db.padel_events.find((e) => e.id === p_event), { current_round: p_round, round_started_at: now(), status: 'igang' }); },
  padel_set_event_status: ({ p_event, p_status }) => { db.padel_events.find((e) => e.id === p_event).status = p_status; },
  padel_admin_set_ranked: ({ p_event, p_ranked }) => {
    const ev = db.padel_events.find((e) => e.id === p_event);
    const ms = db.padel_matches.filter((m) => m.event_id === p_event);
    if (p_ranked) { ev.ranked = true; ms.filter((m) => m.status === 'bekraeftet').forEach(applyElo); }
    else { ms.forEach((m) => revertElo(m.id)); ev.ranked = false; }
  },
};

export function createClient() {
  let cb = () => {};
  const session = () => JSON.parse(sessionStorage.getItem(SKEY) || 'null');
  return {
    auth: {
      onAuthStateChange(fn) { cb = fn; setTimeout(() => cb('INITIAL_SESSION', session()), 0); return { data: { subscription: { unsubscribe() {} } } }; },
      async signInWithPassword({ email }) {
        const p = db.padel_profiles.find((x) => x.email === email);
        if (!p) return { data: null, error: { message: 'Invalid login credentials' } };
        sessionStorage.setItem(SKEY, JSON.stringify({ user: { id: p.id, email } }));
        setTimeout(() => cb('SIGNED_IN', session()), 0);
        return { data: { session: session() }, error: null };
      },
      async signUp() { return { data: { session: null }, error: null }; },
      async signOut() { sessionStorage.removeItem(SKEY); setTimeout(() => cb('SIGNED_OUT', null), 0); return { error: null }; },
      async resetPasswordForEmail() { return { data: {}, error: null }; },
      async updateUser() { return { data: {}, error: null }; },
    },
    from: (t) => new Query(t),
    async rpc(name, args) {
      try { await RPC[name](args); save(); return { data: null, error: null }; }
      catch (e) { return { data: null, error: { message: e.message } }; }
    },
    channel() { const c = { on: () => c, subscribe: () => c }; return c; },
    removeChannel() {},
  };
}
