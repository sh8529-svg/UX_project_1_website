(function () {
  const $ = (id) => document.getElementById(id);
  const RATES = { slow: 0.8, normal: 1, fast: 1.25 };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  const game = StoryDeck.createGame(window.PROMPTS);
  const total = game.total();
  let autoRead = store.get('storyPrompts.autoRead', 'true') === 'true';
  let speed = store.get('storyPrompts.speed', 'normal');
  if (!(speed in RATES)) speed = 'normal';

  const el = {
    prompt: $('prompt'), progress: $('progress'), draw: $('draw'), repeat: $('repeat'),
    stop: $('stop'), stopRules: $('stop-rules'), complete: $('complete'), status: $('status'), speechState: $('speech-state'),
    auto: $('auto'), rulesBtn: $('read-rules'), rules: $('rules-text'), unsupported: $('unsupported'),
    rulesError: $('rules-error'), promptError: $('speech-error')
  };

  const announcer = StoryController.createAnnouncer((t) => { el.status.textContent = t; }, setTimeout.bind(window), clearTimeout.bind(window));
  function showError(area, msg) { // visible, non-live error text next to the relevant controls
    el.rulesError.hidden = el.promptError.hidden = true;
    if (!area) return;
    const target = area === 'rules' ? el.rulesError : el.promptError;
    target.textContent = msg; target.hidden = false;
  }

  let controller;
  const speaker = StorySpeech.createSpeaker(window.speechSynthesis, window.SpeechSynthesisUtterance, (s) => {
    el.speechState.textContent = s.status === 'speaking' ? 'Reading aloud…' : ''; // ordinary text, not live
    if (controller) controller.onSpeech(s);
  });

  function render() {
    const cur = game.current();
    el.prompt.textContent = cur ? cur.text : 'Draw a prompt to begin.';
    el.progress.textContent = cur ? `Prompt ${game.position()} of ${total}` : `0 of ${total} prompts drawn.`;
    el.draw.textContent = !cur ? 'Draw a prompt' : game.isComplete() ? 'Shuffle and start again' : 'Next prompt';
    el.complete.hidden = !game.isComplete();
    el.repeat.disabled = !cur || !speaker.supported;
  }

  controller = StoryController.createController({
    game, speaker, render, showError,
    announce: announcer.say, clearAnnouncement: announcer.clear,
    rate: () => RATES[speed],
    autoRead: () => autoRead
  });

  el.draw.addEventListener('click', () => controller.draw());
  el.repeat.addEventListener('click', () => controller.repeat());
  [el.stop, el.stopRules].forEach((b) => b.addEventListener('click', () => controller.stop())); // same behavior for both
  el.rulesBtn.addEventListener('click', () => controller.readRules(el.rules.textContent.replace(/\s+/g, ' ').trim()));

  el.auto.checked = autoRead;
  el.auto.addEventListener('change', () => {
    autoRead = el.auto.checked;
    store.set('storyPrompts.autoRead', String(autoRead));
    if (!autoRead) speaker.stop(); // turning off cancels current speech
  });
  document.querySelectorAll('input[name="speed"]').forEach((r) => {
    r.checked = r.value === speed;
    r.addEventListener('change', () => { speed = r.value; store.set('storyPrompts.speed', speed); }); // affects next reading only
  });

  if (!speaker.supported) {
    el.unsupported.hidden = false;
    [el.stop, el.stopRules, el.rulesBtn, el.auto].forEach((c) => { c.disabled = true; });
    document.querySelectorAll('input[name="speed"]').forEach((r) => { r.disabled = true; });
  }
  render();
})();
