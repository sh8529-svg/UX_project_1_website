const test = require('node:test'); const assert = require('node:assert'); const fs = require('node:fs');
const { createGame } = require('./deck.js'); const { createSpeaker } = require('./speech.js');
const { createController, drawnSpeech, createAnnouncer } = require('./controller.js');
const P = Array.from({ length: 15 }, (_, i) => ({ id: 'p' + i, text: 't' + i }));

test('deck draws every prompt once; total from data', () => {
  const g = createGame(P); assert.equal(g.total(), 15);
  const seen = []; for (let i = 0; i < 15; i++) seen.push(g.draw().id);
  assert.equal(new Set(seen).size, 15); assert.equal(g.draw(), null); assert.ok(g.isComplete());
  assert.equal(g.position(), 15);
});
test('restart gives fresh deck, first differs from last', () => {
  for (let n = 0; n < 200; n++) {
    const g = createGame(P); let last; while (!g.isComplete()) last = g.draw();
    const first = g.restart(); assert.notEqual(first.id, last.id); assert.equal(g.position(), 1);
    const seen = new Set([first.id]); while (!g.isComplete()) seen.add(g.draw().id); assert.equal(seen.size, 15);
  }
});
function mock() {
  const s = { spoken: [], cancels: 0, speak(u) { s.spoken.push(u); }, cancel() { s.cancels++; }, getVoices: () => [{ lang: 'fr-FR' }, { lang: 'en-GB' }] };
  return s;
}
function U(t) { this.text = t; }
test('speech: cancels old, stale events ignored, cancel not an error', () => {
  const synth = mock(), ev = []; const sp = createSpeaker(synth, U, (s) => ev.push(s.status));
  sp.speak('a', 1); const a = synth.spoken[0]; sp.speak('b', 1); const b = synth.spoken[1];
  assert.equal(synth.cancels, 1); assert.equal(a.voice.lang, 'en-GB');
  ev.length = 0; a.onend(); a.onerror({ error: 'error' }); assert.deepEqual(ev, []);
  b.onerror({ error: 'interrupted' }); assert.equal(ev.at(-1), 'idle');
  sp.speak('c', 1); sp.stop(); ev.length = 0; synth.spoken[2].onerror({ error: 'canceled' }); assert.deepEqual(ev, []);
  sp.speak('d', 1); synth.spoken[3].onerror({ error: 'synthesis-failed' }); assert.equal(ev.at(-1), 'error');
});
test('speech unsupported is a harmless no-op', () => {
  const sp = createSpeaker(undefined, undefined, () => {}); assert.equal(sp.supported, false); sp.speak('x'); sp.stop();
});

