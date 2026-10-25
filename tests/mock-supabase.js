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
  const profiles = [{ id: 'u-admin', name: 'Jimmy', gender: 'mand', side: 'hojre', elo: 1000, is_admin: true, is_superadmin: true, role: 'admin', email: 'jimmy@test', news_seen: '9999' },
    ...names.map((n, i) => ({ id: 'u-' + (i + 1), name: 'Test ' + n, gender: i < 6 ? 'mand' : 'kvinde', side: sides[i % 3], elo: 1000, is_admin: false, role: 'bruger', email: `test${i + 1}@fredagspadel.test`, news_seen: '9999' })),
    { id: 'u-brian', name: 'Brian', gender: 'mand', side: 'venstre', elo: 1000, is_admin: false, role: 'bruger', email: 'brian@test', news_seen: '9999' }];
  const groups = [{ id: 'g-fre', name: 'Fredagspadel' }];
  const members = profiles.filter((p) => p.id !== 'u-brian').map((p) => ({ group_id: 'g-fre', player_id: p.id, role: p.id === 'u-admin' ? 'admin' : 'bruger', status: 'aktiv', elo: 1000 }));
  return { padel_centers: centers, padel_courts: courts, padel_profiles: profiles, padel_events: [], padel_signups: [], padel_matches: [], padel_elo_changes: [], padel_signup_log: [],
    padel_groups: groups, padel_group_centers: centers.map((c) => ({ group_id: 'g-fre', center_id: c.id, enabled: true })), padel_group_members: members,
    padel_settings: [{ id: 1, global_ranking_public: false, feedback_after_matches: 0 }], padel_contacts: [], padel_fine_types: [], padel_fines: [], padel_suggestions: [], padel_admin_notices: [], padel_notifications: [], padel_push_subs: [],
    padel_club_teams: [], padel_club_kids: [], padel_club_guardians: [], padel_club_sessions: [], padel_club_absence: [], padel_club_attendance: [], padel_club_cancellations: [], padel_club_posts: [], padel_club_fees: [], padel_club_kid_info: [], padel_club_team_trainers: [], padel_club_staff: [], padel_club_certs: [], padel_club_events: [], padel_club_event_signups: [], padel_club_tasks: [], padel_club_task_helpers: [] };
}
const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) || seed(); } catch { return seed(); } };
let db = load();
const save = () => sessionStorage.setItem(KEY, JSON.stringify(db));
// Kun til test: direkte adgang til databasen i hukommelsen
window.__mock = { db: () => db, save };
const uid = () => JSON.parse(sessionStorage.getItem(SKEY) || 'null')?.user.id;
const me = () => db.padel_profiles.find((p) => p.id === uid());
const GM = (g, p) => db.padel_group_members.find((m) => m.group_id === g && m.player_id === p);
const evGroup = (eid) => db.padel_events.find((e) => e.id === eid)?.group_id;
const canRun = (g) => me()?.is_superadmin || ['admin', 'superbruger'].includes(GM(g, uid())?.status === 'aktiv' && GM(g, uid()).role);
const superuser = canRun;

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
    if (op === 'gte') return r[col] >= val;
    if (op === 'lte') return r[col] <= val;
    if (op === 'neq') return r[col] !== val;
    if (op === 'is') return (r[col] ?? null) === val;
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

// Beskeder (samme regler som databasen)
const notify = (users, kind, title, body, url) => [...new Set(users.filter(Boolean))].forEach((u) => db.padel_notifications.push({ id: uuid(), user_id: u, kind, title, body, url, created_at: now(), read_at: null }));
const playing = (evId, list) => {
  const ev = db.padel_events.find((e) => e.id === evId);
  const ids = list.slice().sort((a, b) => a.created_at.localeCompare(b.created_at) || a.player_id.localeCompare(b.player_id)).map((x) => x.player_id);
  return ids.slice(0, 4 * Math.min(Math.floor(ids.length / 4), (ev?.court_ids || []).length));
};
const notifyPromoted = (evId, before, after, exclude) => {
  if (!before.length) return;
  const up = after.filter((x) => !before.includes(x) && x !== exclude);
  if (up.length) notify(up, 'venteliste', 'Du har fået en plads 🎾', 'Du er rykket op fra ventelisten.', '/#/fredag/' + evId);
};

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
  gte(c, v) { this.f.push(['gte', c, v]); return this; }
  lte(c, v) { this.f.push(['lte', c, v]); return this; }
  neq(c, v) { this.f.push(['neq', c, v]); return this; }
  is(c, v) { this.f.push(['is', c, v]); return this; }
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
      if (this.t === 'padel_signups') for (const s of data) {
        const before = playing(s.event_id, T.filter((x) => x.event_id === s.event_id));
        T.push(s);
        notifyPromoted(s.event_id, before, playing(s.event_id, T.filter((x) => x.event_id === s.event_id)), s.player_id);
      } else T.push(...data);
    } else if (this.op === 'update') {
      data = applyFilters(T, this.f); data.forEach((r) => Object.assign(r, this.v));
    } else if (this.op === 'delete') {
      data = applyFilters(T, this.f);
      if (this.t === 'padel_signups') data.forEach((s) => {
        autoFine(s); logSignup(s, 'fra');
        const all = db.padel_signups.filter((x) => x.event_id === s.event_id);
        notifyPromoted(s.event_id, playing(s.event_id, all), playing(s.event_id, all.filter((x) => x !== s)), s.player_id);
      });
      if (this.t === 'padel_events') for (const e of data) { db.padel_signups = db.padel_signups.filter((s) => s.event_id !== e.id); db.padel_signup_log = db.padel_signup_log.filter((s) => s.event_id !== e.id); }
      db[this.t] = T.filter((r) => !data.includes(r));
    } else {
      data = applyFilters(T, this.f);
      // Lidt adgangsregler for klubben: børn ses kun af trænere og egne forældre
      if (this.t === 'padel_club_kids') data = data.filter((k) => canRun(k.group_id) || kidMine(k.id) || db.padel_club_staff.some((x) => x.group_id === k.group_id && x.user_id === uid() && x.treasurer));
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
  const ev = db.padel_events.find((e) => e.id === m.event_id), g = ev.group_id;
  if (m.status !== 'bekraeftet' || !ev.ranked || db.padel_elo_changes.some((c) => c.match_id === m.id && c.active)) return;
  if (['rotation', 'americano', 'saet'].includes(ev.format) && m.score_a + m.score_b === 0) return;
  const s = ev.format === 'klassisk' ? (m.score_a > m.score_b ? 1 : m.score_a < m.score_b ? 0 : 0.5) : m.score_a / (m.score_a + m.score_b);
  const P = (id) => db.padel_profiles.find((p) => p.id === id);
  const E = (a, b) => 1 / (1 + 10 ** ((b - a) / 400));
  const d = Math.round(32 * (s - E((P(m.a_left).elo + P(m.a_right).elo) / 2, (P(m.b_left).elo + P(m.b_right).elo) / 2)));
  const gd = Math.round(32 * (s - E((GM(g, m.a_left).elo + GM(g, m.a_right).elo) / 2, (GM(g, m.b_left).elo + GM(g, m.b_right).elo) / 2)));
  for (const [id, sg] of [[m.a_left, 1], [m.a_right, 1], [m.b_left, -1], [m.b_right, -1]]) {
    db.padel_elo_changes = db.padel_elo_changes.filter((c) => !(c.match_id === m.id && c.player_id === id));
    db.padel_elo_changes.push({ match_id: m.id, player_id: id, elo_before: P(id).elo, delta: sg * d, group_delta: sg * gd, active: true, created_at: now() });
    P(id).elo += sg * d; GM(g, id).elo += sg * gd;
  }
}
function revertElo(id) {
  const g = evGroup(M(id).event_id);
  for (const c of db.padel_elo_changes.filter((x) => x.match_id === id && x.active)) {
    db.padel_profiles.find((p) => p.id === c.player_id).elo -= c.delta; GM(g, c.player_id).elo -= c.group_delta; c.active = false;
  }
}
const M = (id) => db.padel_matches.find((m) => m.id === id);
const teamOf = (m) => ([m.a_left, m.a_right].includes(uid()) ? 'a' : [m.b_left, m.b_right].includes(uid()) ? 'b' : null);

