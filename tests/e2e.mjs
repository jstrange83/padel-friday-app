// Browsertest af hele forløbet mod den lokale mock-database. Kør: node tests/e2e.mjs
import { createRequire } from 'module';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/npm-tools/node_modules/playwright');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const shots = process.env.SHOTS || path.join(root, 'tests', 'shots');
fs.mkdirSync(shots, { recursive: true });
const server = spawn('python3', ['-m', 'http.server', '8765', '-d', path.join(root, 'public')], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const browser = await chromium.launch();
// Skærmbredde kan sættes med W=320 (lille telefon) for at tjekke, at alt passer
const page = await browser.newPage({ viewport: { width: +process.env.W || 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/mobilepay:|scheme does not have a registered handler/i.test(m.text())) errors.push('console: ' + m.text()); });
page.on('dialog', (d) => d.accept());
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ contentType: 'text/css', body: '' }));
await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(root, 'tests', 'mock-supabase.js'), 'utf8') }));

let step = 0;
// Popuppen om ledige pladser lukkes automatisk i alle andre test (den testes for sig selv)
const spotHandler = page.locator('#spotModal');
await page.addLocatorHandler(spotHandler, async () => { await page.click('#spotNo'); });
// Knapper der står sammen skal være på én linje, lige store og uden ombrudt tekst
const btnAudit = async (where) => {
  const bad = await page.evaluate(() => {
    const out = [];
    const vis = (e) => e.offsetParent !== null && e.getBoundingClientRect().width > 0;
    const groups = new Set([...document.querySelectorAll('#app .btn, #app .segbtn')].filter(vis).map((b) => b.parentElement));
    for (const g of groups) {
      const bs = [...g.children].filter((x) => (x.classList.contains('btn') || x.classList.contains('segbtn')) && vis(x));
      for (const b of bs) {
        const cs = getComputedStyle(b), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.25;
        const inner = b.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        if (inner > lh * 1.6 || b.scrollWidth > b.clientWidth + 1) out.push(`tekst brydes/klippes: "${b.textContent.trim()}"`);
      }
      if (bs.length < 2 || g.classList.contains('seg')) continue;
      const tops = new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top)));
      const ws = bs.map((b) => Math.round(b.getBoundingClientRect().width)), hs = bs.map((b) => Math.round(b.getBoundingClientRect().height));
      if (tops.size > 1) out.push(`flere linjer: ${bs.map((b) => b.textContent.trim()).join(' | ')}`);
      else if (Math.max(...ws) - Math.min(...ws) > 2 || Math.max(...hs) - Math.min(...hs) > 2) out.push(`forskellig størrelse: ${bs.map((b, i) => `${b.textContent.trim()}(${ws[i]}x${hs[i]})`).join(' | ')}`);
    }
    return [...new Set(out)];
  });
  if (bad.length) { if (process.env.AUDIT) console.log(`KNAPPER ${where}:\n  ` + bad.join('\n  ')); else ok(false, `knapper (${where}): ${bad.join('; ')}`); }
};
const shot = async (name) => { await btnAudit(name); return page.screenshot({ path: path.join(shots, `${String(++step).padStart(2, '0')}-${name}.png`), fullPage: true }); };
const ok = (cond, msg) => { if (!cond) throw new Error('FEJL: ' + msg); console.log('✓', msg); };
const text = async () => (await page.locator('#app').innerText()).toLowerCase();
const wait = (ms = 300) => page.waitForTimeout(ms);
// Siden må aldrig være bredere end skærmen
const noOverflow = async (where) => { if (process.env.W) { const w = await page.evaluate(() => { const cw = document.documentElement.clientWidth; return [...document.querySelectorAll('#app *')].filter((e) => e.getBoundingClientRect().right > cw + 1).slice(0, 6).map((e) => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right) + ' ' + (e.textContent || '').trim().slice(0, 30)); }); if (w.length) console.log('OVERFLOW', where, w); } return ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `ingen sidelæns scroll (${where})`); };

