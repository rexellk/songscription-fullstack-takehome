import type { Song, SongUpdate } from "@/types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type History = {
  daysAgo?: number;
  sessions?: number;
  best?: number;
  favorite?: boolean;
  tags?: string[];
  rating?: Song["quality_rating"];
};

/**
 * A believable few weeks of practice for the demo library, so Up next, progress,
 * and "last practiced" sorting have something real to work with. Written by hand
 * rather than randomized, so the demo tells the same story every time:
 * a daily warm-up, a recital piece in progress, a favorite drifting away, and
 * a few songs added but never started.
 */
const DEMO_HISTORY: Record<string, History> = {
  "chopin-prelude-in-e-minor.mid": { daysAgo: 0.2, sessions: 4, best: 76, tags: ["left hand work"] },
  "c-major-scale.mid": { daysAgo: 1, sessions: 30, best: 98, tags: ["warm-up"] },
  "beethoven-fur-elise.mid": { daysAgo: 2, sessions: 14, best: 88, favorite: true, tags: ["recital"], rating: "right" },
  "bach-minuet-in-a-minor.mid": { daysAgo: 4, sessions: 9, best: 91, tags: ["slow practice"] },
  "chopin-prelude-in-a-major.mid": { daysAgo: 9, sessions: 11, best: 84, favorite: true },
  "debussy-clair-de-lune.mid": { daysAgo: 12, sessions: 6, best: 71, favorite: true, tags: ["recital", "slow practice"] },
  "twinkle-twinkle.mid": { daysAgo: 18, sessions: 22, best: 97, tags: ["warm-up"] },
  "burgmuller-arabesque.mid": { daysAgo: 21, sessions: 3, best: 62, tags: ["left hand work"] },
  "joplin-maple-leaf-rag.mid": { tags: ["by ear"] },
  "chopin-raindrop-prelude.mid": {},
  "debussy-first-arabesque.mid": {},
};

export function demoHistory(song: Song, now = Date.now()): SongUpdate | null {
  const h = DEMO_HISTORY[song.file_name];
  if (!h) return null;
  const practiced = h.sessions && h.daysAgo !== undefined;
  return {
    practice_count: h.sessions ?? 0,
    last_practiced_at: practiced ? new Date(now - (h.daysAgo ?? 0) * DAY).toISOString() : null,
    best_accuracy: practiced ? (h.best ?? null) : null,
    is_favorite: h.favorite ?? false,
    tags: h.tags ?? [],
    quality_rating: h.rating ?? null,
  };
}
