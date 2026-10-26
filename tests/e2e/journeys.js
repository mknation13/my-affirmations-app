// End-to-end journeys in a real browser (Playwright + Chromium).
// Serve the repo first:  python3 -m http.server 8765
// Then run:               node tests/e2e/journeys.js   (BASE_URL=... to point elsewhere)
'use strict';
const { chromium, devices } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const C = require('../../content.js');

const BASE = process.env.BASE_URL || 'http://localhost:8765/';
const SHOTS = process.env.SHOTS_DIR || '';
const byText = {};
C.AFFIRMATIONS.forEach((a) => { byText[a.text] = a; if (a.softer) byText[a.softer] = Object.assign({}, a, { tone: 'gentle', isSofter: true }); });

let passed = 0;
async function step(name, fn) {
  try { await fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.log('  ✗ ' + name); throw e; }
}

async function newPage(browser, device, opts) {
  const ctx = await browser.newContext(Object.assign({}, typeof device === 'string' ? devices[device] : device, { acceptDownloads: true }, opts || {}));
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  return page;
}
const text = (page, sel) => page.locator(sel).textContent();
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
async function inViewport(page, sel) {
  return page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }, sel);
}
async function noHorizontalScroll(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'page scrolls sideways');
}

(async () => {
  const browser = await chromium.launch();

  console.log('Fresh user on a phone');
  {
    const page = await newPage(browser, 'iPhone 13');
    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await step('home shows the optional focus card and a daily affirmation', async () => {
      assert.ok(await page.locator('#onboard').isVisible());
      assert.ok((await text(page, '#daily-affirmation')).length > 10);
      assert.ok((await text(page, 'footer')).includes('Wellness tool only, not therapy or medical advice.'));
      await shot(page, 'm-home-first');
    });

    await step('focus chips allow at most 3, saving hides the card', async () => {
      const chips = page.locator('#onboard-chips .chip');
      for (const name of ['Anxiety', 'Burnout', 'Financial stress']) await chips.filter({ hasText: name }).click();
      assert.equal(await page.locator('#onboard-chips .chip:disabled').count(), 5);
      await page.click('#onboard-save');
      assert.equal(await page.locator('#onboard').isVisible(), false);
      const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('ma.prefs')));
      assert.deepEqual(prefs.focus, ['anxiety', 'burnout', 'money']);
    });

    await step('daily affirmation stays the same after a reload', async () => {
      const a = await text(page, '#daily-affirmation');
      await page.reload();
      assert.equal(await text(page, '#daily-affirmation'), a);
      const item = byText[a];
      assert.ok(item, 'daily is a built-in statement');
      assert.ok(!item.focus.length || item.focus.some((f) => ['anxiety', 'burnout', 'money'].includes(f)));
    });

    await step('routine: rough mood, empty evidence offers a quick add', async () => {
      await page.click('#start-routine');
      await page.waitForFunction(() => document.body.classList.contains('in-routine'));
      assert.equal(await page.locator('.tabbar').isVisible(), false, 'tab bar hidden during the routine');
      assert.ok((await text(page, '#focus-line')).includes('Anxiety'));
      await shot(page, 'm-mood');
      await page.click('[data-mood=rough]');
      assert.ok(await page.locator('#evidence-empty').isVisible());
      assert.ok((await page.getAttribute('#routine-evidence-text', 'placeholder')).includes('nervous'), 'prompt matches first focus');
      await page.fill('#routine-evidence-text', 'I went to the appointment even though I was nervous.');
      await page.click('#routine-evidence-form button');
      assert.equal(await page.locator('#evidence-recall li').count(), 1);
      assert.ok((await text(page, '#evidence-recall li')).includes('Anxiety'));
    });

    await step('routine: affirmations fit the mood and focus, with evidence shown', async () => {
      await page.click('#evidence-continue');
      assert.ok(await page.locator('#step-affirmation').isVisible());
      await page.locator('#routine-moments button').nth(1).click(); // hard task
      const seen = [];
      for (let i = 0; i < 8; i++) {
        const t = await text(page, '#routine-affirmation');
        const item = byText[t];
        assert.ok(item, 'known statement: ' + t);
        assert.notEqual(item.tone, 'bright', 'no bright statements on a rough day');
        assert.ok(!item.focus.length || item.focus.some((f) => ['anxiety', 'burnout', 'money'].includes(f)), 'focus respected: ' + t);
        assert.ok(item.moments.includes('hard') || item.moments.includes('any'));
        assert.ok(!seen.includes(t), 'no repeats in a session: ' + t);
        seen.push(t);
        await page.click('#next-affirmation');
      }
      assert.ok(await page.locator('#proof').isVisible());
      assert.ok((await text(page, '#proof-text')).includes('appointment'));
      assert.ok(await inViewport(page, '#complete-routine'), 'Complete routine visible without scrolling');
      await shot(page, 'm-affirmation');
    });

    let hiddenText;
    await step('feedback: save, helpful, not believable, hide', async () => {
      const saved = await text(page, '#routine-affirmation');
      await page.click('#fb-fav');
      assert.equal(await page.getAttribute('#fb-fav', 'aria-pressed'), 'true');
      await page.click('#fb-helpful');
      assert.equal(await page.getAttribute('#fb-helpful', 'aria-pressed'), 'true');
      let fb = await page.evaluate(() => JSON.parse(localStorage.getItem('ma.feedback')));
      const savedId = byText[saved].id;
      assert.ok(fb.favorites.includes(savedId));
      assert.equal(fb.helpful[savedId], 1);

      await page.click('#fb-unbelievable');
      const alt = await text(page, '#routine-affirmation');
      assert.notEqual(alt, saved);
      assert.equal(byText[alt].tone, 'gentle');
      fb = await page.evaluate(() => JSON.parse(localStorage.getItem('ma.feedback')));
      assert.equal(fb.unbelievable[savedId], 1);
      await page.waitForFunction(() => document.getElementById('fb-status').textContent.length > 0);

      hiddenText = await text(page, '#routine-affirmation');
      await page.click('#fb-hide');
      assert.notEqual(await text(page, '#routine-affirmation'), hiddenText);
      fb = await page.evaluate(() => JSON.parse(localStorage.getItem('ma.feedback')));
      assert.ok(fb.hidden.includes(byText[hiddenText].id));
    });

    await step('good mood leads with bright statements', async () => {
      await page.click('#step-affirmation [data-back]');
      await page.click('#step-evidence [data-back]');
      await page.click('[data-mood=good]');
      await page.click('#evidence-continue');
      await page.locator('#routine-moments button').nth(0).click();
      assert.equal(byText[await text(page, '#routine-affirmation')].tone, 'bright');
      // a bright line that isn't believable gets its softer version
      const before = byText[await text(page, '#routine-affirmation')];
      await page.click('#fb-unbelievable');
      assert.equal(await text(page, '#routine-affirmation'), before.softer);
    });

    await step('complete: streak, small action, quick evidence add', async () => {
      await page.click('#complete-routine');
      assert.ok(await page.locator('#step-done').isVisible());
      assert.equal(await text(page, '#done-streak'), '1-day streak');
      assert.ok(await page.locator('#action-card').isVisible());
      const a1 = await text(page, '#action-text');
      assert.ok(a1.length > 10);
      const act = C.ACTIONS.find((x) => x.text === a1);
      assert.ok(act && (act.focus.length === 0 || act.focus.some((f) => ['anxiety', 'burnout', 'money'].includes(f))));
      await page.click('#action-another');
      assert.notEqual(await text(page, '#action-text'), a1);
      await shot(page, 'm-done');
      await page.click('#action-skip');
      assert.equal(await page.locator('#action-card').isVisible(), false);
      await page.click('#done-evidence summary');
      await page.fill('#done-evidence-text', 'Did my routine on a rough day.');
      await page.selectOption('#done-evidence-focus', 'burnout');
      await page.click('#done-evidence-form button');
      await page.waitForFunction(() => document.getElementById('done-status').textContent.includes('Saved'));
      const ev = await page.evaluate(() => JSON.parse(localStorage.getItem('ma.evidence')));
      assert.equal(ev.length, 2);
      assert.equal(ev[1].focus, 'burnout');
    });

    await step('a second routine the same day does not inflate the streak', async () => {
      await page.click('#step-done a.btn-primary');
      await page.click('#start-routine');
      await page.click('[data-mood=okay]');
      await page.click('#evidence-continue');
      await page.click('#complete-routine');
      assert.equal(await text(page, '#done-streak'), '1-day streak');
      assert.ok((await text(page, '#done-message')).includes('already'));
    });

    await step('evidence bank: categories, filter, newest first, delete with confirm', async () => {
      await page.goto(BASE + '#evidence');
      assert.ok(await page.locator('.tabbar').isVisible());
      await page.fill('#evidence-text', 'Checked my balance instead of avoiding it.');
      await page.selectOption('#evidence-focus', 'money');
      await page.click('#evidence-form button');
      assert.equal(await page.locator('#evidence-list li').count(), 3);
      assert.ok((await text(page, '#evidence-list li >> nth=0')).includes('Checked my balance'));
      assert.ok(await page.locator('#evidence-filter').isVisible());
      await page.locator('#evidence-filter .chip').filter({ hasText: 'Financial stress' }).click();
      assert.equal(await page.locator('#evidence-list li').count(), 1);
      await page.locator('#evidence-filter .chip').filter({ hasText: 'All' }).click();
      await shot(page, 'm-evidence');
      await page.locator('#evidence-list li').first().locator('button').click();
      assert.equal(await page.locator('#evidence-list li').count(), 2);
      await page.reload();
      assert.equal(await page.locator('#evidence-list li').count(), 2);
    });

    await step('library: saved tab, focus tabs, hidden statements can be shown again, custom CRUD', async () => {
      await page.goto(BASE + '#affirmations');
      await page.locator('#library-tabs .chip').filter({ hasText: 'Saved' }).click();
      assert.ok(await page.locator('#library-list li').count() >= 1);
      await page.locator('#library-tabs .chip').filter({ hasText: 'Anxiety' }).click();
      assert.ok((await text(page, '#library-note')).includes('your focus'));
      assert.ok(await page.locator('#library-list li').count() >= 5);

      // find the hidden statement and bring it back
      const hidden = byText[hiddenText];
      const tab = hidden.focus.length ? C.FOCUS_AREAS.find((f) => f.id === hidden.focus[0]).name : C.MOMENTS.find((m) => hidden.moments.includes(m.id)).short;
      await page.locator('#library-tabs .chip').filter({ hasText: new RegExp('^' + tab + '$') }).click();
      const row = page.locator('#library-list li', { hasText: hiddenText });
      await row.getByText('Show again').click();
      const fb = await page.evaluate(() => JSON.parse(localStorage.getItem('ma.feedback')));
      assert.ok(!fb.hidden.includes(hidden.id));

      // custom add, edit, delete
      await page.fill('#custom-text', 'My custom night line.');
      await page.selectOption('#custom-moment', 'night');
      await page.click('#custom-submit');
      const first = page.locator('#library-list li').first();
      assert.ok((await first.textContent()).includes('My custom night line.'));
      await first.getByText('Edit').click();
      await page.fill('#custom-text', 'Edited night line.');
      await page.click('#custom-submit');
      await page.reload();
      await page.locator('#library-tabs .chip').filter({ hasText: /^Night$/ }).click();
      assert.ok((await text(page, '#library-list li >> nth=0')).includes('Edited night line.'));
      // built-ins can be saved but not edited
      assert.equal(await page.locator('#library-list li').nth(1).getByText('Edit').count(), 0);
      await shot(page, 'm-library');
      await page.locator('#library-list li').first().getByText('Delete').click();
      assert.ok(!(await text(page, '#library-list')).includes('Edited night line.'));
    });

    let backupPath;
    await step('settings: change focus, turn off small steps, export a backup', async () => {
      await page.goto(BASE + '#settings');
      await page.locator('#settings-focus .chip').filter({ hasText: 'Financial stress' }).click();
      let prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('ma.prefs')));
      assert.deepEqual(prefs.focus, ['anxiety', 'burnout']);
      await page.uncheck('#pref-actions');
      prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('ma.prefs')));
      assert.equal(prefs.showActions, false);
      assert.ok((await text(page, '#feedback-summary')).includes('1 saved'));
      await shot(page, 'm-settings');

      const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
      backupPath = path.join(os.tmpdir(), 'gw-backup-' + Date.now() + '.json');
      await download.saveAs(backupPath);
      const file = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      assert.equal(file.app, 'groundwork');
      assert.equal(file.data.evidence.length, 2);
      assert.ok(file.data.history.length >= 1);
      assert.deepEqual(file.data.prefs.focus, ['anxiety', 'burnout']);
    });

    await step('routine without small steps skips the action card', async () => {
      await page.goto(BASE + '#routine');
      await page.click('[data-mood=okay]');
      await page.click('#evidence-continue');
      await page.click('#complete-routine');
      assert.equal(await page.locator('#action-card').isVisible(), false);
    });

    await step('import: rejects a non-backup file without changing anything', async () => {
      await page.goto(BASE + '#settings');
      const bad = path.join(os.tmpdir(), 'gw-bad.json');
      fs.writeFileSync(bad, JSON.stringify({ hello: 'world' }));
      await page.setInputFiles('#import-file', bad);
      await page.waitForFunction(() => document.getElementById('settings-status').textContent.length > 0);
      assert.ok((await text(page, '#settings-status')).includes("isn't a Groundwork backup"));
      assert.equal(await page.locator('#import-preview').isVisible(), false);
      const notJson = path.join(os.tmpdir(), 'gw-bad.txt');
      fs.writeFileSync(notJson, 'not json at all');
      await page.setInputFiles('#import-file', notJson);
      await page.waitForFunction(() => document.getElementById('settings-status').textContent.includes("couldn't be read"));
    });

    await step('import: restores a backup into an empty browser, and merging twice adds nothing', async () => {
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.setInputFiles('#import-file', backupPath);
      await page.locator('#import-preview').waitFor();
      assert.ok((await text(page, '#import-summary')).includes('2 evidence entries'));
      await page.click('#import-merge');
      let ev = await page.evaluate(() => JSON.parse(localStorage.getItem('ma.evidence')));
      assert.equal(ev.length, 2);
      await page.setInputFiles('#import-file', backupPath);
      await page.locator('#import-preview').waitFor();
      await page.click('#import-merge');
      await page.waitForFunction(() => document.getElementById('settings-status').textContent.includes('Added 0 evidence'));
      ev = await page.evaluate(() => JSON.parse(localStorage.getItem('ma.evidence')));
      assert.equal(ev.length, 2);
      const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('ma.prefs')));
      assert.deepEqual(prefs.focus, ['anxiety', 'burnout']);
      await page.goto(BASE + '#home');
      assert.notEqual(await text(page, '#home-streak'), 'Start a streak');
    });

    await step('import: replace asks first and swaps the data', async () => {
      await page.goto(BASE + '#evidence');
      await page.fill('#evidence-text', 'Only in this browser.');
      await page.click('#evidence-form button');
      await page.goto(BASE + '#settings');
      await page.setInputFiles('#import-file', backupPath);
      await page.locator('#import-preview').waitFor();
      await page.click('#import-replace'); // dialog auto-accepted
      const ev = await page.evaluate(() => JSON.parse(localStorage.getItem('ma.evidence')));
      assert.equal(ev.length, 2);
      assert.ok(!ev.some((e) => e.text === 'Only in this browser.'));
    });

    await step('reset feedback clears saved/hidden/helpful only', async () => {
      await page.click('#reset-feedback');
      const fb = await page.evaluate(() => JSON.parse(localStorage.getItem('ma.feedback')));
      assert.deepEqual(fb, { favorites: [], hidden: [], helpful: {}, unbelievable: {} });
      const ev = await page.evaluate(() => JSON.parse(localStorage.getItem('ma.evidence')));
      assert.equal(ev.length, 2);
    });

    await step('touch targets and layout', async () => {
      for (const route of ['#home', '#evidence', '#affirmations', '#settings']) {
        await page.goto(BASE + route);
        await noHorizontalScroll(page);
        const small = await page.evaluate(() => [...document.querySelectorAll('button, a.btn, .tabbar a, .chip, label.btn')]
          .filter((e) => e.offsetParent && !e.closest('.visually-hidden'))
          .map((e) => [e.textContent.trim().slice(0, 20), e.getBoundingClientRect().height])
          .filter(([, h]) => h < 44));
        assert.deepEqual(small, [], route + ' has small tap targets');
      }
    });

    assert.deepEqual(page.errors, [], 'no console errors');
    await page.context().close();
  }

  console.log('Returning v1 user (data saved before this update)');
  {
    const page = await newPage(browser, 'Pixel 7');
    await page.goto(BASE);
    await page.evaluate(() => {
      localStorage.clear();
      const pad = (n) => (n < 10 ? '0' : '') + n;
      const k = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      const now = new Date();
      const day = (o) => k(new Date(now.getFullYear(), now.getMonth(), now.getDate() - o));
      localStorage.setItem('ma.evidence', JSON.stringify([
        { id: 'v1a', text: 'Finished the report even though I was exhausted.', date: day(3), created: 1 },
        { id: 'v1b', text: 'Asked for help instead of struggling alone.', date: day(9), created: 2 }
      ]));
      localStorage.setItem('ma.custom', JSON.stringify([{ id: 'v1c', text: 'I can do hard things slowly.', moment: 'hard' }]));
      localStorage.setItem('ma.history', JSON.stringify([day(1), day(2), day(3)]));
    });
    const before = await page.evaluate(() => ({ e: localStorage.getItem('ma.evidence'), c: localStorage.getItem('ma.custom'), h: localStorage.getItem('ma.history') }));
    await page.reload();

    await step('existing data is kept exactly, a backup copy is made, schema is set', async () => {
      const after = await page.evaluate(() => ({
        e: localStorage.getItem('ma.evidence'), c: localStorage.getItem('ma.custom'), h: localStorage.getItem('ma.history'),
        schema: localStorage.getItem('ma.schema'), backup: JSON.parse(localStorage.getItem('ma.backup.v1'))
      }));
      assert.equal(after.e, before.e, 'evidence untouched until edited');
      assert.equal(after.c, before.c);
      assert.equal(after.h, before.h);
      assert.equal(after.schema, '2');
      assert.equal(after.backup.data.evidence, before.e);
      assert.equal(await text(page, '#home-streak'), '3-day streak');
      assert.ok(await page.locator('#onboard').isVisible(), 'v1 users are offered focus areas once');
    });

    await step('old entries show up everywhere they should', async () => {
      await page.click('#onboard-skip');
      assert.equal(await page.locator('#onboard').isVisible(), false);
      await page.goto(BASE + '#evidence');
      assert.equal(await page.locator('#evidence-list li').count(), 2);
      await page.goto(BASE + '#affirmations');
      await page.locator('#library-tabs .chip').filter({ hasText: 'Hard task' }).click();
      assert.ok((await text(page, '#library-list')).includes('I can do hard things slowly.'));
      await page.goto(BASE + '#routine');
      await page.click('[data-mood=okay]');
      assert.equal(await page.locator('#evidence-recall li').count(), 2);
      await page.click('#evidence-continue');
      await page.locator('#routine-moments button').nth(1).click();
      const seen = new Set();
      for (let i = 0; i < 12; i++) { seen.add(await text(page, '#routine-affirmation')); await page.click('#next-affirmation'); }
      assert.ok(seen.has('I can do hard things slowly.'), 'custom statement appears in the routine');
      await page.click('#complete-routine');
      assert.equal(await text(page, '#done-streak'), '4-day streak');
    });

    await step('a second load does not re-run the migration', async () => {
      const b1 = await page.evaluate(() => localStorage.getItem('ma.backup.v1'));
      await page.reload();
      assert.equal(await page.evaluate(() => localStorage.getItem('ma.backup.v1')), b1);
    });
    assert.deepEqual(page.errors, [], 'no console errors');
    await page.context().close();
  }

  console.log('Small phone and desktop');
  {
    const se = await newPage(browser, 'iPhone SE');
    await se.goto(BASE);
    await se.evaluate(() => { localStorage.clear(); localStorage.setItem('ma.prefs', JSON.stringify({ focus: ['relationships'], onboarded: true, showActions: true })); });
    await se.reload();
    await step('iPhone SE: routine buttons reachable without scrolling', async () => {
      await se.click('#start-routine');
      await se.click('[data-mood=rough]');
      await se.click('#evidence-continue');
      for (let i = 0; i < 6; i++) {
        assert.ok(await inViewport(se, '#complete-routine'), 'Complete visible for: ' + await text(se, '#routine-affirmation'));
        await se.click('#next-affirmation');
      }
      await shot(se, 'se-affirmation');
      await noHorizontalScroll(se);
    });
    assert.deepEqual(se.errors, []);
    await se.context().close();

    const desk = await newPage(browser, { viewport: { width: 1280, height: 800 } });
    await desk.goto(BASE);
    await desk.evaluate(() => localStorage.clear());
    await desk.reload();
    await step('desktop: every view renders, centered, no sideways scroll', async () => {
      for (const route of ['#home', '#routine', '#evidence', '#affirmations', '#settings']) {
        await desk.goto(BASE + route);
        await noHorizontalScroll(desk);
        const w = await desk.evaluate(() => document.querySelector('main').getBoundingClientRect().width);
        assert.ok(w <= 560, 'content column stays readable');
      }
      await desk.goto(BASE + '#home');
      await shot(desk, 'desktop-home');
      await desk.click('#onboard-skip');
      await desk.click('#start-routine');
      await desk.click('[data-mood=good]');
      await desk.click('#evidence-continue');
      await desk.click('#complete-routine');
      assert.ok(await desk.locator('#step-done').isVisible());
      await shot(desk, 'desktop-done');
    });
    assert.deepEqual(desk.errors, []);
    await desk.context().close();

    const calm = await newPage(browser, 'iPhone 13', { reducedMotion: 'reduce' });
    await calm.goto(BASE + '#routine');
    await step('reduced motion turns animations off', async () => {
      assert.equal(await calm.evaluate(() => getComputedStyle(document.querySelector('#step-mood')).animationName), 'none');
    });
    await calm.context().close();
  }

  await browser.close();
  console.log('\n' + passed + ' journeys passed');
})().catch((e) => { console.error(e); process.exit(1); });
