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
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/mobilepay:|scheme does not have a registered handler/i.test(m.text())) errors.push('console: ' + m.text()); });
page.on('dialog', (d) => d.accept());
await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(root, 'tests', 'mock-supabase.js'), 'utf8') }));

let step = 0;
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
const noOverflow = async (where) => ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `ingen sidelæns scroll (${where})`);

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
  ok((await text()).includes('venter på godkendelse'), 'profil viser ventende anmodning');
  await page.click('#logout');

  // Brian godkender Anne
  await page.waitForSelector('#authForm');
  await page.fill('input[name=email]', 'brian@test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('#nav a:has-text("Admin")');
  await page.click('#nav a:has-text("Spilledage")');
  await page.waitForSelector('.approvals [data-pok]');
  ok((await page.locator('#nav .navbadge').innerText()) === '1', 'Admin i menuen viser 1, der venter');
  ok((await page.locator('.approvals').innerText()).includes('Test Anne'), 'Spilledage viser, at Anne vil være med');
  await shot('godkend-spilledage');
  await page.click('#nav a:has-text("Admin")');
  await page.waitForSelector('[data-approve]');
  await shot('godkend');
  await page.click('[data-approve]');
  await wait(500);
  ok((await text()).includes('2 spillere'), 'Anne godkendt i Lørdagspadel');
  ok(!(await page.locator('#nav .navbadge').count()), 'tallet forsvinder, når Anne er godkendt');

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
  await page.locator('details.newplayer summary').click();
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
  await page.goto('http://localhost:8765/#/admin');
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