// ---- Regression tests for the accessibility fixes (mocked speech: these do not prove real audio or screen-reader behavior) ----
function setup(auto, supported = true) {
  const synth = mock(), msgs = []; let ctl;
  const speaker = supported ? createSpeaker(synth, U, (s) => ctl && ctl.onSpeech(s)) : createSpeaker(undefined, undefined, () => {});
  const game = createGame(P);
  ctl = createController({ game, speaker, render() {}, announce: (m) => msgs.push(m), rate: () => 1, autoRead: () => auto });
  return { synth, msgs, ctl, game, speaker };
}
test('drawing cancels speech even when automatic reading is off, and speaks nothing', () => {
  const { synth, msgs, ctl } = setup(false);
  ctl.draw(); ctl.repeat(); const before = synth.cancels; const spokenBefore = synth.spoken.length;
  ctl.draw();
  assert.ok(synth.cancels > before, 'old speech cancelled');
  assert.equal(synth.spoken.length, spokenBefore, 'nothing new spoken');
  assert.equal(msgs.at(-1), 'Prompt 2 of 15 is ready.');
});
test('auto-read speaks position first; no duplicate status announcement', () => {
  const { synth, msgs, ctl, game } = setup(true);
  ctl.draw();
  assert.equal(synth.spoken[0].text, `Prompt 1 of 15. ${game.current().text}`);
  assert.deepEqual(msgs, []);
});
test('final prompt speech explains completion and restart; next draw restarts at 1', () => {
  const { synth, ctl, game } = setup(true);
  for (let i = 0; i < 15; i++) ctl.draw();
  const t = synth.spoken.at(-1).text;
  assert.ok(t.startsWith('Prompt 15 of 15. ')); assert.ok(t.includes('All 15 prompts have been drawn'));
  assert.ok(t.includes('“Shuffle and start again”'));
  ctl.draw(); assert.ok(synth.spoken.at(-1).text.startsWith('Prompt 1 of 15. ')); assert.equal(game.position(), 1);
  assert.ok(!drawnSpeech(3, 15, 'x', false).includes('deck'));
});
test('final prompt status (auto-read off) says the deck is complete and how to restart', () => {
  const { msgs, ctl } = setup(false);
  for (let i = 0; i < 15; i++) ctl.draw();
  assert.equal(msgs.at(-1), 'Prompt 15 of 15 is ready. All 15 prompts have been drawn. Select “Shuffle and start again” to begin a new deck.');
});
test('rapid draws: stale events from cancelled readings surface no error', () => {
  const { synth, msgs, ctl } = setup(true);
  for (let i = 0; i < 5; i++) ctl.draw();
  const u = synth.spoken; u[0].onerror({ error: 'synthesis-failed' }); u[2].onerror({ error: 'canceled' });
  assert.deepEqual(msgs, []); assert.equal(u.length, 5); assert.equal(synth.cancels, 4);
});
test('error messages name the action that failed; cancellation shows none', () => {
  const { synth, msgs, ctl } = setup(true);
  ctl.draw(); ctl.repeat(); synth.spoken.at(-1).onerror({ error: 'synthesis-failed' });
  assert.ok(msgs.at(-1).includes('“Repeat prompt”'));
  ctl.readRules('rules'); synth.spoken.at(-1).onerror({ error: 'audio-busy' });
  assert.ok(msgs.at(-1).includes('“Read game rules”')); assert.ok(!msgs.at(-1).includes('read button'));
  const n = msgs.length; ctl.repeat(); synth.spoken.at(-1).onerror({ error: 'canceled' }); assert.equal(msgs.length, n);
});
test('unsupported speech: drawing still works and announces', () => {
  const { msgs, ctl, game } = setup(true, false);
  ctl.draw(); assert.equal(game.position(), 1); assert.equal(msgs.at(-1), 'Prompt 1 of 15 is ready.');
});
test('index.html: settings come before draw button; no invented name or prototype/demo labels', () => {
  const h = fs.readFileSync(__dirname + '/index.html', 'utf8');
  assert.ok(h.indexOf('id="auto"') < h.indexOf('id="draw"')); assert.ok(h.indexOf('id="auto-help"') < h.indexOf('id="draw"'));
  assert.ok(h.indexOf('id="auto"') < h.indexOf('id="repeat"'));
  for (const f of ['index.html', 'app.js', 'README.md']) {
    const t = fs.readFileSync(__dirname + '/' + f, 'utf8');
    assert.ok(!/Blurring the Line/i.test(t), f); assert.ok(!/prototype|demo/i.test(t), f);
  }
});
test('index.html: rules appear once, right after the header and before settings and the game area', () => {
  const h = fs.readFileSync(__dirname + '/index.html', 'utf8');
  const at = (x) => h.indexOf(x);
  assert.equal(h.split('id="rules-h"').length - 1, 1); assert.equal(h.split('id="read-rules"').length - 1, 1);
  assert.ok(at('</header>') < at('id="rules-h"')); assert.ok(at('id="read-rules"') < at('id="rules-text"'));
  assert.ok(at('id="rules-h"') < at('id="settings-h"')); assert.ok(at('id="settings-h"') < at('id="game-h"'));
  assert.ok(at('id="read-rules"') < at('id="auto"') && at('id="auto"') < at('id="draw"'));
  assert.ok(!/<details/.test(h));
});
test('speech engine is not touched when nothing is speaking', () => {
  const { synth, ctl } = setup(false);
  ctl.draw(); ctl.draw(); ctl.stop(); assert.equal(synth.cancels, 0);
});

