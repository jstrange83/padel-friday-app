// Opret træningstider med tale eller fritekst, fx
// "Begyndere tirsdag fra 16 til 17.30 de næste 6 tirsdage" eller "U12 hver torsdag kl. 17 til halv syv i Gilleleje".
// parseSession returnerer de felter, den kunne finde; resten udfylder træneren selv i formularen.

const DAYS = { mandag: 1, tirsdag: 2, onsdag: 3, torsdag: 4, fredag: 5, lørdag: 6, søndag: 7 };
const NUM = { en: 1, et: 1, én: 1, to: 2, tre: 3, fire: 4, fem: 5, seks: 6, syv: 7, otte: 8, ni: 9, ti: 10, elleve: 11, tolv: 12,
  tretten: 13, fjorten: 14, femten: 15, seksten: 16, sytten: 17, atten: 18, nitten: 19, tyve: 20 };
const MONTHS = { januar: 1, februar: 2, marts: 3, april: 4, maj: 5, juni: 6, juli: 7, august: 8, september: 9, oktober: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, okt: 10, nov: 11, dec: 12 };

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const isoDow = (s) => new Date(s + 'T12:00:00Z').getUTCDay() || 7;
// Forkort navne, så "begynder", "begyndere" og "begynderne" er det samme, og "u 12" = "u12"
const stem = (s) => s.toLowerCase().replace(/([a-zæøå])\s+(\d)/g, '$1$2').replace(/[^a-zæøå0-9]/g, '').replace(/(erne|ene|ere|er|ne|e)$/, '');

// Et klokkeslæt: "16", "16.30", "16:30", "16 30", "halv seks", "kvart over fire", "fire"
function timeAt(t, i) {
  const rest = t.slice(i);
  let m = rest.match(/^(?:kl\.?\s*)?(\d{1,2})(?:[.:](\d{2})|\s(\d{2})(?!\d))?/);
  if (m) return { h: +m[1], min: +(m[2] || m[3] || 0), len: m[0].length };
  m = rest.match(/^(?:kl\.?\s*)?(halv|kvart over|kvart i)\s+([a-zæøå]+|\d{1,2})/);
  if (m) {
    const n = /^\d+$/.test(m[2]) ? +m[2] : NUM[m[2]];
    if (n == null) return null;
    if (m[1] === 'halv') return { h: n - 1, min: 30, len: m[0].length };
    if (m[1] === 'kvart over') return { h: n, min: 15, len: m[0].length };
    return { h: n - 1, min: 45, len: m[0].length };
  }
  m = rest.match(/^(?:kl\.?\s*)?([a-zæøå]+)/);
  if (m && NUM[m[1]] != null) return { h: NUM[m[1]], min: 0, len: m[0].length };
  return null;
}
// Træning er om eftermiddagen/aftenen: "fire" eller "4" betyder 16
const pm = (x) => (x && x.h < 8 ? { ...x, h: x.h + 12 } : x);
const hhmm = (x) => (x ? `${pad(x.h)}:${pad(x.min)}` : null);

function dateIn(t, today) {
  const m = t.match(/(\d{1,2})\.?\s*(?:\/\s*(\d{1,2})|([a-zæøå]+))/);
  if (!m) return null;
  const mon = m[2] ? +m[2] : MONTHS[m[3]];
  if (!mon || +m[1] < 1 || +m[1] > 31) return null;
  let y = +today.slice(0, 4);
  let d = `${y}-${pad(mon)}-${pad(+m[1])}`;
  if (d < addDays(today, -31)) d = `${y + 1}-${pad(mon)}-${pad(+m[1])}`;
  return d;
}

