# Decisions

A running log of the choices that shaped this build. Each entry says what we picked, what else we considered, why, and the number that would tell us whether it was right.

The business frame for all of it: Anything Piano has no fixed catalog, so the user's library is the catalog. The funnel is add a song, first practice, come back, streak and mastery, Pro. Every transcription costs GPU time, so the product earns when one song turns into many practice sessions.

**Start here:** #2 (what's parsed and stored), #8 (difficulty), #18 (Up next), #22 (how data is queried and where it stops scaling), and #23 (practice themes). The rest are smaller calls.

---

## 1. Supabase for storage and metadata

**Chose:** Supabase Postgres for song metadata, Supabase Storage for the original `.mid` files.
**Considered:** localStorage or IndexedDB (no backend), SQLite behind a Next.js route.
**Why:** It's Play Anything's stack: Next.js, Tailwind, and Supabase, which the Mobile App Developer role lists as strongly preferred. It persists across devices, and a real Postgres schema lets the data model answer product questions with plain SQL. Keeping the original file means a song can be re-parsed later when the parser improves, without asking the user to upload again.
**Would tell us it's right:** Time from "clone" to "running with data" stays under 10 minutes for a new engineer.

## 2. Parse on the client, store the results

**Chose:** Read the MIDI in the browser on upload and store key, tempo, difficulty, hand split, range, and a 500-note preview as columns.
**Considered:** Parsing on every page load from the stored file; parsing in a server function.
**Why:** The library needs to filter and sort by difficulty and key and draw 300 thumbnails without downloading 300 files. Parsing once and storing the results makes the grid a single query. Client-side parsing keeps the demo free of server code.
**Would tell us it's right:** The library at 300 songs loads in one request and scrolls at 60fps.

## 3. Design tokens replace Tailwind's palette entirely

**Chose:** `tailwind.config.ts` overrides `colors`, `borderRadius`, and `boxShadow` rather than extending them. Every color is a CSS variable swapped by `data-theme`.
**Considered:** Extending the default theme and relying on review to catch stray colors.
**Why:** The design rules (no purple, no shadows, max 6px radius) become impossible to break by accident, because the utilities don't exist. Theme switching is a variable swap, so no component needs `dark:` variants.
**Would tell us it's right:** Zero `dark:` classes and zero raw hex values in `src/components`.

## 4. Contrast usage rules on top of the tokens

**Chose:** Keep the planned token values and add two usage rules: captions on `paper-sunk` use `ink-2` (since `ink-3` on sunk is 4.4 to 4.5:1), and `brass` is never used for small text (4.49:1 on paper). It's fine for icons, focus rings, notes, and as a button fill.
**Considered:** Darkening `ink-3` and `brass` again.
**Why:** The tokens pass everywhere else, and changing them shifts the whole palette. A rule at the two edges is cheaper. `scripts/check-contrast.ts` reads the values from `globals.css` and checks every pairing, so the rule is enforced by a script, not memory. Hairline `rule` borders are decorative structure and sit around 1.7:1. Interactive boundaries (inputs, chips) also carry a text label or icon that passes 3:1.
**Would tell us it's right:** `npx tsx scripts/check-contrast.ts` exits 0.

## 5. Practice settings: library-wide defaults, per-song overrides

**Chose:** Library-wide practice defaults (speed, hands, and practice theme) in the Settings menu, stored in `localStorage`. Per-song overrides stored as nullable columns (`practice_speed`, `practice_hand`, `practice_theme`), where null means "use the default".
**Considered:** Only the light/dark toggle; a single `practice_prefs jsonb` column.
**Why:** The brief asks "what settings might a user want, per file or library-wide, and what lives where". The split we chose: how you like to practice is personal and library-wide, while how a specific hard song needs to be practiced (slower, left hand alone) belongs to that song. Typed columns with check constraints keep bad values out and are easy to query, unlike a JSON blob.
**PM vs engineer:** The engineer wanted jsonb for flexibility. The PM wanted to be able to ask "what share of hard songs get slowed down" in one line of SQL. Typed columns won.
**Would tell us it's right:** Share of songs with a per-song override, and whether songs slowed to 0.5x get more practice starts in the following 14 days than songs of the same difficulty left at 1x.

## 6. Supabase client is created lazily

