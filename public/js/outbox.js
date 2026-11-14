// Resultater uden net: Er der ingen forbindelse, når et resultat gemmes (typisk i hallen), lægges det på telefonen
// og sendes automatisk, så snart der er net igen. Ligger kun i denne browser/app.
import { sb, S, toast, hooks, niceError } from './core.js';

const KEY = 'fp-outbox';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const write = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* ok */ } };

export const pendingFor = (matchId) => read().find((x) => x.match === matchId) || null;
export const isNetErr = (e) => !navigator.onLine || /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(String(e?.message || e || ''));

// Gem resultatet. Returnerer 'sent', 'queued' eller kaster fejlen (vist som besked).
export async function reportResult(match, a, b) {
  if (!navigator.onLine) return queue(match, a, b);
  let res;
  try { res = await sb.rpc('padel_report_result', { p_match: match, p_a: a, p_b: b }); } catch (e) { if (isNetErr(e)) return queue(match, a, b); throw e; }
  if (res.error) { if (isNetErr(res.error)) return queue(match, a, b); toast(niceError(res.error), true); throw res.error; }
  return 'sent';
}

function queue(match, a, b) {
  write(read().filter((x) => x.match !== match).concat({ match, a, b, at: Date.now() }));
  toast('Ingen forbindelse. Resultatet er gemt på telefonen og sendes, når der er net igen.');
  schedule();
  return 'queued';
}

let busy = false, timer = null;
function schedule() { clearTimeout(timer); timer = null; if (read().length) timer = setTimeout(() => flushOutbox().then((n) => n && hooks.route?.()), 30000); }

// Send det, der ligger og venter. Returnerer antal sendte.
export async function flushOutbox() {
  if (busy || !navigator.onLine || !S.realMe) { schedule(); return 0; }
  const list = read();
  if (!list.length) return 0;
  busy = true;
  let sent = 0;
  try {
    for (const it of list) {
      let res;
      try { res = await sb.rpc('padel_report_result', { p_match: it.match, p_a: it.a, p_b: it.b }); } catch (e) { res = { error: e }; }
      if (res.error && isNetErr(res.error)) break;
      write(read().filter((x) => x.match !== it.match));
      if (res.error) toast(`Et resultat (${it.a}–${it.b}) kunne ikke gemmes: ${niceError(res.error)}`, true);
      else sent++;
    }
  } finally { busy = false; }
  if (sent) toast(sent === 1 ? 'Resultatet er sendt ✓' : `${sent} resultater er sendt ✓`);
  schedule();
  return sent;
}

export function setupOutbox() {
  const go = () => flushOutbox().then((n) => n && hooks.route?.());
  addEventListener('online', go);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) go(); });
  setTimeout(go, 3000);
}