const cleanPhone = (x) => {
  x = String(x || '').replace(/[\s\-().]/g, '');
  if (/^\+?45\d{8}$/.test(x)) return '+45' + x.slice(-8);
  if (/^\d{8}$/.test(x)) return '+45' + x;
  if (/^\+\d{8,15}$/.test(x)) return x;
  throw new Error('Ugyldigt telefonnummer');
};
const setPhone = (pid, ph) => {
  const c = db.padel_contacts.find((x) => x.player_id === pid);
  if (c) c.phone = cleanPhone(ph); else db.padel_contacts.push({ player_id: pid, phone: cleanPhone(ph) });
};
// Automatisk bøde ved afmelding (samme regler som databasen)
const signoffType = (evId, pid) => {
  const ev = db.padel_events.find((e) => e.id === evId);
  if (!ev || ev.status === 'afsluttet') return null;
  if (!db.padel_groups.find((x) => x.id === ev.group_id)?.fines_enabled) return null;
  const ss = db.padel_signups.filter((x) => x.event_id === evId).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.player_id.localeCompare(b.player_id));
  const me_ = ss.find((x) => x.player_id === pid);
  if (!me_ || Date.parse(me_.created_at) > tick - 15 * 60e3) return null;
  if (ss.indexOf(me_) >= 4 * Math.min(Math.floor(ss.length / 4), (ev.court_ids || []).length)) return null;
  const ts = db.padel_fine_types.filter((t) => t.group_id === ev.group_id && t.active && !t.per_minute);
  const sameDay = new Date(tick).toISOString().slice(0, 10) >= ev.starts_at.slice(0, 10);
  return ((sameDay && ts.find((t) => t.auto === 'afbud_dagen')) || ts.find((t) => t.auto === 'afbud'))?.id || null;
};
const autoFine = (s) => {
  const tid = signoffType(s.event_id, s.player_id);
  if (!tid) return;
  const t = db.padel_fine_types.find((x) => x.id === tid), ev = db.padel_events.find((e) => e.id === s.event_id);
  db.padel_fines.push({ id: uuid(), group_id: ev.group_id, player_id: s.player_id, type_id: t.id, title: t.name, amount: t.amount, note: 'Meldte fra', event_id: ev.id, status: 'ubetalt', given_by: null, auto: true, created_at: now() });
};