**Chose:** `getSupabase()` creates the client on first use and throws a readable error if env vars are missing. The page checks `isSupabaseConfigured` and shows a setup notice.
**Considered:** Creating the client at module load.
**Why:** A missing env var shouldn't break `next build` or show a blank page to a reviewer who clones the repo. They see what to do instead.
**Would tell us it's right:** A fresh clone with no `.env.local` builds and renders the setup notice.

## 7. Core logic in plain TypeScript, so it can move to mobile

**Chose:** The logic that decides things is plain TypeScript with no React or browser dependencies:
- `density.ts`, `query.ts`, `suggestions.ts`, `format.ts`, `particles.ts`, `seed.ts`, and `track.ts`
- the Supabase client and row types
- the parser, apart from one hashing call

The browser-bound parts are kept thin and separate: the React hooks (`use*.ts`, `preferences.ts`), audio (`player.ts`), and file handling in `songs.ts`.
**Why:** The real target is an iOS and Android app. A React Native (Expo) version would reuse the scoring, search, suggestions, schema, queries, and unit tests unchanged. What changes:
- the SHA-256 call becomes `expo-crypto`
- file picking becomes the native document picker
- the canvases become react-native-skia
- the drawer becomes a native bottom sheet
- Tone.js becomes native audio

**Would tell us it's right:** A mobile prototype imports those pure modules unchanged, and the unit tests run against both.

## 8. Difficulty from how the hands move, not raw note count

**Chose:** A score from onsets per second (notes starting within 30ms count once), average chord size, and keyboard span beyond three octaves. Buckets: easy under 3, medium under 5.5, hard above. The score, onsets per second, and chord size are stored as columns next to `notes_per_sec`.
**Considered:** My first version, which used notes per second (under 3 easy, under 6 medium).
**Why:** Run against real files, notes per second rated Chopin's A major prelude (slow, chordal, one of the easiest) as hard, because every chord note counted separately. It also rated Clair de lune as easy, since it's slow but covers almost six octaves. The new score gives 3 easy, 5 medium, 3 hard across the 11 samples, in an order a teacher would recognize. The continuous score also makes "easiest first" a real ordering instead of three ties.
**PM vs engineer:** The engineer wanted a learned model. The PM wanted something explainable in one sentence in the drawer. Three terms, explainable, won.
**Would tell us it's right:** Songs rated hard have a lower first-week practice completion rate than easy ones, and "Not usable" ratings don't cluster on songs we call easy. Longer term, compare against the difficulty users pick in mastery mode.

## 9. Key detection: conventional spelling, honest confidence

**Chose:** Spell keys the way sheet music does (D♭ major, C♯ minor) and store the correlation as `key_confidence`, shown in the drawer as a quiet "likely" when it's under 0.9.
**Known limitation:** Chopin's Raindrop prelude (D♭ major) is detected as A♭ major at 0.86. Its repeated A♭ is the dominant, which pulls a pitch-histogram method toward the wrong key. This is the classic weakness of Krumhansl-Schmuckler.
**Would tell us it's right:** In the transcription feedback notes, how often "the key is wrong" comes up for songs with confidence at or above 0.9 compared with below.

## 10. Titles: trust the file only when it says something

**Chose:** Use the MIDI's embedded name unless it's a default such as "Piano", "Track 1", or LilyPond's "control track". Otherwise prettify the file name, keeping small words and key qualities lowercase ("Chopin Prelude in E minor").
**Why:** Eight of the 11 sample files embed "control track". Real transcriptions will have the same problem, and a library full of identical titles is unusable.
**Would tell us it's right:** Rename rate after upload (once renaming exists). If people rename most songs, titles are failing.

## 11. Upload failures are specific, and batches are summarized

**Chose:** Validate extension and size before reading the file, then check the 4-byte `MThd` header, so a renamed `.txt` gets "That file isn't a MIDI file" instead of a parse error. Each failure reason has its own copy, and network failures get a "Try again" action. A multi-file upload gets one summary toast ("Added 2 songs. 1 was already in your library.").
**Why:** "Did my song work?" is the question at the activation step. Ten toasts for ten files is noise. One wrong file in a batch still gets its own error, with the file name.
**Would tell us it's right:** `upload_failed` share by reason. `wrong_type` should fall as the picker's `accept` filter does its job. `storage_error` spikes point at infrastructure, not users.

## 12. Real sample songs

