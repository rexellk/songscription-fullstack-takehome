# QA tests (Playwright)

Run: `npx playwright test` (Chromium only, serial, one worker). Only `tests/**/*.spec.ts` is collected
(`testMatch`); the Vitest unit tests in `src/**/*.test.ts` run with `npm run test:unit`.

- Uses the dev server on http://localhost:3000. If it's already running it is reused, otherwise `npm run dev` is started.
- Talks to the REAL Supabase project from `.env.local`. Every test generates a unique MIDI file at runtime
  with `@tonejs/midi` (embedded name `QA test <hex>`, which becomes the song title), so uploads never collide
  with existing songs by hash.
- Cleanup: `afterEach` deletes the songs the test created (row, `midi` storage object, and their `events` rows)
  with supabase-js. `global-teardown.ts` sweeps any leftover title starting with `QA test ` in case a run crashed.
  Nothing without that prefix is ever deleted.
- Node 20 WebSocket: supabase-js refuses to build its realtime client without a WebSocket global, and `ws` is not
  installed. The suite never uses realtime, so `helpers.ts` passes a stub transport class
  (`realtime: { transport }`, using the native `WebSocket` when it exists). No `NODE_OPTIONS` needed.
- Empty and loading states are tested with `page.route` on `/rest/v1/songs` (fake `[]` / delayed GET), so the
  real library is never emptied.
- Events: `global-setup.ts` records the highest `events.id`; `global-teardown.ts` deletes song-less events
  (search_used, filter_used, theme_changed, upload_failed, song_added of UI-deleted songs, ...) with a larger id.
  Events tied to a QA song are deleted with the song.
- Supabase calls from the suite time out after 15s and retry, so a stalled network can't hang `afterEach`.
  If the laptop sleeps mid-run, uploads can still time out; rerun.
- Demo songs are only ever read (search, filter, sort, open/close drawer). Every write goes to a QA song.
- Known app bugs are asserted, not skipped: 7c (focus doesn't return to the card title when the drawer closes)
  and 7d (the drawer has no accessible name in practice mode). They go green once the app is fixed.
- The audio tests (card preview, practice stage Play) skip themselves if tonejs.github.io is unreachable.
- Practice stage, song theme, and practice_started tests run on a QA song only. The Up next slot test
  narrows the songs GET (via `page.route`) to two QA songs, so Up next is built from them alone ("Start here").
- `drawer_opened` events logged when a test only opens a demo song's drawer are removed by teardown.
- The library practice theme lives in localStorage (fresh per test context); the test still resets it to Embers.