const RPC = {
  padel_set_news_seen: ({ p_id }) => { if (me()) me().news_seen = p_id; },
  padel_set_theme: ({ p_theme }) => { me().theme = p_theme; },
  padel_vapid_public: () => 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
  padel_save_push: ({ p_endpoint, p_p256dh, p_auth }) => { db.padel_push_subs.push({ endpoint: p_endpoint, user_id: uid(), p256dh: p_p256dh, auth: p_auth, enabled: true }); },
  padel_disable_push: ({ p_endpoint }) => { db.padel_push_subs.filter((x) => x.endpoint === p_endpoint).forEach((x) => (x.enabled = false)); },
  padel_has_push: () => db.padel_push_subs.some((x) => x.user_id === uid() && x.enabled),
  padel_notifications_read: () => { db.padel_notifications.filter((n) => n.user_id === uid() && !n.read_at).forEach((n) => (n.read_at = now())); },
  padel_set_ranking_mode: ({ g, p_mode }) => { db.padel_groups.find((x) => x.id === g).ranking_mode = p_mode; },
  padel_ranking: ({ g }) => {
    const mode = db.padel_groups.find((x) => x.id === g)?.ranking_mode || 'alle';
    if (mode === 'ingen' && !(me()?.is_superadmin || GM(g, uid())?.role === 'admin')) return [];
    const inGroup = (pid, gg) => db.padel_group_members.some((m) => m.player_id === pid && m.status === 'aktiv' && (!gg || m.group_id === gg) && !db.padel_groups.find((x) => x.id === m.group_id)?.archived);
    const mStart = new Date(new Date(tick).getFullYear(), new Date(tick).getMonth(), 1).toISOString();
    return db.padel_profiles.filter((p) => !p.deleted_at && !p.merged_into && (mode === 'gruppe' ? inGroup(p.id, g) : inGroup(p.id))).map((p) => {
      const r = { id: p.id, name: p.name, gender: p.gender, elo: p.elo, matches: 0, form: [], month_pts: 0, eggs: 0, cur_streak: 0, best_streak: 0 };
      const cs = db.padel_elo_changes.filter((c) => c.player_id === p.id && c.active).sort((a, b) => a.created_at.localeCompare(b.created_at));
      for (const c of cs) {
        const m = db.padel_matches.find((x) => x.id === c.match_id), ev = db.padel_events.find((e) => e.id === m.event_id);
        const onA = [m.a_left, m.a_right].includes(p.id), my = onA ? m.score_a : m.score_b, th = onA ? m.score_b : m.score_a;
        r.matches++; r.form.push(c.delta);
        if (ev.starts_at >= mStart) r.month_pts += c.delta;
        if (['saet', 'klassisk'].includes(ev.format) && th === 0 && my >= 6) r.eggs++;
        if (my > th) { r.cur_streak++; r.best_streak = Math.max(r.best_streak, r.cur_streak); } else r.cur_streak = 0;
      }
      r.form = r.form.slice(-5).reverse();
      return r;
    });
  },
  padel_delete_player: ({ p_user }) => {
    const p = db.padel_profiles.find((x) => x.id === p_user);
    if (p.is_superadmin) throw new Error('En superadmin kan ikke slettes');
    if (p_user !== uid() && !me()?.is_superadmin && !db.padel_group_members.some((m) => m.player_id === p_user && GM(m.group_id, uid())?.role === 'admin')) throw new Error('Det har du ikke adgang til');
    db.padel_group_members.filter((m) => m.player_id === p_user && m.status !== 'fjernet').forEach((m) => (m.status = 'fjernet'));
    p.deleted_at = now();
  },
  padel_reactivate_me: () => { if (me().deleted_at) { me().deleted_at = null; db.padel_admin_notices.push({ id: uuid(), kind: 'comeback', player_id: uid(), how: 'genaktiverede sin profil (samme mail)', elo: me().elo, seen: false, created_at: now() }); } },
  padel_notices_seen: ({ p_ids }) => { db.padel_admin_notices.filter((n) => p_ids.includes(n.id)).forEach((n) => (n.seen = true)); },
  padel_restore_player: ({ p_user }) => { db.padel_profiles.find((x) => x.id === p_user).deleted_at = null; },
  padel_archive_group: ({ g, p_archived }) => { if (!me()?.is_superadmin) throw new Error('Kun superadmin'); Object.assign(db.padel_groups.find((x) => x.id === g), { archived: p_archived }); },
  // Superadmin: ret og slet
  padel_super_update: ({ p_table, p_id, p_data }) => {
    if (!me()?.is_superadmin) throw new Error('Kun superadmin');
    let row;
    if (p_table === 'padel_group_members') { const [g, p] = p_id.split('|'); row = GM(g, p); } else row = db[p_table].find((r) => String(r.id) === String(p_id));
    if (!row) throw new Error('Fandt ikke det, der skulle rettes');
    if (p_table === 'padel_matches') revertElo(row.id);
    Object.assign(row, p_data);
    if (p_table === 'padel_matches' && row.status === 'bekraeftet') applyElo(row);
  },
  padel_super_prepare_delete: ({ p_table, p_id }) => {
    if (!me()?.is_superadmin) throw new Error('Kun superadmin');
    if (p_table === 'padel_matches') revertElo(p_id);
    if (p_table === 'padel_events') db.padel_matches.filter((m) => m.event_id === p_id).forEach((m) => revertElo(m.id));
  },
  // Forslagskasse
  padel_send_suggestion: ({ p_text, p_source, p_group }) => {
    if (!p_text?.trim()) throw new Error('Skriv dit forslag');
    const x = { id: uuid(), player_id: uid(), group_id: p_group || null, text: p_text.trim(), source: p_source === 'popup' ? 'popup' : 'profil', status: 'ny', reply: null, replied_at: null, reply_seen: true, created_at: now() };
    db.padel_suggestions.push(x); me().feedback_asked_at ||= now(); return x.id;
  },
  padel_answer_suggestion: ({ p_id, p_status, p_reply }) => {
    if (!me()?.is_superadmin) throw new Error('Kun superadmin');
    const x = db.padel_suggestions.find((y) => y.id === p_id), r = p_reply?.trim() || null;
    if (r !== x.reply || p_status !== x.status) x.reply_seen = false;
    if (r !== x.reply) x.replied_at = now();
    Object.assign(x, { status: p_status, reply: r });
  },
  padel_suggestion_replies_seen: () => { db.padel_suggestions.filter((x) => x.player_id === uid()).forEach((x) => (x.reply_seen = true)); },
  padel_should_ask_feedback: () => {
    const n = db.padel_settings[0].feedback_after_matches ?? 5, p = me();
    if (!p || n <= 0 || p.feedback_asked_at || p.placeholder) return false;
    return db.padel_matches.filter((m) => m.status === 'bekraeftet' && [m.a_left, m.a_right, m.b_left, m.b_right].includes(uid())).length >= n;
  },
  padel_feedback_asked: () => { me().feedback_asked_at ||= now(); },
  padel_set_feedback_after: ({ p_n }) => { db.padel_settings[0].feedback_after_matches = p_n; },
  padel_signoff_fine_type: ({ p_event, p_player }) => signoffType(p_event, p_player),
  padel_save_fine_type_v2: (a) => { const id = RPC.padel_save_fine_type(a); db.padel_fine_types.find((t) => t.id === id).auto = a.p_per_minute ? null : a.p_auto || null; return id; },
  padel_set_phone: ({ p_phone }) => setPhone(uid(), p_phone),
  padel_set_phone_v2: ({ p_phone }) => {
    setPhone(uid(), p_phone);
    const ph = cleanPhone(p_phone);
    const old = db.padel_profiles.find((p) => (p.placeholder || p.deleted_at) && !p.merged_into && p.id !== uid() && db.padel_contacts.some((c) => c.player_id === p.id && c.phone === ph));
    if (!old || db.padel_signups.some((x) => x.player_id === uid())) return null;
    const meId = uid(), sw = (x) => (x === old.id ? meId : x);
    me().elo = old.elo;
    db.padel_signups.forEach((x) => (x.player_id = sw(x.player_id)));
    db.padel_matches.forEach((m) => ['a_left', 'a_right', 'b_left', 'b_right'].forEach((k) => (m[k] = sw(m[k]))));
    db.padel_elo_changes.forEach((x) => (x.player_id = sw(x.player_id)));
    db.padel_fines.forEach((x) => (x.player_id = sw(x.player_id)));
    db.padel_group_members.forEach((x) => (x.player_id = sw(x.player_id)));
    old.merged_into = meId;
    if (old.deleted_at) db.padel_admin_notices.push({ id: uuid(), kind: 'comeback', player_id: meId, old_player_id: old.id, how: 'oprettede sig igen med samme telefonnummer', elo: old.elo, seen: false, created_at: now() });
    return old.id;
  },
  padel_admin_create_player: ({ g, p_name, p_phone, p_gender, p_side }) => {
    if (!(me()?.is_superadmin || GM(g, uid())?.role === 'admin')) throw new Error('Kun gruppens admin kan oprette spillere');
    const ph = cleanPhone(p_phone);
    if (db.padel_contacts.some((c) => c.phone === ph && !db.padel_profiles.find((p) => p.id === c.player_id)?.merged_into)) throw new Error('Der er allerede en spiller med det telefonnummer. Send dem en invitation i stedet.');
    const id = 'u-ph-' + uuid().slice(0, 8);
    db.padel_profiles.push({ id, name: p_name.trim(), gender: p_gender, side: p_side || 'begge', elo: 1000, is_admin: false, role: 'bruger', placeholder: true });
    db.padel_contacts.push({ player_id: id, phone: ph });
    db.padel_group_members.push({ group_id: g, player_id: id, role: 'bruger', status: 'aktiv', elo: 1000 });
    return id;
  },
  padel_admin_set_phone: ({ p_user, p_phone }) => setPhone(p_user, p_phone),
  padel_group_name: ({ g }) => db.padel_groups.find((x) => x.id === g)?.name,
  padel_request_join: ({ g }) => {
    const m = GM(g, uid());
    if (m?.status === 'aktiv') return 'aktiv';
    if (m) m.status = 'afventer'; else db.padel_group_members.push({ group_id: g, player_id: uid(), role: 'bruger', status: 'afventer', elo: 1000 });
    const admins = db.padel_group_members.filter((x) => x.group_id === g && x.status === 'aktiv' && x.role === 'admin').map((x) => x.player_id).concat(db.padel_profiles.filter((p) => p.is_superadmin).map((p) => p.id));
    notify(admins, 'anmodning', `${me().name} vil gerne være med`, 'Godkend eller afvis.', '/#/fredage');
    return 'afventer';
  },
  padel_set_member: ({ g, p, p_role, p_status }) => {
    const m = GM(g, p);
    if (m) Object.assign(m, { role: p_role, status: p_status }); else db.padel_group_members.push({ group_id: g, player_id: p, role: p_role, status: p_status, elo: 1000 });
  },
  padel_create_group: ({ p_name, p_centers }) => {
    const id = uuid();
    db.padel_groups.push({ id, name: p_name });
    p_centers.forEach((c) => db.padel_group_centers.push({ group_id: id, center_id: c, enabled: true }));
    return id;
  },
  padel_set_group_centers: ({ g, p_centers }) => {
    db.padel_group_centers.filter((x) => x.group_id === g).forEach((x) => (x.enabled = p_centers.includes(x.center_id)));
    p_centers.filter((c) => !db.padel_group_centers.some((x) => x.group_id === g && x.center_id === c)).forEach((c) => db.padel_group_centers.push({ group_id: g, center_id: c, enabled: true }));
  },
  padel_rename_group: ({ g, p_name }) => { db.padel_groups.find((x) => x.id === g).name = p_name; },
  padel_set_global_public: ({ p_public }) => { db.padel_settings[0].global_ranking_public = p_public; },
  // Bødekasse
  padel_set_fines: ({ g, p_enabled, p_pay_to, p_note }) => {
    if (!(me()?.is_superadmin || GM(g, uid())?.role === 'admin')) throw new Error('Kun gruppens admin kan ændre bødekassen');
    Object.assign(db.padel_groups.find((x) => x.id === g), { fines_enabled: p_enabled, fines_pay_to: p_pay_to || null, fines_note: p_note || null });
    if (p_enabled && !db.padel_fine_types.some((t) => t.group_id === g))
      [['For sent fremmøde', 5, true], ['Afbud efter tilmelding', 30, false, 'afbud'], ['Afbud på dagen', 100, false, 'afbud_dagen'], ['Udeblivelse', 500], ['Dårlig opførsel', 30], ['Glemte sager', 30]]
        .forEach(([name, amount, pm, auto], i) => db.padel_fine_types.push({ id: uuid(), group_id: g, name, amount, per_minute: !!pm, sort: i + 1, active: true, auto: auto || null }));
  },
  padel_set_fines_v2: (a) => {
    if (a.p_box_url && !/^https:\/\//i.test(a.p_box_url)) throw new Error('Linket til MobilePay Box skal starte med https://');
    RPC.padel_set_fines(a); db.padel_groups.find((x) => x.id === a.g).fines_box_url = a.p_box_url || null;
  },
  padel_save_fine_type: ({ p_id, g, p_name, p_amount, p_per_minute }) => {
    if (p_id) { Object.assign(db.padel_fine_types.find((t) => t.id === p_id), { name: p_name, amount: p_amount, per_minute: p_per_minute }); return p_id; }
    const t = { id: uuid(), group_id: g, name: p_name, amount: p_amount, per_minute: p_per_minute, sort: 99, active: true }; db.padel_fine_types.push(t); return t.id;
  },
  padel_set_fine_type_active: ({ p_id, p_active }) => { db.padel_fine_types.find((t) => t.id === p_id).active = p_active; },
  padel_give_fine: ({ g, p_player, p_type, p_minutes, p_title, p_amount, p_note }) => {
    if (!canRun(g)) throw new Error('Kun admin og superbruger kan give bøder');
    const t = p_type && db.padel_fine_types.find((x) => x.id === p_type);
    if (t?.per_minute && !(p_minutes > 0)) throw new Error('Angiv antal minutter');
    if (!t && (!p_title || !(p_amount > 0))) throw new Error('Skriv hvad bøden er for og et beløb');
    const f = { id: uuid(), group_id: g, player_id: p_player, type_id: t?.id || null, title: t ? t.name : p_title, amount: t ? (t.per_minute ? t.amount * p_minutes : t.amount) : p_amount,
      minutes: t?.per_minute ? p_minutes : null, note: p_note, status: 'ubetalt', given_by: uid(), created_at: now() };
    db.padel_fines.push(f); return f.id;
  },
  padel_fine_paid: ({ p_fine }) => {
    const f = db.padel_fines.find((x) => x.id === p_fine);
    if (canRun(f.group_id)) f.status = 'betalt'; else if (f.player_id === uid()) f.status = 'afventer'; else throw new Error('Det kan du ikke');
  },
  padel_fines_seen: ({ p_ids }) => { db.padel_fines.filter((f) => p_ids.includes(f.id) && f.player_id === uid()).forEach((f) => (f.seen_at = now())); },
  padel_fine_set_status: ({ p_fine, p_status }) => { db.padel_fines.find((x) => x.id === p_fine).status = p_status; },
  padel_global_ranking: () => db.padel_profiles.map((p) => ({ id: p.id, name: p.name, gender: p.gender, elo: p.elo, matches: db.padel_elo_changes.filter((c) => c.player_id === p.id && c.active).length })),
  padel_set_event_courts: ({ p_event, p_courts }) => { db.padel_events.find((e) => e.id === p_event).court_ids = p_courts; },
  padel_save_profile: ({ p_name, p_gender, p_side }) => {
    const p = me();
    if (p) Object.assign(p, { name: p_name, gender: p_gender, side: p_side });
    else db.padel_profiles.push({ id: uid(), name: p_name, gender: p_gender, side: p_side, elo: 1000, is_admin: false, role: 'bruger' });
  },
  padel_set_role: ({ p_user, p_role }) => { Object.assign(db.padel_profiles.find((p) => p.id === p_user), { role: p_role, is_admin: p_role === 'admin' }); },
  padel_admin_update_player: ({ p_user, p_name, p_gender, p_side }) => { Object.assign(db.padel_profiles.find((p) => p.id === p_user), { name: p_name, gender: p_gender, side: p_side }); },
  padel_report_result: ({ p_match, p_a, p_b }) => {
    const fm = db.padel_events.find((e) => e.id === M(p_match).event_id).format;
    if (['saet', 'klassisk'].includes(fm) && (p_a > 7 || p_b > 7 || (p_a === 7 && p_b === 7))) throw new Error('Et hold kan højst få 7 i et sæt');
    const m = M(p_match);
    // Første resultat sætter dagen i gang (frie spiltyper har ingen "Start runde")
    const ev = db.padel_events.find((e) => e.id === m.event_id);
    if (ev.status === 'planlagt') Object.assign(ev, { status: 'igang', current_round: Math.max(ev.current_round, m.round_no) });
    else if (ev.status === 'igang' && ev.format !== 'rotation') ev.current_round = Math.max(ev.current_round, m.round_no);
    if (superuser() || m.status === 'planlagt') { if (!superuser() && !teamOf(m)) throw new Error('Du spiller ikke i denne kamp'); revertElo(m.id); Object.assign(m, { score_a: p_a, score_b: p_b, status: 'bekraeftet', changed: false, prev_score_a: null, prev_score_b: null }); return applyElo(m); }
    const t = teamOf(m); if (!t) throw new Error('Du spiller ikke i denne kamp');
    if (m.status === 'planlagt') return Object.assign(m, { score_a: p_a, score_b: p_b, status: 'indtastet', reported_team: t, reported_by: uid(), changed: false });
    if (m.score_a === p_a && m.score_b === p_b) return;
    if (m.status === 'indtastet' && m.reported_by === uid()) return Object.assign(m, { score_a: p_a, score_b: p_b });
    if (m.status === 'bekraeftet') { revertElo(m.id); Object.assign(m, { prev_score_a: m.score_a, prev_score_b: m.score_b }); }
    Object.assign(m, { score_a: p_a, score_b: p_b, status: 'indtastet', reported_team: t, reported_by: uid(), changed: true });
  },
  padel_confirm_result: ({ p_match }) => {
    const m = M(p_match), t = teamOf(m);
    if (!superuser() && (!t || t === m.reported_team)) throw new Error('Resultatet skal godkendes af modstanderholdet');
    Object.assign(m, { status: 'bekraeftet', changed: false, prev_score_a: null, prev_score_b: null }); applyElo(m);
  },
  padel_reject_result: ({ p_match }) => {
    const m = M(p_match);
    if (m.changed && m.prev_score_a != null) { Object.assign(m, { status: 'bekraeftet', score_a: m.prev_score_a, score_b: m.prev_score_b, changed: false, prev_score_a: null, prev_score_b: null }); return applyElo(m); }
    Object.assign(m, { status: 'planlagt', score_a: null, score_b: null, reported_team: null, changed: false });
  },
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


// ---------- Juniorklub ----------
const code = () => uuid().replace(/-/g, '').slice(0, 12);
const KID = (id) => db.padel_club_kids.find((k) => k.id === id);
const kidMine = (id) => db.padel_club_guardians.some((x) => x.kid_id === id && x.user_id === uid() && x.active) || KID(id)?.player_id === uid();
const teamGroup = (t) => db.padel_club_teams.find((x) => x.id === t)?.group_id;
const sessGroup = (s) => teamGroup(db.padel_club_sessions.find((x) => x.id === s)?.team_id);
const trainerIds = (g) => db.padel_group_members.filter((m) => m.group_id === g && m.status === 'aktiv' && ['admin', 'superbruger'].includes(m.role)).map((m) => m.player_id);
const clubPeople = (g, t) => db.padel_club_kids.filter((k) => k.group_id === g && k.status === 'aktiv' && (!t || k.team_id === t))
  .flatMap((k) => [...db.padel_club_guardians.filter((x) => x.kid_id === k.id && x.active).map((x) => x.user_id), k.player_id]).filter(Boolean);
const activate = (g, u) => { const m = GM(g, u); if (m) { if (m.status !== 'aktiv') m.status = 'aktiv'; } else db.padel_group_members.push({ group_id: g, player_id: u, role: 'bruger', status: 'aktiv', elo: 1000 }); };
const upsert = (t, keys, row) => { const x = db[t].find((r) => keys.every((k) => r[k] === row[k])); if (x) Object.assign(x, row); else db[t].push(row); };
const needTrainer = (g) => { if (!canRun(g)) throw new Error('Kun klubbens trænere'); };
Object.assign(RPC, {
  padel_group_kind: ({ g }) => db.padel_groups.find((x) => x.id === g && !x.archived)?.kind || 'gruppe',
  padel_create_group_v2: ({ p_name, p_centers, p_kind }) => { const id = RPC.padel_create_group({ p_name, p_centers: p_centers || [] }); db.padel_groups.find((x) => x.id === id).kind = p_kind; return id; },
  padel_club_apply: ({ g, p_kids }) => {
    if (!me()) throw new Error('Opret din profil først');
    const ks = p_kids.filter((k) => k.name?.trim());
    if (!ks.length) throw new Error('Skriv barnets navn');
    for (const k of ks) {
      const id = uuid();
      db.padel_club_kids.push({ id, group_id: g, name: k.name.trim(), birth_year: k.birth_year ? +k.birth_year : null, note: k.note?.trim() || null, status: 'ansoegt', team_id: null, player_id: null, login_code: code(), guardian_code: code(), created_by: uid(), created_at: now() });
      db.padel_club_guardians.push({ kid_id: id, user_id: uid(), active: true });
    }
    notify(trainerIds(g), 'klub_ind', 'Ny indmeldelse: ' + ks.map((k) => k.name.trim()).join(', '), 'Godkend under Admin.', '/#/admin');
    return ks.length;
  },
  padel_club_decide: ({ p_kid, p_status, p_team }) => {
    const k = KID(p_kid); needTrainer(k.group_id);
    Object.assign(k, { status: p_status, team_id: p_team || k.team_id, approved_by: uid() });
    const us = db.padel_club_guardians.filter((x) => x.kid_id === k.id && x.active).map((x) => x.user_id);
    if (p_status === 'aktiv') { [...us, k.player_id].filter(Boolean).forEach((u) => activate(k.group_id, u)); notify([...us, k.player_id], 'klub_optaget', `${k.name} er optaget 🎾`, 'Se træningstiderne i appen.', '/#/traening'); }
    else notify(us, 'klub_afvist', `${k.name} er ikke optaget`, '', '/#/profil');
  },
  padel_club_set_kid: ({ p_kid, p_name, p_birth_year, p_team, p_status }) => { const k = KID(p_kid); needTrainer(k.group_id); Object.assign(k, { name: p_name.trim(), birth_year: p_birth_year, team_id: p_team, status: p_status }); },
  padel_club_leave: ({ p_kid }) => { if (!kidMine(p_kid) && !canRun(KID(p_kid).group_id)) throw new Error('Det har du ikke adgang til'); KID(p_kid).status = 'udmeldt'; },
  padel_club_save_team: ({ p_id, g, p_name, p_archived }) => {
    if (p_id) { const t = db.padel_club_teams.find((x) => x.id === p_id); needTrainer(t.group_id); Object.assign(t, { name: p_name.trim(), archived: !!p_archived }); return p_id; }
    needTrainer(g); if (!p_name?.trim()) throw new Error('Skriv holdets navn');
    const t = { id: uuid(), group_id: g, name: p_name.trim(), sort: db.padel_club_teams.filter((x) => x.group_id === g).length + 1, archived: false }; db.padel_club_teams.push(t); return t.id;
  },
  padel_club_save_session: ({ p_id, p_team, p_weekday, p_start, p_end, p_place, p_active }) => {
    needTrainer(teamGroup(p_team));
    if (p_end <= p_start) throw new Error('Sluttid skal være efter starttid');
    const v = { weekday: p_weekday, start_time: p_start + ':00', end_time: p_end + ':00', place: p_place?.trim() || null, active: p_active !== false };
    if (p_id) { Object.assign(db.padel_club_sessions.find((x) => x.id === p_id), v); return p_id; }
    const s = { id: uuid(), team_id: p_team, ...v }; db.padel_club_sessions.push(s); return s.id;
  },
  padel_club_set_absence: ({ p_session, p_day, p_kid, p_status, p_reason }) => {
    if (!kidMine(p_kid) && !canRun(sessGroup(p_session))) throw new Error('Det har du ikke adgang til');
    upsert('padel_club_absence', ['session_id', 'day', 'kid_id'], { session_id: p_session, day: p_day, kid_id: p_kid, status: p_status, reason: p_reason || null, set_by: uid() });
  },
  padel_club_set_attendance: ({ p_session, p_day, p_kid, p_present }) => { needTrainer(sessGroup(p_session)); upsert('padel_club_attendance', ['session_id', 'day', 'kid_id'], { session_id: p_session, day: p_day, kid_id: p_kid, present: p_present }); },
  padel_club_cancel: ({ p_session, p_day, p_cancelled, p_note }) => {
    const g = sessGroup(p_session); needTrainer(g);
    upsert('padel_club_cancellations', ['session_id', 'day'], { session_id: p_session, day: p_day, cancelled: p_cancelled, note: p_note || null });
    const s = db.padel_club_sessions.find((x) => x.id === p_session);
    notify(clubPeople(g, s.team_id), 'klub_aflyst', (p_cancelled ? 'Træning aflyst ' : 'Træning genoprettet ') + p_day, p_note || '', '/#/traening');
  },
  padel_club_post: ({ g, p_team, p_title, p_body, p_pinned }) => {
    needTrainer(g); if (!p_body?.trim()) throw new Error('Skriv en besked');
    const p = { id: uuid(), group_id: g, team_id: p_team || null, author: uid(), title: p_title?.trim() || null, body: p_body.trim(), pinned: !!p_pinned, hidden: false, created_at: now() };
    db.padel_club_posts.push(p);
    notify([...clubPeople(g, p_team), ...trainerIds(g)].filter((x) => x !== uid()), 'klub_opslag', '📣 ' + (p.title || 'Nyt opslag'), p.body.slice(0, 140), '/#/opslag');
    return p.id;
  },
  padel_club_update_post: ({ p_id, p_title, p_body, p_pinned, p_hidden }) => { const p = db.padel_club_posts.find((x) => x.id === p_id); needTrainer(p.group_id); Object.assign(p, { title: p_title, body: p_body, pinned: !!p_pinned, hidden: !!p_hidden }); },
  padel_club_set_fee: ({ g, p_fee, p_label, p_url, p_info }) => {
    if (!(me()?.is_superadmin || GM(g, uid())?.role === 'admin')) throw new Error('Kun klubbens admin');
    if (p_url && !/^https:\/\//i.test(p_url)) throw new Error('Linket til MobilePay skal starte med https://');
    Object.assign(db.padel_groups.find((x) => x.id === g), { club_fee: p_fee || null, club_fee_label: p_label?.trim() || null, club_fee_url: p_url?.trim() || null, club_info: p_info?.trim() || null });
  },
  padel_club_fee_paid: ({ p_kid }) => {
    const k = KID(p_kid), lbl = db.padel_groups.find((x) => x.id === k.group_id).club_fee_label;
    const st = canRun(k.group_id) ? 'betalt' : kidMine(p_kid) ? 'afventer' : null;
    if (!st) throw new Error('Det har du ikke adgang til');
    const cur = db.padel_club_fees.find((x) => x.kid_id === p_kid && x.label === lbl);
    upsert('padel_club_fees', ['kid_id', 'label'], { kid_id: p_kid, label: lbl, status: cur?.status === 'betalt' ? 'betalt' : st });
  },
  padel_club_fee_set: ({ p_kid, p_status }) => { const k = KID(p_kid); upsert('padel_club_fees', ['kid_id', 'label'], { kid_id: p_kid, label: db.padel_groups.find((x) => x.id === k.group_id).club_fee_label, status: p_status }); },
  padel_club_code_info: ({ p_code }) => {
    const k = db.padel_club_kids.find((x) => x.login_code === p_code || x.guardian_code === p_code);
    return k ? { kind: k.login_code === p_code ? 'barn' : 'foraelder', kid: k.name, club: db.padel_groups.find((x) => x.id === k.group_id).name, group_id: k.group_id } : null;
  },
  padel_club_claim: ({ p_code }) => {
    if (!me()) throw new Error('Opret din profil først');
    const k = db.padel_club_kids.find((x) => x.login_code === p_code || x.guardian_code === p_code);
    if (!k) throw new Error('Linket virker ikke længere. Bed om et nyt.');
    if (k.login_code === p_code) { k.player_id = uid(); k.login_code = code(); }
    else { upsert('padel_club_guardians', ['kid_id', 'user_id'], { kid_id: k.id, user_id: uid(), active: true }); k.guardian_code = code(); }
    if (k.status === 'aktiv') activate(k.group_id, uid());
    return k.group_id;
  },
});


// Etape 1: oplysninger, trænere på hold, kasserer
const isAdm = (g) => me()?.is_superadmin || GM(g, uid())?.status === 'aktiv' && GM(g, uid())?.role === 'admin';
const treasurer = (g) => isAdm(g) || db.padel_club_staff.some((x) => x.group_id === g && x.user_id === uid() && x.treasurer);
Object.assign(RPC, {
  padel_club_apply_v2: ({ g, p_kids }) => {
    const n = RPC.padel_club_apply({ g, p_kids });
    const mine = db.padel_club_kids.filter((k) => k.group_id === g && k.created_by === uid()).slice(-n);
    mine.forEach((k, i) => {
      const x = p_kids.filter((y) => y.name?.trim())[i];
      Object.assign(k, { birth_date: x.birth_date || null, birth_year: x.birth_date ? +x.birth_date.slice(0, 4) : null, gender: x.gender || null, photo_ok: x.photo_ok ?? null, address: x.address || null });
      if (x.info?.trim()) db.padel_club_kid_info.push({ kid_id: k.id, info: x.info.trim() });
    });
    return n;
  },
  padel_club_update_kid: ({ p_kid, p_name, p_birth_date, p_gender, p_photo_ok, p_info, p_address }) => {
    const k = KID(p_kid);
    if (!kidMine(p_kid) && !canRun(k.group_id)) throw new Error('Det har du ikke adgang til');
    Object.assign(k, { name: p_name.trim(), birth_date: p_birth_date, birth_year: p_birth_date ? +p_birth_date.slice(0, 4) : k.birth_year, gender: p_gender, photo_ok: p_photo_ok, address: p_address || null });
    upsert('padel_club_kid_info', ['kid_id'], { kid_id: p_kid, info: p_info?.trim() || null });
  },
  padel_club_set_team_trainers: ({ p_team, p_users }) => {
    if (!isAdm(teamGroup(p_team))) throw new Error('Kun klubbens admin');
    db.padel_club_team_trainers.filter((x) => x.team_id === p_team).forEach((x) => (x.active = p_users.includes(x.user_id)));
    p_users.forEach((u) => upsert('padel_club_team_trainers', ['team_id', 'user_id'], { team_id: p_team, user_id: u, active: true }));
  },
  padel_club_set_staff: ({ g, p_user, p_treasurer, p_cert_date }) => {
    if (!isAdm(g)) throw new Error('Kun klubbens admin');
    upsert('padel_club_staff', ['group_id', 'user_id'], { group_id: g, user_id: p_user, treasurer: !!p_treasurer });
    upsert('padel_club_certs', ['group_id', 'user_id'], { group_id: g, user_id: p_user, cert_date: p_cert_date });
  },
  padel_club_set_fee_v2: (a) => { RPC.padel_club_set_fee(a); db.padel_groups.find((x) => x.id === a.g).club_collect_address = !!a.p_collect_address; },
  padel_club_fee_reminder: ({ g }) => {
    if (!treasurer(g)) throw new Error('Kun kasserer og admin');
    const lbl = db.padel_groups.find((x) => x.id === g).club_fee_label;
    const kids = db.padel_club_kids.filter((k) => k.group_id === g && k.status === 'aktiv' && !db.padel_club_fees.some((f) => f.kid_id === k.id && f.label === lbl && f.status !== 'ubetalt'));
    const us = [...new Set(kids.flatMap((k) => db.padel_club_guardians.filter((x) => x.kid_id === k.id && x.active).map((x) => x.user_id)))];
    notify(us, 'klub_kontingent', '💳 Husk kontingent ' + lbl, 'Kontingentet er ikke betalt endnu.', '/#/traening');
    return us.length;
  },
  padel_club_trainer_contacts: ({ g }) => db.padel_group_members.filter((m) => m.group_id === g && m.status === 'aktiv' && ['admin', 'superbruger'].includes(m.role))
    .map((m) => ({ user_id: m.player_id, name: db.padel_profiles.find((p) => p.id === m.player_id)?.name, phone: db.padel_contacts.find((c) => c.player_id === m.player_id)?.phone || null,
      team_ids: db.padel_club_team_trainers.filter((x) => x.user_id === m.player_id && x.active).map((x) => x.team_id) }))
    .filter((x) => GM(g, x.user_id).role === 'superbruger' || x.team_ids.length),
  padel_club_my_treasurer: () => db.padel_club_staff.filter((x) => x.user_id === uid() && x.treasurer).map((x) => x.group_id),
});
// Kassereren må markere betalt
const _feePaid = RPC.padel_club_fee_paid, _feeSet = RPC.padel_club_fee_set;
RPC.padel_club_fee_paid = (a) => { const k = KID(a.p_kid); if (treasurer(k.group_id) && !canRun(k.group_id)) { upsert('padel_club_fees', ['kid_id', 'label'], { kid_id: k.id, label: db.padel_groups.find((x) => x.id === k.group_id).club_fee_label, status: 'betalt' }); return; } return _feePaid(a); };
RPC.padel_club_fee_set = _feeSet;


// Etape 2: påmindelser, afbudsfrist, kalender
Object.assign(RPC, {
  padel_club_set_options: ({ g, p_reminders, p_absence_hours }) => { if (!isAdm(g)) throw new Error('Kun klubbens admin'); Object.assign(db.padel_groups.find((x) => x.id === g), { club_reminders: p_reminders, club_absence_hours: p_absence_hours || null }); },
  padel_ical_token: ({ p_new }) => { const p = me(); if (!p.ical_token || p_new) p.ical_token = code() + code(); return p.ical_token; },
});
const _setAbs = RPC.padel_club_set_absence;
RPC.padel_club_set_absence = (a) => {
  _setAbs(a);
  const k = KID(a.p_kid), g = k.group_id, hrs = db.padel_groups.find((x) => x.id === g).club_absence_hours, s = db.padel_club_sessions.find((x) => x.id === a.p_session);
  const startMs = Date.parse(`${a.p_day}T${s.start_time.slice(0, 5)}:00+01:00`);
  const late = a.p_status === 'afbud' && hrs > 0 && !canRun(g) && Date.now() > startMs - hrs * 3600e3;
  db.padel_club_absence.find((x) => x.session_id === a.p_session && x.day === a.p_day && x.kid_id === a.p_kid).late = late;
  if (late) notify(db.padel_club_team_trainers.filter((x) => x.team_id === k.team_id && x.active).map((x) => x.user_id), 'klub_sent_afbud', 'Sent afbud: ' + k.name, a.p_reason || '', '/#/traening');
};


// Etape 3: arrangementer, forældrehjælp, venteliste, prøvetræning
const EV = (id) => db.padel_club_events.find((e) => e.id === id);
Object.assign(RPC, {
  padel_club_apply_v3: ({ g, p_kids }) => {
    const n = RPC.padel_club_apply_v2({ g, p_kids });
    const ks = p_kids.filter((y) => y.name?.trim());
    db.padel_club_kids.filter((k) => k.group_id === g && k.created_by === uid()).slice(-n).forEach((k, i) => { k.trial_requested = !!ks[i].trial; k.waitlist = false; k.trial = false; });
    return n;
  },
  padel_club_decide_v2: ({ p_kid, p_action, p_team }) => {
    const k = KID(p_kid); needTrainer(k.group_id);
    if (p_action === 'venteliste') { Object.assign(k, { status: 'ansoegt', waitlist: true, team_id: p_team || k.team_id }); return; }
    if (p_action === 'afvist') { Object.assign(k, { status: 'afvist', waitlist: false }); return; }
    RPC.padel_club_decide({ p_kid, p_status: 'aktiv', p_team });
    Object.assign(k, { waitlist: false, trial: p_action === 'proeve' });
  },
  padel_club_set_team_max: ({ p_team, p_max }) => { if (!isAdm(teamGroup(p_team))) throw new Error('Kun klubbens admin'); db.padel_club_teams.find((t) => t.id === p_team).max_kids = p_max || null; },
  padel_club_save_event: (a) => {
    const g = a.p_id ? EV(a.p_id).group_id : a.g; needTrainer(g);
    if (!a.p_title?.trim()) throw new Error('Skriv en titel');
    const v = { team_id: a.p_team, title: a.p_title.trim(), description: a.p_desc || null, starts_at: a.p_starts, ends_at: a.p_ends, place: a.p_place || null, deadline: a.p_deadline, price: a.p_price || null, max_kids: a.p_max || null, cancelled: !!a.p_cancelled };
    let id = a.p_id;
    if (id) Object.assign(EV(id), v); else { id = uuid(); db.padel_club_events.push({ id, group_id: g, created_by: uid(), created_at: now(), ...v }); notify(clubPeople(g, a.p_team), 'klub_arrangement', '📅 ' + v.title, '', '/#/traening'); }
    const keep = (a.p_tasks || []).map((t) => t.id).filter(Boolean);
    db.padel_club_tasks.filter((t) => t.event_id === id && !keep.includes(t.id)).forEach((t) => (t.active = false));
    (a.p_tasks || []).forEach((t, i) => { if (t.id) Object.assign(db.padel_club_tasks.find((x) => x.id === t.id), { title: t.title, slots: t.slots, active: true }); else db.padel_club_tasks.push({ id: uuid(), event_id: id, title: t.title, slots: t.slots || 1, sort: i + 1, active: true }); });
    return id;
  },
  padel_club_event_signup: ({ p_event, p_kid, p_status }) => {
    const e = EV(p_event);
    if (!kidMine(p_kid) && !canRun(e.group_id)) throw new Error('Du kan kun tilmelde dine egne børn');
    const n = db.padel_club_event_signups.filter((x) => x.event_id === p_event && x.status === 'tilmeldt' && x.kid_id !== p_kid).length;
    if (p_status === 'tilmeldt' && e.max_kids && n >= e.max_kids) throw new Error('Arrangementet er fuldt');
    const cur = db.padel_club_event_signups.find((x) => x.event_id === p_event && x.kid_id === p_kid);
    upsert('padel_club_event_signups', ['event_id', 'kid_id'], { event_id: p_event, kid_id: p_kid, status: p_status, paid: cur?.paid || 'ubetalt' });
  },
  padel_club_event_paid: ({ p_event, p_kid, p_status }) => {
    const x = db.padel_club_event_signups.find((y) => y.event_id === p_event && y.kid_id === p_kid && y.status === 'tilmeldt');
    if (!x) throw new Error('Barnet er ikke tilmeldt');
    const boss = canRun(EV(p_event).group_id) || treasurer(EV(p_event).group_id);
    if (!boss && p_status === 'betalt') throw new Error('Det har du ikke adgang til');
    if (!boss && x.paid === 'betalt') return;
    x.paid = p_status;
  },
  padel_club_task_help: ({ p_task, p_on }) => {
    const t = db.padel_club_tasks.find((x) => x.id === p_task);
    if (p_on && db.padel_club_task_helpers.filter((h) => h.task_id === p_task && h.active && h.user_id !== uid()).length >= t.slots) throw new Error('Der er allerede nok hjælpere');
    upsert('padel_club_task_helpers', ['task_id', 'user_id'], { task_id: p_task, user_id: uid(), active: !!p_on });
  },
  padel_club_event_counts: ({ g }) => db.padel_club_events.filter((e) => e.group_id === g).map((e) => ({ event_id: e.id, n: db.padel_club_event_signups.filter((x) => x.event_id === e.id && x.status === 'tilmeldt').length })),
});


// Find en klub
Object.assign(RPC, {
  padel_club_set_discoverable: ({ g, p_on }) => { if (!isAdm(g)) throw new Error('Kun klubbens admin'); db.padel_groups.find((x) => x.id === g).club_discoverable = !!p_on; },
  padel_club_join_info: ({ g }) => { const x = db.padel_groups.find((y) => y.id === g && y.kind === 'klub'); return x ? { name: x.name, collect_address: !!x.club_collect_address } : null; },
  padel_dismiss_club: ({ g }) => { const p = me(); p.dismissed_clubs = [...new Set([...(p.dismissed_clubs || []), g])]; },
  padel_discover_clubs: () => db.padel_groups.filter((x) => x.kind === 'klub' && x.club_discoverable && !x.archived && !GM(x.id, uid())
    && !db.padel_club_kids.some((k) => k.group_id === x.id && kidMine(k.id)) && !(me()?.dismissed_clubs || []).includes(x.id)).map((x) => ({ id: x.id, name: x.name })),
});

export function createClient() {
  let cb = () => {};
  const session = () => JSON.parse(sessionStorage.getItem(SKEY) || 'null');
  return {
    auth: {
      onAuthStateChange(fn) { cb = fn; setTimeout(() => cb('INITIAL_SESSION', session()), 0); return { data: { subscription: { unsubscribe() {} } } }; },
      async signInWithPassword({ email }) {
        let p = db.padel_profiles.find((x) => x.email === email);
        // "ny…@test": ny bruger uden profil endnu
        if (!p && /^ny.*@test$/.test(email)) p = { id: 'u-' + email.split('@')[0] };
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
      try { const data = await RPC[name](args); save(); return { data: data ?? null, error: null }; }
      catch (e) { return { data: null, error: { message: e.message } }; }
    },
    channel() { const c = { on: () => c, subscribe: () => c }; return c; },
    removeChannel() {},
  };
}
