// Login, opret konto og ny adgangskode.
import { sb, S, app, hooks, esc, toast, q, busy, rememberMe } from '../core.js';
import { landingHtml, bindLanding } from './landing.js';

// Padelbane i perspektiv med én bold, der hopper ind (kun ved åbning)
const court = () => {
  // Banen: fjern baglinje y=24 (x 96–304), nær baglinje y=232 (x 8–392). Linjer interpoleres i dybden.
  const at = (t) => { const y = 24 + 208 * t, half = 104 + 88 * t; return { y, l: 200 - half, r: 200 + half }; };
  const ln = (t) => { const p = at(t); return `<line x1="${p.l}" y1="${p.y}" x2="${p.r}" y2="${p.y}"/>`; };
  const s1 = at(0.16), s2 = at(0.84), n = at(0.46);
  return `<svg class="court" viewBox="0 0 400 248" role="img" aria-label="Padelbane">
    <defs><radialGradient id="ballG" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent)"/></radialGradient></defs>
    <polygon class="turf" points="96,24 304,24 392,232 8,232"/>
    <g class="glass"><line x1="96" y1="24" x2="96" y2="2"/><line x1="304" y1="24" x2="304" y2="2"/><line x1="96" y1="2" x2="304" y2="2"/></g>
    <g class="lines"><polygon points="96,24 304,24 392,232 8,232" fill="none"/>${ln(0.16)}${ln(0.84)}
      <line x1="200" y1="${s1.y}" x2="200" y2="${s2.y}"/></g>
    <line class="net" x1="${n.l - 6}" y1="${n.y}" x2="${n.r + 6}" y2="${n.y}"/>
    <line class="netpost" x1="${n.l - 6}" y1="${n.y}" x2="${n.l - 6}" y2="${n.y - 14}"/><line class="netpost" x1="${n.r + 6}" y1="${n.y}" x2="${n.r + 6}" y2="${n.y - 14}"/>
    <line class="nettop" x1="${n.l - 6}" y1="${n.y - 14}" x2="${n.r + 6}" y2="${n.y - 14}"/>
    <ellipse class="shadow" cx="0" cy="0" rx="9" ry="3"><animateMotion dur="1.5s" fill="freeze" path="M150 40 L262 160 L300 206" keyPoints="0;0.62;1" keyTimes="0;0.6;1" calcMode="linear"/></ellipse>
    <circle class="ball" cx="0" cy="0" r="9" fill="url(#ballG)">
      <animateMotion dur="1.5s" fill="freeze" path="M150 18 Q205 -26 262 156 Q282 118 300 198" keyPoints="0;0.6;1" keyTimes="0;0.6;1" calcMode="spline" keySplines=".3 0 .7 1;.2 0 .6 1"/>
      <animate attributeName="r" dur="1.5s" fill="freeze" values="5;8;9" keyTimes="0;0.6;1"/>
    </circle>
  </svg>`;
};