**Chose:** Added eight public domain piano pieces from the Mutopia Project (credited in `public/samples/CREDITS.md`) beside the three starter files.
**Why:** Three short files can't show what the library looks like with variety: different keys, difficulty, hand balance, lengths, and busy versus sparse piano rolls. Only public domain files were used, in line with the company's stance on licensed training data.
**Would tell us it's right:** Share of new visitors who press "Load demo library" and then open or practice a song in the same visit.

## 13. Piano roll thumbnails show the opening, every note intact

**Chose:** `preview_notes` holds the first 500 notes of the song, unaltered. The card draws them with the pitch range fitted to those notes.
**Considered:** Every Nth note across the whole song (the original plan).
**Why:** Skipping notes breaks chords apart, so long pieces like Clair de lune rendered as scattered dots and every long song looked the same. The opening, drawn in full, is recognizable: Clair de lune's rolling arpeggios, the Raindrop prelude's repeated A♭ as one brass line. It's also the part a learner starts with, so the thumbnail previews the first practice session.
**Would tell us it's right:** Time from library load to the first song opened. Longer term, whether people open the song they meant to open (few quick open-and-close pairs).

## 14. Search is forgiving, filters are few

**Chose:** Search matches every word, in any order, across titles and tags, with accents folded ("fur elise" finds "Für Elise"). One difficulty or favorites chip at a time, a key dropdown that lists only keys in the library, and five sorts. `/` focuses search. Clearing filters keeps your sort.
**Considered:** Folders, multi-select chips, a full filter panel.
**Why:** At 11 songs nobody filters. At 300, people look for one song by a half-remembered word, or for "something easy". Folders ask the user to organize before they get value. Tags already cover that, and search reads them.
**Would tell us it's right:** `search_used` with `result_count = 0` stays rare. `filter_used` shows which chips earn their space, so remove the ones nobody taps.

## 15. The drawer is where learning decisions happen

**Chose:** Song facts, hands, difficulty, and progress are always in the same order, with advice written from the data ("Most of this song sits in the left hand. Try the left hand alone first."). Per-song practice settings sit at the bottom. The drawer is a side panel on desktop and a bottom sheet on phones, traps focus, and returns focus to the card on close.
**Why:** "Can I play this, and which hand is hard?" is the question a learner asks before a first session. Answering it from the MIDI itself is honest, and it matches the app's one-hand practice and difficulty levels.
**Would tell us it's right:** Share of `drawer_opened` followed by `practice_started` on the same song within 30 minutes.

## 16. A scrim token for the overlay

**Chose:** `--scrim` is ink at 20% in light mode and ebony at 60% in dark mode.
**Considered:** Ink at 20% in both modes, as first drafted.
**Why:** In dark mode, `ink` is a light ivory, so the overlay would have brightened the page behind the drawer instead of dimming it. Both values are built from existing tokens, so no new color enters the palette.
**Would tell us it's right:** The drawer reads as a layer above the page in both modes (checked in screenshots), and the contrast script still passes.

## 17. Audio loads on first play, from the audio clock

**Chose:** Tone.js and the Salamander grand piano samples load the first time someone presses play. Notes are scheduled on the Tone transport, and the playhead reads the transport clock. One song plays at a time: cards preview 10 seconds, the drawer previews 20, both capped at the song's length.
**Why:** Tone.js and 30 piano samples would double the first load for a feature not everyone uses. Reading the audio clock keeps the playhead in sync with what you hear, even when frames drop. Closing the drawer or deleting a song stops playback.
**Would tell us it's right:** `preview_played` followed by `practice_started` on the same song. That's the case for previews: hearing a song makes people want to play it.

## 18. Up next: three reasons to sit down at the piano

**Chose:** One featured song and two quieter rows. The featured song is the one practiced most recently ("Keep going"). Then a favorite, or failing that any song, untouched for 7+ days ("Haven't played in 12 days"). Then a song never practiced, rotating daily rather than on every render ("Something new"). A brand-new library features its easiest song as "Start here" (logged as its own slot). Hidden when the library has fewer than two songs.
**Considered:** Three identical cards; a single "continue" button; a recommendation score.
**Why:** Each slot maps to a retention job. Keep going builds streaks. Revisit catches a favorite before it's forgotten. Something new turns an upload that cost GPU time into a first practice session. The rules fit in one sentence each, so the label explains the choice.
**Would tell us it's right:** Practice starts by slot (the first README query), which also credits a practice started in the drawer after opening an Up next song, because the drawer carries the slot. If "something_new" rarely leads to practice, uploads aren't converting to first sessions and onboarding needs work.

