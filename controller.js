// Game actions + spoken/announced wording. No browser APIs, so it can be tested in Node.
(function (root) {
  const q = (t) => '“' + t + '”';
  // What is spoken when a prompt is drawn with automatic reading on.
  function drawnSpeech(position, total, text, complete) {
    let s = `Prompt ${position} of ${total}. ${text}`;
    if (complete) s += ` All ${total} prompts have been drawn. Select ${q('Shuffle and start again')} to begin a new deck.`;
    return s;
  }
  // Short status for the polite live region when nothing is being spoken.
  function readyMessage(position, total, complete) {
    return `Prompt ${position} of ${total} is ready.` +
      (complete ? ` All ${total} prompts have been drawn. Select ${q('Shuffle and start again')} to begin a new deck.` : '');
  }
  function errorMessage(action) {
    return action === 'rules'
      ? `Speech problem: the rules could not be read aloud, or reading stopped unexpectedly. The written rules are on this page. To try again, select ${q('Read game rules')}.`
      : `Speech problem: the prompt could not be read aloud, or reading stopped unexpectedly. The prompt is still shown on this page. To try again, select ${q('Repeat prompt')}.`;
  }
  // Live-region updates: a newer message (or cancel/clear) always cancels an older pending one.
  function createAnnouncer(setText, setTimer, clearTimer, delay) {
    let pending = null;
    const cancel = () => { if (pending !== null) { clearTimer(pending); pending = null; } };
    return {
      say(msg) { cancel(); setText(''); pending = setTimer(() => { pending = null; setText(msg); }, delay === undefined ? 50 : delay); },
      cancel,
      clear() { cancel(); setText(''); }
    };
  }
  // o: game, speaker, rate(), autoRead(), announce(msg), render(), [clearAnnouncement()], [showError(area, msg|null)]
  function createController(o) {
    const clear = o.clearAnnouncement || (() => {}), showError = o.showError || (() => {});
    let lastAction = 'draw';
    const begin = (action) => { lastAction = action; clear(); showError(null); }; // drop stale messages/errors
    return {
      draw() {
        o.speaker.stop(); // always cancel old speech first, even when automatic reading is off
        begin('draw');
        const cur = o.game.isComplete() ? o.game.restart() : o.game.draw();
        const pos = o.game.position(), total = o.game.total(), done = o.game.isComplete();
        o.render();
        if (o.autoRead() && o.speaker.supported) o.speaker.speak(drawnSpeech(pos, total, cur.text, done), o.rate());
        else o.announce(readyMessage(pos, total, done)); // only when nothing is spoken: avoids duplicates
      },
      repeat() { const c = o.game.current(); if (!c) return; begin('repeat'); o.speaker.speak(c.text, o.rate()); },
      readRules(text) { begin('rules'); o.speaker.speak(text, o.rate()); },
      stop() { o.speaker.stop(); showError(null); o.announce('Reading stopped.'); }, // used by both Stop buttons
      onSpeech(s) {
        if (s.status !== 'error') return; // cancellations/interruptions arrive as 'idle', never as errors
        const msg = errorMessage(lastAction);
        showError(lastAction === 'rules' ? 'rules' : 'prompt', msg); // visible text (not a live region)
        o.announce(msg); // announced once
      }
    };
  }
  const api = { drawnSpeech, readyMessage, errorMessage, createAnnouncer, createController };
  if (typeof module !== 'undefined') module.exports = api; else root.StoryController = api;
})(typeof window !== 'undefined' ? window : globalThis);
