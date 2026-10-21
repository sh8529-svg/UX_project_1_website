// Shuffled deck logic. No browser APIs, so it can be tested in Node.
(function (root) {
  // Fisher–Yates shuffle; returns a new array.
  function shuffle(items, rnd) {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function createGame(prompts, rnd) {
    rnd = rnd || Math.random;
    let order = shuffle(prompts, rnd);
    let index = -1; // -1 = nothing drawn yet
    return {
      total: () => prompts.length,
      current: () => (index >= 0 ? order[index] : null),
      position: () => index + 1, // 0 before first draw
      isComplete: () => index >= 0 && index === order.length - 1,
      // Draws the next prompt, or returns null if the deck is finished.
      draw() { if (index >= order.length - 1) return null; index++; return order[index]; },
      // Fresh deck, shows its first prompt; never equals the previous final prompt.
      restart() {
        const last = index >= 0 ? order[index] : null;
        order = shuffle(prompts, rnd);
        if (last && order.length > 1 && order[0].id === last.id) {
          const k = 1 + Math.floor(rnd() * (order.length - 1));
          [order[0], order[k]] = [order[k], order[0]];
        }
        index = 0;
        return order[0];
      }
    };
  }
  const api = { shuffle, createGame };
  if (typeof module !== 'undefined') module.exports = api; else root.StoryDeck = api;
})(typeof window !== 'undefined' ? window : globalThis);