## 19. Settings: personal defaults in the popover, song needs in the drawer

**Chose:** The Settings menu (behind the avatar) holds Appearance (Light, Dark, System) and practice defaults (speed, hands, theme), saved in localStorage on this device. Each song can override all three. The override is stored on the row, and null means "follow the default", so changing a default reaches every song you never customized.
**Why:** This answers the brief's "what settings, and where". How you like to practice is about you. How a hard song needs practicing is about the song.
**Would tell us it's right:** Share of practice starts on songs with an override. If it stays near zero, the per-song setting can go and the defaults are enough.

## 20. Demo history tells a story, and 300 songs stay fast

**Chose:** "Load demo library" adds all eleven samples, then gives them a hand-written practice history: a daily warm-up, a recital piece in progress, a favorite drifting away, songs never started. Separately, `npm run seed:300` inserts 300 mock rows to test scale.
**Measured at 311 songs (dev mode):** first card at 1.7s, search repaint about 33ms per keystroke, re-sort 20ms, scrolling at 56fps. Songs payload 3.2 MB, almost all preview notes.
**Would tell us it's right:** p75 time to first card under 2 seconds at 300 songs in production.
**What's next:** a small thumbnail column, the full notes loaded when the drawer opens, and pagination past a few hundred songs.

## 21. What the final review round changed

I ran four review passes (design, QA, product, and copy) over the finished product, using Claude Code subagents, then fixed what they found. The main changes:
- **Drawer.** It has three bands (About this song, Your practice, Feedback) instead of eight equal sections. It has a sticky top bar, so the close button never floats over text, and it goes fully dark in practice mode.
- **Controls.** One shared segmented control for every setting, in the popover and the drawer, and one selected style everywhere: a brass border plus a fill. Before, dark-mode selection relied on a fill with under 3:1 contrast.
- **Accessibility.** The page behind the drawer is `inert`, and focus returns to the card that opened it. That was a real bug: focus went to the page body. The drawer keeps its accessible name in practice mode. Tap targets are 40px on phones, and card times read as "3 days ago" to screen readers.
- **Instrumentation.** A practice started in the drawer after opening an Up next song keeps its slot. "Start here" is its own slot. There's a new `drawer_opened` event and an unused event was removed. The Up next rows say "Practice" instead of showing a play icon that didn't play anything.
- **Mobile.** A shorter Up next, an icon-only sort control so search has room, and rating options that stack.

**Considered and deferred:** a visible streak and a per-visit session id on events, so D1 and D7 retention can be measured per person. Both are high value but outside the brief. They're first on the "what's next" list.

## 22. How data is stored and queried, and where it stops scaling

**Chose:**
- **One read.** `select * order by created_at desc`, using `songs_created_idx`.
- **Search, filter, and sort run in the browser** over the list already loaded.
- **Writes send only the changed fields and read back only those fields.** A favorite toggle's response is 64 bytes.
- **Dedup is one indexed lookup** on the unique `file_hash`.
- **Events are append-only**, indexed on `(name, created_at)` for the funnel queries and on `song_id` for per-song joins and delete cleanup.

**Considered:** Querying Postgres on every keystroke with the trigram index. Paginating from the first song.
**Why:** A personal library is tens to a few hundred songs. One fetch makes every search, filter and sort instant with zero round trips, and it works on a flaky connection once loaded. Server-side search would add a network round trip per keystroke and gain nothing at this size.

The trigram, tag, and last-practiced indexes are in the schema on purpose. They're what the server-side path uses when a library outgrows one fetch. Their write cost at this scale is negligible.

**Known limits, in order of what to fix first:**
1. **The list download grows with the library.** It's 3.2 MB at 311 songs, almost all `preview_notes`. Fix: a small generated thumbnail column for the list, with the full notes fetched when the drawer opens.
2. **Beyond about 1,000 songs,** move to keyset pagination on `(created_at, id)` and server-side search on the trigram index.
3. **`practice_count` is read-modify-write from the client.** That's fine for one user on one device. For real multi-device use it becomes an atomic `increment_practice()` database function, and a `practice_sessions` table replaces the mocked counters, which also gives real streaks.
4. **RLS is open for the single mocked user.** Production adds `user_id` and `auth.uid() = user_id` policies.

