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
  // Forsiden før login: beskrivelse af appen under log ind
  ok(await page.locator('.landing .laud .lcard').count() === 3 && await page.locator('.landing .lgain .lcard').count() === 3 && await page.locator('.lpush [data-lsignup]').count() === 1 && (await page.locator('.landing').innerText()).includes('Padelcentre'), 'forsiden beskriver appen for grupper, klubber og centre');
  await page.locator('.landing .lfaq summary').first().click();
  await noOverflow('forside');
  await page.screenshot({ path: path.join(shots, 'forside-hel.png'), fullPage: true });
  await page.click('[data-lsignup]');
  await page.waitForSelector('.authtabs button.on:has-text("Opret konto")');
  ok(true, 'Opret konto nederst på forsiden skifter til opret konto');
  await page.locator('.authtabs button:has-text("Log ind")').click();
  await page.waitForSelector('#authForm');
  await page.fill('input[name=email]', 'jimmy@test');
  await page.fill('input[name=password]', 'whatever');
  await page.click('button[type=submit]');
  await page.waitForSelector('text=Opret spilledag');
  ok((await text()).includes('ingen kommende spilledage'), 'tom oversigt viser opret-knap');
  // Mangler efternavn: lille kort øverst; ét navn bliver afvist, og "Senere" skjuler kortet
  await page.waitForSelector('#nameCard');
  await page.click('#nameCard button.primary');
  await wait(300);
  ok(await page.locator('#nameCard').count() === 1, 'kun fornavn bliver ikke gemt');
  await shot('efternavn');
  await page.click('#nameLater');
  ok(!(await page.locator('#nameCard').count()), 'Senere skjuler kortet');
  await shot('fredage-tom');

  // Opret 4 fredage med ét sæt pr. runde
  await page.click('a:has-text("Opret spilledag")');
  await page.waitForSelector('#nf');
  await page.click('label:has-text("Ét sæt pr. runde")');
  ok((await page.inputValue('input[name=minutes]')) === '20', 'ét sæt sætter 20 min pr. runde');
  ok((await page.locator('#roundsHint').innerText()).includes('6 runder'), '2 timer giver 6 runder');
  await shot('ny-fredag');
  await noOverflow('ny spilledag');
  // ＋ Opret en dag mere: dagen lægges ned som et kort, og formularen er klar til næste dag; kortet kan fjernes igen
  await page.click('#addDay');
  await page.waitForSelector('.evq');
  ok((await page.locator('#createBtn').innerText()).includes('Opret 8 spilledage') && (await page.locator('#nfHead').innerText()).includes('Dag 2'), 'en dag mere giver 8 spilledage ved 4 uger, og formularen hedder Dag 2');
  await shot('ny-fredag-flere-dage');
  await noOverflow('flere dage');
  await page.click('[data-qdel="0"]');
  ok(!(await page.locator('.evq').count()) && (await page.locator('#createBtn').innerText()).includes('Opret 4 spilledage'), 'den ekstra dag kan fjernes igen');
  await page.click('#createBtn');
  await page.waitForSelector('a.ev');
  ok((await page.locator('a.ev').count()) === 4, '4 fredage oprettet');
  await shot('fredage-4');

  // Hurtig tilmelding fra oversigten
  await page.locator('a.ev').first().locator('[data-on]').click();
  await wait();
  ok((await page.locator('a.ev').first().innerText()).includes('Du er med'), 'tilmeldt fra oversigten');

  // Aflys den sidste spilledag: den bliver liggende som "Aflyst", kan ikke tilmeldes, og kan fortrydes
  await page.locator('a.ev').last().locator('[data-on]').click();
  await wait();
  await page.locator('a.ev').last().click();
  await page.waitForSelector('#cancelEvent');
  await page.click('#cancelEvent');
  await page.waitForSelector('.card.cancelled');
  ok((await page.locator('.evsub').innerText()).includes('Aflyst') && !(await page.locator('#signon, #signoff').count()), 'aflyst dag vises som aflyst uden tilmelding');
  await page.goto('http://localhost:8765/#/fredage');
  await page.waitForSelector('a.ev');
  ok((await page.locator('a.ev').last().innerText()).includes('Aflyst') && !(await page.locator('a.ev').last().locator('[data-on], [data-off]').count()), 'aflyst dag står i oversigten uden knapper');
  await shot('aflyst');
  await page.locator('a.ev').last().click();
  await page.waitForSelector('#uncancelEvent');
  await page.click('#uncancelEvent');
  await page.waitForSelector('#cancelEvent');
  ok(!(await page.locator('.card.cancelled').count()), 'aflysningen kan fortrydes');
  await page.goto('http://localhost:8765/#/fredage');
  await page.waitForSelector('a.ev');

  // Åbn fredagen og tilmeld 8 testspillere (9 i alt = 2 baner + 1 venteliste)
  await page.locator('a.ev').first().click();
  await page.waitForSelector('.page.event');
  for (let i = 0; i < 6; i++) {
    await page.fill('#addSearch', 'test');
    await page.locator('#addHits .hit').first().click();
    await wait(250);
  }
  // De sidste to sættes ind som en liste (fx fra MATCHi): én på mail og én på navn, plus én appen ikke kender
  await page.click('details.importbox summary');
  await page.fill('#importText', 'test11@fredagspadel.test\nTest Freja\nUkendt Person');
  await page.click('#importGo');
  await page.waitForSelector('#importRes .warnc');
  { const r = await page.locator('#importRes').innerText(); ok(r.includes('Test Eva') && r.includes('Test Freja') && r.includes('Ukendt Person'), 'indsat liste tilmelder kendte spillere og viser dem, appen ikke kender'); }
  await shot('indsaet-liste');
  ok((await text()).includes('2 baner klar · 1 på venteliste'), 'venteliste ved 9 tilmeldte');
  await shot('tilmeldte');

  // Dagsplan (med banepris og bolde, så prisen pr. spiller kan regnes ud)
  await page.evaluate(() => { const db = window.__mock.db(); db.padel_courts.forEach((c) => (c.price = 500)); db.padel_groups.find((g) => g.id === 'g-fre').ball_fee = 15; db.padel_events.forEach((e) => (e.booked_by = 'u-2')); if (!db.padel_contacts.some((c) => c.player_id === 'u-2')) db.padel_contacts.push({ player_id: 'u-2', phone: '26129208' }); window.__mock.save(); });
  await page.waitForSelector('#makePlan');
  ok(!(await page.locator('.pricecard').count()), 'prisen vises først, når dagsplanen er lavet');
  await page.click('#makePlan');
  await wait(500);
  await page.waitForSelector('.pricecard');
  ok((await page.locator('.pricecard').innerText()).includes('140 kr.') && (await page.locator('.pricecard').innerText()).toLowerCase().includes('bane og bolde'), 'pris pr. spiller: 2 baner á 500 kr. delt på 8 + 15 kr. bolde = 140 kr.');
  ok(await page.locator('#bookedBy').count() === 1, 'admin kan vælge, hvem der har booket banen');
  await page.evaluate(() => { window.__savedSession = sessionStorage.getItem('mock-session'); sessionStorage.setItem('mock-session', JSON.stringify({ user: { id: 'u-1', email: 'test1@fredagspadel.test' } })); });
  await page.reload();
  await page.waitForSelector('.pricecard');
  ok((await page.locator('.pricecard').innerText()).includes('140 kr.') && !(await page.locator('#bookedBy').count()) && (await page.locator('.pricecard [data-mpopen="26129208"]').count()) === 1 && !(await page.locator('.pricecard a[href^="mobilepay://"]').count()), 'en spiller ser prisen og kan betale, men kan ikke vælge, hvem der har booket');
  await page.click('.pricecard [data-ipaid]');
  await wait(600);
  ok(!(await page.locator('.pricecard').count()), 'når spilleren har betalt, forsvinder kortet');
  await page.evaluate(() => sessionStorage.setItem('mock-session', JSON.stringify({ user: { id: 'u-admin', email: 'jimmy@test' } })));
  await page.reload();
  await page.waitForSelector('.pricecard');
  ok(await page.locator('.pricecard [data-paidfor="u-1"].on').count() === 1 && await page.locator('.pricecard details.bookedby').count() === 1, 'admin ser, hvem der har betalt, og "booket af" er foldet sammen, når dagsplanen er lavet');
  ok(await page.locator('.rtabs .rtab').count() === 6, 'dagsplan med 6 runder som faner: ' + await page.locator('.rtabs .rtab').count() + ' ' + await page.evaluate(() => JSON.stringify(window.__mock.db().padel_events.map((e) => [e.format, e.round_minutes, e.duration_minutes]))));
  ok(await page.evaluate(() => window.__mock.db().padel_notifications.filter((n) => n.kind === 'dagsplan').length === 9), 'alle 9 tilmeldte (også den, der laver planen) får besked om dagsplanen');
  const mc1 = await page.locator('.mine-card').innerText();
  ok(/Runde 1/.test(mc1) && (/Dig/.test(mc1) || /pause/i.test(mc1)), 'Din næste kamp viser runde, bane og holdene med "Dig"');
  ok(/pause/i.test(mc1) || /Vinderchance/i.test(mc1), 'Din næste kamp viser vinderchancen');
  ok(await page.locator('.match .wchance').count() > 0, 'kampene viser vinderchance før de er spillet');
  ok(await page.evaluate(() => [...document.querySelectorAll('.match .wclbl')].every((el) => { const n = el.innerText.match(/(\d+)%/g).map((x) => parseInt(x)); return n.length === 2 && n[0] + n[1] === 100; })), 'vinderchancerne giver 100% tilsammen');
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
  // Kampdetaljer på en spillet kamp: banen, point før og efter
  for (const t of await page.locator('.rtab').all()) { if (await page.locator('[data-act="detail"]').count()) break; await t.click(); await wait(200); }
  ok((await page.locator('[data-act="detail"]').count()) > 0, 'spillede kampe har et link til detaljer');
  await page.locator('[data-act="detail"]').first().click();
  await page.waitForSelector('.mdcourt');
  ok((await page.locator('.mdcell').count()) === 4 && /→/.test(await page.locator('.mdpts').innerText()), 'kampdetaljer viser banen og point før → efter');
  await shot('kampdetaljer');
  await noOverflow('kampdetaljer');
  await page.click('#mdClose');
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

  // TV-skærm: admin henter et hemmeligt link; skærmen viser baner, resultater og dagens stilling uden login
  await page.click('#tvEvent');
  await page.waitForSelector('#castModal');
  ok((await page.locator('#castModal').innerText()).includes('Vis på TV') && await page.locator('#castOpen').count() === 1 && !(await page.locator('.qrmodal').count()), 'TV-knappen tilbyder at caste eller åbne TV-skærmen (ingen QR-kode)');
  await shot('tv-cast');
  await page.click('#castClose');
  // Cast-siden, som appen åbner i Chrome: godtager kun links til vores egne TV-sider
  await page.goto('http://localhost:8765/cast.html?u=https%3A%2F%2Fevil.example%2Ftv%2Fx');
  await page.waitForSelector('#box');
  ok((await page.locator('#box').innerText()).includes('Linket mangler'), 'cast-siden afviser fremmede links');
  await page.goto('http://localhost:8765/cast.html?u=' + encodeURIComponent('https://padelklubben.dk/tv/abc'));
  await page.waitForSelector('#box');
  ok(await page.locator('#go').count() === 1 || (await page.locator('#box').innerText()).includes('Chrome'), 'cast-siden viser Cast til TV');
  await page.goto('http://localhost:8765/#/fredage');
  await page.waitForSelector('#nav a');
  const tvTok = await page.evaluate(() => window.__mock.db().padel_tv_links[0].token);
  await page.goto(`http://localhost:8765/tv.html?k=${tvTok}`);
  await page.waitForSelector('aside h2');
  { const t = await page.locator('#app').innerText(); ok(t.includes('Dagens stilling') && /Bane|Court/.test(t) && /\d–\d/.test(t), 'TV-skærmen viser baner, resultater og dagens stilling'); }
  await shot('tv-skaerm');
  await page.goto('http://localhost:8765/#/fredage');
  await page.waitForSelector('#nav a');

  // Rangliste
  { const vw = page.viewportSize().width; const shown = await page.locator("#nav .navfoot").isVisible(); ok(vw >= 900 ? shown : !shown, vw >= 900 ? "navn og gruppe i menuen på computer" : "intet navn i bundmenuen på telefon"); }
  await page.click('#nav a:has-text("Rangliste")');
  await wait(400);
  ok((await text()).includes('kamp'), 'ranglisten viser kampe');
  await shot('rangliste');
  for (const k of ['maaned', 'aeg', 'streak']) { await page.click(`[data-kind="${k}"]`); await wait(300); }
  await page.click('[data-sk="dage"]');
  await wait(400);
  ok(/i træk/.test(await page.locator('[data-sk="dage"]').innerText()) && (await page.locator('.list .row').count()) >= 1, 'streak: flest spilledage i træk (fx fredage)');
  await page.click('[data-sk="sejre"]');
  await wait(300);
  ok((await page.locator('.list .row').count()) >= 1, 'ranglistefaner (måned, æg, streak) virker');
  await page.click('[data-kind="center"]');
  await wait(400);
  ok((await page.locator('.list .row').count()) >= 1 && (await text()).includes('kampe her'), 'center-rangliste viser spillere, der har spillet i centret (kun superadmin)');
  await page.click('[data-cs="pts"]');
  await wait(300);
  await shot('rangliste-center');
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
  await page.click('[data-tab="spillere"]');
  await page.waitForSelector('details.plist'); await page.evaluate(() => document.querySelectorAll('details.plist').forEach((d) => (d.open = true)));
  await page.locator('.prow summary').first().click();
  ok((await page.locator('.prow[open] .contact').innerText()).includes('12 34 56 78'), 'nummer vises for admin med ring/SMS');
  await page.click('#nav a:has-text("Spilledage")');
  await wait(300);
  ok(await page.locator('.phonetip').count() === 0, 'påmindelse væk efter gemt nummer');
  // Min padel: spillerkort med point, placering og tal
  await page.click('#nav a:has-text("Min padel")');
  await page.waitForSelector('.pcard .prank');
  await page.waitForSelector('.mtiles');
  ok((await page.locator('.pcard').innerText()).includes('point') && (await page.locator('.mtiles').innerText()).toLowerCase().includes('kampe'), 'Min padel viser spillerkort, placering og sæsonens tal');
  await page.click('details.badges summary');
  await page.waitForSelector('.bdg');
  ok(await page.locator('.bdg.ok').count() >= 2 && await page.locator('.bdg:not(.ok)').count() >= 1 && (await page.locator('details.badges summary').innerText()).match(/\d+ af \d+/), 'Min padel viser badges: opnåede og låste med hvad der mangler');
  await shot('badges');
  await wait(1100);
  await shot('min-padel');
  await noOverflow('min padel');
  await page.click('#toSettings');
  await page.waitForSelector('.page.settings .editbox');
  await shot('indstillinger');
  await noOverflow('indstillinger');

  // FAQ-søgning
  await page.goto('http://localhost:8765/#/faq');
  await page.fill('#faqSearch', 'røre nettet');
  await wait(200);
  ok((await page.locator('details.faq').count()) >= 1, 'FAQ finder regel om nettet');

  // Admin: se som
  await page.click('#nav a:has-text("Admin")');
  await page.click('[data-tab="spillere"]');
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
  await page.click('#nav a:has-text("Min padel")');
  await page.click('#toSettings');
  await page.waitForSelector('.page.settings .me-card');
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
  // Center med egen officiel rangliste (kun superadmin kan slå det til)
  await page.check('#centerMode');
  await wait(500);
  ok(await page.evaluate(() => window.__mock.db().padel_groups.find((x) => x.name === 'Lørdagspadel').is_center === true), 'superadmin gør Lørdagspadel til et center med egen rangliste');
  await page.click('[data-tab="indstillinger"]');
  await page.waitForSelector('#centerLook');
  await page.locator('#centerLook label.sw').nth(9).click();
  await page.fill('#centerLook input[name=msg]', 'Ranglisteaften kl. 19');
  await page.click('#centerLook button');
  await wait(500);
  ok(await page.evaluate(() => { const g = window.__mock.db().padel_groups.find((x) => x.name === 'Lørdagspadel'); return g.brand_color === '#8b5cf6' && g.tv_message === 'Ranglisteaften kl. 19'; }), 'centret vælger farve og besked til TV-skærmen');
  ok(await page.locator('.rankmode').isHidden(), 'et center har altid sin egen rangliste (valget er skjult)');
  // Sponsorer på TV-skærmen
  await page.waitForSelector('#sponsorAdd');
  await page.fill('#sponsorAdd input[name=name]', 'Gilleleje Bageri');
  await page.setInputFiles('#sponsorAdd input[name=logo]', { name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
  await page.click('#sponsorAdd button');
  await page.waitForSelector('.sprow');
  ok(await page.evaluate(() => { const s = window.__mock.db().padel_groups.find((x) => x.name === 'Lørdagspadel').sponsors; return s?.length === 1 && s[0].name === 'Gilleleje Bageri' && !!s[0].logo; }), 'centret kan tilføje en sponsor med logo');
  await shot('center-indstillinger');
  await noOverflow('center indstillinger');
  await page.click('[data-tab="grupper"]');
  await page.waitForSelector('#centerMode');
  await page.uncheck('#centerMode');
  await wait(500);
  ok(await page.evaluate(() => !window.__mock.db().padel_groups.find((x) => x.name === 'Lørdagspadel').is_center), 'center kan slås fra igen');
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
  await page.click('#nav a:has-text("Min padel")');
  await page.click('#toSettings');
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
  await page.click('#nav a:has-text("Min padel")');
  await page.click('#toSettings');
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
  await page.click('#nav a:has-text("Min padel")').catch(() => {});
  await wait(300);
  ok((await page.locator('.gchip').allInnerTexts()).some((t) => t.includes('⏳')), 'profil viser ventende anmodning');
  await page.click('#toSettings');
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
  await page.click('[data-tab="spillere"]');
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
  await ip.click('#nav a:has-text("Min padel")');
  await ip.click('#toSettings');
  await ip.waitForSelector('.page.settings .me-card');
  ok(await ip.locator('#installRow').count() === 1, 'iPhone: hjemmeskærm ligger under Profil');
  await iphone.close();

  // Bødekasse: admin slår til, giver bøde, spilleren melder betalt, admin godkender
  await loginAs('jimmy@test');
  await page.goto('http://localhost:8765/#/admin');
  await page.waitForSelector('.atiles');
  ok(await page.locator('.atile').count() >= 4, 'Admin starter med en oversigt med fliser');
  await shot('admin-oversigt');
  await page.click('[data-tab="spillere"]');
  await page.click('[data-pgroup="g-fre"]');
  await wait(300);
  ok(await page.locator('details.plist:not([open])').count() === 1, 'spillerlisten under Admin er foldet sammen');
  await page.waitForSelector('[data-tab="indstillinger"]'); await page.click('[data-tab="indstillinger"]'); await page.waitForSelector('#finesOn');
  await page.check('#finesOn');
  await wait(500);
  ok((await page.locator('#nav a:not(.navfoot)').count()) <= 4 && !(await page.locator('#nav').innerText()).includes('Bøder'), 'højst 4 punkter i bunden; bødekassen ligger på Min padel');
  await page.click('#nav a:has-text("Min padel")');
  await page.waitForSelector('a.owe');
  await page.click('a.owe');
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
  ok((await page.locator('.finegate [data-mpopen="12345678"]').count()) === 1 && (await page.locator('.finegate .mp[data-payids]').count()) === 1 && !(await page.locator('.finegate a[href^="mobilepay://"]').count()), 'kopiér nummer og "Jeg har betalt" (ingen gamle MobilePay-links)');
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
  ok(await page.locator('.mine-card .mp').count() === 1, '"Jeg har betalt" i Dit udestående');
  await page.click('.mine-card .mp');
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

  // Admins egen bøde: skal godkendes af en anden admin eller af den bødeansvarlige
  await page.evaluate(() => { const db = window.__mock.db(); db.padel_group_members.find((m) => m.group_id === 'g-fre' && m.player_id === 'u-1').fines_manager = true;
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
  await page.evaluate(() => { const db = window.__mock.db(); db.padel_group_members.find((m) => m.group_id === 'g-fre' && m.player_id === 'u-2').role = 'superbruger'; window.__mock.save(); });
  await loginAs(await page.evaluate(() => window.__mock.db().padel_profiles.find((p) => p.id === 'u-2').email));
  await page.goto('http://localhost:8765/#/boeder');
  await page.waitForSelector('.page.fines');
  await wait(400);
  ok(!(await page.locator('[data-paid="f-own"]').count()) && !(await page.locator('.approvals').count()), 'en superbruger kan ikke godkende betalinger');
  await loginAs(await page.evaluate(() => window.__mock.db().padel_profiles.find((p) => p.id === 'u-1').email));
  await page.goto('http://localhost:8765/#/boeder');
  await page.waitForSelector('.approvals [data-paid="f-own"]');
  await page.click('.approvals [data-paid="f-own"]');
  await wait(500);
  ok(await page.evaluate(() => window.__mock.db().padel_fines.find((f) => f.id === 'f-own').status === 'betalt'), 'den bødeansvarlige godkender admins betaling');
  await page.evaluate(() => { const db = window.__mock.db(); db.padel_group_members.find((m) => m.group_id === 'g-fre' && m.player_id === 'u-1').fines_manager = false; db.padel_group_members.find((m) => m.group_id === 'g-fre' && m.player_id === 'u-2').role = 'bruger'; db.padel_fines = db.padel_fines.filter((f) => f.id !== 'f-own'); window.__mock.save(); });
  await loginAs('jimmy@test');
  await page.goto('http://localhost:8765/#/boeder');
  await page.waitForSelector('.page.fines');
  await page.evaluate(() => document.querySelectorAll('details.fset').forEach((d) => (d.open = true)));
  ok(await page.locator('#fineSettings select[name=mgr]').count() === 1, 'admin kan vælge en bødeansvarlig i indstillingerne');
  await page.locator('#fineSettings select[name=mgr]').selectOption('u-3');
  await page.click('#fineSettings button');
  await wait(600);
  ok(await page.evaluate(() => window.__mock.db().padel_group_members.find((m) => m.group_id === 'g-fre' && m.player_id === 'u-3').fines_manager === true), 'den bødeansvarlige er gemt');
  await page.evaluate(() => { const db = window.__mock.db(); db.padel_group_members.find((m) => m.group_id === 'g-fre' && m.player_id === 'u-3').fines_manager = false; window.__mock.save(); });

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
  await page.click('[data-tab="spillere"]');
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
  await page.click('#nav a:has-text("Min padel")');
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
  await sf.locator('[data-sug2rm]').click();
  await wait(400);
  ok(await page.evaluate(() => (window.__mock.db().padel_roadmap_v2 || []).some((r) => r.title.includes('mørk og en lys') && r.hidden && r.status === 'plan')), 'superadmin sætter et forslag på listen På vej (skjult, til han har set på det)');
  await sf.locator('select[name=status]').selectOption('planlagt');
  await sf.locator('textarea[name=reply]').fill('God idé, den kommer!');
  await sf.locator('button.primary').click();
  await wait(400);
  await shot('forslag-admin');
  await loginAs('test2@fredagspadel.test');
  await page.click('#nav a:has-text("Min padel")');
  await page.waitForSelector('#sugRow .badge.new');
  ok((await page.locator('#sugRow').innerText()).includes('Nyt svar'), 'spilleren ser "Nyt svar" ved Forslagskasse');
  await page.click('#sugRow');
  await page.waitForSelector('.sreply');
  ok((await page.locator('.sug', { hasText: 'mørk og en lys' }).innerText()).includes('God idé, den kommer!'), 'spilleren ser svaret i appen');
  await shot('forslag-svar');

  // Redigeringstilstand for superadmin: slå til, ret en kamp, slet en bøde, slå fra
  await loginAs('jimmy@test');
  await page.goto('http://localhost:8765/#/indstillinger');
  await page.waitForSelector('#editMode');
  await page.click('#testAppRow'); ok(await page.locator('.qrmodal svg').count() === 1, 'superadmin kan vise QR til test-appen'); await page.click('.qrmodal button');
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
  await page.click('#nav a:has-text("Min padel")');
  await page.click('#toSettings');
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
  ok(!(await page.locator('[data-kind="center"]').count()) && !(await page.locator('#tvEvent').count()), 'center-rangliste og TV-skærm er skjult for almindelige brugere');
  await page.goto('http://localhost:8765/#/admin');
  await page.waitForSelector('[data-tab="indstillinger"]'); await page.click('[data-tab="indstillinger"]'); await page.waitForSelector('#finesOn');
  await page.click('.rankmode label:has-text("Kun gruppen")');
  await wait(500);
  await page.goto('http://localhost:8765/#/rangliste');
  await page.waitForSelector('.page h1');
  await wait(400);
  ok(!(await page.locator('.page').innerText()).includes('Test Anders'), '"Kun gruppen" viser kun gruppens spillere');
  await page.goto('http://localhost:8765/#/admin');
  await page.waitForSelector('[data-tab="indstillinger"]'); await page.click('[data-tab="indstillinger"]'); await page.waitForSelector('#finesOn');
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
  ok((await page.locator('#nav a:has-text("Min padel") .navbadge').innerText()) === '1', 'tal på Profil ved ny besked');
  await page.goto('http://localhost:8765/#/beskeder');
  await page.waitForSelector('.notices-page');
  ok((await page.locator('.nrow').first().innerText()).includes('Du har fået en plads'), 'beskeden står under Beskeder');
  ok(await page.locator('#pushToggle').count() === 1, 'knap til notifikationer på telefonen');
  await shot('beskeder');
  await wait(300);
  ok(!(await page.locator('#nav .navbadge').count()), 'tallet forsvinder, når beskeden er læst');

  // Udseende: vælg pink, det gemmes og huskes efter genindlæsning
  await page.click('#nav a:has-text("Min padel")');
  await page.click('#toSettings');
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
  ok((await page.locator('.themes').count()) === 2 && (await page.locator('[data-theme-key]').count()) >= 13, 'temaer delt i Mørke og Lyse, med flere lyse');
  ok((await page.locator('[data-theme-key="brondby"]').count()) === (await page.evaluate(async () => { const s = JSON.parse(sessionStorage.getItem('mock-session')); return window.__mock.db().padel_profiles.find((p) => p.id === s.user.id)?.is_superadmin ? 1 : 0; })), 'Brøndby-temaet kan kun vælges af superadmin');
  await shot('tema-valg');
  for (const k of ['himmel', 'mint', 'sand', 'lavendel', 'skov', 'rubin']) {
    await page.click(`[data-theme-key="${k}"]`);
    await wait(150);
    ok((await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) !== 'rgba(0, 0, 0, 0)' && (await page.evaluate(() => document.documentElement.dataset.theme)) === k, `tema ${k} virker`);
  }
  await page.click('[data-theme-key=""]');
  await wait(300);
  ok(!(await page.evaluate(() => document.documentElement.dataset.theme)), 'tilbage til standard');

  // Påmindelser på mail (gruppens admin)
  await loginAs('jimmy@test');
  await page.goto('http://localhost:8765/#/admin');
  await page.waitForSelector('[data-tab="indstillinger"]'); await page.click('[data-tab="indstillinger"]');
  await page.waitForSelector('details.mailset');
  await page.click('details.mailset > summary');
  await page.check('#mailForm input[name=on]');
  await page.fill('#mailForm input[name=reply]', 'fredag@test.dk');
  await page.click('#mailForm button');
  await wait(500);
  ok(await page.evaluate(() => { const g = window.__mock.db().padel_groups.find((x) => x.id === 'g-fre'); return g.mail_enabled === true && g.mail_reply_to === 'fredag@test.dk'; }), 'admin slår påmindelser på mail til med gruppens svar-mail');
  await noOverflow('mail indstillinger');
  // Rettigheder med flueben: Bo får lov til at oprette spilledage
  await page.click('[data-tab="rettigheder"]');
  await page.waitForSelector('#rightsFind');
  await page.fill('#rightsFind', 'Test Bo');
  await page.click('[data-radd="u-2"]');
  await page.waitForSelector('.rcard[data-ruser="u-2"]');
  await page.locator('.rcard[data-ruser="u-2"] label:has(input[data-rk="spilledage"])').click();
  await wait(500);
  ok(await page.evaluate(() => (window.__mock.db().padel_rights_v2 || []).find((x) => x.group_id === 'g-fre' && x.user_id === 'u-2')?.rights.includes('spilledage')), 'admin giver Bo rettigheden Spilledage med ét flueben');
  await shot('admin-rettigheder');
  await noOverflow('rettigheder');
  await loginAs('test2@fredagspadel.test');
  await page.goto('http://localhost:8765/#/fredage');
  await page.waitForSelector('.page h1');
  await wait(300);
  ok(await page.locator('a[href="#/ny-fredag"]').count() > 0, 'Bo kan nu oprette spilledage');
  ok(!(await page.locator('#nav').innerText()).includes('Admin'), 'Bo får ikke Admin i menuen for kun at kunne oprette spilledage');
  await loginAs('jimmy@test');
  await page.goto('http://localhost:8765/#/admin');
  await page.waitForSelector('[data-tab="rettigheder"]'); await page.click('[data-tab="rettigheder"]');
  await page.waitForSelector('.rcard[data-ruser="u-2"]');
  await page.click('.rcard[data-ruser="u-2"] [data-rnone]');
  await wait(400);
  ok(await page.evaluate(() => !(window.__mock.db().padel_rights_v2 || []).find((x) => x.user_id === 'u-2')?.rights.length), 'rettigheden kan fjernes igen med Ingen');
  // Nyhedsbrev: Bo får rettigheden og skriver et nyhedsbrev til gruppen
  await page.fill('#rightsFind', 'Test Bo');
  if (await page.locator('[data-radd="u-2"]').count()) await page.click('[data-radd="u-2"]');
  await page.waitForSelector('.rcard[data-ruser="u-2"]');
  await page.locator('.rcard[data-ruser="u-2"] label:has(input[data-rk="nyhedsbrev"])').click();
  await wait(500);
  ok(await page.evaluate(() => (window.__mock.db().padel_rights_v2 || []).find((x) => x.group_id === 'g-fre' && x.user_id === 'u-2')?.rights.includes('nyhedsbrev')), 'admin kan give rettigheden Nyhedsbrev');
  // Superadmin giver gruppen den betalte udgave, så AI-hjælpen kan bruges
  await page.click('[data-tab="grupper"]');
  await page.waitForSelector('#plusMode');
  await page.locator('label:has(#plusMode)').click();
  await page.waitForSelector('#plusUntil');
  ok(await page.evaluate(() => window.__mock.db().padel_groups.find((x) => x.id === 'g-fre').plus === true), 'superadmin slår den betalte udgave til for gruppen');
  await loginAs('test2@fredagspadel.test');
  await page.goto('http://localhost:8765/#/admin');
  await page.waitForSelector('#nlNew');
  ok((await page.locator('#nav').innerText()).includes('Admin'), 'med rettigheden Nyhedsbrev får Bo Admin i menuen');
  ok((await page.locator('.nlintro-card').innerText()).match(/sendes til \d+/), 'Nyhedsbrev viser, hvor mange det sendes til');
  await page.click('#nlNew');
  await page.waitForSelector('#nlForm');
  await page.fill('#nlForm input[name=title]', 'Nyt fra fredagspadel');
  await page.fill('#nlForm textarea[name=intro]', 'Hej alle sammen');
  await page.fill('[data-sec="0"] input[name=heading]', 'Juleturnering');
  await page.fill('[data-sec="0"] textarea[name=text]', 'Vi spiller den 18. december.\n\nSe mere på https://padelklubben.dk');
  await page.fill('[data-sec="0"] input[name=button_text]', 'Tilmeld dig');
  await page.fill('[data-sec="0"] input[name=button_url]', 'https://padelklubben.dk');
  await page.click('#nlAdd');
  await page.waitForSelector('[data-sec="1"]');
  ok(await page.inputValue('[data-sec="0"] input[name=heading]') === 'Juleturnering', 'teksten bliver stående, når man tilføjer et afsnit');
  await page.fill('[data-sec="1"] input[name=heading]', 'Nye bolde');
  await wait(200);
  const pv = await page.locator('#nlPreview').innerText();
  ok(pv.includes('Nyt fra fredagspadel') && pv.includes('Juleturnering') && pv.includes('Nye bolde') && pv.includes('Tilmeld dig'), 'forhåndsvisningen viser mailen, mens man skriver');
  await shot('nyhedsbrev-skriv');
  await noOverflow('nyhedsbrev');
  // ✨ AI læser nyhedsbrevet igennem: forslaget vises først, kan bruges og fortrydes
  await page.fill('[data-sec="1"] textarea[name=text]', 'Vi har fået nye bolde uden stafefejl');
  await page.click('#nlAi');
  await page.waitForSelector('#aiModal');
  ok((await page.locator('#aiModal').innerText()).includes('Rettet 1 stavefejl') && (await page.locator('#aiModal .nlmail li').count()) >= 2, 'AI viser, hvad der er rettet, og mailen med punktliste');
  await shot('nyhedsbrev-ai');
  await noOverflow('AI-forslag');
  ok(await page.inputValue('[data-sec="1"] textarea[name=text]') === 'Vi har fået nye bolde uden stafefejl', 'intet ændres, før man trykker Brug forslaget');
  await page.click('#aiYes');
  await page.waitForSelector('#nlUndo');
  ok((await page.inputValue('[data-sec="1"] textarea[name=text]')).startsWith('Vi har fået nye bolde uden stavefejl'), 'AI-forslaget sættes ind i teksten');
  await page.click('#nlUndo');
  await page.waitForSelector('#nlAi');
  ok(await page.inputValue('[data-sec="1"] textarea[name=text]') === 'Vi har fået nye bolde uden stafefejl' && !(await page.locator('#nlUndo').count()), 'AI-ændringerne kan fortrydes');
  await page.click('#nlAi');
  await page.waitForSelector('#aiModal');
  await page.click('#aiYes');
  await page.waitForSelector('#nlUndo');
  await page.click('#nlTest');
  await wait(500);
  ok(await page.evaluate(() => (window.__nlSent || []).some((x) => x.test)), 'man kan sende en test til sig selv');
  await page.click('#nlSend');
  await page.waitForSelector('.nlrow-item');
  ok(await page.evaluate(() => (window.__mock.db().padel_newsletters_v2 || []).some((n) => n.title.startsWith('Nyt fra fredagspadel') && n.status === 'sendt' && n.sections.length === 2 && n.recipients > 0)), 'nyhedsbrevet sendes til gruppen');
  ok((await page.locator('.nlrow-item').first().innerText()).includes('Sendt'), 'listen viser det sendte nyhedsbrev');
  // Uden den betalte udgave er AI-hjælpen låst
  await page.evaluate(() => { window.__mock.db().padel_groups.find((x) => x.id === 'g-fre').plus = false; window.__mock.save(); });
  await page.reload();
  await page.waitForSelector('#nlNew');
  await page.click('#nlNew');
  await page.waitForSelector('#nlForm');
  ok(!(await page.locator('.nlai').count()), 'uden betalt udgave vises AI-hjælpen slet ikke');
  await page.click('#nlBack');
  await page.waitForSelector('.nlrow-item');
  await shot('nyhedsbrev-liste');
  // Spilleren kan slå nyhedsbreve fra under Notifikationer og mails
  await page.goto('http://localhost:8765/#/beskeder');
  await page.waitForSelector('[data-nlopt="g-fre"]');
  await page.locator('label:has([data-nlopt="g-fre"])').click();
  await wait(400);
  ok(await page.evaluate(() => (window.__mock.db().padel_newsletter_optout_v2 || []).some((x) => x.group_id === 'g-fre' && x.user_id === 'u-2' && x.off)), 'man kan slå nyhedsbreve fra for en gruppe');
  await noOverflow('nyhedsbrev fra');
  await loginAs('jimmy@test');
  await page.goto('http://localhost:8765/#/admin');
  await page.waitForSelector('[data-tab="rettigheder"]'); await page.click('[data-tab="rettigheder"]');
  await page.waitForSelector('.rcard[data-ruser="u-2"]');
  await page.click('.rcard[data-ruser="u-2"] [data-rnone]');
  await wait(400);
  // Superadmin tilføjer et punkt til "På vej" og flytter det til I gang
  await page.goto('http://localhost:8765/#/nyt');
  await page.waitForSelector('[data-rmtab="plan"]');
  await page.click('[data-rmtab="plan"]');
  await page.click('details.rmnew summary');
  await page.fill('details.rmnew input[name=title]', 'Bookning af baner i appen');
  await page.click('details.rmnew button.primary');
  await page.waitForSelector('.rmitem:has-text("Bookning af baner i appen")');
  ok(await page.evaluate(() => window.__mock.db().padel_roadmap_v2.some((r) => r.title === 'Bookning af baner i appen' && r.status === 'plan')), 'superadmin tilføjer et punkt til På vej');
  await page.locator('.rmitem:has-text("Bookning af baner i appen") [data-rmnext]').click();
  await wait(400);
  ok(await page.evaluate(() => window.__mock.db().padel_roadmap_v2.find((r) => r.title === 'Bookning af baner i appen').status === 'igang'), 'punktet kan flyttes til I gang med ét tryk');
  // Nyt i appen: popup én gang efter en større opdatering; spillere ser ikke admin-nyheder
  await loginAs('jimmy@test');
  await page.evaluate(() => { const db = window.__mock.db(); db.padel_profiles.find((p) => p.id === 'u-5').news_seen = '2026-10-24'; db.padel_profiles.find((p) => p.id === 'u-admin').news_seen = '2026-10-24'; window.__mock.save(); });
  await page.reload();
  await page.waitForSelector('#newsModal');
  const nm = await page.locator('#newsModal').innerText();
  ok(nm.includes('Vinderchance og badges') && nm.includes('TV-skærmen: sponsorer'), 'admin får popup med de nyeste nyheder');
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
  ok(!(await page.locator('#newsModal').innerText()).includes('Grafer på fremmøde og kontingent'), 'spillere ser ikke admin-nyheder');
  await page.click('#newsOk');
  await page.goto('http://localhost:8765/#/nyt');
  await page.waitForSelector('[data-newslink]');
  await page.locator('[data-newslink]').first().click();
  await page.waitForSelector('[data-theme-key]');
  ok(!(await page.locator('#newsModal').count()) && page.url().includes('#/udseende'), 'knappen "Vælg farver" i nyheden fører til Udseende');
  await page.goto('http://localhost:8765/#/nyt');
  await page.waitForSelector('.news-entry');
  ok((await page.locator('.news-entry').count()) >= 1, 'tidligere nyheder kan læses under Profil');
  // Nyt og på vej: I gang og På vej, med 👍
  await page.click('[data-rmtab="igang"]');
  await page.waitForSelector('.rmitem');
  ok((await page.locator('.roadmap').innerText()).includes('App til iPhone'), 'I gang viser det, vi arbejder på');
  await page.click('[data-rmtab="plan"]');
  await page.waitForSelector('[data-vote="rm-2"]');
  ok(!(await page.locator('.roadmap').innerText()).includes('Hemmeligt punkt'), 'hemmelige punkter er skjult for spillere');
  await page.click('[data-vote="rm-2"]');
  await wait(400);
  ok((await page.locator('[data-vote="rm-2"]').innerText()).includes('1') && await page.evaluate(() => window.__mock.db().padel_roadmap_votes_v2.some((v) => v.item_id === 'rm-2' && v.active)), 'en spiller kan give 👍 til et punkt');
  await shot('nyt-og-paa-vej');
  await noOverflow('nyt og på vej');

  // ---------- Juniorklub ----------
  const freshLogin = async (email, url = 'http://localhost:8765/') => {
    await page.evaluate(() => sessionStorage.removeItem('mock-session'));
    await page.goto(url);
    await page.waitForSelector('#authForm');
    if (!freshLogin.checked) { freshLogin.checked = true; ok(await page.locator('#authForm input[name=remember]').isChecked(), '"Husk mig" er slået til som standard'); const pre = await page.inputValue('input[name=email]'); ok(pre.includes('@'), 'e-mailen fra sidste login er udfyldt'); }
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
  await page.fill('details.teamcard[open] form[data-tdesc] textarea', 'For børn 9-12 år. Vi lærer grundslagene.');
  await page.click('details.teamcard[open] form[data-tdesc] button');
  await wait(500);
  ok(await page.evaluate(() => window.__mock.db().padel_club_teams.find((t) => t.name === 'U12').description === 'For børn 9-12 år. Vi lærer grundslagene.'), 'træneren skriver en beskrivelse af holdet');
  await page.click('details.welcomeset summary');
  await page.fill('#welcomeForm textarea', 'Velkommen i klubben! Husk indendørssko.');
  await page.click('#welcomeForm button');
  await wait(500);
  ok(await page.evaluate(() => !!window.__mock.db().padel_groups.find((g) => g.kind === 'klub').club_welcome), 'træneren skriver en velkomstbesked');
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
  await page.click('[data-tab="indstillinger"]');
  await page.click('details.gset:not(.staff):not(.mailset) summary');
  await page.fill('#clubSet input[name=fee]', '600');
  await page.fill('#clubSet input[name=label]', 'Efterår 2026');
  await page.fill('#clubSet input[name=url]', 'https://qr.mobilepay.dk/box/test');
  await page.fill('#clubSet input[name=acct]', 'Reg. 1234 konto 0012345678');
  await page.fill('#clubSet textarea[name=info]', 'Husk vand og indendørssko. Træner: Brian');
  await page.locator('#clubSet input[name=addr]').check();
  await page.fill('#clubSet input[name=hours]', '48');
  await page.click('#clubSet button');
  await wait(500);
  ok((await page.locator('details.gset:not(.staff):not(.mailset) summary').innerText()).includes('600'), 'kontingent sat op');
  ok((await page.evaluate((g) => window.__mock.db().padel_groups.find((x) => x.id === g).club_absence_hours, clubId)) === 48, 'afbudsfrist sat til 48 timer');
  ok((await page.evaluate((g) => window.__mock.db().padel_groups.find((x) => x.id === g).club_fee_account, clubId)) === 'Reg. 1234 konto 0012345678', 'kontonummer til kontingent er gemt');
  // Man kan kun melde et barn ind i en klub, man selv er med i (ellers skal man have klubbens link)
  ok(!(await page.locator('#clubSet input[name=disc][type=checkbox]').count()), 'indstillingen "kan findes i appen" er fjernet');
  await freshLogin('test5@fredagspadel.test');
  await page.waitForSelector('#nav a');
  await pastGates();
  await page.goto('http://localhost:8765/#/profil');
  await page.waitForSelector('.page');
  await wait(600);
  ok(!(await page.locator('#discRow').count()), 'en spiller uden for klubben kan ikke melde et barn ind i klubben fra Profil');
  await page.goto('http://localhost:8765/#/klub-ind');
  await page.waitForSelector('.page.club');
  ok(!(await page.locator('#joinForm select[name=club]').count()), 'indmeldelsen viser ingen klubber, man ikke er med i');
  await freshLogin('jimmy@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  await page.evaluate((g) => localStorage.setItem('fp-group', g), clubId);
  await page.goto('http://localhost:8765/#/admin');
  await page.reload();
  await page.waitForSelector('[data-tab="indstillinger"]');
  await page.click('[data-tab="indstillinger"]');
  await page.click('details.staff summary');
  await page.locator('form[data-staff="u-brian"] input[name=cert]').fill('2026-09-01');
  await page.locator('form[data-staff="u-brian"] button').click();
  await wait(500);
  ok((await page.evaluate(() => window.__mock.db().padel_club_certs.find((x) => x.user_id === 'u-brian')?.cert_date)) === '2026-09-01', 'børneattest registreret for træneren');
  // Flere poster: træneren kan også sidde i bestyrelsen
  await page.locator('form[data-staff="u-brian"] label.rchip:has(input[value="Bestyrelsesmedlem"])').click();
  await page.locator('form[data-staff="u-brian"] label.rchip:has(input[value="Udvikler af appen"])').click();
  await page.locator('form[data-staff="u-brian"] button.primary').click();
  await wait(500);
  ok(await page.evaluate(() => { const x = window.__mock.db().padel_club_staff.find((y) => y.user_id === 'u-brian'); return x.board_titles.length === 2 && x.board_title === 'Bestyrelsesmedlem · Udvikler af appen'; }), 'en træner kan have flere poster: bestyrelsesmedlem og udvikler af appen');
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
  const joinUrl = page.url();
  ok(!(await page.locator('details.welcomecard[open], details.teaminfo[open]').count()), 'velkomst og holdene er foldet sammen ved indmeldelsen');
  await page.click('details.welcomecard > summary');
  await page.click('details.teaminfo > summary');
  ok((await page.locator('.welcomecard').innerText()).includes('Husk indendørssko') && (await page.locator('.teaminfo').innerText()).includes('Vi lærer grundslagene'), 'indmeldelsen viser velkomstbeskeden og holdenes beskrivelse');
  await shot('klub-indmeld-velkomst');
  const k0 = page.locator('.kidf').nth(0);
  await k0.locator('input[name=kname]').fill('Oscar Test');
  await k0.locator('input[name=kbirth]').fill('2014-05-03');
  ok(/^\d+ år$/.test(await k0.locator('.kage').innerText()), 'barnets alder vises under fødselsdatoen: ' + await k0.locator('.kage').innerText());
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
  await page.goto(joinUrl);
  await page.waitForSelector('#joinForm .kidf legend');
  ok((await page.locator('#joinForm .kidf legend').first().innerText()) === 'Barn 3' && (await page.locator('#joinForm').evaluate((f) => f.parentElement.innerText)).includes('allerede meldt Oscar og Ida ind'), 'har man allerede meldt børn ind, fortsætter nummereringen (Barn 3)');

  // Træneren (Brian) godkender og sætter på hold
  await freshLogin('brian@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  const nav = await page.locator('#nav').innerText();
  ok(nav.includes('Træning') && nav.includes('Opslag') && !nav.includes('Rangliste') && !nav.includes('Spilledage'), 'klubbens menu: Træning, Opslag, Profil, Admin');
  ok((await page.locator('#nav a[href="#/admin"] .navbadge').innerText()) === '2', 'træneren ser tal for nye indmeldelser');
  ok(lastTodo.includes('2 nye børn venter'), 'træneren får en popup om nye børn, når appen åbnes: ' + lastTodo);
  await page.click('#nav a[href="#/admin"]');
  await page.click('[data-tab="boern"]');
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
  ok((await page.locator('.welcomecard').innerText()).includes('Husk indendørssko'), 'nye medlemmer ser velkomstbeskeden på Træning');
  await page.click('#welcomeOk');
  ok(!(await page.locator('.welcomecard').count()), 'velkomsten på Træning kan lukkes');
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
  ok((await page.locator('.feecard .feeacct').innerText()).includes('Reg. 1234 konto 0012345678'), 'forælderen ser kontonummeret til overførsel');
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
  ok((await page.locator('.attcharts .donut').count()) === 2 && (await page.locator('.htrack').count()) >= 2, 'fremmøde med lagkager og bjælker');
  if (await page.locator('#attTeamSel option[value="alle"]').count()) {
    ok((await page.locator('#attTeamSel').inputValue()) === 'alle' && (await page.locator('.hbar').count()) >= 2, 'Alle hold samlet, med en bjælke pr. hold');
    await page.locator('.hbar').first().click();
    await page.waitForFunction(() => document.querySelector('#attTeamSel')?.value !== 'alle');
    ok(!(await page.locator('.hbar').count()), 'tryk på et hold viser holdet alene');
    await page.selectOption('#attTeamSel', 'alle');
    await page.waitForSelector('.hbar');
  }
  await shot('klub-fremmode');
  await noOverflow('klub fremmøde');
  await page.goto('http://localhost:8765/#/traening');
  await page.waitForSelector('.tr.trainer');
  await shot('klub-traening-traener');
  await noOverflow('klub træning træner');
  // Påmindelse om én træning: til alle, der ikke har meldt afbud
  await page.locator('.tr.trainer').nth(1).locator('summary').click();
  const pBefore = await page.evaluate(() => window.__mock.db().padel_notifications.filter((n) => n.kind === 'klub_paamind').length);
  await page.locator('.tr.trainer').nth(1).locator('[data-remind$="|1"]').click();
  await wait(500);
  ok(await page.evaluate((b) => window.__mock.db().padel_notifications.filter((n) => n.kind === 'klub_paamind').length > b, pBefore), 'træneren sender en påmindelse om træningen');
  await shot('klub-paamind');
  await noOverflow('påmind');
  await page.locator('.tr.trainer').nth(1).locator('summary').click();
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
  if (await page.locator('.chips.groups [data-group]:not(.on)').count()) {
    const clubId = await page.locator('.chips.groups [data-group].on').getAttribute('data-group');
    await page.locator('.chips.groups [data-group]:not(.on)').first().click();
    await wait(500);
    ok(page.url().endsWith('#/fredage') && (await page.locator('#nav a[href="#/fredage"]').count()) === 1, 'skift fra klub til spillegruppe åbner Spilledage');
    await page.click(`.chips.groups [data-group="${clubId}"]`);
    await page.waitForSelector('#evNew');
    ok(page.url().endsWith('#/traening'), 'skift tilbage til klubben åbner Træning');
  }
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
  await page.waitForSelector('[data-tab]');
  ok(!(await page.locator('[data-tab="kontingent"]').count()) && (await page.locator('[data-tab="spillere"]').count()) === 1, 'træneren ser ikke kontingent, men gerne Medlemmer');
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
  await page.waitForSelector('[data-tab="indstillinger"]');
  await page.click('[data-tab="indstillinger"]');
  await page.click('details.staff summary');
  await page.locator('#addStaff select').selectOption({ label: 'Pia Forælder' });
  await page.click('#addStaff button');
  await page.waitForSelector('form[data-staff="u-nyforaelder"]');
  const pf = page.locator('form[data-staff="u-nyforaelder"]');
  await pf.locator('label.rchip:has(input[value="Kasserer"])').click();
  ok((await pf.locator('.rightsnote').innerText()).includes('Rettigheder'), 'bestyrelsen viser, at rettigheder vælges under Rettigheder');
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
  await page.locator('form[data-staff="u-nyforaelder"] label.rchip:has(input[value="Kasserer"])').click();
  await page.locator('form[data-staff="u-nyforaelder"] button.primary').click();
  await wait(500);
  // Invitér resten af bestyrelsen med mail: en, der findes i appen, kommer med med det samme; en ny får en invitation
  await page.click('details.inviteboard summary');
  await page.fill('#inviteBoard input[name=name]', 'Test Dorthe');
  await page.fill('#inviteBoard input[name=email]', 'test10@fredagspadel.test');
  await page.locator('#inviteBoard select[name=title]').selectOption('Sekretær');
  await page.click('#inviteBoard button');
  await wait(600);
  ok(await page.evaluate((g) => window.__mock.db().padel_club_staff.some((x) => x.group_id === g && x.user_id === 'u-10' && x.board_title === 'Sekretær'), clubId), 'en, der allerede er i appen, kommer med i bestyrelsen med det samme');
  if (!(await page.locator('details.inviteboard[open]').count())) await page.click('details.inviteboard summary');
  await page.fill('#inviteBoard input[name=name]', 'Mette Ny');
  await page.fill('#inviteBoard input[name=email]', 'mette@ny.dk');
  await page.locator('#inviteBoard select[name=title]').selectOption('Bestyrelsesmedlem');
  await page.click('#inviteBoard button');
  await page.waitForSelector('[data-invcancel]');
  ok((await page.locator('details.inviteboard').innerText()).includes('mette@ny.dk'), 'en ny person står som inviteret, til de opretter sig');
  await shot('klub-inviter-bestyrelse');
  await page.click('[data-invcancel]');
  await wait(500);
  ok(!(await page.locator('[data-invcancel]').count()), 'invitationen kan annulleres');
  await noOverflow('klub bestyrelse');
  await freshLogin('nyforaelder@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  ok((await page.locator('#nav').innerText()).includes('Admin'), 'kassereren får Admin i menuen');
  await page.click('#nav a[href="#/admin"]');
  await page.waitForSelector('.ftiles');
  ok((await page.locator('.ftiles').innerText()).includes('2\nafventer'), 'kassereren ser 2 betalinger der afventer');
  const allRows = await page.locator('[data-kfee]').count();
  await page.click('[data-feefilter="afventer"]');
  await page.waitForSelector('.feefilt');
  ok((await page.locator('[data-kfee]').count()) === 2 && (await page.locator('.ftbtn.on').count()) === 1, 'tryk på "afventer" viser kun dem, der afventer');
  await page.click('[data-feefilter="afventer"]');
  await page.waitForFunction(() => !document.querySelector('.feefilt'));
  ok((await page.locator('[data-kfee]').count()) === allRows, 'tryk igen viser alle');
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
  ok((await page.locator('.feemoney').innerText()).includes('600 kr.') && (await page.locator('.attcharts .donut').count()) === 1, 'kontingent: beløb betalt og lagkage');
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
  ok(await page.evaluate(() => { const d = document.querySelector('details.people'), r = d.querySelector('.coachrow').getBoundingClientRect(), c = d.getBoundingClientRect(); return r.width > c.width * 0.8; }), 'bestyrelse og trænere fylder hele kortets bredde');
  await shot('opslag-bestyrelse');
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
  await page.goto('http://localhost:8765/#/profil');
  await page.waitForSelector('[data-kidparent]', { state: 'attached' });
  await page.locator('details:has([data-kidparent]) > summary').first().click();
  ok((await page.locator('[data-kidparent]').first().innerText()).includes('Familie') && (await page.locator('.famlist').first().innerText()).includes('Pia') && (await page.locator('.famlist').first().innerText()).includes('(dig)') && (await page.locator('.famlist [data-famrm]').count()) >= 1, 'man kan se, hvem i familien der har adgang, og fjerne andre');
  const rs = page.locator('details.remindset').first();
  await rs.locator('summary').click();
  await rs.locator('label:has(input[value="11111110000000"])').click();
  await rs.locator('button.primary').click();
  await wait(500);
  ok(await page.evaluate(() => window.__mock.db().padel_club_guardians.some((g) => g.user_id === 'u-nyfar' && g.remind_pattern === '11111110000000')), 'forælder vælger kun påmindelser i lige uger (fx 7/7)');
  const kidCard = page.locator('details:has([data-kidparent])').first();
  if ((await kidCard.getAttribute('open')) === null) await kidCard.locator('> summary').click();
  const rs2 = page.locator('details.remindset').first();
  if ((await rs2.getAttribute('open')) === null) await rs2.locator('summary').click();
  ok((await rs2.locator('summary').innerText()).includes('Lige uger'), 'valget vises');
  await rs2.locator('label:has(input[value="custom"])').click();
  await rs2.locator('.remgrid').waitFor();
  await rs2.locator('label.remday:has(input[name=d7])').click();
  await shot('familie-paamindelser');
  await noOverflow('familie påmindelser');
  await rs2.locator('button.primary').click();
  await wait(500);
  ok(await page.evaluate(() => window.__mock.db().padel_club_guardians.find((g) => g.user_id === 'u-nyfar').remind_pattern === '11111111000000'), 'egne dage, fx 9/5 med weekender');
  await noOverflow('familie');
  // Barnets eget login
  await page.evaluate(() => sessionStorage.removeItem('mock-session'));
  await page.goto('about:blank');
  await page.goto(`http://localhost:8765/#/barn/${codes[1]}`);
  await page.waitForSelector('#kidGo');
  ok((await text()).includes('hej oscar') && !(await page.locator('input[name=email]').count()), 'barnets link hilser på barnet og kræver ingen e-mail');
  await shot('klub-barn-login');
  await noOverflow('barnets login');
  await page.click('#kidGo');
  await pastGates();
  await page.waitForSelector('.tr');
  ok((await page.locator('.krow').first().innerText()).includes('(dig)'), 'barnet ser sine egne træninger');
  ok(!(await page.locator('.mykids a[href^="#/klub-ind"]').count()), 'barnet har ingen knap til at melde ind');
  await page.goto('http://localhost:8765/#/klub-ind');
  await page.waitForSelector('.page.club');
  ok((await text()).includes('din forælder, der melder ind') && !(await page.locator('#joinForm').count()), 'børn kan ikke melde andre ind');
  await page.goto('http://localhost:8765/#/indstillinger');
  await page.waitForSelector('.kidcodebox');
  const oscarCode = await page.evaluate(() => window.__mock.db().padel_club_kids.find((k) => k.name === 'Oscar Test').login_code);
  ok((await page.locator('.kidcodebox b').innerText()).replace(/-/g, '').toLowerCase() === oscarCode, 'barnet kan se sin kode til login på Profil');
  // Logget ud (fx app på hjemmeskærmen på iPhone): log ind ved at skrive koden
  await page.evaluate(() => { sessionStorage.removeItem('mock-session'); localStorage.removeItem('fp-kidcode'); });
  await page.goto('http://localhost:8765/');
  await page.waitForSelector('#kidCode');
  await page.click('#kidCode');
  await page.fill('#kidForm input[name=code]', oscarCode.toUpperCase().replace(/(.{4})(?=.)/g, '$1-'));
  await shot('klub-barn-kode');
  await noOverflow('barn kode');
  await page.click('#kidGo');
  await pastGates();
  await page.waitForSelector('.tr');
  ok(await page.evaluate(() => JSON.parse(sessionStorage.getItem('mock-session'))?.user?.email?.startsWith('barn-')), 'barnet logger ind med koden (uden e-mail)');
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
  ok((await page.evaluate(() => { const ns = window.__mock.db().padel_notifications.filter((n) => n.kind === 'besked'); return ['u-nyforaelder', 'u-nyfar', 'u-brian'].every((u) => ns.some((n) => n.user_id === u)) && !ns.some((n) => n.user_id.startsWith('u-barn-')); })), 'begge forældre og træneren får besked, ikke afsenderen');
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
  await page.waitForSelector('.page');
  await wait(600);
  ok(!(await page.locator('#discRow').count()), 'Se som: en spiller uden for klubben ser heller ikke linjen');
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
  await page.waitForSelector('[data-tab]');
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
  await page.waitForSelector('[data-tab]');
  await page.click('[data-tab="hold"]');
  await page.waitForSelector('#newTeam');
  ok(await page.locator('details.welcomeset').count() === 1, 'en træner kan også skrive velkomstbeskeden');
  await page.click('[data-tab="spillere"]');
  await page.waitForSelector('#invite');
  ok(!(await page.locator('.rolesel').count()) && !(await page.locator('#clubSet').count()), 'en træner ser Medlemmer med invitationslink, men kan ikke ændre roller eller indstillinger');
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
  if (await page.locator('[data-kteam="none"]').count()) {
    await page.click('[data-kteam="none"]');
    await page.waitForSelector('.kteam-opt.on[data-kteam="none"]');
    ok((await page.locator('details.plist').count()) === 1 && (await page.locator('details.plist.noteam').count()) === 1, 'vælg et hold: kun de børn vises');
    await shot('klub-boern-hold');
    await noOverflow('børn pr. hold');
    await page.click('[data-kteam=""]');
    await page.waitForSelector('.kteam-opt.on[data-kteam=""]');
  }
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
  ok((await sf2.locator('select[name=kwish] option').allInnerTexts()).some((t) => t.includes('Begyndere') && t.includes('tir 16.00–17.30')), 'man kan ønske hold, og holdene vises med tider');
  await sf2.locator('select[name=kwish]').selectOption({ label: (await sf2.locator('select[name=kwish] option').allInnerTexts()).find((t) => t.includes('Begyndere')) });
  await page.click('#joinForm button.primary');
  await wait(700);
  ok(await page.evaluate(() => { const k = window.__mock.db().padel_club_kids.find((x) => x.player_id === 'u-nyvoksen'); return k && k.adult && k.gender === 'pige' && k.status === 'ansoegt' && window.__mock.db().padel_club_guardians.some((x) => x.kid_id === k.id && x.user_id === 'u-nyvoksen'); }), 'den voksne er meldt ind som sit eget medlem');
  await freshLogin('brian@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  ok(lastTodo.includes('ny') || lastTodo === '' , 'træneren åbner appen');
  await page.goto('http://localhost:8765/#/admin');
  await page.click('[data-tab="boern"]');
  await page.waitForSelector('.kpend:has-text("Vera Voksen")');
  ok((await page.locator('[data-tab="boern"]').innerText()).includes('Spillere'), 'fanen hedder Spillere i en klub med voksne');
  const vp = await page.locator('.kpend:has-text("Vera Voksen")').innerText();
  ok(vp.includes('Voksen') && vp.includes('Har meldt sig selv ind') && vp.includes('Kvinde'), 'træneren ser, at det er en voksen: ' + vp.replace(/\n/g, ' '));
  ok(vp.includes('Ønsker Begyndere') && (await page.locator('.kpend:has-text("Vera Voksen") select option:checked').innerText()).includes('Begyndere'), 'træneren ser ønsket hold, og det er valgt på forhånd');
  await shot('klub-voksen-godkend');
  await page.locator('.kpend:has-text("Vera Voksen") [data-kdo$="|aktiv"]').click();
  await wait(600);
  ok(await page.evaluate(() => { const k = window.__mock.db().padel_club_kids.find((x) => x.player_id === 'u-nyvoksen'); const t = window.__mock.db().padel_club_teams.find((x) => x.id === k.team_id); return k.status === 'aktiv' && t?.name === 'Begyndere' && !k.wish_team; }), 'den voksne er godkendt på det ønskede hold');
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
  // Ønske om at skifte hold bagefter: træneren får besked og flytter
  await page.locator('.kidcard').first().evaluate((d) => (d.open = true));
  await page.locator('form[data-wishkid] select').selectOption({ index: 1 });
  await page.click('form[data-wishkid] button');
  await page.waitForSelector('.wishline');
  ok(await page.evaluate(() => window.__mock.db().padel_notifications.some((n) => n.kind === 'klub_oenske' && n.user_id === 'u-brian')), 'trænerne får besked om ønsket');
  await freshLogin('brian@test');
  await page.waitForSelector('#nav a');
  await pastGates();
  await page.goto('http://localhost:8765/#/admin');
  await page.click('[data-tab="boern"]');
  await page.waitForSelector('.wishbox [data-wishok]');
  await shot('klub-oenske-hold');
  await page.click('.wishbox [data-wishok]');
  await wait(600);
  ok(await page.evaluate(() => { const k = window.__mock.db().padel_club_kids.find((x) => x.player_id === 'u-nyvoksen'); return window.__mock.db().padel_club_teams.find((x) => x.id === k.team_id)?.name === 'U12' && !k.wish_team; }), 'træneren flytter til det ønskede hold, og ønsket forsvinder');
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
  await page.goto('http://localhost:8765/#/indstillinger');
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

  // Opret flere spilledage på forskellige dage på én gang (tirsdag og fredag i 2 uger)
  await page.goto('http://localhost:8765/#/ny-fredag');
  await page.waitForSelector('#nf');
  const evBefore = await page.evaluate(() => window.__mock.db().padel_events.length);
  await page.selectOption('select[name=count]', '2');
  await page.fill('input[name=when]', '2027-03-02T19:00');
  await page.click('#addDay');
  await page.waitForSelector('.evq');
  await page.fill('input[name=when]', '2027-03-05T17:30');
  await page.dispatchEvent('input[name=when]', 'change');
  await page.locator('label:has(input[name=format][value=americano])').click();
  ok((await page.locator('#createBtn').innerText()).includes('Opret 4 spilledage'), 'to dage i 2 uger giver 4 spilledage');
  await page.click('#createBtn');
  await page.waitForSelector('a.ev');
  const made = await page.evaluate((b) => window.__mock.db().padel_events.slice(b).map((e) => new Date(e.starts_at)).map((d) => `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`).sort(), evBefore);
  ok(made.join(',') === ['12/3 17:30', '2/3 19:00', '5/3 17:30', '9/3 19:00'].sort().join(','), 'spilledagene får hver deres dato og tid: ' + made.join(', '));
  ok(await page.evaluate((b) => { const e = window.__mock.db().padel_events.slice(b); return e.filter((x) => x.format === 'americano').length === 2 && e.filter((x) => x.format !== 'americano').length === 2; }, evBefore), 'hver dag kan have sin egen spiltype');

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
