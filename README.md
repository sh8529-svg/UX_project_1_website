# Story Prompts

A simple website that draws a random story prompt and reads it aloud with the browser's built-in text-to-speech. Players tell the story out loud themselves. The site does not record audio, remember the story, or use any speech service.

## Preview
Double-click `index.html` (Chrome, Edge, Safari or Firefox). Nothing to install.

## Using it
- **Page order:** title, shortcuts, How to play (rules, always expanded), Speech settings, Prompt.
- **Shortcuts near the top:** "Skip to game" and "Speech settings" are ordinary links. Activating one moves you to that section's heading; press Tab to reach its controls.
- **Speech settings:** "Automatically read prompts" and reading speed. You can use the built-in reading controls or your own screen reader. If you use a screen reader, you may prefer to turn automatic reading off.
- **Reading controls:** "Read game rules" and a "Stop reading" button sit together in How to play. "Draw a prompt / Next prompt / Shuffle and start again", "Repeat prompt" and a second "Stop reading" are in the Prompt section. Both Stop buttons do the same thing and never change the prompt or deck.
- **Automatic reading on:** the site speaks "Prompt 3 of 15", then the prompt (and on the last one, that the deck is complete). **Off:** a short status message says the prompt is ready; the full text stays on the page.
- **Speech problems** appear as visible text next to the relevant controls (and are announced once), naming "Repeat prompt" or "Read game rules" to retry. Intentional stopping is never shown as an error.
- Edit prompts in `prompts.js`.

## What changed in this version
Skip links; a Stop button beside "Read game rules"; announcements that cancel stale pending messages; visible speech errors; a final-prompt status that explains restarting; speech state reset when `speak()` throws; a standard visually-hidden style for the status region; "Reading aloud…" is now ordinary non-live text; wrapping fixes for very large text.

## Tests performed
- `node --test game.test.js` (Node 18+): 18 logic tests (deck, speech, controller, announcements) with mocked speech and timers.
- `browser-check.js` (optional, needs Playwright and Chromium): heading/landmark tree, skip links and focus, stable focus while drawing, stop buttons, announcements, visible errors, 320 px reflow, 200% text, WCAG text-spacing overrides, focus rings not clipped, unsupported speech. Speech is mocked.
- Measured contrast: body and headings 16.2:1; muted notes 9.4:1; button text on yellow 11.4:1; focus outline 16.2:1 on the page and 11.4:1 on yellow.

## Not tested; please check manually
Real audio playback; macOS VoiceOver (Safari), iOS VoiceOver, NVDA, TalkBack; Firefox and Safari rendering; real browser zoom at 200%; whether speech and a screen reader talk over each other on your devices.

## Known limitations
Voices and speech behavior vary by device and browser. Screen-reader announcements can vary even with valid markup. This is an AA-targeted implementation, not a certified audit.

## Publish later (free static hosting)
Upload the folder to Netlify Drop or GitHub Pages. No build step or keys.