**Would tell us it's right:** Search repaint stays under 50ms per keystroke and first card under 2s (p75) at 300 songs. Past that, the limits above are the plan.

## 23. Practice themes: color inside the stage, never in the library

**Chose:** The practice view plays the song's opening (up to 45 seconds) as falling notes onto a keyboard. Keys light as notes land, and the chosen theme bursts particles from each key: Embers, Petals, Snow, Stardust, or Off. The library default lives in the Settings menu. Each song can override it, stored in `songs.practice_theme`, where null means "use the default". Reduced motion keeps the notes and drops the particles.
**How it stays smooth:**
- One canvas driven by the audio clock.
- A fixed pool of 400 particles in typed arrays, with no objects created per frame.
- At most 60 new particles per frame.
- The additive glow (`lighter`) is used only on the particle layer.

Measured at 61fps on Maple Leaf Rag, the densest sample, in every theme.
**Considered:** A full 88-key keyboard, as first planned.
**Why not:** In a 460px panel, 88 keys are 8px each. The keyboard instead covers the song's range, rounded out to whole octaves and at least three, so the keys you'll play are wide enough to read.
**Why build it at all:** Practice is the product. Themes are the kind of personal touch people share on TikTok, and a natural Pro perk. Keeping every glow inside the always-dark stage protects the quiet library design.
**Would tell us it's right:** `practice_theme_changed` counts by theme, and whether people who pick a theme start more practice sessions in the following week than people on the default.

## 24. Final polish: small libraries and silent openings

**Chose:**
- **Small libraries.** Below four songs, the library has no search and filter toolbar. The grid ends with an "Add another song" tile instead, and any leftover filter is ignored, so it can't hide songs with no way to clear it.
- **Silent openings.** Previews start 0.4 seconds before the first note, so a file that opens with a pickup bar or a count-in plays and animates immediately. The rolls line up with the same start.

**Why:** A toolbar for two songs is noise. The second and third songs are where a habit starts, so the space goes to adding them. A preview that stays silent for three seconds reads as broken, especially on the first song someone tries.
**Would tell us it's right:** The share of libraries that reach three songs in the first session, and fewer preview plays abandoned in the first two seconds.

## 25. Where it gets hard, and a sheet you can swipe away

**Chose:**
- **Where it gets hard.** Each song stores a 40-point `density` profile: how often notes start in each fortieth of the whole song. The drawer draws it as a thin strip, with the busiest stretch in ink, and a sentence names it ("Busiest from 2:00 to 3:38. Try that part at 75% first.").
  - The profile is smoothed, the stretch must be at least three sections wide, and it's judged by the median of its sections, so one loud final chord can't pass for a hard passage.
  - Songs under 30 seconds don't show it.
  - Steady songs say "The pace stays about the same all the way through."
- **Swipe to dismiss.** On phones, the drawer's top bar follows your finger and closes past 120px or on a quick flick, otherwise it snaps back. The close button still works everywhere.

**Why:** "Which part do I need to slow down for?" is a question every learner asks, and the answer comes from data already parsed at upload. It points straight at the per-song speed setting. The swipe is what anyone on a phone tries first on a bottom sheet with a handle.
**Known limit:** density only measures pace. In steady pieces like Chopin's E minor prelude, the hard part is chords and reach, which the difficulty sentence covers instead.
**Would tell us it's right:** Songs whose drawer shows a hard stretch get more per-song speed overrides, and more practice starts at 75% or 50%, than songs that don't.

## 26. Quick edits can't overwrite each other

**Found by:** an intermittent test failure in the final health check. Opening Practice saves a session in the background. If the learner picked a theme before that save came back, the late response replaced the whole song with a copy taken before the theme change, so the theme appeared to reset. The database was always right.
**Chose:** Optimistic updates now merge into the current row and touch only the fields that save changed. A failed save rolls back only its own fields.
**Why:** People tap fast on phones. Favorite, then tag, then theme, all within a second, is normal use, and each tap has to stick.
**Would tell us it's right:** No reports of settings "not saving", and the end-to-end suite stays green across repeated runs (it passed several full runs after the fix).
