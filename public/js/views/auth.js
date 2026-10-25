// Login, opret konto og ny adgangskode.
import { sb, S, app, hooks, esc, toast, q, busy } from '../core.js';

export function renderAuth(mode = 'login') {
  const signup = mode === 'signup';
  const invited = signup && /^#\/(velkommen|barn)/.test(location.hash);
  const ji = S.joinInfo;
  const intro = ji?.kind === 'barn' ? `Hej ${esc(ji.kid.split(' ')[0])}! Opret din egen konto til <b>${esc(ji.name)}</b>, så kan du selv se dine træninger og give afbud.`
    : ji?.kind === 'foraelder' ? `Du er inviteret som forælder til <b>${esc(ji.kid)}</b> i <b>${esc(ji.name)}</b>. Opret en konto, eller log ind hvis du har en.`
    : ji?.kind === 'klub' ? `Du er inviteret til <b>${esc(ji.name)}</b>. Opret en konto som forælder (eller log ind), og meld bagefter dit barn ind.`
    : invited ? 'Du er inviteret med til padel! Opret en konto, eller log ind hvis du har en, så kan du komme med i gruppen.'
    : 'Rangliste, hold og resultater til jeres padelgruppe.';
  app.innerHTML = `
  <div class="auth">
    <div class="logo">🎾</div>
    <h1>Padel</h1>
    <p class="muted">${intro}</p>
    <form class="card" id="authForm">
      <label>E-mail<input type="email" name="email" required autocomplete="email"></label>
      <label>Adgangskode<input type="password" name="password" required minlength="6" autocomplete="${signup ? 'new-password' : 'current-password'}"></label>
      <button class="btn primary" type="submit">${signup ? 'Opret konto' : 'Log ind'}</button>
      ${signup ? '' : '<button class="link" type="button" id="forgot">Glemt adgangskode?</button>'}
    </form>
    <p class="center">${signup ? 'Har du allerede en konto?' : 'Ny spiller?'}
      <button class="link" id="switch">${signup ? 'Log ind' : 'Opret konto'}</button></p>
  </div>`;

  document.getElementById('switch').onclick = () => renderAuth(signup ? 'login' : 'signup');
  const f = document.getElementById('authForm');
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
      if (!signup) return await q(sb.auth.signInWithPassword(creds));
      const data = await q(sb.auth.signUp({ ...creds, options: { emailRedirectTo: location.origin } }));
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