export function parseSession(text, { teams = [], centers = [], today, nowMinutes = 0 } = {}) {
  const raw = ' ' + text.toLowerCase().replace(/[,!?]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  const t = raw;
  const out = {};
  // Ugedag (også "tirsdage", "om tirsdagen")
  for (const [w, n] of Object.entries(DAYS)) if (new RegExp(`[ ]${w}(e|en|ene)?[ ]`).test(t)) { out.weekday = n; break; }
  // Hold: det navn, der passer bedst (længste match)
  const words = t.split(' ').filter(Boolean).map(stem);
  const joined = stem(t);
  const hit = teams.map((tm) => ({ tm, s: stem(tm.name) })).filter((x) => x.s && (words.includes(x.s) || joined.includes(x.s))).sort((a, b) => b.s.length - a.s.length)[0];
  if (hit) out.team = hit.tm.id;
  else {
    const m = t.match(/ (?:for|til|hold(?:et)?) (?!at |de |den |det |\d)([a-zæøå0-9]+(?: \d+)?) /);
    if (m && !DAYS[m[1]] && !/^(næste|uger?|gange?|kl)$/.test(m[1])) out.newTeam = m[1].replace(/^./, (c) => c.toUpperCase()).replace(/^U (\d)/, 'U$1');
  }
  // Tidspunkt: "fra X til Y", "X til Y", "X-Y"
  let from = null, to = null, pos = -1;
  const fm = t.match(/ (?:fra|kl\.?|klokken) (?=(?:kl\.?\s*)?(?:\d|halv|kvart|[a-zæøå]+ ))/);
  if (fm) { pos = fm.index + fm[0].length; from = timeAt(t, pos); }
  if (!from) { const m = t.match(/ (\d{1,2}(?:[.:]\d{2})?)\s*(?:-|til )/); if (m) { pos = m.index + 1; from = timeAt(t, pos); } }
  if (from) {
    // Sluttid: efter "til" eller "-" lige efter starttidspunktet
    const rest = t.slice(pos + from.len);
    const m = rest.match(/^\s*(?:-|til(?: kl\.?)?)\s*/);
    if (m) to = timeAt(rest, m[0].length);
  }
  from = pm(from); to = pm(to);
  if (from && to && to.h * 60 + to.min <= from.h * 60 + from.min && to.h < 12) to = { ...to, h: to.h + 12 };
  // Varighed i stedet for sluttid: "i halvanden time", "i en og en halv time", "i 2 timer" (søges kun efter starttidspunktet)
  if (from && !to) {
    const m = t.slice(pos).replace(/^\S+/, '').match(/ i (\d+(?:[.,]\d+)?|en|to|tre|halvanden)( og en halv)? timer? /);
    if (m) {
      const h = (m[1] === 'halvanden' ? 1.5 : NUM[m[1]] || parseFloat(m[1].replace(',', '.'))) + (m[2] ? 0.5 : 0);
      const e = from.h * 60 + from.min + Math.round(h * 60);
      if (h > 0 && h <= 5) to = { h: Math.floor(e / 60), min: e % 60 };
    }
  }
  if (from) out.start = hhmm(from);
  if (to) out.end = hhmm(to);
  // Sted: et af centrene ("i Gilleleje", "Helsinge")
  const c = centers.find((x) => t.includes(' ' + x.toLowerCase()));
  if (c) out.place = `Padelhuset ${c}`;
  // Hvor mange gange / hvornår
  const cnt = t.match(/ (\d+|[a-zæøå]+) (?:gange|uger|tirsdage|mandage|onsdage|torsdage|fredage|lørdage|søndage) /);
  if (cnt) { const n = /^\d+$/.test(cnt[1]) ? +cnt[1] : NUM[cnt[1]]; if (n) out.count = n; }
  if (/ (hver|alle) /.test(t) && !out.count) out.forever = true;
  // Datoer: "fra 6. november", "til 18/12" (kun rigtige datoer tæller, ikke "fra 16 til 17")
  const firstDate = (re) => { for (const m of t.matchAll(re)) { const d = today && dateIn(m[1], today); if (d) return d; } return null; };
  const fromDate = firstDate(/ (?:fra|start(?:er)?|begynd(?:er)?)(?: den)? (\d{1,2}\.?\s*(?:\/\s*\d{1,2}|[a-zæøå]+))(?= )/g);
  const toDate = firstDate(/ (?:til og med|indtil|til)(?: den)? (\d{1,2}\.?\s*(?:\/\s*\d{1,2}|[a-zæøå]+))(?= )/g);
  // Første gang: den næste af ugedagen (i dag, hvis træningen ikke er begyndt endnu)
  if (out.weekday && today) {
    let first = fromDate;
    if (!first) {
      first = today;
      const started = from && nowMinutes >= from.h * 60 + from.min;
      while (isoDow(first) !== out.weekday || (first === today && started)) first = addDays(first, 1);
    } else while (isoDow(first) !== out.weekday) first = addDays(first, 1);
    out.from = first;
    if (out.count) out.to = addDays(first, 7 * (out.count - 1));
    else if (toDate) out.to = toDate;
  }
  return out;
}

// Talegenkendelse (dansk). Kalder onText med det, der blev sagt.
export const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
export function listen(btn, onText, onError) {
  const rec = new SR();
  rec.lang = 'da-DK';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  const label = btn.textContent;
  btn.textContent = '🎙️';
  btn.classList.add('listening');
  const done = () => { btn.textContent = label; btn.classList.remove('listening'); };
  rec.onresult = (e) => onText(e.results[0][0].transcript);
  rec.onerror = (e) => { done(); onError?.(e.error); };
  rec.onend = done;
  rec.start();
}
