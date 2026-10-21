// Wrapper around the browser's built-in text-to-speech.
(function (root) {
  function createSpeaker(synth, Utter, onChange) {
    const supported = !!(synth && Utter);
    let token = 0;      // identifies the newest reading; older events are ignored
    let busy = false;   // true while one of our readings is active
    let current = null; // keeps a reference so browsers don't garbage-collect it mid-speech
    let voices = [];
    const loadVoices = () => { try { voices = synth.getVoices() || []; } catch (e) { voices = []; } };
    if (supported) {
      loadVoices();
      if (synth.addEventListener) synth.addEventListener('voiceschanged', loadVoices);
    }
    function pickVoice() {
      const en = voices.filter(v => /^en([-_]|$)/i.test(v.lang || ''));
      return en.find(v => v.default) || en[0] || null;
    }
    // Only call cancel() when something is actually speaking, so idle button presses never touch the speech engine.
    function cancelIfNeeded() {
      if (busy || synth.speaking || synth.pending) { try { synth.cancel(); } catch (e) {} }
      busy = false;
    }
    function speak(text, rate) {
      if (!supported) return;
      const mine = ++token;
      cancelIfNeeded();
      const u = new Utter(text);
      u.lang = 'en-US';
      u.rate = rate || 1;
      const v = pickVoice();
      if (v) { u.voice = v; u.lang = v.lang; }
      u.onstart = () => { if (mine === token) onChange({ status: 'speaking' }); };
      u.onend = () => { if (mine === token) busy = false; if (mine === token) onChange({ status: 'idle' }); };
      u.onerror = (e) => {
        if (mine !== token) return;
        busy = false;
        const expected = e && (e.error === 'canceled' || e.error === 'interrupted');
        onChange({ status: expected ? 'idle' : 'error' });
      };
      current = u;
      onChange({ status: 'starting' });
      busy = true;
      try { synth.speak(u); } catch (e) { if (mine === token) { busy = false; onChange({ status: 'error' }); } }
    }
    function stop() {
      token++; // makes any pending events from the old reading harmless
      if (supported) cancelIfNeeded();
      onChange({ status: 'idle' });
    }
    return { supported, speak, stop };
  }
  const api = { createSpeaker };
  if (typeof module !== 'undefined') module.exports = api; else root.StorySpeech = api;
})(typeof window !== 'undefined' ? window : globalThis);