// ---- v3 tests (mock speech/timers: logic only, not real audio or screen-reader behavior) ----
function fakeTimers() { const q = []; return { set: (f) => { q.push(f); return q.length - 1; }, clear: (i) => { q[i] = null; }, run() { q.splice(0).forEach((f) => f && f()); } }; }
function setup2(auto) {
  const synth = mock(), tm = fakeTimers(), texts = [], errors = []; let ctl;
  const ann = createAnnouncer((t) => texts.push(t), tm.set, tm.clear);
  const speaker = createSpeaker(synth, U, (s) => ctl && ctl.onSpeech(s));
  ctl = createController({ game: createGame(P), speaker, render() {}, announce: ann.say, clearAnnouncement: ann.clear,
    showError: (a, m) => errors.push([a, m]), rate: () => 1, autoRead: () => auto });
  return { synth, tm, texts, errors, ctl };
}
test('announcer: a newer message replaces a pending older one', () => {
  const tm = fakeTimers(), texts = []; const a = createAnnouncer((t) => texts.push(t), tm.set, tm.clear);
  a.say('old'); a.say('new'); tm.run();
  assert.ok(!texts.includes('old')); assert.equal(texts.at(-1), 'new');
});
test('starting a reading invalidates a pending announcement', () => {
  const { tm, texts, ctl } = setup2(false);
  ctl.draw(); ctl.repeat(); tm.run(); // "ready" message was pending when speech started
  assert.ok(!texts.includes('Prompt 1 of 15 is ready.'));
  ctl.stop(); ctl.draw(); tm.run(); assert.equal(texts.at(-1), 'Prompt 2 of 15 is ready.'); assert.ok(!texts.includes('Reading stopped.'));
});
test('both Stop buttons share controller.stop(): speech stops, prompt and deck unchanged', () => {
  const { synth, ctl, texts, tm } = setup2(true);
  ctl.draw(); const spoken = synth.spoken.length, c0 = synth.cancels; ctl.stop(); tm.run();
  assert.ok(synth.cancels > c0); assert.equal(synth.spoken.length, spoken); assert.equal(texts.at(-1), 'Reading stopped.');
});
test('speech failure: visible error once, state reset, retry works; cancellation is not an error', () => {
  const synth = mock(); synth.speak = () => { throw new Error('boom'); };
  const ev = []; const sp = createSpeaker(synth, U, (s) => ev.push(s.status));
  sp.speak('a'); assert.equal(ev.filter((s) => s === 'error').length, 1);
  synth.speak = (u) => synth.spoken.push(u); const c = synth.cancels; sp.speak('b');
  assert.equal(synth.cancels, c, 'busy state was reset, so no needless cancel');
  const { synth: s2, errors, ctl } = setup2(true);
  ctl.draw(); s2.spoken[0].onerror({ error: 'interrupted' }); s2.spoken[0].onerror({ error: 'canceled' }); assert.equal(errors.length, 1); // only the begin() clear
  s2.spoken[0].onerror({ error: 'audio-busy' }); assert.equal(errors.at(-1)[0], 'prompt'); assert.ok(errors.at(-1)[1].includes('“Repeat prompt”'));
  ctl.readRules('r'); assert.equal(errors.at(-1)[1], null); s2.spoken.at(-1).onerror({ error: 'audio-busy' });
  assert.equal(errors.at(-1)[0], 'rules'); assert.ok(errors.at(-1)[1].includes('“Read game rules”'));
});