export function renderAuth(mode = 'login') {
  const signup = mode === 'signup';
  const invited = signup && /^#\/(velkommen|barn)/.test(location.hash);
  const ji = S.joinInfo;
  const intro = ji?.kind === 'barnmail' ? `Hej ${esc(ji.kid.split(' ')[0])}! Log ind med din e-mail, så kobles du på <b>${esc(ji.name)}</b>.`
    : ji?.kind === 'foraelder' ? `Du er inviteret som forælder til <b>${esc(ji.kid)}</b> i <b>${esc(ji.name)}</b>. Opret en konto, eller log ind hvis du har en.`
    : ji?.kind === 'klub' && ji.audience === 'voksne' ? `Du er inviteret til <b>${esc(ji.name)}</b>. Opret en konto (eller log ind), og meld dig bagefter ind.`
    : ji?.kind === 'klub' && ji.audience === 'begge' ? `Du er inviteret til <b>${esc(ji.name)}</b>. Opret en konto (eller log ind), og meld bagefter dig selv eller dit barn ind.`
    : ji?.kind === 'klub' ? `Du er inviteret til <b>${esc(ji.name)}</b>. Opret en konto som forælder (eller log ind), og meld bagefter dit barn ind.`
    : invited ? 'Du er inviteret med til padel. Opret en konto, eller log ind hvis du har en, så kommer du med i gruppen.'
    : 'Spilledage, hold og rangliste til private padelgrupper, klubber, foreninger og padelcentre.';
  // Forsiden med beskrivelse vises kun på hjemmesiden for nye besøgende (ikke i appen og ikke fra en invitation)
  const landing = !invited && !ji && !window.Capacitor?.isNativePlatform?.();
  // Barnets eget login: ingen e-mail, bare ét tryk, så er barnet logget ind på telefonen
  if (ji?.kind === 'barn') return renderKidLogin(ji);
  const replay = !app.querySelector('.authx');
  app.innerHTML = `
  <div class="auth authx" id="top">
    <div class="hero" aria-hidden="true">${court()}</div>
    <h1 class="word">Padel</h1>
    <p class="intro">${intro}</p>
    <div class="authtabs" role="tablist">
      <button type="button" role="tab" class="${signup ? '' : 'on'}" aria-selected="${!signup}" ${signup ? 'id="switch"' : ''}>Log ind</button>
      <button type="button" role="tab" class="${signup ? 'on' : ''}" aria-selected="${signup}" ${signup ? '' : 'id="switch"'}>Opret konto</button>
    </div>
    <form id="authForm">
      <label>E-mail<input type="email" name="email" required autocomplete="email" inputmode="email"></label>
      <label>Adgangskode<input type="password" name="password" required minlength="6" autocomplete="${signup ? 'new-password' : 'current-password'}">
        ${signup ? '<small class="muted">Mindst 6 tegn.</small>' : ''}</label>
      <label class="switch remember"><input type="checkbox" name="remember" ${rememberMe() ? 'checked' : ''}><span>Husk mig på denne enhed</span></label>
      <button class="btn primary" type="submit">${signup ? 'Opret konto' : 'Log ind'}</button>
      ${signup ? '' : '<button class="link" type="button" id="forgot">Glemt adgangskode?</button>'}
    </form>
    <p class="center"><button class="link sm" type="button" id="kidCode">🧒 Barn uden e-mail? Log ind med din kode</button></p>
    ${landing ? '<p class="center lmore"><a class="link sm" href="#hvad">Hvad er Padelklubben? ↓</a></p>' : ''}
  </div>${landing ? `<div id="hvad">${landingHtml()}</div>` : ''}`;
  if (landing) {
    bindLanding(() => renderAuth('signup'));
    app.querySelector('.lmore a')?.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('hvad')?.scrollIntoView({ behavior: 'smooth' }); });
  }
  // Bolden hopper kun første gang (ikke når man skifter fane), og aldrig hvis man har bedt om mindre bevægelse
  if (!replay || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    app.querySelectorAll('.court animate, .court animateMotion').forEach((a) => { a.setAttribute('dur', '0.001s'); });
  }

  document.getElementById('switch').onclick = () => renderAuth(signup ? 'login' : 'signup');
  document.getElementById('kidCode').onclick = () => renderKidLogin(null);
  const f = document.getElementById('authForm');
  // Husk e-mailen fra sidste login (kun når "Husk mig" er slået til)
  try { const em = localStorage.getItem('fp-email'); if (em && rememberMe() && !f.email.value) f.email.value = em; } catch {}
  document.getElementById('forgot')?.addEventListener('click', async () => {
    const email = f.email.value.trim();
    if (!email) return toast('Skriv din e-mail først', true);
    await q(sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin }));
    toast('Vi har sendt en mail med et link til ny adgangskode');
  });
  f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button[type=submit]');
    busy(btn, true);
    try {
      const creds = { email: f.email.value.trim(), password: f.password.value };
      const keep = f.remember.checked;
      try { localStorage.setItem('fp-remember', keep ? '1' : '0'); if (keep) localStorage.setItem('fp-email', creds.email); else localStorage.removeItem('fp-email'); } catch {}
      if (!signup) return await q(sb.auth.signInWithPassword(creds));
      // Invitationen gemmes på kontoen, så den virker, selvom mailen åbnes i en anden browser
      let join = null, claim = null;
      try { join = localStorage.getItem('fp-join'); claim = localStorage.getItem('fp-claim'); } catch {}
      const res = await sb.auth.signUp({ ...creds, options: { emailRedirectTo: location.origin, data: { ...(join ? { padel_join: join } : {}), ...(claim ? { padel_claim: claim } : {}) } } });
      // Mailen har allerede en konto: skift til Log ind med mailen udfyldt
      if (res.error && /already (been )?registered|already exists/i.test(res.error.message || '')) {
        renderAuth('login');
        const nf = document.getElementById('authForm'); nf.email.value = creds.email; nf.password.focus();
        toast('Du har allerede en konto med den e-mail. Log ind med din adgangskode, eller tryk Glemt adgangskode');
        return;
      }
      const data = await q(Promise.resolve(res));
      if (!data.session) {
        app.innerHTML = `<div class="auth"><div class="logo">📬</div><h1>Tjek din mail</h1>
          <p class="muted">Vi har sendt et link til ${esc(creds.email)}. Klik på det for at bekræfte din konto, og log så ind her.</p>
          <button class="btn" onclick="location.reload()">Til login</button></div>`;
      }
    } catch {} finally { busy(btn, false); }
  };
}

