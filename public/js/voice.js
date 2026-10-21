// Sig resultatet med stemmen (dansk talegenkendelse) og bip når tiden er gået.
import { toast } from './core.js';

export const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const NUMW = (() => {
  const u = ['nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti', 'elleve', 'tolv', 'tretten', 'fjorten', 'femten', 'seksten', 'sytten', 'atten', 'nitten'];
  const m = {};
  u.forEach((w, i) => (m[w] = i));
  Object.assign(m, { et: 1, 'én': 1, een: 1, nul: 0, tyve: 20, tredive: 30 });
  for (let i = 1; i < 10; i++) { m[u[i] + 'ogtyve'] = 20 + i; m[u[i] + 'ogtredive'] = 30 + i; }
  m.etogtyve = 21; m.etogtredive = 31;
  return m;
})();

// Fortolker fx "seks fire", "6-4", "vi vandt 6 4", "vi tabte 3 til 9", "otte otte", "uafgjort 12"
export function parseScore(text, myTeam) {
  const t = text.toLowerCase();
  const nums = [];
  for (const tok of t.split(/[^a-zæøåé0-9]+/)) {
    if (!tok) continue;
    if (/^\d+$/.test(tok)) nums.push(+tok);
    else if (tok in NUMW) nums.push(NUMW[tok]);
  }
  const draw = /uafgjort|lige/.test(t);
  if (nums.length === 1 && draw) nums.push(nums[0]);
  if (nums.length === 1 && /^\d\d$/.test(String(nums[0]))) { const d = String(nums[0]); nums.splice(0, 1, +d[0], +d[1]); }
  if (nums.length < 2) return null;
  let [x, y] = nums;
  const we = /\b(vi|os)\b/.test(t) && myTeam;
  if (!we) return { a: x, b: y };
  if (/vandt|vinder/.test(t)) [x, y] = [Math.max(x, y), Math.min(x, y)];
  else if (/tabte|taber/.test(t)) [x, y] = [Math.min(x, y), Math.max(x, y)];
  return myTeam === 'a' ? { a: x, b: y } : { a: y, b: x };
}

export function listenScore(btn, form, myTeam) {
  if (!SR) return toast('Din browser kan ikke tale-genkendelse. Skriv resultatet i stedet.', true);
  const rec = new SR();
  rec.lang = 'da-DK';
  rec.interimResults = false;
  rec.maxAlternatives = 5;
  const label = btn.textContent;
  btn.textContent = '🎙️ Lytter…';
  btn.classList.add('listening');
  const done = () => { btn.textContent = label; btn.classList.remove('listening'); };
  rec.onresult = (e) => {
    const alts = [...e.results[0]].map((r) => r.transcript);
    const hit = alts.map((a) => ({ a, r: parseScore(a, myTeam) })).find((x) => x.r);
    if (!hit) return toast(`Hørte "${alts[0]}", men fandt ikke et resultat. Prøv fx "seks fire".`, true);
    form.a.value = hit.r.a;
    form.b.value = hit.r.b;
    form.querySelector('button').focus();
    toast(`Hørte "${hit.a}" → ${hit.r.a}–${hit.r.b}. Tjek og tryk Gem.`);
  };
  rec.onerror = (e) => {
    done();
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Giv appen adgang til mikrofonen for at bruge det', true);
    else if (e.error !== 'aborted') toast('Kunne ikke høre dig. Prøv igen, eller skriv resultatet.', true);
  };
  rec.onend = done;
  try { rec.start(); } catch { done(); }
}

export function beep() {
  try { navigator.vibrate?.([400, 200, 400, 200, 400]); } catch {}
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.5, 1].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.4, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.4);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.4);
    });
  } catch {}
}
