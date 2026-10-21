// Optional real-browser check (needs Playwright + Chromium). Speech is MOCKED: this does not test audio or screen readers.
// Run: NODE_PATH=$(npm root -g) node browser-check.js
const { chromium } = require('playwright'); const assert = require('assert');
const URL = 'file://' + __dirname + '/index.html';
const mockSpeech = () => {
  window.__sp = { spoken: [], cancels: 0, fail: null };
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speaking: false, pending: false,
    getVoices: () => [{ lang: 'en-US', default: true }], addEventListener() {}, cancel() { window.__sp.cancels++; },
    speak(u) { if (window.__sp.fail) setTimeout(() => u.onerror({ error: window.__sp.fail }), 0); else window.__sp.spoken.push(u.text); } } });
};
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 800 } });
  await ctx.addInitScript(mockSpeech); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto(URL);
  const $t = (s) => page.textContent(s), active = () => page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
  const sp = () => page.evaluate(() => window.__sp);

  // Structure (rendered)
  assert.deepStrictEqual(await page.$$eval('h1,h2,h3,h4,h5,h6', (h) => h.map((x) => x.tagName + ':' + x.textContent.trim())),
    ['H1:Story Prompts', 'H2:How to play', 'H3:Example', 'H2:Speech settings', 'H2:Prompt']);
  const snap = await page.locator('body').ariaSnapshot();
  for (const n of ['heading "Story Prompts" [level=1]', 'heading "Example" [level=3]', 'group "Reading speed"', 'radio "Normal" [checked]', 'checkbox "Automatically read prompts"', 'link "Skip to game"', 'link "Speech settings"', 'navigation "Page shortcuts"'])
    assert(snap.includes(n), 'a11y tree missing ' + n);
  assert.equal(await page.locator('main ol > li').count(), 5);
  assert.deepStrictEqual(await page.$$eval('[tabindex]', (e) => e.map((x) => x.tagName + x.id + x.getAttribute('tabindex'))), ['H2settings-h-1', 'H2game-h-1']);
  assert.equal(await page.evaluate(() => document.querySelectorAll('[aria-hidden],[inert],[role=application]').length), 0);
  assert.equal(await active(), 'BODY', 'no focus on load');
  // DOM order == visual order (top positions increase)
  const ys = await page.$$eval('h1,nav,#read-rules,#settings-h,#auto,#game-h,#draw', (e) => e.map((x) => x.getBoundingClientRect().top + scrollY));
  assert.deepStrictEqual(ys, [...ys].sort((a, c) => a - c));

  // Skip links: real keyboard use, focus lands on target heading, next Tab goes to first control after it
  await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Skip to game');
  await page.keyboard.press('Enter'); assert.equal(await active(), 'game-h');
  assert(await page.evaluate(() => { const r = document.getElementById('game-h').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), 'target in view');
  await page.keyboard.press('Tab'); assert.equal(await active(), 'draw');
  await page.evaluate(() => scrollTo(0, 0)); await page.focus('nav a:nth-child(2)'); await page.keyboard.press('Enter');
  assert.equal(await active(), 'settings-h'); await page.keyboard.press('Tab'); assert.equal(await active(), 'auto');

  // Gameplay: stable focus + same element; both Stop buttons; rules; errors; announcements
  await page.evaluate(() => { window.__d = document.getElementById('draw'); }); await page.focus('#draw');
  const same = () => page.evaluate(() => document.activeElement === window.__d);
  for (let i = 1; i <= 15; i++) { await page.keyboard.press(i % 2 ? 'Enter' : 'Space'); assert(await same()); }
  assert.equal(await $t('#draw'), 'Shuffle and start again'); assert((await sp()).spoken.at(-1).includes('Select “Shuffle and start again”'));
  await page.keyboard.press('Enter'); assert.equal(await $t('#progress'), 'Prompt 1 of 15'); assert(await same());
  const prompt = await $t('#prompt'); const c0 = (await sp()).cancels;
  await page.click('#read-rules'); await page.click('#stop-rules'); assert.equal(await active(), 'stop-rules');
  assert((await sp()).cancels > c0); assert.equal(await $t('#prompt'), prompt); assert.equal(await $t('#progress'), 'Prompt 1 of 15');
  const c1 = (await sp()).cancels; await page.click('#repeat'); await page.click('#stop'); assert((await sp()).cancels > c1); assert.equal(await active(), 'stop');
  assert.equal(await $t('#prompt'), prompt);
  // announcements: rapid actions, auto reading off
  await page.uncheck('#auto'); await page.focus('#draw');
  await page.click('#draw'); await page.click('#stop'); await page.waitForTimeout(250); assert.equal(await $t('#status'), 'Reading stopped.');
  await page.click('#stop'); await page.click('#draw'); await page.waitForTimeout(250); assert.equal(await $t('#status'), 'Prompt 3 of 15 is ready.');
  assert.equal((await sp()).spoken.length > 0, true); const n = (await sp()).spoken.length; await page.click('#draw'); assert.equal((await sp()).spoken.length, n);
  // visible errors
  await page.check('#auto'); await page.evaluate(() => { window.__sp.fail = 'synthesis-failed'; });
  await page.click('#repeat'); await page.waitForTimeout(150);
  assert(await page.isVisible('#speech-error')); assert((await $t('#speech-error')).includes('“Repeat prompt”')); assert.equal(await $t('#status'), await $t('#speech-error'));
  await page.click('#read-rules'); await page.waitForTimeout(150);
  assert(await page.isVisible('#rules-error') && !(await page.isVisible('#speech-error'))); assert((await $t('#rules-error')).includes('“Read game rules”'));
  await page.evaluate(() => { window.__sp.fail = 'canceled'; }); await page.click('#repeat'); await page.waitForTimeout(150);
  assert(!(await page.isVisible('#rules-error')) && !(await page.isVisible('#speech-error')), 'cancellation is not an error');

  // Reflow / text size / text spacing at 320 px, with 200% text, and focus rings not clipped
  await page.setViewportSize({ width: 320, height: 700 });
  const fits = () => page.evaluate(() => ({ h: document.documentElement.scrollWidth > innerWidth,
    clipped: [...document.querySelectorAll('button,p,li,h1,h2,h3,label,legend,a')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).display !== 'inline').map((e) => e.id || e.textContent.slice(0, 20)),
    cut: [...document.querySelectorAll('button')].filter((e) => e.scrollHeight > e.clientHeight + 1).map((e) => e.id) }));
  let r = await fits(); assert(!r.h && !r.clipped.length && !r.cut.length, '320px ' + JSON.stringify(r));
  await page.addStyleTag({ content: 'html{font-size:200%}' }); r = await fits(); assert(!r.h && !r.clipped.length && !r.cut.length, '200% ' + JSON.stringify(r));
  await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
  r = await fits(); assert(!r.h && !r.clipped.length && !r.cut.length, 'spacing ' + JSON.stringify(r));
  for (const id of ['draw', 'stop-rules', 'repeat', 'auto']) { await page.focus('#' + id); const m = await page.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return [r.left, innerWidth - r.right]; }); assert(m[0] >= 7 && m[1] >= 7, id + ' focus ring clipped ' + m); }
  assert.equal(await page.evaluate(() => document.querySelectorAll('main p, main li').length > 0 && [...document.querySelectorAll('#rules-text p')].every((p) => p.offsetHeight > 0)), true);
  // Unsupported speech: game works, both Stop buttons + rules button disabled
  const c2 = await b.newContext({ viewport: { width: 390, height: 800 } });
  await c2.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); window.SpeechSynthesisUtterance = undefined; });
  const p2 = await c2.newPage(); await p2.goto(URL);
  for (const id of ['stop', 'stop-rules', 'read-rules', 'repeat', 'auto']) assert(await p2.isDisabled('#' + id), id + ' should be disabled');
  assert(await p2.isVisible('#unsupported')); await p2.click('#draw'); assert.equal(await p2.textContent('#progress'), 'Prompt 1 of 15');
  assert.deepStrictEqual(errs, []); await b.close(); console.log('ALL BROWSER CHECKS PASSED (mocked speech; Chromium only)');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