export function renderNewPassword() {
  app.innerHTML = `<div class="auth"><h1>Ny adgangskode</h1>
    <form class="card" id="pw"><label>Ny adgangskode<input type="password" name="pw" minlength="6" required autocomplete="new-password"></label>
    <button class="btn primary">Gem</button></form></div>`;
  document.getElementById('pw').onsubmit = async (e) => {
    e.preventDefault();
    await q(sb.auth.updateUser({ password: e.target.pw.value }));
    S.recovery = false;
    toast('Adgangskoden er ændret');
    hooks.boot();
  };
}

// Kode til barnets login: vises i grupper af 4, så den er nem at skrive af
export const fmtKidCode = (c) => String(c || '').toUpperCase().replace(/(.{4})(?=.)/g, '$1-');
function renderKidLogin(ji) {
  let saved = null;
  try { saved = localStorage.getItem('fp-kidcode'); } catch {}
  const typed = !ji;
  const first = ji ? esc(ji.kid.split(' ')[0]) : '';
  app.innerHTML = `
  <div class="auth authx">
    <div class="hero" aria-hidden="true">${court()}</div>
    <h1 class="word">Padel</h1>
    ${typed ? `<p class="intro">Skriv den kode, du har fået af din forælder. Du finder den også under <b>Min padel → ⚙️ Indstillinger</b>, når du er logget ind.</p>
      <form id="kidForm"><label>Din kode<input name="code" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX" value="${esc(fmtKidCode(saved || ''))}"></label>
      <button class="btn primary big" id="kidGo">🎾 Kom i gang</button></form>`
    : `<p class="intro">Hej ${first}! Tryk på knappen, så er du logget ind i <b>${esc(ji.name)}</b> på denne telefon. Du skal ikke bruge e-mail eller adgangskode.</p>
    <button class="btn primary big" id="kidGo">🎾 Kom i gang</button>`}
    <p class="muted small center">Bliver du logget ud, så bed din forælder om koden under <b>Min padel → Mine børn → Eget login</b>.</p>
    <p class="center"><button class="link sm" id="kidMail">${typed ? '‹ Tilbage til log ind' : 'Jeg har allerede et login med e-mail'}</button></p>
  </div>`;
  document.getElementById('kidMail').onclick = () => { if (ji) S.joinInfo = { ...ji, kind: 'barnmail' }; renderAuth('login'); };
  const btn = document.getElementById('kidGo');
  const go = async (e) => {
    e?.preventDefault();
    busy(btn, true);
    let code = null;
    if (typed) code = document.querySelector('#kidForm input[name=code]').value.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
    else try { code = localStorage.getItem('fp-claim'); } catch {}
    try {
      const { data, error } = await sb.functions.invoke('padel-kid-login', { body: { code } });
      if (error) {
        let msg = 'Kunne ikke få forbindelse. Tjek internettet, og prøv igen.';
        try { msg = (await error.context.json()).error || msg; } catch {}
        throw new Error(msg);
      }
      try { localStorage.removeItem('fp-claim'); localStorage.setItem('fp-kidcode', data.code || code); if (data.group) localStorage.setItem('fp-group', data.group); } catch {}
      await q(sb.auth.signInWithPassword({ email: data.email, password: data.password }));
      location.hash = '#/traening';
      toast(`Velkommen, ${esc((data.name || '').split(' ')[0])} 🎾`);
    } catch (e2) { toast(e2.message || 'Noget gik galt. Prøv igen', true); busy(btn, false); }
  };
  if (typed) document.getElementById('kidForm').onsubmit = go; else btn.onclick = go;
}
