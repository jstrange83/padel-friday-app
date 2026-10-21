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
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('dialog', (d) => d.accept());
await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(root, 'tests', 'mock-supabase.js'), 'utf8') }));

let step = 0;
const shot = async (name) => page.screenshot({ path: path.join(shots, `${String(++step).padStart(2, '0')}-${name}.png`), fullPage: true });
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
  ok((await page.locator('details.rounds summary').first().innerText()).toLowerCase().includes('dagsplan (6)'), 'dagsplan med 6 runder');
  ok((await page.locator('.mine-card').innerText()).match(/Runde 1|pause/i), 'Din aften viser første runde');
  await shot('dagsplan');
  await noOverflow('spilledag');

  // Start runde 1
  await page.click('#nextRound');
  await wait(500);
  ok((await text()).includes('i gang'), 'runde 1 i gang');
  await shot('runde1');

  // Indtast resultat via Din aften (admin godkender direkte)
  const mine = await page.locator('.mine-card').innerText();
  if (mine.includes('Du spiller')) {
    await page.click('.mine-card a:has-text("Indtast resultat")');
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

  // Start resten og afslut
  for (let r = 2; r <= 6; r++) { await page.click('#nextRound'); await wait(300); }
  ok((await page.locator('#finish').first().innerText()).includes('Afslut'), 'afslut-knap efter sidste runde');
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
  await page.locator('.prow summary').nth(1).click();
  await shot('admin');
  await noOverflow('admin');
  await page.locator('.prow[open] [data-viewas]').click();
  await page.waitForSelector('#viewAsBar');
  ok(!(await page.locator('#nav').innerText()).includes('Admin'), 'se som skjuler Admin');
  await page.locator('a.ev').first().locator('[data-on], [data-off]').first().click().catch(() => {});
  await wait(300);
  ok((await page.locator('#toast').innerText()).includes('Kun visning'), 'se som blokerer ændringer');
  await shot('se-som');
  await page.click('#stopViewAs');
  await wait(400);
  ok(!(await page.locator('#viewAsBar').count()), 'tilbage til mig');

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
  await page.click('#nav a:has-text("Admin")');
  await page.waitForSelector('[data-approve]');
  await shot('godkend');
  await page.click('[data-approve]');
  await wait(500);
  ok((await text()).includes('2 spillere'), 'Anne godkendt i Lørdagspadel');

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
