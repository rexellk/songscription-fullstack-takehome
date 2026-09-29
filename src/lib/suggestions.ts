import { daysSince } from "@/lib/format";
import type { SuggestionSlot } from "@/lib/track";
import type { Song } from "@/types";

export type Suggestion = { slot: SuggestionSlot; song: Song; label: string };

const REVISIT_AFTER_DAYS = 7;

/** Stable within a day, different tomorrow: "something new" shouldn't reshuffle on every render. */
function dailyRank(id: string, now: number) {
  const day = Math.floor(now / 86_400_000);
  let h = day;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return h >>> 0;
}

const byDifficulty = (a: Song, b: Song) => (a.difficulty_score ?? 0) - (b.difficulty_score ?? 0);

function revisitLabel(days: number) {
  if (days >= 14) return `Haven't played in ${Math.floor(days / 7)} weeks`;
  return `Haven't played in ${days} days`;
}

/**
 * Answers "what should I practice today?" with up to three songs, one per reason:
 * 1. Keep going: the song practiced most recently (momentum; feeds streaks).
 * 2. Revisit: a favorite not touched in a week or more (retention before it's forgotten).
 * 3. Something new: a song never practiced, rotating daily (turns uploads into first sessions).
 * Each slot falls back sensibly, and no song appears twice.
 */
export function suggest(songs: Song[], now = Date.now()): Suggestion[] {
  if (songs.length < 2) return [];
  const used = new Set<string>();
  const out: Suggestion[] = [];
  const take = (slot: SuggestionSlot, song: Song | undefined, label: string) => {
    if (!song || used.has(song.id)) return;
    used.add(song.id);
    out.push({ slot, song, label });
  };

  const practiced = songs
    .filter((s) => s.last_practiced_at)
    .sort((a, b) => daysSince(a.last_practiced_at, now) - daysSince(b.last_practiced_at, now));
  const fresh = songs.filter((s) => s.practice_count === 0);

  if (practiced.length) {
    take("keep_going", practiced[0], "Keep going");
  } else {
    // A brand-new library: the easiest song is the best first session.
    take("start_here", [...fresh].sort(byDifficulty)[0], "Start here");
  }

  const stale = practiced
    .filter((s) => !used.has(s.id) && daysSince(s.last_practiced_at, now) >= REVISIT_AFTER_DAYS)
    .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || daysSince(b.last_practiced_at, now) - daysSince(a.last_practiced_at, now));
  if (stale[0]) take("revisit", stale[0], revisitLabel(daysSince(stale[0].last_practiced_at, now)));

  const unplayed = fresh.filter((s) => !used.has(s.id)).sort((a, b) => dailyRank(a.id, now) - dailyRank(b.id, now));
  take("something_new", unplayed[0], "Something new");

  // Still short: fill with the next most recently practiced songs.
  for (const s of practiced) {
    if (out.length >= 3) break;
    take("keep_going", s, "Keep going");
  }
  for (const s of unplayed) {
    if (out.length >= 3) break;
    take("something_new", s, "Something new");
  }
  return out.slice(0, 3);
}