try {
  await page.goto('http://localhost:8765/');
  await page.waitForSelector('#authForm');
  await shot('login');
  await page.fill('input[name=email]', 'jimmy@test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('text=Opret spilledag');
  ok((await text()).includes('ingen kommende spilledage'), 'tom oversigt viser opret-knap');
  await shot('fredage-tom');

  // Opret 4 fredage med ét sæt pr. runde
  await page.click('a:has-text("Opret spilledag")');
  await page.waitForSelector('#nf');
  await page.click('label:has-text("Ét sæt pr. runde")');
  ok((await page.inputValue('input[name=minutes]')) === '20', 'ét sæt sætter 20 min pr. runde');
  ok((await page.locator('#roundsHint').innerText()).includes('6 runder'), '2 timer giver 6 runder');
  await shot('ny-fredag');
  await noOverflow('ny spilledag');
  await page.click('#createBtn');
  await page.waitForSelector('a.ev');
  ok((await page.locator('a.ev').count()) === 4, '4 fredage oprettet');
  await shot('fredage-4');

  // Hurtig tilmelding fra oversigten
  await page.locator('a.ev').first().locator('[data-on]').click();
  await wait();
  ok((await page.locator('a.ev').first().innerText()).includes('Du er med'), 'tilmeldt fra oversigten');

  // Åbn fredagen og tilmeld 8 testspillere (9 i alt = 2 baner + 1 venteliste)
  await page.locator('a.ev').first().click();
  await page.waitForSelector('.page.event');
  for (let i = 0; i < 8; i++) {
    await page.fill('#addSearch', 'test');
    await page.locator('#addHits .hit').first().click();
    await wait(250);
  }
  ok((await text()).includes('2 baner klar · 1 på venteliste'), 'venteliste ved 9 tilmeldte');
  await shot('tilmeldte');

  // Dagsplan
  await page.click('#makePlan');
  await wait(500);
  ok(await page.locator('.rtabs .rtab').count() === 6, 'dagsplan med 6 runder som faner');
  ok(await page.evaluate(() => window.__mock.db().padel_notifications.filter((n) => n.kind === 'dagsplan').length === 9), 'alle 9 tilmeldte (også den, der laver planen) får besked om dagsplanen');
  const mc1 = await page.locator('.mine-card').innerText();
  ok(/Runde 1/.test(mc1) && (/Dig/.test(mc1) || /pause/i.test(mc1)), 'Din næste kamp viser runde, bane og holdene med "Dig"');
  if (await page.evaluate(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition)) && (await page.locator('.mine-card').innerText()).includes('Indtast resultat'))
    ok(await page.locator('.mine-card [data-act=voice]').count() === 1, 'Sig resultat i Din aften');
  await shot('dagsplan');
  await noOverflow('spilledag');

  ok(await page.locator('#nextRound').count() === 0, 'ingen "Start runde" ved Ét sæt');
  await page.locator('[data-rtab="6"]').click();
  await wait(200);
  ok(await page.locator('.match [data-act=enter]').count() >= 1, 'kampe i senere runder kan indtastes med det samme');
  await page.locator('[data-rtab="1"]').click();
  await wait(200);

  // Indtast resultat via Din aften (admin godkender direkte)
  const mine = await page.locator('.mine-card').innerText();
  if (mine.includes('Du spiller')) {
    await page.click('.mine-card [data-act=enter]');
    await wait(500);
  } else {
    await page.locator('[data-act=enter]').first().click();
  }
  const f = page.locator('form.enter:not([hidden])').first();
  await f.locator('input[name=a]').fill('6');
  await f.locator('input[name=b]').fill('4');
  await f.locator('button').click();
  await wait(500);
  ok((await text()).includes('dagens stilling'), 'stilling vises efter resultat');
  ok((await page.locator('.evsub .live-txt').count()) === 1, 'dagen er i gang efter første resultat');
  await shot('runde1');
  ok(await page.locator('.badge:has-text("Point")').count() >= 1, 'kampen har point');

  // Ret hold i runde 1: byt to spillere
  const tb = page.locator('[data-act=teams]').first();
  await tb.click();
  const tf = page.locator('form.editteams:not([hidden])').first();
  const opts = await tf.locator('select[name=al] option').allTextContents();
  await tf.locator('select[name=al]').selectOption({ index: (opts.length - 1) });
  await tf.locator('button.primary').click();
  await wait(500);
  ok(!errors.length, 'ret hold uden fejl');
  await shot('efter-resultat');

  // Indtast et resultat i en senere runde uden at nogen har startet den (banerne følges ikke ad)
  await page.locator('[data-rtab]').last().click();
  await wait(200);
  const late = page.locator('.match:has([data-act=enter].primary)').last();
  const lateId = (await late.getAttribute('id')).slice(2);
  await late.locator('[data-act=enter]').click();
  const lf = page.locator(`form.enter[data-id="${lateId}"]:not([hidden])`);
  await lf.locator('input[name=a]').fill('3'); await lf.locator('input[name=b]').fill('6');
  await lf.locator('button').click();
  await wait(500);
  ok((await page.locator(`#m-${lateId} .score`).innerText()).includes('3'), 'resultat i senere runde gemt');
  // Spil resten af kampene færdige
  for (let i = 0; i < 40; i++) {
    let btn = page.locator('[data-act=enter].primary').first();
    if (!(await btn.count())) {
      const open = page.locator('.rtab:not(.done)').first();
      if (!(await open.count())) break;
      await open.click(); await wait(200);
      btn = page.locator('[data-act=enter].primary').first();
      if (!(await btn.count())) break;
    }
    const id = await btn.getAttribute('data-id');
    await btn.click();
    const ff = page.locator(`form.enter[data-id="${id}"]:not([hidden])`);
    await ff.locator('input[name=a]').fill('6'); await ff.locator('input[name=b]').fill(String(i % 5));
    await ff.locator('button').click();
    await wait(250);
  }
  ok(await page.locator('.rtab.done').count() === 6, 'alle 6 runder er markeret spillet');
  ok((await page.locator('#finish').first().innerText()).includes('Afslut'), 'afslut-knap efter sidste runde');

  // Spiller retter et godkendt resultat: en fra modstanderholdet skal godkende ændringen
  const evUrl = page.url();
  // Vis den runde, kampen vi tester, ligger i
  let focusId = null;
  const openAll = async () => {
    if (!focusId || await page.locator(`#m-${focusId}`).count()) return;
    const r = await page.evaluate((id) => JSON.parse(sessionStorage.getItem('mockdb')).padel_matches.find((m) => m.id === id).round_no, focusId);
    await page.click(`[data-rtab="${r}"]`); await wait(200);
  };
  const loginAs = async (email, keepModal = false) => {
    await page.evaluate(() => sessionStorage.removeItem('mock-session'));
    await page.goto('http://localhost:8765/');
    await page.waitForSelector('#authForm');
    await page.fill('input[name=email]', email);
    await page.fill('input[name=password]', 'whatever');
    await page.click('button[type=submit]');
    await page.waitForSelector('#nav a, .finegate');
    if (await page.locator('.finegate').count()) { await page.click('#fgOk'); await page.waitForSelector('#nav a'); }
    await page.goto(evUrl);
    await page.waitForSelector('.page.event');
    await wait(400);
    if (keepModal) return;
    if (await page.locator('#fbModal').count()) await page.click('#fbLater');
    await openAll();
  };
  const cm = await page.evaluate(() => {
    const db = JSON.parse(sessionStorage.getItem('mockdb'));
    const m = db.padel_matches.find((x) => x.status === 'bekraeftet' && ![x.a_left, x.a_right, x.b_left, x.b_right].includes('u-admin'));
    const mail = (id) => db.padel_profiles.find((p) => p.id === id).email;
    return { id: m.id, a: mail(m.a_left), mate: mail(m.a_right), b: mail(m.b_left), sa: m.score_a, sb: m.score_b };
  });
  focusId = cm.id;
  await loginAs(cm.a);
  await page.locator(`#m-${cm.id} [data-act=enter]`).click();
  const cf = page.locator(`form.enter[data-id="${cm.id}"]:not([hidden])`);
  ok((await cf.innerText()).includes('modstanderholdet godkende'), 'spiller får at vide, at en ændring skal godkendes');
  await cf.locator('input[name=a]').fill('7'); await cf.locator('input[name=b]').fill('5');
  await cf.locator('button').click();
  await wait(500);
  ok((await page.locator(`#m-${cm.id} .badge`).innerText()).toLowerCase().includes(`ændret fra ${cm.sa}–${cm.sb}`), 'ændret resultat afventer modstanderen');
  ok(!(await page.locator(`#m-${cm.id} [data-act=confirm]`).count()), 'den der ændrer kan ikke selv godkende');
  await shot('aendring-afventer');
  await loginAs(cm.mate);
  ok(!(await page.locator(`#m-${cm.id} [data-act=confirm]`).count()), 'makkeren kan ikke godkende ændringen');
  await loginAs(cm.b);
  ok((await page.locator(`#m-${cm.id} [data-act=confirm]`).innerText()).includes('Godkend'), 'modstander kan godkende ændringen');
  ok((await page.locator('.approvals').innerText()).toLowerCase().includes('venter på din godkendelse'), 'rettelsen vises øverst hos modstanderen');
  ok(/din (næste kamp|kamp nu)|dine kampe/.test((await page.locator('.mine-card .mtitle').innerText()).toLowerCase()), 'kortet øverst hedder Din næste kamp');
  const ps = await page.evaluate(async () => {
    const { parseScore } = await import('/js/voice.js');
    return [parseScore('seks to', 'b'), parseScore('seks to', 'a'), parseScore('vi tabte seks to', 'b'), parseScore('seks to', null)].map((r) => `${r.a}-${r.b}`).join(',');
  });
  ok(ps === '2-6,6-2,6-2,6-2', 'sagt resultat: første tal er ens eget hold (' + ps + ')');
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('godkend-rettelse');
  await page.locator(`#m-${cm.id} [data-act=reject]`).click();
  await wait(500);
  await openAll();
  ok((await page.locator(`#m-${cm.id} .score`).innerText()).replace(/\s/g, '') === `${cm.sa}–${cm.sb}`, 'afvist ændring giver det gamle resultat tilbage');
  await loginAs('jimmy@test');
  await page.locator(`#m-${cm.id} [data-act=enter]`).click();
  await cf.locator('input[name=a]').fill('6'); await cf.locator('input[name=b]').fill('0');
  await cf.locator('button').click();
  await wait(500);
  await openAll();
  ok((await page.locator(`#m-${cm.id} .score`).innerText()).replace(/\s/g, '') === '6–0' && (await page.locator(`#m-${cm.id} .badge`).innerText()).includes('Point'), 'admin retter direkte');
  // Nulstil kampen; en spiller taster et nyt resultat, som tæller med det samme
  await page.locator(`#m-${cm.id} [data-act=reset]`).click();
  await wait(500);
  await loginAs(cm.b);
  await page.locator(`[data-act=enter][data-id="${cm.id}"]`).first().click();
  await cf.locator('input[name=a]').fill('2'); await cf.locator('input[name=b]').fill('6');
  await cf.locator('button').click();
  await wait(500);
  await openAll();
  ok((await page.locator(`#m-${cm.id} .badge`).innerText()).includes('Point'), 'spillerens første resultat tæller uden godkendelse');
  await loginAs('jimmy@test');
  await page.locator('#finish').first().click();
  await wait(400);
  ok((await text()).includes('afsluttet'), 'dagen afsluttet');
  await shot('afsluttet');

  // Rangliste
  await page.click('#nav a:has-text("Rangliste")');
  await wait(400);
  ok((await text()).includes('kamp'), 'ranglisten viser kampe');
  await shot('rangliste');
  for (const k of ['maaned', 'aeg', 'streak']) { await page.click(`[data-kind="${k}"]`); await wait(300); }
  ok((await page.locator('.list .row').count()) >= 1, 'ranglistefaner (måned, æg, streak) virker');
  await page.click('[data-kind="maaned"]');
  await wait(300);
  await shot('rangliste-maaned');
  await page.locator('.list a.row').first().click();
  await page.waitForSelector('.stats-page');
  await page.fill('#cmpSearch', 'test');
  await page.locator('#cmpHits .hit').first().click();
  await wait(400);
  ok(await page.locator('.legend').count() === 1, 'sammenlign med spiller viser to kurver');
  await shot('statistik-sammenlign');
  await page.click('[data-per="all"]');
  await page.click('[data-st="opp"]');
  await wait(200);

  // Telefonnummer: påmindelse, ugyldigt nummer afvises, gyldigt gemmes og vises for admin
  await page.click('#nav a:has-text("Spilledage")');
  await wait(300);
  ok(await page.locator('.phonetip').count() === 1, 'påmindelse om telefonnummer');
  await page.click('.phonetip');
  await page.waitForSelector('#pf');
  await page.fill('#pf input[name=phone]', '1234');
  await page.click('#pf button.primary');
  await wait(300);
  ok((await page.locator('#toast').innerText()).includes('Ugyldigt telefonnummer'), 'ugyldigt nummer afvist');
  await noOverflow('profil');
  await page.fill('#pf input[name=phone]', '12 34 56 78');
  await page.click('#pf button.primary');
  await wait(400);
  await page.click('#nav a:has-text("Admin")');
  await page.waitForSelector('details.plist'); await page.evaluate(() => document.querySelectorAll('details.plist').forEach((d) => (d.open = true)));
  await page.locator('.prow summary').first().click();
  ok((await page.locator('.prow[open] .contact').innerText()).includes('12 34 56 78'), 'nummer vises for admin med ring/SMS');
  await page.click('#nav a:has-text("Spilledage")');
  await wait(300);
  ok(await page.locator('.phonetip').count() === 0, 'påmindelse væk efter gemt nummer');

  // FAQ-søgning
  await page.goto('http://localhost:8765/#/faq');
  await page.fill('#faqSearch', 'røre nettet');
  await wait(200);
  ok((await page.locator('details.faq').count()) >= 1, 'FAQ finder regel om nettet');

  // Admin: se som
  await page.click('#nav a:has-text("Admin")');
  await page.waitForSelector('.prow');
  await page.waitForSelector('details.plist'); await page.evaluate(() => document.querySelectorAll('details.plist').forEach((d) => (d.open = true)));
  await page.locator('.prow summary').nth(1).click();
  await shot('admin');
  await noOverflow('admin');
  await page.locator('.prow[open] [data-viewas]').click();
  await page.waitForSelector('#viewAsBar');
  ok(!(await page.locator('#nav').innerText()).includes('Admin'), 'se som skjuler Admin');
  const qb = page.locator('a.ev').first().locator('[data-on]');
  if (await qb.count()) {
    await qb.click();
    await wait(400);
    ok((await page.locator('#toast').innerText()).includes('tilmeldt'), 'se som: kan tilmelde spilleren');
  }
  await page.click('#nav a:has-text("Profil")');
  await page.waitForSelector('.me-card');
  if (!(await page.locator('.editbox[open]').count())) await page.locator('.editbox summary').click();
  await page.fill('#pf input[name=phone]', '87654321');
  await page.click('#pf button.primary');
  await wait(400);
  ok((await page.locator('.me-card').innerText()).includes('87 65 43 21'), 'se som: retter spillerens telefon');
  await shot('se-som');
  await page.click('#stopViewAs');
  await wait(400);
  ok(!(await page.locator('#viewAsBar').count()), 'tilbage til mig');
  ok((await page.evaluate(() => JSON.parse(sessionStorage.getItem('mockdb')).padel_contacts.find((c) => c.player_id === 'u-admin')?.phone)) === '+4512345678', 'se som: Jimmys eget nummer er ikke ændret');

  // Hurtige indstillinger på dagen: åbn en ny dag, slå en bane fra
  await page.click('#nav a:has-text("Spilledage")');
  await page.waitForSelector('a.ev');
  await page.locator('a.ev').first().click();
  await page.waitForSelector('.page.event');
  await page.click('[data-qs="courts"]');
  ok(await page.locator('#qspanel').isVisible(), 'tryk på "5 baner" åbner panel');
  await page.locator('[data-court]').last().click();
  await wait(400);
  ok((await page.locator('[data-qs="courts"]').innerText()).includes('4 baner'), 'bane slået fra (4 baner)');
  await page.locator('[data-set="format"][data-val="rotation"]').click();
  await wait(400);
  ok((await page.locator('[data-qs="format"]').innerText()).includes('Rotation'), 'spiltype skiftet til rotation');
  await shot('hurtige-indstillinger');

  // Grupper: Jimmy opretter Lørdagspadel i Helsinge og gør Brian til admin
  await page.click('#nav a:has-text("Admin")');
  await page.click('[data-tab="grupper"]');
  await page.click('details.newgroup summary');
  await page.waitForSelector('#newGroup');
  await page.fill('#newGroup input[name=name]', 'Lørdagspadel');
  await page.locator('#newGroup label:has-text("Helsinge")').click();
  await page.click('#newGroup button');
  await wait(500);
  ok((await text()).includes('lørdagspadel'), 'gruppe oprettet og valgt');
  ok(await page.locator('#superAdd').isVisible(), 'ny gruppe uden admin: medlemmer står åbne');
  await page.fill('#superAdd', 'bri');
  await page.locator('#superHits [data-sadd][data-r="admin"]').click();
  await wait(500);
  ok((await page.locator('.mrow:has-text("Brian") select').inputValue()) === 'admin', 'Brian tilføjet som admin');
  // Superadmin tilføjer en eksisterende spiller som superbruger og fjerner ham igen
  await page.fill('#superAdd', 'carsten');
  await page.locator('#superHits [data-sadd][data-r="superbruger"]').click();
  await wait(400);
  ok((await page.locator('.mrow:has-text("Test Carsten") select').inputValue()) === 'superbruger', 'Carsten tilføjet som superbruger');
  await page.locator('.mrow:has-text("Test Carsten") [data-remove]').click();
  await wait(400);
  ok(!(await page.locator('.mrow:has-text("Test Carsten")').count()), 'Carsten fjernet igen');
  await shot('superadmin');
  await page.click('[data-group="g-fre"]');
  await wait(400);
  ok(!(await page.locator('#superAdd').isVisible()) && (await page.locator('.gsum').innerText()).includes('Admin:'), 'gruppekort: medlemmer foldet sammen, admin vist øverst');
  await shot('gruppekort');
  await page.click('[data-tab="baner"]');
  await page.locator('details.centerbox summary').first().click();
  await shot('admin-baner');
  await page.click('[data-tab="spillere"]');
  await shot('admin-spillere');
  await page.click('#inviteQR');
  ok(await page.locator('.qrmodal svg').count() === 1, 'QR-kode vises');
  await shot('qr');
  await page.click('.qrmodal button');
  ok(await page.locator('.qrmodal').count() === 0, 'QR-kode lukkes');
  // Alle spillere: tilføj Test Carsten til Lørdagspadel og gør ham til superbruger der
  await page.click('[data-allp]');
  await page.waitForSelector('details.plist'); await page.evaluate(() => document.querySelectorAll('details.plist').forEach((d) => (d.open = true)));
  await page.fill('#playerSearch', 'carsten');
  await page.locator('.prow:visible summary').first().click();
  await page.locator('.prow[open] [data-gadd]').filter({ hasText: 'Lørdagspadel' }).click();
  await wait(400);
  const sel = page.locator('.prow[open] .mrow:has-text("Lørdagspadel") select');
  ok(await sel.count() === 1, 'Alle spillere: Carsten tilføjet til Lørdagspadel');
  await sel.selectOption('superbruger');
  await wait(400);
  ok((await page.locator('.prow[open] summary').innerText()).includes('Lørdagspadel (Superbruger)'), 'Alle spillere: rolle skiftet');
  await shot('alle-spillere');
  await page.locator('.prow[open] .mrow:has-text("Lørdagspadel") [data-gremove]').click();
  await wait(400);
  ok(!(await page.locator('.prow[open] summary').innerText()).includes('Lørdagspadel'), 'Alle spillere: fjernet igen');
  await page.locator('[data-pgroup]', { hasText: 'Lørdagspadel' }).click();
  const lordag = await page.evaluate(() => localStorage.getItem('fp-group'));

  // Log ind som Brian: ser kun Lørdagspadel, kan kun vælge Helsinge
  await page.click('#nav a:has-text("Profil")');
  await page.click('#logout');
  await page.waitForSelector('#authForm');
  await page.fill('input[name=email]', 'brian@test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('#nav a');
  await page.click('#nav a:has-text("Spilledage")');
  await wait(400);
  ok((await text()).includes('lørdagspadel') && !(await text()).includes('fredagspadel'), 'Brian ser kun Lørdagspadel');
  await page.click('a:has-text("Opret spilledag")');
  await page.waitForSelector('#nf');
  const centerOpts = await page.locator('select[name=center] option').allTextContents();
  ok(centerOpts.length === 1 && centerOpts[0] === 'Helsinge', 'Brian kan kun vælge Helsinge');
  await page.locator('select[name=count]').selectOption('1');
  await page.click('#createBtn');
  await wait(500);

  // Test Anne bruger invitationslinket og venter på godkendelse
  await page.click('#nav a:has-text("Profil")');
  await page.click('#logout');
  await page.waitForSelector('#authForm');
  await page.goto('http://localhost:8765/#/velkommen/' + lordag);
  await page.waitForSelector('#authForm');
  await page.click('#switch');
  await page.fill('input[name=email]', 'test7@fredagspadel.test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await wait(700);
  ok((await page.locator('#toast').innerText()).includes('bedt om at komme med') || (await text()).includes('lørdagspadel'), 'anmodning sendt');
  await page.click('#nav a:has-text("Profil")').catch(() => {});
  await wait(300);
  ok((await page.locator('.gchip').allInnerTexts()).some((t) => t.includes('⏳')), 'profil viser ventende anmodning');
  await page.click('#logout');

  // Ny spiller opretter sig via linket, men bekræfter mailen i en anden browser (linket huskes på kontoen)
  await page.waitForSelector('#authForm');
  await page.goto('http://localhost:8765/#/velkommen/' + lordag);
  await page.waitForSelector('#authForm');
  await page.fill('input[name=email]', 'nytobias@test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('text=Tjek din mail');
  await page.evaluate(() => { localStorage.removeItem('fp-join'); localStorage.removeItem('fp-claim'); });
  await page.goto('http://localhost:8765/');
  await page.waitForSelector('#authForm');
  if (!(await page.locator('button[type=submit]:has-text("Log ind")').count())) await page.click('#switch');
  await page.fill('input[name=email]', 'nytobias@test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('#pf');
  await page.fill('#pf input[name=name]', 'Tobias Test');
  await page.fill('#pf input[name=phone]', '22446688');
  await page.click('#pf label:has-text("Mand")');
  if (await page.locator('#pf label:has-text("Højre")').count()) await page.click('#pf label:has-text("Højre")');
  await page.click('#pf button.primary');
  await wait(900);
  ok(await page.evaluate((g) => window.__mock.db().padel_group_members.some((m) => m.group_id === g && m.player_id === 'u-nytobias' && m.status === 'afventer'), lordag), 'invitationen huskes på kontoen, selvom mailen åbnes i en anden browser');
  ok(await page.evaluate(() => !Object.keys(window.__mock.db().__meta?.['nytobias@test'] || {}).length), 'invitationen fjernes fra kontoen, når den er brugt');
  // (Tobias fjernes igen, så testen af Anne nedenfor er uændret)
  await page.evaluate((g) => { const db = window.__mock.db(); db.padel_group_members.find((m) => m.group_id === g && m.player_id === 'u-nytobias').status = 'fjernet';
    db.padel_notifications.filter((n) => (n.ref || '').includes('u-nytobias') || (n.title || '').includes('Tobias')).forEach((n) => { n.done_at = new Date().toISOString(); n.read_at = n.done_at; }); window.__mock.save(); }, lordag);
  await page.evaluate(() => sessionStorage.removeItem('mock-session'));
  await page.goto('http://localhost:8765/');

  // Brian godkender Anne
  await page.waitForSelector('#authForm');
  await page.fill('input[name=email]', 'brian@test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('#nav a:has-text("Admin")');
  await page.click('#nav a:has-text("Spilledage")');
  await page.waitForSelector('.approvals [data-pok]');
  ok((await page.locator('#nav a:has-text("Admin") .navbadge').innerText()) === '1', 'Admin i menuen viser 1, der venter');
  ok((await page.locator('.approvals').innerText()).includes('Test Anne'), 'Spilledage viser, at Anne vil være med');
  await shot('godkend-spilledage');
  await page.click('#nav a:has-text("Admin")');
  await page.waitForSelector('[data-approve]');
  await shot('godkend');
  await page.click('[data-approve]');
  await wait(500);
  ok((await text()).includes('2 spillere'), 'Anne godkendt i Lørdagspadel');
  ok(!(await page.locator('#nav a:has-text("Admin") .navbadge').count()), 'tallet forsvinder, når Anne er godkendt');
  await page.goto('http://localhost:8765/#/beskeder');
  await page.waitForSelector('.notices-page');
  ok(!(await text()).includes('vil gerne være med'), 'beskeden om Anne forsvinder, når hun er godkendt');

  // Hjemmeskærm: på en iPhone vises vejledningen efter login, og den kan springes over
  const iphone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const ip = await iphone.newPage();
  ip.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await ip.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(root, 'tests', 'mock-supabase.js'), 'utf8') }));
  await ip.goto('http://localhost:8765/');
  await ip.waitForSelector('#authForm');
  await ip.fill('input[name=email]', 'test2@fredagspadel.test');
  await ip.fill('input[name=password]', 'whatever');
  await ip.click('button[type=submit]');
  await ip.waitForSelector('.gate');
  ok((await ip.locator('.gate').innerText()).includes('Føj til hjemmeskærm'), 'iPhone: vejledning til hjemmeskærm');
  await ip.screenshot({ path: path.join(shots, 'install-iphone.png') });
  await ip.click('#skipInstall');
  await ip.waitForSelector('#nav a');
  ok(await ip.locator('.gate').count() === 0, 'iPhone: spring over virker');
  await ip.click('#nav a:has-text("Profil")');
  await ip.waitForSelector('.me-card');
  ok(await ip.locator('#installRow').count() === 1, 'iPhone: hjemmeskærm ligger under Profil');
  await iphone.close();

  // Bødekasse: admin slår til, giver bøde, spilleren melder betalt, admin godkender
  await loginAs('jimmy@test');
  await page.goto('http://localhost:8765/#/admin');
  await page.waitForSelector('.page.admin');
  await page.click('[data-pgroup="g-fre"]');
  await wait(300);
  ok(await page.locator('details.plist:not([open])').count() === 1, 'spillerlisten under Admin er foldet sammen');
  ok(!(await page.locator('#nav').innerText()).includes('Bøder'), 'bødekassen er slået fra som standard');
  await page.waitForSelector('details.gset'); await page.evaluate(() => document.querySelectorAll('details.gset').forEach((d) => (d.open = true)));
  await page.check('#finesOn');
  await wait(500);
  ok((await page.locator('#nav').innerText()).includes('Bøder'), 'Bøder kommer i menuen, når den slås til');
  await page.click('#nav a:has-text("Bøder")');
  await page.waitForSelector('.page.fines');
  await page.locator('details.givebox summary').click();
  await page.fill('#fineWho', 'anders');
  await page.locator('#fineHits [data-pick]').first().click();
  await page.selectOption('#giveFine select[name=type]', { label: 'For sent fremmøde · 5 kr./min' });
  await page.fill('#giveFine input[name=minutes]', '7');
  await page.click('#giveFine button.primary');
  await wait(500);
  ok((await page.locator('.flist .fine').first().innerText()).includes('35 kr.'), 'bøde for 7 min for sent = 35 kr.');
  // Egen bøde uden takst
  await page.selectOption('#giveFine select[name=type]', { label: 'Andet…' });
  await page.fill('#fineWho', 'anders');
  await page.locator('#fineHits [data-pick]').first().click();
  await page.fill('#giveFine input[name=title]', 'Glemt bolde');
  await page.fill('#giveFine input[name=amount]', '20');
  await page.click('#giveFine button.primary');
  await wait(500);
  ok((await page.locator('.ftile.red').innerText()).includes('55 kr.'), 'ubetalte i alt 55 kr.');
  // Bøde fra spilledagen
  await page.goto(evUrl);
  await page.waitForSelector('.page.event');
  await page.locator('#evFine summary').click();
  await page.waitForSelector('#evFine #giveFine');
  await page.locator('#fineWho').focus();
  ok(await page.locator('#fineHits [data-pick]').count() >= 4, 'dagens spillere står klar i Giv bøde');
  await page.locator('#fineHits [data-pick]').first().click();
  await page.selectOption('#giveFine select[name=type]', { label: 'Afbud på dagen · 100 kr.' });
  await page.click('#giveFine button.primary');
  await wait(500);
  ok((await page.locator('#toast').innerText()).includes('har fået en bøde'), 'bøde givet fra spilledagen');
  await page.goto('http://localhost:8765/#/boeder');
  await page.waitForSelector('.page.fines');
  const evFineRow = page.locator('.flist .fine', { hasText: 'Afbud på dagen' });
  ok(await evFineRow.count() === 1, 'bøden fra spilledagen står i bødekassen');
  await evFineRow.locator('[data-fstatus]').click();
  await wait(500);
  await page.locator('details.fset > summary').click();
  // Slå en takst fra: den kan så ikke vælges, når man giver en bøde
  await page.locator('.ftype', { hasText: 'Udeblivelse' }).locator('input[data-tactive]').uncheck();
  await wait(500);
  ok(await page.locator('details.fset[open]').count() === 1, 'indstillingerne bliver åbne efter til/fra');
  ok(!(await page.locator('#giveFine select[name=type]').innerText()).includes('Udeblivelse'), 'en takst der er slået fra kan ikke vælges');
  ok((await page.evaluate(() => JSON.parse(sessionStorage.getItem('mockdb')).padel_fine_types.find((t) => t.name === 'Udeblivelse').active)) === false, 'takst slået fra er gemt');
  await page.fill('#fineSettings input[name=payto]', 'MobilePay 12 34 56 78');
  await page.click('#fineSettings button');
  await wait(400);
  await shot('boeder-admin');
  await noOverflow('bødekasse');
  // Spilleren logger ind og ser sin nye bøde med det samme
  await page.evaluate(() => sessionStorage.removeItem('mock-session'));
  await page.goto('http://localhost:8765/');
  await page.waitForSelector('#authForm');
  await page.fill('input[name=email]', 'test1@fredagspadel.test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('.finegate');
  const fgt = await page.locator('.finegate').innerText();
  ok(fgt.includes('Du har fået 2 bøder') && fgt.includes('55 kr.'), 'ny bøde vises, når spilleren logger ind');
  ok((await page.locator('.finegate a.mp').getAttribute('href')).startsWith('mobilepay://send?phone=12345678&amount=55'), 'MobilePay-knap med nummer og beløb');
  await shot('boede-ved-login');
  await page.click('#fgSee');
  await page.waitForSelector('.page.fines');
  await page.reload();
  await page.waitForSelector('#nav a');
  ok(!(await page.locator('.finegate').count()), 'bøden vises kun én gang');
  await page.goto('http://localhost:8765/#/boeder');
  await page.waitForSelector('.page.fines');
  const mc = await page.locator('.mine-card').innerText();
  ok(mc.includes('55 kr.') && mc.includes('MobilePay 12 34 56 78'), 'spilleren ser sit udestående og hvor der betales');
  ok(!(await page.locator('#giveFine').count()), 'almindelig spiller kan ikke give bøder');
  ok(await page.locator('.mine-card a.mp').count() === 1, 'MobilePay-knap i Dit udestående');
  await page.click('.mine-card a.mp');
  await wait(1000);
  if (!page.url().includes('#/boeder')) { await page.goto('http://localhost:8765/#/boeder'); }
  await page.waitForSelector('.page.fines');
  ok((await page.locator('.ftile.amber').innerText()).includes('55 kr.'), 'tryk på MobilePay melder bøderne betalt (afventer)');
  ok((await page.locator('.mine-card').innerText()).includes('Venter på, at en admin godkender'), 'spilleren kan se, at betalingen afventer');
  await shot('boeder-spiller');
  await loginAs('jimmy@test');
  await page.goto('http://localhost:8765/#/boeder');
  await page.waitForSelector('.approvals');
  for (let i = 0; i < 2; i++) { await page.locator('.approvals [data-paid]').first().click(); await wait(400); }
  ok((await page.locator('.ftile.green').innerText()).includes('55 kr.'), 'admin godkender betalingerne');
  ok((await page.locator('.list .row').first().innerText()).includes('Test Anders'), 'bødekonge vises');
  // MobilePay Box-link
  await page.locator('details.fset > summary').click();
  await page.fill('#fineSettings input[name=box]', 'https://qr.mobilepay.dk/box/abc123/pay-in');
  await page.click('#fineSettings button');
  await wait(400);
  ok((await page.evaluate(() => JSON.parse(sessionStorage.getItem('mockdb')).padel_groups.find((x) => x.id === 'g-fre').fines_box_url)) === 'https://qr.mobilepay.dk/box/abc123/pay-in', 'admin gemmer link til MobilePay Box');

  // Fortryd betalt
  await page.click('[data-ftab="betalt"]');
  await wait(300);
  await page.locator('.flist [data-fstatus]', { hasText: 'Fortryd betalt' }).first().click();
  await wait(500);
  ok((await page.locator('.ftile.red').innerText()).match(/(20|35) kr\./), 'en betalt bøde kan sættes tilbage til ubetalt');
  await page.evaluate(() => sessionStorage.removeItem('mock-session'));
  await page.goto('http://localhost:8765/');
  await page.waitForSelector('#authForm');
  await page.fill('input[name=email]', 'test1@fredagspadel.test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('#nav a, .finegate');
  if (await page.locator('.finegate').count()) await page.click('#fgOk');
  await page.goto('http://localhost:8765/#/boeder');
  await page.waitForSelector('.page.fines');
  ok((await page.locator('.mine-card a.mp').getAttribute('href')) === 'https://qr.mobilepay.dk/box/abc123/pay-in', 'spilleren får knap til MobilePay Box');
  await shot('boeder-box');
  await loginAs('jimmy@test');
  await shot('boeder-fortryd');

  // Admins egen bøde: skal godkendes af en anden admin eller superbruger
  await page.evaluate(() => { const db = window.__mock.db(); db.padel_group_members.find((m) => m.group_id === 'g-fre' && m.player_id === 'u-1').role = 'superbruger';
    db.padel_fines.push({ id: 'f-own', group_id: 'g-fre', player_id: 'u-admin', title: 'Egen test', amount: 20, status: 'ubetalt', created_at: new Date().toISOString(), seen_at: new Date().toISOString() }); window.__mock.save(); });
  await loginAs('jimmy@test');
  await page.goto('http://localhost:8765/#/boeder');
  await page.waitForSelector('.page.fines');
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-ftab]')].find((x) => x.dataset.ftab === 'alle'); b?.click(); });
  await wait(400);
  await page.waitForSelector('[data-paid="f-own"][data-own]');
  await page.click('[data-paid="f-own"]');
  await wait(500);
  ok(await page.evaluate(() => window.__mock.db().padel_fines.find((f) => f.id === 'f-own').status === 'afventer'), 'admins egen bøde venter på, at en anden admin godkender');
  ok(!(await page.locator('[data-paid="f-own"]').count()), 'admin kan ikke selv godkende sin egen bøde');
  await page.evaluate(() => { const db = window.__mock.db(); db.padel_group_members.find((m) => m.group_id === 'g-fre' && m.player_id === 'u-1').role = 'bruger'; db.padel_fines = db.padel_fines.filter((f) => f.id !== 'f-own'); window.__mock.save(); });

  // Automatisk bøde ved afmelding: Jimmy tilmelder sig en kommende dag (med 3 andre), venter og melder fra
  await page.goto('http://localhost:8765/#/fredage');
  await page.waitForSelector('.page');
  if (await page.locator('[data-group="g-fre"]').count()) { await page.click('[data-group="g-fre"]'); await wait(400); }
  await page.waitForSelector('a.ev [data-on]');
  const evId = await page.locator('a.ev [data-on]').first().getAttribute('data-on');
  await page.locator('a.ev [data-on]').first().click();
  await wait(500);
  await page.evaluate((id) => {
    const db = JSON.parse(sessionStorage.getItem('mockdb'));
    for (const p of ['u-2', 'u-3', 'u-4']) if (!db.padel_signups.some((x) => x.event_id === id && x.player_id === p)) db.padel_signups.push({ event_id: id, player_id: p, created_at: '2026-10-01T10:00:00.000Z' });
    db.padel_signups.filter((x) => x.event_id === id).forEach((x) => (x.created_at = x.player_id === 'u-admin' ? '2026-10-01T08:00:00.000Z' : '2026-10-01T09:00:00.000Z'));
    sessionStorage.setItem('mockdb', JSON.stringify(db));
  }, evId);
  await page.reload();
  await page.waitForSelector(`[data-off="${evId}"]`);
  let warned = '';
  page.once('dialog', (d) => { warned = d.message(); });
  await page.click(`[data-off="${evId}"]`);
  await wait(600);
  ok(warned.includes('automatisk en bøde: Afbud efter tilmelding'), 'advarsel om automatisk bøde før afmelding');
  ok((await page.locator('#toast').innerText()).includes('Bøde: Afbud efter tilmelding'), 'afmelding giver automatisk bøde');
  const af = await page.evaluate((id) => JSON.parse(sessionStorage.getItem('mockdb')).padel_fines.find((f) => f.event_id === id && f.auto), evId);
  ok(af && af.player_id === 'u-admin' && af.amount === 30, 'den automatiske bøde er gemt på spilleren');
  await page.goto('http://localhost:8765/#/boeder');
  await page.waitForSelector('.page.fines');
  ok((await page.locator('.flist').innerText()).includes('Automatisk'), 'automatisk bøde er mærket i bødekassen');
  await shot('auto-boede');

  // Opret spiller uden login, tilmeld ham, og lad ham overtage profilen, når han opretter sig
  await page.goto('http://localhost:8765/#/admin');
  await page.waitForSelector('.page.admin');
  await page.click('[data-pgroup="g-fre"]');
  await wait(300);
  await page.click('#newPlayerBtn');
  await page.fill('#newPlayer input[name=name]', 'Nikolaj Ny');
  await page.fill('#newPlayer input[name=phone]', '11 22 33 44');
  await page.click('#newPlayer label:has-text("Mand")');
  await page.click('#newPlayer button.primary');
  await wait(500);
await page.waitForSelector('details.plist'); await page.evaluate(() => document.querySelectorAll('details.plist').forEach((d) => (d.open = true)));
    ok((await page.locator('#players').innerText()).includes('Nikolaj Ny') && (await page.locator('.prow', { hasText: 'Nikolaj Ny' }).innerText()).includes('Uden login'), 'admin opretter spiller uden login');
  await shot('opret-spiller');
  await page.goto(evUrl);
  await page.waitForSelector('.page.event');
  if (await page.locator('#addSearch').count()) {
    await page.fill('#addSearch', 'nikolaj');
    await page.locator('#addHits .hit').first().click();
    await wait(400);
    ok((await text()).includes('nikolaj ny'), 'spiller uden login kan tilmeldes');
  }
  await page.evaluate(() => sessionStorage.removeItem('mock-session'));
  await page.goto('http://localhost:8765/');
  await page.waitForSelector('#authForm');
  await page.fill('input[name=email]', 'nyspiller@test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('#pf');
  await page.fill('#pf input[name=name]', 'Nikolaj Ny');
  await page.fill('#pf input[name=phone]', '+45 11223344');
  await page.click('#pf label:has-text("Mand")');
  await page.click('#pf button.primary');
  await page.waitForSelector('#nav a, .gate');
  if (await page.locator('#skipInstall').count()) await page.click('#skipInstall');
  await page.waitForSelector('#nav a');
  ok((await page.locator('#nav').innerText()).includes('Spilledage'), 'ny bruger overtager spilleren og er med i gruppen med det samme');
  const merged = await page.evaluate(() => { const db = JSON.parse(sessionStorage.getItem('mockdb')); return db.padel_profiles.find((p) => p.name === 'Nikolaj Ny' && p.placeholder).merged_into; });
  ok(merged === 'u-nyspiller', 'profilen uden login er koblet til den nye bruger');

  // Forslagskasse: superadmin sætter "spørg efter 3 kampe", spilleren får popup, sender forslag og får svar
  await loginAs('jimmy@test');
  await page.goto('http://localhost:8765/#/admin');
  await page.waitForSelector('.page.admin');
  await page.click('[data-tab="forslag"]');
  await page.waitForSelector('#fbAfter');
  await page.fill('#fbAfter input[name=n]', '3');
  await page.click('#fbAfter button');
  await wait(400);
  await loginAs('test2@fredagspadel.test', true);
  await page.waitForSelector('#fbModal');
  ok((await page.locator('#fbModal').innerText()).includes('Hvad synes du om appen?'), 'popup med forslag efter 3 spillede kampe');
  await shot('forslag-popup');
  await page.fill('#fbModal textarea', 'Kan vi få en mørk og en lys tilstand?');
  await page.click('#fbModal button.primary');
  await wait(400);
  ok(!(await page.locator('#fbModal').count()), 'popup lukker efter forslag');
  await page.reload();
  await page.waitForSelector('#nav a');
  await wait(400);
  ok(!(await page.locator('#fbModal').count()), 'popup vises kun én gang');
  await page.click('#nav a:has-text("Profil")');
  await page.click('#sugRow');
  await page.waitForSelector('#sugForm');
  await page.fill('#sugForm textarea', 'Bøder skulle kunne betales med kort');
  await page.click('#sugForm button');
  await wait(400);
  ok((await page.locator('.sug').count()) === 2, 'forslagskassen under Profil viser mine forslag');
  await noOverflow('forslagskasse');
  await loginAs('jimmy@test');
  await page.goto('http://localhost:8765/#/admin');
  await page.waitForSelector('.page.admin');
  await page.click('[data-tab="forslag"]');
  await page.waitForSelector('form[data-sug]');
  ok((await page.locator('[data-stab="nye"]').innerText()).includes('2'), 'superadmin ser 2 nye forslag');
  const sf = page.locator('form[data-sug]', { hasText: 'mørk og en lys' });
  await sf.locator('select[name=status]').selectOption('planlagt');
  await sf.locator('textarea[name=reply]').fill('God idé, den kommer!');
  await sf.locator('button').click();
  await wait(400);
  await shot('forslag-admin');
  await loginAs('test2@fredagspadel.test');
  await page.click('#nav a:has-text("Profil")');
  await page.waitForSelector('#sugRow .badge.new');
  ok((await page.locator('#sugRow').innerText()).includes('Nyt svar'), 'spilleren ser "Nyt svar" ved Forslagskasse');
  await page.click('#sugRow');
  await page.waitForSelector('.sreply');
  ok((await page.locator('.sug', { hasText: 'mørk og en lys' }).innerText()).includes('God idé, den kommer!'), 'spilleren ser svaret i appen');
  await shot('forslag-svar');

  // Redigeringstilstand for superadmin: slå til, ret en kamp, slet en bøde, slå fra
  await loginAs('jimmy@test');
  await page.goto('http://localhost:8765/#/profil');
  await page.waitForSelector('#editMode');
  ok(!(await page.locator('#editBar').count()), 'redigering er slået fra som standard');
  await page.check('#editMode');
  await wait(300);
  ok(await page.locator('#editBar').count() === 1, 'bjælke viser, at redigering er slået til');
  await page.goto(evUrl);
  await page.waitForSelector('.page.event');
  await openAll();
  ok(await page.locator('.match [data-sedit^="padel_matches|"]').count() >= 1, '✏️ på kampene');
  await page.locator(`#m-${cm.id} [data-sedit]`).click();
  await page.waitForSelector('.sedit-card');
  await page.fill('.sedit-card input[name=score_a]', '5');
  await page.fill('.sedit-card input[name=score_b]', '5');
  await shot('rediger-kamp');
  await page.click('.sedit-card button.primary');
  await wait(600);
  await openAll();
  ok((await page.locator(`#m-${cm.id} .score`).innerText()).replace(/\s/g, '') === '5–5', 'superadmin retter en kamps resultat');
  await page.goto('http://localhost:8765/#/boeder');
  await page.waitForSelector('.page.fines');
  await page.click('[data-ftab="alle"]');
  await wait(300);
  const before = await page.locator('.flist .fine').count();
  await page.locator('.flist .fine [data-sedit]').first().click();
  await page.waitForSelector('#seDel');
  await page.click('#seDel');
  await wait(600);
  ok((await page.locator('.flist .fine').count()) === before - 1, 'superadmin sletter en bøde');
  await page.goto('http://localhost:8765/#/rangliste');
  await page.waitForSelector('.list .row');
  ok(await page.locator('.list .row [data-sedit]').count() >= 1, '✏️ på ranglisten');
  await page.click('#editOff');
  await wait(400);
  ok(!(await page.locator('[data-sedit]').count()) && !(await page.locator('#editBar').count()), 'slået fra: ingen ✏️ og ingen bjælke');

  // Slet (arkivér) en gruppe: forsvinder for Brian; kan hentes tilbage
  await loginAs('jimmy@test');
  await page.goto('http://localhost:8765/#/admin');
  await page.waitForSelector('[data-tab="grupper"]');
  await page.click('[data-tab="grupper"]');
  await page.locator('.chips.groups [data-group]', { hasText: 'Lørdagspadel' }).click();
  await page.waitForSelector('#archiveGroup');
  await page.click('#archiveGroup');
  await wait(600);
  ok(!(await page.locator('.chips.groups [data-group]', { hasText: 'Lørdagspadel' }).count()), 'slettet gruppe forsvinder fra listen');
  ok((await page.locator('details.archived').innerText()).includes('Slettede grupper (1)'), 'slettede grupper kan ses af superadmin');
  await page.evaluate(() => sessionStorage.removeItem('mock-session'));
  await page.goto('http://localhost:8765/');
  await page.waitForSelector('#authForm');
  await page.fill('input[name=email]', 'brian@test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('#reload, #nav a');
  ok(!(await page.locator('#nav a:has-text("Spilledage")').count()), 'Brian kan ikke længere bruge den slettede gruppe');
  await loginAs('jimmy@test');
  await page.goto('http://localhost:8765/#/admin');
  await page.click('[data-tab="grupper"]');
  await page.locator('details.archived summary').click();
  await page.click('[data-unarchive]');
  await wait(600);
  ok(await page.locator('.chips.groups [data-group]', { hasText: 'Lørdagspadel' }).count() === 1, 'gruppen kan hentes tilbage');

  // Slet bruger: spilleren sletter sig selv, kommer igen og genaktiverer med samme point
  const elo3 = await page.evaluate(() => JSON.parse(sessionStorage.getItem('mockdb')).padel_group_members.find((m) => m.player_id === 'u-3' && m.group_id === 'g-fre').elo);
  await loginAs('test3@fredagspadel.test');
  await page.click('#nav a:has-text("Profil")');
  await page.waitForSelector('#deleteMe');
  await page.click('#deleteMe');
  await page.waitForSelector('#authForm');
  ok(true, 'spilleren kan slette sin egen profil');
  await page.fill('input[name=email]', 'test3@fredagspadel.test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('#reactivate');
  ok((await text()).includes('din profil er slettet'), 'slettet spiller får tilbudt at genaktivere');
  await page.click('#reactivate');
  await page.waitForSelector('#reload, #nav a, .finegate, .gate, .me-card');
  const back = await page.evaluate(() => { const db = JSON.parse(sessionStorage.getItem('mockdb')); return { del: db.padel_profiles.find((p) => p.id === 'u-3').deleted_at, m: db.padel_group_members.find((m) => m.player_id === 'u-3' && m.group_id === 'g-fre') }; });
  ok(!back.del && back.m.status === 'fjernet' && back.m.elo === elo3, 'genaktiveret med samme point; skal godkendes i gruppen igen');
  // Superadmin får besked om, at spilleren er kommet igen
  await loginAs('jimmy@test');
  await page.goto('http://localhost:8765/#/fredage');
  await page.waitForSelector('.notices');
  ok((await page.locator('.notices').innerText()).includes('Test Carsten genaktiverede sin profil'), 'superadmin får besked, når en slettet spiller kommer igen');
  ok(Number(await page.locator('#nav a:has-text("Admin") .navbadge').innerText()) >= 1, 'tal på Admin for beskeden');
  await shot('kommet-igen');
  await page.click('#noticesOk');
  await wait(400);
  ok(!(await page.locator('.notices').count()), 'beskeden forsvinder efter OK');
  // Admin sletter en spiller og gendanner
  await loginAs('jimmy@test');
  await page.goto('http://localhost:8765/#/admin');
  await page.waitForSelector('.page.admin');
  await page.click('[data-tab="spillere"]');
  await page.click('[data-pgroup="g-fre"]');
  await page.waitForSelector('details.plist'); await page.evaluate(() => document.querySelectorAll('details.plist').forEach((d) => (d.open = true)));
  await page.locator('.prow', { hasText: 'Test Dennis' }).locator('summary').click();
  await page.locator('.prow[open] [data-delplayer]').click();
  await wait(600);
  ok(!(await page.locator('#players').innerText()).includes('Test Dennis'), 'admin sletter en spiller');
  await page.click('[data-allp]');
  await page.waitForSelector('details.plist'); await page.evaluate(() => document.querySelectorAll('details.plist').forEach((d) => (d.open = true)));
  const dr = page.locator('.prow', { hasText: 'Test Dennis' });
  ok((await dr.innerText()).includes('Slettet'), 'slettet spiller står som Slettet under Alle spillere');
  await dr.locator('summary').click();
  await page.locator('.prow[open] [data-restore]').click();
  await wait(600);
  ok(!(await page.locator('.prow', { hasText: 'Test Dennis' }).innerText()).includes('Slettet'), 'superadmin kan gendanne en slettet spiller');

  // Én fælles rangliste: Brians gruppe ser også spillere fra Fredagspadel; admin kan vælge "kun gruppen" eller "ingen"
  await page.evaluate(() => sessionStorage.removeItem('mock-session'));
  await page.goto('http://localhost:8765/');
  await page.waitForSelector('#authForm');
  await page.fill('input[name=email]', 'brian@test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('#nav a');
  await page.goto('http://localhost:8765/#/rangliste');
  await page.waitForSelector('.page h1');
  await wait(400);
  ok((await page.locator('.list').innerText()).includes('Test Anders'), 'fælles rangliste viser spillere fra alle grupper');
  await page.goto('http://localhost:8765/#/admin');
  await page.waitForSelector('details.gset'); await page.evaluate(() => document.querySelectorAll('details.gset').forEach((d) => (d.open = true)));
  await page.click('.rankmode label:has-text("Kun gruppen")');
  await wait(500);
  await page.goto('http://localhost:8765/#/rangliste');
  await page.waitForSelector('.page h1');
  await wait(400);
  ok(!(await page.locator('.page').innerText()).includes('Test Anders'), '"Kun gruppen" viser kun gruppens spillere');
  await page.goto('http://localhost:8765/#/admin');
  await page.waitForSelector('details.gset'); await page.evaluate(() => document.querySelectorAll('details.gset').forEach((d) => (d.open = true)));
  await page.click('.rankmode label:has-text("Ingen")');
  await wait(500);
  await loginAs('jimmy@test');
  await page.evaluate(() => sessionStorage.removeItem('mock-session'));
  await page.goto('http://localhost:8765/');
  await page.waitForSelector('#authForm');
  await page.fill('input[name=email]', 'test7@fredagspadel.test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('#nav a');
  await wait(500);
  if (await page.locator('#fbModal').count()) await page.click('#fbLater');
  await page.locator('[data-group]', { hasText: 'Lørdagspadel' }).click();
  await wait(400);
  ok(!(await page.locator('#nav').innerText()).includes('Rangliste'), '"Ingen rangliste" skjuler ranglisten for spillerne');

  // Notifikation: en spiller melder fra, og den første på ventelisten får besked
  await loginAs('jimmy@test');
  const wl = await page.evaluate(() => {
    const db = window.__mock.db();
    const ev = db.padel_events.find((e) => e.status === 'planlagt' && e.group_id === 'g-fre');
    ev.court_ids = ev.court_ids.slice(0, 1);
    db.padel_signups = db.padel_signups.filter((x) => x.event_id !== ev.id);
    ['u-1', 'u-2', 'u-4', 'u-5', 'u-6'].forEach((p, i) => db.padel_signups.push({ event_id: ev.id, player_id: p, created_at: `2026-10-01T10:0${i}:00.000Z` }));
    db.padel_notifications = [];
    window.__mock.save();
    return ev.id;
  }, null);
  await page.goto('http://localhost:8765/#/fredag/' + wl);
  await page.waitForSelector('.page.event');
  await wait(400);
  await page.evaluate(() => document.querySelectorAll('details.signbox').forEach((d) => (d.open = true)));
  await page.locator('[data-unsign="u-1"]').click();
  await wait(600);
  const nf = await page.evaluate(() => JSON.parse(sessionStorage.getItem('mockdb')).padel_notifications.filter((n) => n.kind === 'venteliste'));
  ok(nf.length === 1 && nf[0].user_id === 'u-6' && nf[0].kind === 'venteliste', 'den første på ventelisten får besked om plads');
  await page.evaluate(() => sessionStorage.removeItem('mock-session'));
  await page.goto('http://localhost:8765/');
  await page.waitForSelector('#authForm');
  await page.fill('input[name=email]', 'test6@fredagspadel.test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('#nav a, .finegate');
  if (await page.locator('.finegate').count()) await page.click('#fgOk');
  await page.waitForSelector('#nav a');
  await wait(400);
  if (await page.locator('#fbModal').count()) await page.click('#fbLater');
  ok((await page.locator('#nav a:has-text("Profil") .navbadge').innerText()) === '1', 'tal på Profil ved ny besked');
  await page.goto('http://localhost:8765/#/beskeder');
  await page.waitForSelector('.notices-page');
  ok((await page.locator('.nrow').first().innerText()).includes('Du har fået en plads'), 'beskeden står under Beskeder');
  ok(await page.locator('#pushToggle').count() === 1, 'knap til notifikationer på telefonen');
  await shot('beskeder');
  await wait(300);
  ok(!(await page.locator('#nav .navbadge').count()), 'tallet forsvinder, når beskeden er læst');

  // Udseende: vælg pink, det gemmes og huskes efter genindlæsning
  await page.click('#nav a:has-text("Profil")');
  await page.click('a[href="#/udseende"]');
  await page.waitForSelector('.themes');
  await page.click('[data-theme-key="pink"]');
  await wait(400);
  ok((await page.evaluate(() => document.documentElement.dataset.theme)) === 'pink', 'pink tema slås til med det samme');
  await shot('tema-pink-valg');
  await page.reload();
  await page.waitForSelector('#nav a');
  ok((await page.evaluate(() => document.documentElement.dataset.theme)) === 'pink', 'temaet huskes');
  await page.goto('http://localhost:8765/#/fredage');
  await page.waitForSelector('.page');
  await wait(300);
  await shot('tema-pink');
  await page.goto('http://localhost:8765/#/udseende');
  await page.waitForSelector('.themes');
  await page.click('[data-theme-key="lys"]');
  await page.goto('http://localhost:8765/#/fredage');
  await page.waitForSelector('.page');
  await wait(300);
  await shot('tema-lys');
  await noOverflow('lyst tema');
  await page.goto('http://localhost:8765/#/udseende');
  await page.waitForSelector('.themes');
  await page.click('[data-theme-key=""]');
  await wait(300);
  ok(!(await page.evaluate(() => document.documentElement.dataset.theme)), 'tilbage til standard');

  // Nyt i appen: popup én gang efter en større opdatering; spillere ser ikke admin-nyheder
  await loginAs('jimmy@test');
  await page.evaluate(() => { const db = window.__mock.db(); db.padel_profiles.find((p) => p.id === 'u-5').news_seen = '2026-10-24'; db.padel_profiles.find((p) => p.id === 'u-admin').news_seen = '2026-10-24'; window.__mock.save(); });
  await page.reload();
  await page.waitForSelector('#newsModal');
  const nm = await page.locator('#newsModal').innerText();
  ok(nm.includes('Billeder i beskeder') && nm.includes('dagsplanen er klar'), 'admin får popup med de nyeste nyheder');
  await shot('nyt-i-appen');
  await page.click('#newsOk');
  await page.reload();
  await page.waitForSelector('#nav a');
  await wait(500);
  ok(!(await page.locator('#newsModal').count()), 'popuppen kommer kun én gang');
  await page.evaluate(() => sessionStorage.removeItem('mock-session'));
  await page.goto('http://localhost:8765/');
  await page.waitForSelector('#authForm');
  await page.fill('input[name=email]', 'test5@fredagspadel.test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('#nav a, .finegate');
  if (await page.locator('.finegate').count()) await page.click('#fgOk');
  await page.waitForSelector('#newsModal');
  ok(!(await page.locator('#newsModal').innerText()).includes('Se appen som almindelig bruger'), 'spillere ser ikke admin-nyheder');
  await page.click('#newsOk');
  await page.goto('http://localhost:8765/#/nyt');
  await page.waitForSelector('.news-entry');
  ok((await page.locator('.news-entry').count()) >= 1, 'tidligere nyheder kan læses under Profil');

  // ---------- Juniorklub ----------
  const freshLogin = async (email, url = 'http://localhost:8765/') => {
    await page.evaluate(() => sessionStorage.removeItem('mock-session'));
    await page.goto(url);
    await page.waitForSelector('#authForm');
    await page.fill('input[name=email]', email);
    await page.fill('input[name=password]', 'whatever');
    await page.click('button[type=submit]');
  };
  let lastTodo = '', lastAsk = '', lastSpot = '';
  const pastGates = async () => {
    lastTodo = '';
    for (let i = 0; i < 4; i++) {
      await wait(400);
      if (await page.locator('#skipInstall').count()) { await page.click('#skipInstall'); continue; }
      if (await page.locator('#newsOk').count()) { await page.click('#newsOk'); continue; }
      if (await page.locator('#fgOk').count()) { await page.click('#fgOk'); continue; }
      if (await page.locator('#fbLater').count()) { await page.click('#fbLater'); continue; }
      if (await page.locator('#spotNo').count()) { lastSpot = await page.locator('#spotModal').innerText(); await page.click('#spotNo'); continue; }
      if (await page.locator('#askLater').count()) { lastAsk = await page.locator('#askModal').innerText(); await page.click('#askLater'); continue; }
      if (await page.locator('#todoLater').count()) { lastTodo = await page.locator('#todoModal').innerText(); await page.click('#todoLater'); continue; }
    }
  };
  // Superadmin opretter klubben og gør Brian til træner
  await freshLogin('jimmy@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  await page.goto('http://localhost:8765/#/admin');
  await page.waitForSelector('.page.admin');
  await page.click('[data-tab="grupper"]');
  await page.click('details.newgroup summary');
  await page.fill('#newGroup input[name=name]', 'Gribskov Padelklub Junior');
  ok(await page.locator('#audBox').isHidden(), 'valget af børn/voksne er skjult for en spillegruppe');
  await page.locator('#newGroup label:has-text("Klub")').click();
  ok(await page.locator('#audBox').isVisible() && await page.locator('#newGroup input[name=aud][value=boern]').isChecked(), 'en ny klub er som udgangspunkt for børn');
  await shot('ny-klub');
  await page.click('#newGroup button.primary');
  await wait(500);
  ok((await page.locator('.gsum').innerText()).includes('Juniorklub'), 'juniorklub oprettet');
  const clubId = await page.evaluate(() => window.__mock.db().padel_groups.find((x) => x.kind === 'klub').id);
  await page.fill('#superAdd', 'bri');
  await wait(300); await shot('tilfoej-spiller'); await noOverflow('tilføj spiller');
  ok((await page.locator('#superHits [data-r="superbruger"]').innerText()) === 'Træner', 'i en klub hedder superbruger "Træner"');
  await page.locator('#superHits [data-r="superbruger"]').click();
  await wait(400);
  // Hold og træningstider (én i dag, så fremmøde kan krydses af, og én om 2 dage)
  const dows = await page.evaluate(() => { const d = new Date(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen' }).format(new Date()) + 'T12:00:00Z'); const a = d.getUTCDay() || 7; return [a, ((a + 1) % 7) + 1]; });
  await page.click('[data-tab="hold"]');
  await page.waitForSelector('#newTeam');
  await page.fill('#newTeam input[name=name]', 'U12');
  await page.click('#newTeam button');
  await page.waitForSelector('details.teamcard[open]');
  for (const [i, wd] of dows.entries()) {
    await page.click('details.teamcard[open] details.srow.new summary');
    const f = page.locator('details.teamcard[open] details.srow.new form');
    await f.locator('select[name=wd]').selectOption(String(wd));
    await f.locator('input[name=st]').fill(i ? '17:00' : '16:00');
    await f.locator('input[name=en]').fill(i ? '18:30' : '17:00');
    await f.locator('input[name=place]').fill('Padelhuset Gilleleje');
    await f.locator('button.primary').click();
    await wait(500);
  }
  ok((await page.locator('details.teamcard[open] details.srow:not(.new)').count()) === 2, 'to træningstider på holdet');
  await page.locator('details.teamcard[open] label:has([data-coach][value="u-brian"])').click();
  await wait(500);
  ok((await page.evaluate(() => window.__mock.db().padel_club_team_trainers.filter((x) => x.user_id === 'u-brian' && x.active).length)) === 1, 'Brian sat som træner på U12');
  await page.locator('details.teamcard[open] form[data-tmax] input[name=max]').fill('1');
  await page.locator('details.teamcard[open] form[data-tmax] button').click();
  await wait(500);
  ok((await page.locator('details.teamcard[open] details.srow:not(.new) .byline').first().innerText()).includes('Oprettet af Jimmy'), 'admin ser hvem der har oprettet træningstiden');
  await shot('klub-hold-tider');
  await noOverflow('klub hold og tider');
  // Kontingent og info
  await page.click('[data-tab="spillere"]');
  await page.click('details.gset:not(.staff) summary');
  await page.fill('#clubSet input[name=fee]', '600');
  await page.fill('#clubSet input[name=label]', 'Efterår 2026');
  await page.fill('#clubSet input[name=url]', 'https://qr.mobilepay.dk/box/test');
  await page.fill('#clubSet textarea[name=info]', 'Husk vand og indendørssko. Træner: Brian');
  await page.locator('#clubSet input[name=addr]').check();
  await page.fill('#clubSet input[name=hours]', '48');
  await page.click('#clubSet button');
  await wait(500);
  ok((await page.locator('details.gset:not(.staff) summary').innerText()).includes('600'), 'kontingent sat op');
  ok((await page.evaluate((g) => window.__mock.db().padel_groups.find((x) => x.id === g).club_absence_hours, clubId)) === 48, 'afbudsfrist sat til 48 timer');
  // Klubben kan findes i appen: andre ser en lille linje under Profil, som kan lukkes
  await page.locator('#clubSet input[name=disc]').check();
  await page.click('#clubSet button.primary');
  await wait(500);
  await freshLogin('test5@fredagspadel.test');
  await page.waitForSelector('#nav a');
  await pastGates();
  await page.goto('http://localhost:8765/#/profil');
  await page.waitForSelector('#discRow');
  ok(!(await page.locator('#discRow').innerText()).includes('Gribskov'), 'diskret linje under Profil uden klubbens navn');
  await page.click('#discRow');
  await page.waitForSelector('#joinForm select[name=club]');
  ok((await page.locator('#joinForm select[name=club] option').allInnerTexts()).some((t) => t.includes('Gribskov Padelklub Junior')), 'klubben vælges i en rullemenu ved indmeldelsen');
  await shot('klub-find');
  await noOverflow('klub find');
  await freshLogin('jimmy@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  await page.evaluate((g) => localStorage.setItem('fp-group', g), clubId);
  await page.goto('http://localhost:8765/#/admin');
  await page.reload();
  await page.waitForSelector('.tabbar');
  await page.click('[data-tab="spillere"]');
  await page.click('details.staff summary');
  await page.locator('form[data-staff="u-brian"] input[name=cert]').fill('2026-09-01');
  await page.locator('form[data-staff="u-brian"] button').click();
  await wait(500);
  ok((await page.evaluate(() => window.__mock.db().padel_club_certs.find((x) => x.user_id === 'u-brian')?.cert_date)) === '2026-09-01', 'børneattest registreret for træneren');
  await shot('klub-medlemmer');

  // Forælder får invitationslinket, opretter sig og melder to børn ind
  await page.evaluate(() => sessionStorage.removeItem('mock-session'));
  await page.goto('about:blank');
  await page.goto(`http://localhost:8765/#/velkommen/${clubId}`);
  await page.waitForSelector('#authForm');
  ok((await text()).includes('gribskov padelklub junior') && (await text()).includes('meld'), 'login nævner klubben og indmeldelse ved invitation: ' + (await text()).slice(0, 200));
  await wait(500);
  if (!(await page.locator('button[type=submit]:has-text("Log ind")').count())) await page.click('#switch');
  await page.waitForSelector('button[type=submit]:has-text("Log ind")');
  await page.fill('input[name=email]', 'nyforaelder@test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('#pf');
  ok((await text()).includes('meld') && !(await page.locator('#pf label:has-text("Højre")').count()), 'forælder: velkomst nævner indmeldelse, ingen side på banen');
  await page.fill('#pf input[name=name]', 'Pia Forælder');
  await page.fill('#pf input[name=phone]', '22334455');
  await page.click('#pf label:has-text("Kvinde")');
  await page.click('#pf button.primary');
  await pastGates();
  await page.waitForSelector('#joinForm');
  const k0 = page.locator('.kidf').nth(0);
  await k0.locator('input[name=kname]').fill('Oscar Test');
  await k0.locator('input[name=kbirth]').fill('2014-05-03');
  await k0.locator('label:has-text("Dreng")').click();
  await k0.locator('label:has-text("Ja")').click();
  await k0.locator('textarea[name=kinfo]').fill('Glemmer tit sin drikkedunk');
  await k0.locator('input[name=kaddr]').fill('Strandvejen 1, 3250 Gilleleje');
  await page.click('#moreKid');
  const k1 = page.locator('.kidf').nth(1);
  await k1.locator('input[name=kname]').fill('Ida Test');
  await k1.locator('input[name=kbirth]').fill('2016-02-10');
  await k1.locator('label:has-text("Pige")').click();
  await k1.locator('label:has-text("Nej")').click();
  await k1.locator('label:has-text("prøve 1-2 træninger")').click();
  await k1.locator('input[name=kaddr]').fill('Strandvejen 1, 3250 Gilleleje');
  await shot('klub-indmeld');
  await noOverflow('klub indmeld');
  await page.click('#joinForm button.primary');
  await wait(600);
  ok((await text()).includes('oscar test') && (await text()).includes('træner har godkendt'), 'forælder ser at børnene venter på godkendelse');
  ok((await page.evaluate(() => { const db = window.__mock.db(); const o = db.padel_club_kids.find((k) => k.name === 'Oscar Test'), i = db.padel_club_kids.find((k) => k.name === 'Ida Test'); return o.birth_date === '2014-05-03' && o.gender === 'dreng' && o.photo_ok === true && i.photo_ok === false && !!o.address && db.padel_club_kid_info.some((x) => x.kid_id === o.id); })), 'fødselsdato, køn, billedsamtykke, adresse og info gemt');

  // Træneren (Brian) godkender og sætter på hold
  await freshLogin('brian@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  const nav = await page.locator('#nav').innerText();
  ok(nav.includes('Træning') && nav.includes('Opslag') && !nav.includes('Rangliste') && !nav.includes('Spilledage'), 'klubbens menu: Træning, Opslag, Profil, Admin');
  ok((await page.locator('#nav a[href="#/admin"] .navbadge').innerText()) === '2', 'træneren ser tal for nye indmeldelser');
  ok(lastTodo.includes('2 nye børn venter'), 'træneren får en popup om nye børn, når appen åbnes: ' + lastTodo);
  await page.click('#nav a[href="#/admin"]');
  await page.waitForSelector('.kpend');
  await shot('klub-godkend');
  ok(await page.locator('.kpend:has-text("Ida Test") .badge.trial').count(), 'ønske om prøvetræning vises for træneren');
  await page.locator('.kpend:has-text("Ida Test") select').selectOption({ index: 1 });
  await page.locator('.kpend:has-text("Ida Test") [data-kdo$="|aktiv"]').click();
  await wait(500);
  ok((await page.locator('.kpend:has-text("Oscar Test") select option').nth(1).innerText()).includes('fuldt'), 'holdet vises som fuldt (1/1)');
  await page.locator('.kpend:has-text("Oscar Test") select').selectOption({ index: 1 });
  await page.locator('.kpend:has-text("Oscar Test") [data-kdo$="|venteliste"]').click();
  await wait(500);
  ok((await page.locator('.waitbox').innerText()).includes('Oscar Test'), 'Oscar står på venteliste');
  await shot('klub-venteliste');
  await page.locator('.waitbox [data-kdo$="|aktiv"]').click();
  await wait(500);
  ok(!(await page.locator('.kpend').count()) && (await text()).includes('u12 (2)'), 'begge børn godkendt og på U12 (Oscar optaget fra ventelisten)');
  ok((await page.evaluate(() => { const ns = window.__mock.db().padel_notifications.filter((n) => n.kind === 'klub_ind'); return ns.length && ns.every((n) => n.done_at); })), 'beskeden om indmeldelsen forsvinder, når børnene er behandlet');
  await page.click('details.plist summary');
  ok(await page.locator('.prow:has-text("Ida Test") .badge.nophoto').count() && await page.locator('.prow:has-text("Oscar Test") .badge.warn').count(), 'træneren ser "ingen billeder" og vigtig info');
  ok((await page.evaluate(() => window.__mock.db().padel_notifications.filter((n) => n.user_id === 'u-nyforaelder' && n.kind === 'klub_optaget').length)) === 2, 'forælderen får besked om optagelse');

  // Forælderen giver afbud og melder kontingent betalt
  await freshLogin('nyforaelder@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  await page.goto('http://localhost:8765/#/traening');
  await page.waitForSelector('.tr');
  ok((await page.locator('.tr').first().locator('.krow').count()) === 2, 'træningen viser begge børn');
  ok(/Kommer Ida/.test(lastAsk) && /Kommer Oscar/.test(lastAsk), 'popup spørger om næste træning for begge egne børn: ' + lastAsk.replace(/\n/g, ' '));
  ok((await page.locator('.tr').first().locator('small.unans').count()) === 2 && !(await page.locator('.tr').first().locator('.btn.on').count()), 'ingen er meldt til automatisk: begge står som Ikke svaret');
  await page.locator('.tr').first().locator('.krow').first().locator('[data-abs$="|kommer"]').click();
  await wait(500);
  ok(await page.locator('.tr').first().locator('.krow').first().locator('.btn.on.yes').count() && !(await page.locator('.tr').first().locator('.krow').first().locator('small.unans').count()), 'forælderen melder barnet til med Kommer');
  await page.locator('.tr').nth(1).locator('.krow').first().locator('[data-abs$="|afbud"]').click();
  await wait(500);
  ok(await page.locator('.tr').nth(1).locator('.krow').first().locator('.btn.on.no').count(), 'afbud givet med ét tryk');
  ok((await page.locator('.feecard').innerText()).includes('1.200 kr.'), 'kontingent for to børn vises');
  ok((await page.locator('.card.trainers').innerText()).includes('Brian'), 'forælderen ser holdets træner');
  ok((await page.locator('.card.mykids .krow').count()) === 2 && await page.locator('.card.mykids a[href^="#/klub-ind/"]').count(), 'kortet "Mine børn" på Træning med knap til at melde flere ind');
  await page.click('.card.mykids a[href="#/boern"]');
  await page.waitForSelector('.kidcard');
  ok((await page.locator('.kidcard').count()) === 2 && await page.locator('.kidcard details.kidedit').count() === 2, 'siden Mine børn med Ret oplysninger');
  await shot('klub-mine-boern');
  await page.goto('http://localhost:8765/#/traening');
  await page.waitForSelector('.tr');
  // Sent afbud (dagens træning er inden for fristen på 48 timer): træneren får besked
  await page.locator('.tr').first().locator('.krow').last().locator('[data-abs$="|afbud"]').click();
  await wait(500);
  ok((await page.evaluate(() => { const db = window.__mock.db(); const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen' }).format(new Date());
    return db.padel_club_absence.some((a) => a.day === today && a.late) && db.padel_notifications.some((n) => n.kind === 'klub_sent_afbud' && n.user_id === 'u-brian'); })), 'træneren får besked om sent afbud (inden for 48 timer)');
  await page.locator('.tr').first().locator('.krow').last().locator('[data-abs$="|kommer"]').click();
  await wait(500);
  // Kalender
  await page.click('#calLink');
  await page.waitForSelector('#calModal');
  ok((await page.locator('#calModal a[href^="webcal://"]').count()) === 1 && (await page.locator('#calModal a[href*="calendar.google.com"]').count()) === 1, 'kalender-abonnement med link til iPhone og Google');
  await shot('klub-kalender');
  await page.click('#calClose');
  await shot('klub-traening-foraelder');
  await noOverflow('klub træning forælder');
  await page.click('.feecard [data-only]');
  await wait(500);
  ok((await page.locator('.feecard').innerText()).toLowerCase().includes('venter på'), 'betaling afventer træneren');

  // Træneren: ser afbud, krydser fremmøde af, aflyser, skriver opslag, bekræfter betaling
  await freshLogin('brian@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  await page.goto('http://localhost:8765/#/traening');
  await page.waitForSelector('.tr.trainer');
  ok((await page.locator('.tr.trainer').nth(1).locator('.trcount').innerText()).includes('1 afbud'), 'træneren ser antal afbud');
  await page.locator('.tr.trainer').first().locator('summary').click();
  await page.locator('.tr.trainer').first().locator('[data-att]').first().check();
  await wait(400);
  ok((await page.evaluate(() => window.__mock.db().padel_club_attendance.filter((a) => a.present).length)) === 1, 'fremmøde krydset af');
  await page.goto('http://localhost:8765/#/admin');
  await page.waitForSelector('[data-tab="fremmode"]');
  await page.click('[data-tab="fremmode"]');
  await page.waitForSelector('.pct');
  ok((await page.locator('.krow:has-text("Ida Test") .pct').innerText()) === '100%' && (await page.locator('.krow:has-text("Oscar Test") .pct').innerText()) === '0%', 'fremmødestatistik pr. barn');
  await shot('klub-fremmode');
  await noOverflow('klub fremmøde');
  await page.goto('http://localhost:8765/#/traening');
  await page.waitForSelector('.tr.trainer');
  await shot('klub-traening-traener');
  await noOverflow('klub træning træner');
  await page.locator('.tr.trainer').last().locator('summary').click();
  await page.locator('.tr.trainer').last().locator('[data-cancel$="|1"]').click();
  await wait(500);
  ok(await page.locator('.tr.cancelled').count(), 'træning aflyst');
  await page.click('#nav a[href="#/opslag"]');
  await page.waitForSelector('details.postnew');
  await page.click('details.postnew summary');
  await page.fill('#postForm input[name=title]', 'Velkommen');
  await page.fill('#postForm textarea[name=body]', 'Første træning er i dag. Se mere på https://example.com');
  await page.click('#postForm button.primary');
  await wait(500);
  ok((await page.locator('.post').count()) === 1 && (await page.locator('.post a').count()) === 1, 'opslag sendt (med link)');
  // Arrangement med betaling, maks 1 plads og forældrehjælp
  await page.click('#nav a[href="#/traening"]');
  await page.waitForSelector('#evNew');
  await page.click('#evNew');
  await page.waitForSelector('#evForm');
  const evDate = await page.evaluate(() => { const d = new Date(Date.now() + 10 * 864e5); return d.toISOString().slice(0, 10); });
  await page.fill('#evForm input[name=title]', 'Stævne i Helsinge');
  await page.locator('#evForm select[name=team]').selectOption({ label: 'U12' });
  await page.fill('#evForm input[name=day]', evDate);
  await page.fill('#evForm input[name=st]', '09:00');
  await page.fill('#evForm input[name=en]', '14:00');
  await page.fill('#evForm input[name=place]', 'Padelhuset Helsinge');
  await page.fill('#evForm input[name=price]', '50');
  await page.fill('#evForm input[name=max]', '1');
  await page.fill('#evForm textarea[name=tasks]', 'Kørsel, 1');
  await shot('klub-arrangement-ny');
  await page.click('#evForm button.primary');
  await wait(600);
  ok((await page.locator('details.tr.event').count()) === 1, 'arrangement oprettet');
  ok(!(await page.locator('details.tr.event .byline').count()), 'en træner ser ikke, hvem der har oprettet');
  await page.click('#nav a[href="#/admin"]');
  await page.waitForSelector('.tabbar');
  ok(!(await page.locator('[data-tab="kontingent"]').count()) && !(await page.locator('[data-tab="spillere"]').count()), 'træneren ser ikke kontingent og medlemmer');
  await page.click('[data-tab="boern"]');
  await page.click('details.plist summary');
  await shot('klub-boern');
  await noOverflow('klub børn');

  // Admin gør Pia til kasserer; kassereren bekræfter betaling, sender påmindelse og henter listen
  await freshLogin('jimmy@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  await page.evaluate((g) => localStorage.setItem('fp-group', g), clubId);
  await page.goto('http://localhost:8765/#/admin');
  await page.reload();
  await page.waitForSelector('[data-tab="spillere"]');
  await page.click('[data-tab="spillere"]');
  await page.click('details.staff summary');
  await page.locator('#addStaff select').selectOption({ label: 'Pia Forælder' });
  await page.click('#addStaff button');
  await page.waitForSelector('form[data-staff="u-nyforaelder"]');
  const pf = page.locator('form[data-staff="u-nyforaelder"]');
  await pf.locator('select[name=title]').selectOption('Kasserer');
  ok(await pf.locator('input[name=treasurer]').isChecked() && await pf.locator('input[name=can_post]').isDisabled() && !(await pf.locator('input[name=can_post]').isChecked()), 'kasserer får automatisk kun adgang til kontingent');
  await pf.locator('button.primary').click();
  await wait(500);
  ok((await page.evaluate(() => { const x = window.__mock.db().padel_club_staff.find((y) => y.user_id === 'u-nyforaelder'); return x?.board_title === 'Kasserer' && x.treasurer && !x.can_post && !x.can_events && !x.can_approve; })), 'Pia sat som kasserer i bestyrelsen med ret til kontingent (og kun det)');
  await shot('klub-bestyrelse');
  // Fjern og sæt igen (Pia skal være kasserer i resten af testen)
  await page.locator('form[data-staff="u-nyforaelder"] [data-staffrm]').click();
  await wait(500);
  ok(!(await page.evaluate(() => window.__mock.db().padel_club_staff.find((x) => x.user_id === 'u-nyforaelder')?.board_title)) && !(await page.locator('form[data-staff="u-nyforaelder"]').count()), 'bestyrelsesmedlem kan fjernes');
  await page.locator('#addStaff select').selectOption({ label: 'Pia Forælder' });
  await page.click('#addStaff button');
  await page.waitForSelector('form[data-staff="u-nyforaelder"]');
  await page.locator('form[data-staff="u-nyforaelder"] select[name=title]').selectOption('Kasserer');
  await page.locator('form[data-staff="u-nyforaelder"] button.primary').click();
  await wait(500);
  await noOverflow('klub bestyrelse');
  await freshLogin('nyforaelder@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  ok((await page.locator('#nav').innerText()).includes('Admin'), 'kassereren får Admin i menuen');
  await page.click('#nav a[href="#/admin"]');
  await page.waitForSelector('.ftiles');
  ok((await page.locator('.ftiles').innerText()).includes('2\nafventer'), 'kassereren ser 2 betalinger der afventer');
  await page.locator('.krow:has-text("Ida Test") [data-kfee$="|betalt"]').click();
  await wait(400);
  await page.locator('.krow:has-text("Oscar Test") [data-kfee$="|betalt"]').click();
  await wait(400);
  await page.locator('.krow:has-text("Oscar Test") [data-kfee$="|ubetalt"]').click();
  await wait(400);
  await page.click('#feeRemind');
  await wait(400);
  ok((await page.evaluate(() => window.__mock.db().padel_notifications.filter((n) => n.kind === 'klub_kontingent').length)) === 1, 'påmindelse om kontingent sendt');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#feeCsv')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  ok(csv.includes('Ida Test') && csv.includes('Betalt') && csv.includes('Strandvejen'), 'liste til regnskabet kan hentes');
  await shot('klub-kontingent');
  await noOverflow('klub kontingent');

  // Forælderen ser opslag og info, og deler adgang med den anden forælder
  await freshLogin('nyforaelder@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  await page.goto('http://localhost:8765/#/opslag');
  await page.waitForSelector('.post');
  ok((await text()).includes('husk vand') && (await text()).includes('velkommen'), 'forælder ser info og opslag');
  await page.click('details.people summary');
  ok((await page.locator('details.people').innerText()).includes('Kasserer') && (await page.locator('details.people').innerText()).includes('Brian'), 'bestyrelse og trænere med kontaktinfo under Opslag');
  ok((await page.evaluate(() => window.__mock.db().padel_notifications.filter((n) => n.user_id === 'u-nyforaelder' && n.kind === 'klub_opslag').length)) === 1, 'forælder får notifikation om opslag');
  await page.goto('http://localhost:8765/#/traening');
  await page.waitForSelector('details.tr.event');
  // Arrangement: Oscar tilmeldes, så er det fuldt for Ida; betal og meld sig som hjælper
  const evc = page.locator('details.tr.event');
  await evc.locator('.krow:has-text("Oscar Test") [data-evsign$="|tilmeldt"]').click();
  await wait(500);
  ok(await page.locator('details.tr.event .krow:has-text("Oscar Test") .btn.on.yes').count() && await page.locator('details.tr.event .krow:has-text("Ida Test") [data-evsign$="|tilmeldt"][disabled]').count(), 'tilmeldt, og så er der ikke flere pladser');
  await page.locator('details.tr.event [data-evpay][data-only]').click();
  await wait(500);
  await page.locator('details.tr.event [data-task$="|1"]').click();
  await wait(500);
  ok((await page.evaluate(() => { const db = window.__mock.db(); return db.padel_club_event_signups[0]?.paid === 'afventer' && db.padel_club_task_helpers.some((h) => h.user_id === 'u-nyforaelder' && h.active); })), 'betaling afventer, og forælderen hjælper med kørsel');
  await shot('klub-arrangement');
  await noOverflow('klub arrangement');
  await shot('klub-opslag');
  await page.goto('http://localhost:8765/#/profil');
  await page.waitForSelector('.kidcard');
  ok((await page.locator('.kidcard').count()) === 2 && !(await page.locator('.pts').count()), 'profil viser mine børn (og ingen point)');
  await page.locator('.kidcard:has-text("Ida Test") summary').first().click();
  await page.locator('.kidcard:has-text("Ida Test") details.kidedit summary').click();
  await page.locator('.kidcard:has-text("Ida Test") textarea[name=kinfo]').fill('Er lidt genert i starten');
  await page.locator('.kidcard:has-text("Ida Test") form button.primary').click();
  await wait(500);
  ok((await page.evaluate(() => { const db = window.__mock.db(); const i = db.padel_club_kids.find((k) => k.name === 'Ida Test'); return db.padel_club_kid_info.find((x) => x.kid_id === i.id)?.info; })) === 'Er lidt genert i starten', 'forælderen retter barnets oplysninger');
  await page.goto('http://localhost:8765/#/profil');
  await page.waitForSelector('.kidcard');
  await shot('klub-profil');
  await page.goto('http://localhost:8765/#/privatliv');
  await page.waitForSelector('.privacy');
  ok((await text()).includes('oplysninger om børn'), 'privatlivssiden findes');
  await noOverflow('privatliv');
  const codes = await page.evaluate(() => { const k = window.__mock.db().padel_club_kids.find((x) => x.name === 'Oscar Test'); return [k.guardian_code, k.login_code]; });
  // Anden forælder via link
  await page.evaluate(() => sessionStorage.removeItem('mock-session'));
  await page.goto('about:blank');
  await page.goto(`http://localhost:8765/#/barn/${codes[0]}`);
  await page.waitForSelector('#authForm');
  ok((await text()).includes('forælder til oscar test'), 'link til anden forælder forklarer hvad det er');
  await wait(500);
  if (!(await page.locator('button[type=submit]:has-text("Log ind")').count())) await page.click('#switch');
  await page.waitForSelector('button[type=submit]:has-text("Log ind")');
  await page.fill('input[name=email]', 'nyfar@test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('#pf');
  await page.fill('#pf input[name=name]', 'Per Far');
  await page.fill('#pf input[name=phone]', '33445566');
  await page.click('#pf label:has-text("Mand")');
  await page.click('#pf button.primary');
  await pastGates();
  await page.waitForSelector('.tr');
  ok((await text()).includes('oscar test') && !(await text()).includes('ida test'), 'anden forælder ser kun sit barn');
  // Barnets eget login
  await page.evaluate(() => sessionStorage.removeItem('mock-session'));
  await page.goto('about:blank');
  await page.goto(`http://localhost:8765/#/barn/${codes[1]}`);
  await page.waitForSelector('#authForm');
  ok((await text()).includes('hej oscar'), 'barnets link hilser på barnet');
  await wait(500);
  if (!(await page.locator('button[type=submit]:has-text("Log ind")').count())) await page.click('#switch');
  await page.waitForSelector('button[type=submit]:has-text("Log ind")');
  await page.fill('input[name=email]', 'nyoscar@test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('#pf');
  ok(await page.locator('#pf label:has-text("Højre")').count(), 'barnet vælger selv side på banen');
  await page.fill('#pf input[name=name]', 'Oscar Test');
  await page.fill('#pf input[name=phone]', '44556677');
  await page.click('#pf label:has-text("Mand")');
  await page.click('#pf label:has-text("Højre")');
  await page.click('#pf button.primary');
  await pastGates();
  await page.waitForSelector('.tr');
  ok((await page.locator('.krow').first().innerText()).includes('(dig)'), 'barnet ser sine egne træninger');
  await shot('klub-barn');
  await noOverflow('klub barn');

  // Beskeder: barnet skriver til trænerne, og begge forældre er automatisk med
  await page.goto('http://localhost:8765/#/ny-besked');
  await page.waitForSelector('#cmp');
  ok((await text()).includes('dine forældre kan også læse'), 'barnet får at vide, at forældrene kan læse med');
  ok(await page.locator('#cmp label:has-text("Bestyrelsen")').count() && await page.locator('#cmp label:has-text("Kassereren")').count(), 'man kan skrive til trænere, bestyrelse og kasserer');
  await page.fill('#cmp input[name=subject]', 'Ny bat');
  await page.fill('#cmp textarea[name=body]', 'Hvilken bat skal jeg købe?');
  await shot('besked-ny');
  await noOverflow('ny besked');
  await page.click('#cmp button.primary');
  await page.waitForSelector('.thread .msg');
  ok((await page.locator('.thpeople').textContent()).includes('Brian'), 'træneren er med i samtalen');
  ok((await page.evaluate(() => { const ns = window.__mock.db().padel_notifications.filter((n) => n.kind === 'besked'); return ['u-nyforaelder', 'u-nyfar', 'u-brian'].every((u) => ns.some((n) => n.user_id === u)) && !ns.some((n) => n.user_id === 'u-nyoscar'); })), 'begge forældre og træneren får besked, ikke afsenderen');
  await shot('besked-samtale');
  await noOverflow('samtale');

  // Træneren svarer, markerer løst og skriver selv til forældrene om Ida
  await freshLogin('brian@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  await page.goto('http://localhost:8765/#/profil');
  await page.waitForSelector('#msgRow .badge.new');
  ok((await page.locator('#msgRow').innerText()).includes('Samtaler med medlemmer'), 'træneren har Samtaler med medlemmer i Profil med mærke');
  await page.click('#msgRow');
  await page.waitForSelector('.throw.unread');
  await page.click('.throw');
  await page.waitForSelector('#rep');
  await page.fill('#rep textarea', 'Kom forbi til træning, så finder vi en');
  await page.click('#rep button.primary');
  await wait(500);
  ok((await page.locator('.msg').count()) === 2 && (await page.locator('.msg.mine').count()) === 1, 'træneren har svaret');
  // Billede i samtalen: kun billede, ingen tekst
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 120, height: 90 } });
  await page.setInputFiles('#rep input[name=img]', { name: 'bat.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('#rep .imgprev:not([hidden]) img');
  await shot('besked-billede-valgt');
  await noOverflow('billede valgt');
  await page.click('#rep button.primary');
  await page.waitForFunction(() => document.querySelectorAll('.msg').length === 3, null, { timeout: 5000 });
  await page.waitForFunction(() => document.querySelector('.msg:last-child img.msgimg')?.src?.startsWith('blob:'));
  ok(await page.evaluate(() => { const m = window.__mock.db().padel_thread_msgs.at(-1); return m.image?.startsWith('u-brian/') && m.body === ''; }), 'træneren kan sende et billede i samtalen');
  ok(await page.evaluate(() => window.__mock.db().padel_notifications.some((n) => n.body === '📷 Billede')), 'notifikationen siger Billede');
  await page.click('.msg:last-child img.msgimg');
  await page.waitForSelector('.imgview img');
  await shot('besked-billede-stort');
  await page.click('.imgview');
  ok(!(await page.locator('.imgview').count()), 'billedet kan åbnes stort og lukkes igen');
  await page.click('#rep button.primary');
  await wait(300);
  ok((await page.locator('.msg').count()) === 3, 'tomt svar uden billede sendes ikke');
  await page.click('#solve');
  await wait(500);
  ok((await text()).includes('markeret som løst'), 'samtalen er markeret som løst');
  const idaId = await page.evaluate(() => window.__mock.db().padel_club_kids.find((k) => k.name === 'Ida Test').id);
  await page.goto('about:blank');
  await page.goto(`http://localhost:8765/#/ny-besked?barn=${idaId}`);
  await page.waitForSelector('#cmp');
  ok(await page.locator('#cmp input[name=mode][value=foraeldre]').isChecked(), 'træneren skriver til forældrene om et barn');
  await page.fill('#cmp textarea[name=body]', 'Ida var super i dag');
  await page.click('#cmp button.primary');
  await page.waitForSelector('.thread .msg');
  ok((await page.evaluate(() => { const t = window.__mock.db().padel_threads.at(-1); const ns = window.__mock.db().padel_notifications.filter((n) => n.url === '/#/samtale/' + t.id); return t.from_staff && ns.some((n) => n.user_id === 'u-nyforaelder') && !ns.some((n) => n.user_id === 'u-nyfar'); })), 'beskeden om Ida går til Idas forælder');

  // "Se som" en spiller uden børn: linjen om klubben vises som for spilleren selv
  await freshLogin('jimmy@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  await page.evaluate(() => { sessionStorage.setItem('fp-viewas', 'u-6'); localStorage.setItem('fp-group', 'g-fre'); });
  await page.goto('http://localhost:8765/#/profil');
  await page.reload();
  await page.waitForSelector('#discRow');
  ok((await page.locator('#discRow').innerText()).includes('Meld et barn ind'), 'Se som: linjen vises som for spilleren');
  await page.evaluate(() => sessionStorage.removeItem('fp-viewas'));

  // En træner uden børn bruger klubbens link og beder om adgang; admin godkender som træner
  const klubId = await page.evaluate(() => window.__mock.db().padel_groups.find((x) => x.kind === 'klub').id);
  await page.evaluate(() => sessionStorage.removeItem('mock-session'));
  await page.goto('about:blank');
  await page.goto(`http://localhost:8765/#/velkommen/${klubId}`);
  await page.waitForSelector('#authForm');
  await wait(500);
  if (!(await page.locator('button[type=submit]:has-text("Log ind")').count())) await page.click('#switch');
  await page.fill('input[name=email]', 'nytraener@test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('#pf');
  await page.fill('#pf input[name=name]', 'Dan Træner');
  await page.fill('#pf input[name=phone]', '55667788');
  await page.click('#pf label:has-text("Mand")');
  await page.click('#pf button.primary');
  await pastGates();
  await page.waitForSelector('#adultJoin');
  await shot('klub-adgang-uden-barn');
  await noOverflow('adgang uden barn');
  await page.click('#adultJoin');
  await wait(600);
  ok((await page.evaluate(() => window.__mock.db().padel_group_members.find((m) => m.player_id === 'u-nytraener')?.status)) === 'afventer', 'træneren har bedt om adgang til klubben');
  await freshLogin('jimmy@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  await page.evaluate((g) => localStorage.setItem('fp-group', g), klubId);
  await page.goto('http://localhost:8765/#/admin');
  await page.reload();
  await page.waitForSelector('.tabbar');
  await page.click('[data-tab="spillere"]');
  await page.waitForSelector('.pendingbox');
  ok((await page.locator('.pendingbox').innerText()).includes('Dan Træner'), 'admin ser træneren under Venter på godkendelse');
  await shot('klub-godkend-traener');
  await page.click('.pendingbox [data-arole="superbruger"]');
  await wait(600);
  ok((await page.evaluate(() => window.__mock.db().padel_group_members.find((m) => m.player_id === 'u-nytraener'))).role === 'superbruger', 'godkendt som træner');

  // Admin ser, hvem der har oprettet arrangementet
  await freshLogin('jimmy@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  await page.evaluate(() => localStorage.setItem('fp-group', window.__mock.db().padel_groups.find((x) => x.kind === 'klub').id));
  await page.goto('http://localhost:8765/#/traening');
  await page.reload();
  await page.waitForSelector('details.tr.event');
  ok((await page.locator('details.tr.event .byline').textContent()).includes('Oprettet af Brian'), 'admin ser, at Brian oprettede arrangementet');

  // En træner opretter selv et hold og bliver træner på det
  await freshLogin('brian@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  await page.evaluate((g) => localStorage.setItem('fp-group', g), klubId);
  await page.goto('http://localhost:8765/#/admin');
  await page.reload();
  await page.waitForSelector('.tabbar');
  await page.click('[data-tab="hold"]');
  await page.waitForSelector('#newTeam');
  await page.fill('#newTeam input[name=name]', 'Begyndere');
  await page.click('#newTeam button');
  await page.waitForSelector('details.teamcard[open]');
  ok((await page.evaluate(() => { const db = window.__mock.db(); const t = db.padel_club_teams.find((x) => x.name === 'Begyndere'); return t && db.padel_club_team_trainers.some((x) => x.team_id === t.id && x.user_id === 'u-brian' && x.active); })), 'træneren opretter et hold og bliver selv træner på det');
  await noOverflow('træner opretter hold');

  // Ny træning med tale (fritekst): appen udfylder formularen
  await page.fill('#qsText', 'Begyndere tirsdag fra 16 til 17.30 de næste 6 tirsdage');
  await page.click('#qsAsk button.primary');
  await page.waitForSelector('#qsForm:not([hidden])');
  ok((await page.inputValue('#qsForm input[name=st]')) === '16:00' && (await page.inputValue('#qsForm input[name=en]')) === '17:30' && (await page.inputValue('#qsForm select[name=wd]')) === '2', 'tale/tekst udfylder dag og tid');
  ok((await page.locator('#qsSum').innerText()).includes('6 gange'), 'opsummering: 6 gange');
  await shot('traening-med-tale');
  await noOverflow('træning med tale');
  await page.click('#qsForm button.primary');
  await wait(600);
  ok((await page.evaluate(() => { const db = window.__mock.db(); const t = db.padel_club_teams.find((x) => x.name === 'Begyndere'); const s = db.padel_club_sessions.find((x) => x.team_id === t.id); return s && s.weekday === 2 && s.valid_from && s.valid_to && (Date.parse(s.valid_to) - Date.parse(s.valid_from)) / 864e5 === 35; })), 'træningen er oprettet med 6 tirsdage');

  // Popup til træneren: et optaget barn uden hold, "Tag stilling nu" fører til Børn
  await page.evaluate((g) => { const db = window.__mock.db(); db.padel_club_kids.push({ id: 'k-noteam', group_id: g, name: 'Uden Hold', status: 'aktiv', team_id: null, waitlist: false, trial: false, created_at: '2026-10-20T10:00:00Z' }); window.__mock.save(); }, klubId);
  await freshLogin('brian@test');
  await page.waitForSelector('#todoModal');
  ok((await page.locator('#todoModal').innerText()).includes('mangler et hold'), 'popup: barn mangler et hold');
  await shot('popup-traener');
  await page.click('#todoModal [data-todo]');
  await page.waitForSelector('.plist.noteam');
  ok((await page.locator('.plist.noteam').innerText()).includes('Uden Hold'), '"Tag stilling nu" viser børn uden hold');
  await freshLogin('jimmy@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  ok(!lastTodo, 'admin får ikke popuppen, kun trænerne');
  await page.evaluate(() => { const db = window.__mock.db(); db.padel_club_kids.find((k) => k.id === 'k-noteam').status = 'udmeldt'; window.__mock.save(); });

  // Popup om næste træning: den anden forælder svarer Kommer for sit barn direkte i popuppen
  await page.evaluate(() => { const db = window.__mock.db(); const o = db.padel_club_kids.find((k) => k.name === 'Oscar Test'); db.padel_club_absence = db.padel_club_absence.filter((a) => a.kid_id !== o.id); window.__mock.save(); });
  await freshLogin('nyfar@test');
  await page.waitForSelector('#askModal');
  ok(!(await page.locator('#askModal').innerText()).includes('Ida'), 'popuppen viser kun ens egne børn');
  await shot('popup-naeste-traening');
  await noOverflow('popup næste træning');
  await page.locator('#askModal [data-ask$="|kommer"]').first().click();
  await wait(1500);
  ok((await page.evaluate(() => window.__mock.db().padel_club_absence.some((a) => a.status === 'kommer' && a.set_by === 'u-nyfar'))) && !(await page.locator('#askModal').count()), 'svar i popuppen gemmes, og popuppen lukker');

  // Fredagspadel: popup om ledige pladser de sidste 3 dage før, kun hvis man ikke er tilmeldt
  await page.removeLocatorHandler(spotHandler);
  const spotEv = await page.evaluate(() => { const db = window.__mock.db(); const id = 'ev-spot';
    db.padel_events.push({ id, group_id: 'g-fre', center_id: 'c-gil', starts_at: new Date(Date.now() + 864e5).toISOString(), status: 'planlagt', format: 'rotation', team_mode: 'aaben', court_ids: ['gil-0', 'gil-1'], round_minutes: 30, duration_minutes: 120, current_round: 0, ranked: true, created_at: new Date().toISOString() });
    db.padel_signups.push({ event_id: id, player_id: 'u-1', created_at: new Date().toISOString() }); window.__mock.save(); return id; });
  await freshLogin('test7@fredagspadel.test');
  await page.waitForSelector('#spotModal');
  ok((await page.locator('#spotModal').innerText()).includes('7 ledige pladser'), 'popup: 7 ledige pladser');
  await shot('popup-ledige-pladser');
  await noOverflow('popup ledige pladser');
  await page.click('#spotYes');
  await wait(800);
  ok((await page.evaluate((id) => window.__mock.db().padel_signups.some((x) => x.event_id === id && x.player_id === 'u-7'), spotEv)), 'Meld mig til tilmelder spilleren');
  await freshLogin('test8@fredagspadel.test');
  await page.waitForSelector('#spotModal');
  await page.click('#spotNo');
  await page.evaluate(() => sessionStorage.removeItem('mock-session'));
  await freshLogin('test8@fredagspadel.test');
  await page.waitForSelector('#nav a');
  await wait(1200);
  ok(!(await page.locator('#spotModal').count()), '"Ikke denne gang": spørger ikke igen om samme dag');
  await page.addLocatorHandler(spotHandler, async () => { await page.click('#spotNo'); });

  // Klub for børn og voksne: en voksen melder sig selv ind, træneren godkender, og den voksne giver selv svar
  await page.evaluate((g) => { const db = window.__mock.db(); db.padel_groups.find((x) => x.id === g).club_audience = 'begge'; window.__mock.save(); }, klubId);
  await page.evaluate(() => sessionStorage.removeItem('mock-session'));
  await page.goto('about:blank');
  await page.goto(`http://localhost:8765/#/velkommen/${klubId}`);
  await page.waitForSelector('#authForm');
  ok((await text()).includes('dig selv eller dit barn'), 'login nævner, at man kan melde sig selv eller sit barn ind');
  await page.fill('input[name=email]', 'nyvoksen@test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('text=Tjek din mail');
  await page.goto('http://localhost:8765/');
  await page.waitForSelector('#authForm');
  if (!(await page.locator('button[type=submit]:has-text("Log ind")').count())) await page.click('#switch');
  await page.fill('input[name=email]', 'nyvoksen@test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('#pf');
  await page.fill('#pf input[name=name]', 'Vera Voksen');
  await page.fill('#pf input[name=phone]', '22113344');
  await page.click('#pf label:has-text("Kvinde")');
  await page.click('#pf button.primary');
  await pastGates();
  await page.waitForSelector('#joinForm');
  ok(await page.locator('#joinForm input[name=jmode][value=self]').isChecked(), 'indmeldelsen starter med "Mig selv"');
  ok((await page.locator('#joinForm input[name=kname]').inputValue()) === 'Vera Voksen', 'navnet kommer fra profilen');
  const vsf = page.locator('.selff');
  await vsf.locator('input[name=kbirth]').fill('1985-03-02');
  await vsf.locator('label:has-text("Kvinde")').click();
  await vsf.locator('label:has-text("Ja")').click();
  await vsf.locator('textarea[name=kinfo]').fill('Dårligt knæ');
  if (await vsf.locator('input[name=kaddr]').count()) await vsf.locator('input[name=kaddr]').fill('Strandvejen 2, 3250 Gilleleje');
  await shot('klub-voksen-indmeld');
  await noOverflow('voksen indmeldelse');
  await page.click('#joinForm label:has-text("Et barn")');
  await page.waitForSelector('#moreKid');
  ok(await page.locator('#joinForm input[name=kname]').inputValue() === '', 'skift til "Et barn" viser barnets felter');
  await page.click('#joinForm label:has-text("Mig selv")');
  await page.waitForSelector('.selff');
  const sf2 = page.locator('.selff');
  await sf2.locator('input[name=kbirth]').fill('1985-03-02');
  await sf2.locator('label:has-text("Kvinde")').click();
  await sf2.locator('label:has-text("Ja")').click();
  if (await sf2.locator('input[name=kaddr]').count()) await sf2.locator('input[name=kaddr]').fill('Strandvejen 2, 3250 Gilleleje');
  await page.click('#joinForm button.primary');
  await wait(700);
  ok(await page.evaluate(() => { const k = window.__mock.db().padel_club_kids.find((x) => x.player_id === 'u-nyvoksen'); return k && k.adult && k.gender === 'pige' && k.status === 'ansoegt' && window.__mock.db().padel_club_guardians.some((x) => x.kid_id === k.id && x.user_id === 'u-nyvoksen'); }), 'den voksne er meldt ind som sit eget medlem');
  await freshLogin('brian@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  ok(lastTodo.includes('ny') || lastTodo === '' , 'træneren åbner appen');
  await page.goto('http://localhost:8765/#/admin');
  await page.waitForSelector('.kpend:has-text("Vera Voksen")');
  ok((await page.locator('[data-tab="boern"]').innerText()).includes('Spillere'), 'fanen hedder Spillere i en klub med voksne');
  const vp = await page.locator('.kpend:has-text("Vera Voksen")').innerText();
  ok(vp.includes('Voksen') && vp.includes('Har meldt sig selv ind') && vp.includes('Kvinde'), 'træneren ser, at det er en voksen: ' + vp.replace(/\n/g, ' '));
  await shot('klub-voksen-godkend');
  await page.locator('.kpend:has-text("Vera Voksen") select').selectOption({ index: 1 });
  await page.locator('.kpend:has-text("Vera Voksen") [data-kdo$="|aktiv"]').click();
  await wait(600);
  ok(await page.evaluate(() => window.__mock.db().padel_club_kids.find((x) => x.player_id === 'u-nyvoksen').status === 'aktiv'), 'den voksne er godkendt');
  await freshLogin('nyvoksen@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  await page.goto('http://localhost:8765/#/traening');
  await page.waitForSelector('.card.mykids');
  ok((await page.locator('.card.mykids').innerText()).includes('Mit medlemskab'), 'den voksne ser "Mit medlemskab"');
  if (await page.locator('.tr .krow').count()) {
    ok((await page.locator('.tr .krow').first().innerText()).includes('(dig)'), 'den voksne ser sine egne træninger');
    await page.locator('.tr .krow').first().locator('[data-abs$="|kommer"]').click();
    await wait(500);
    ok(await page.evaluate(() => window.__mock.db().padel_club_absence.some((a) => a.status === 'kommer' && a.set_by === 'u-nyvoksen')), 'den voksne svarer selv Kommer');
  }
  await shot('klub-voksen-traening');
  await noOverflow('voksen træning');
  await page.goto('http://localhost:8765/#/ny-besked');
  await page.waitForSelector('#cmp');
  ok(!(await text()).includes('dine forældre'), 'en voksen får ikke at vide, at forældrene læser med');
  await page.goto('http://localhost:8765/#/boern');
  await page.waitForSelector('.kidcard');
  ok((await text()).includes('ret dine oplysninger') && !(await page.locator('[data-kidparent]').count()), 'den voksne kan rette sine egne oplysninger (uden "Forælder 2")');
  await page.evaluate((g) => { const db = window.__mock.db(); db.padel_groups.find((x) => x.id === g).club_audience = 'boern'; window.__mock.save(); }, klubId);

  // Spørgsmål og svar passer til der, hvor man er
  await freshLogin('nyforaelder@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  await page.goto('http://localhost:8765/#/faq');
  await page.waitForSelector('#faqList h3');
  { const cats = await page.locator('#faqList h3').allInnerTexts(); ok(cats.some((c) => /juniorklub/i.test(c)) && cats.some((c) => /padelregler/i.test(c)) && !cats.some((c) => /bødekasse|formater/i.test(c)), 'forælder i klubben: klub og fælles, ikke bøder og formater: ' + cats.join(', ')); }
  await freshLogin('test5@fredagspadel.test');
  await page.waitForSelector('#nav a');
  await pastGates();
  await page.goto('http://localhost:8765/#/faq');
  await page.waitForSelector('#faqList h3');
  { const cats = await page.locator('#faqList h3').allInnerTexts(); ok(cats.some((c) => /bødekasse/i.test(c)) && !cats.some((c) => /juniorklub/i.test(c)), 'spiller i gruppe: bøder, ikke juniorklub: ' + cats.join(', ')); }

  // Opret konto med en mail, der allerede findes (fx fra TaskHero): skift til Log ind
  await page.evaluate(() => sessionStorage.removeItem('mock-session'));
  await page.goto('about:blank');
  await page.goto('http://localhost:8765/');
  await page.waitForSelector('#authForm');
  if (!(await page.locator('button[type=submit]:has-text("Opret konto")').count())) await page.click('#switch');
  await page.fill('input[name=email]', 'test5@fredagspadel.test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await wait(500);
  ok((await page.locator('button[type=submit]').innerText()) === 'Log ind' && (await page.inputValue('input[name=email]')) === 'test5@fredagspadel.test', 'eksisterende mail: skifter til Log ind med mailen udfyldt');

  // Fredagspadel: en spiller skriver til admin
  await freshLogin('test5@fredagspadel.test');
  await page.waitForSelector('#nav a');
  await pastGates();
  await page.evaluate(() => localStorage.setItem('fp-group', 'g-fre'));
  await page.goto('http://localhost:8765/#/profil');
  await page.reload();
  await page.waitForSelector('#msgRow');
  ok((await page.locator('#msgRow').innerText()).includes('Skriv til admin'), 'i Fredagspadel hedder det Skriv til admin');
  await page.click('#msgRow');
  await page.click('#newMsg');
  await page.waitForSelector('#cmp');
  ok(!(await page.locator('#cmp input[name=role][type=radio]').count()), 'i en gruppe skal man ikke vælge modtager');
  await page.fill('#cmp textarea[name=body]', 'Kan vi spille kl. 18 i stedet?');
  await page.click('#cmp button.primary');
  await page.waitForSelector('.thread .msg');
  ok((await page.evaluate(() => window.__mock.db().padel_notifications.some((n) => n.kind === 'besked' && n.user_id === 'u-admin'))), 'admin får beskeden');

  // Visning: superadmin kan se appen som almindelig bruger og skifte tilbage
  await freshLogin('jimmy@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  await page.evaluate(() => localStorage.setItem('fp-group', 'g-fre'));
  await page.goto('http://localhost:8765/#/profil');
  await page.reload();
  await page.waitForSelector('.modecard');
  ok((await page.locator('.modecard .seg label').count()) === 3, 'superadmin kan vælge Superadmin, Mine roller eller Bruger');
  await page.locator('.modecard .seg label:has-text("Bruger")').click();
  await page.waitForSelector('#viewAsBar.modebar');
  await wait(400);
  ok(!(await page.locator('#nav').innerText()).includes('Admin'), 'som almindelig bruger: ingen Admin i menuen');
  await shot('visning-bruger');
  await noOverflow('visning bruger');
  await page.locator('.modecard .seg label:has-text("Mine roller")').click();
  await wait(600);
  ok((await page.locator('#nav').innerText()).includes('Admin') && (await page.locator('#viewAsBar.modebar').count()), 'mine roller: admin i Fredagspadel, hvor jeg er admin');
  await page.click('#viewAsBar #stopViewAs');
  await wait(600);
  ok(!(await page.locator('#viewAsBar').count()), 'tilbage til superadmin');

  ok(!errors.length, 'ingen JavaScript-fejl: ' + errors.join(' | '));
  console.log('\nALLE TEST OK');
} catch (e) {
  console.error(e.message, '\n', errors.join('\n'));
  await shot('fejl');
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
