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

try {
  await page.goto('http://localhost:8765/');
  await page.waitForSelector('#authForm');
  await shot('login');
  await page.fill('input[name=email]', 'jimmy@test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('text=Opret fredag');
  ok((await text()).includes('ingen kommende fredage'), 'tom oversigt viser opret-knap');
  await shot('fredage-tom');

  // Opret 4 fredage med ét sæt pr. runde
  await page.click('a:has-text("Opret fredag")');
  await page.waitForSelector('#nf');
  await page.click('label:has-text("Ét sæt pr. runde")');
  ok((await page.inputValue('input[name=minutes]')) === '20', 'ét sæt sætter 20 min pr. runde');
  ok((await page.locator('#roundsHint').innerText()).includes('6 runder'), '2 timer giver 6 runder');
  await shot('ny-fredag');
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
    const opt = await page.locator('#addPlayer option').nth(1).getAttribute('value');
    await page.selectOption('#addPlayer', opt);
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
  ok((await text()).includes('1 kampe') || (await text()).includes('kampe'), 'ranglisten viser kampe');
  await shot('rangliste');

  // FAQ-søgning
  await page.goto('http://localhost:8765/#/faq');
  await page.fill('#faqSearch', 'venteliste');
  await wait(200);
  ok((await page.locator('details.faq').count()) >= 1, 'FAQ finder venteliste');

  // Admin: se som
  await page.click('#nav a:has-text("Admin")');
  await page.waitForSelector('.prow');
  await page.locator('.prow summary').nth(1).click();
  await shot('admin');
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
