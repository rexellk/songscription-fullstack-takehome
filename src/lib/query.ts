import type { Song } from "@/types";

export type Filter = "all" | "favorites" | "easy" | "medium" | "hard";
export type SortKey = "recent" | "practiced" | "title" | "easiest" | "hardest";

export type LibraryQuery = {
  text: string;
  filter: Filter;
  key: string | null;
  sort: SortKey;
};

export const DEFAULT_QUERY: LibraryQuery = { text: "", filter: "all", key: null, sort: "recent" };

export const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "favorites", label: "Favorites" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

export const SORTS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Recently added" },
  { value: "practiced", label: "Last practiced" },
  { value: "title", label: "Title A to Z" },
  { value: "easiest", label: "Easiest first" },
  { value: "hardest", label: "Hardest first" },
];

export function isFiltering(q: LibraryQuery) {
  return q.text.trim() !== "" || q.filter !== "all" || q.key !== null;
}

/** Folds accents so "fur elise" finds "Für Elise" and "burgmuller" finds "Burgmüller". */
export function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const byTitle = (a: Song, b: Song) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
const score = (s: Song) => s.difficulty_score ?? s.notes_per_sec ?? 0;
const time = (iso: string | null) => (iso ? new Date(iso).getTime() : -Infinity);

const COMPARE: Record<SortKey, (a: Song, b: Song) => number> = {
  recent: (a, b) => time(b.created_at) - time(a.created_at),
  practiced: (a, b) => time(b.last_practiced_at) - time(a.last_practiced_at) || byTitle(a, b),
  title: byTitle,
  easiest: (a, b) => score(a) - score(b) || byTitle(a, b),
  hardest: (a, b) => score(b) - score(a) || byTitle(a, b),
};

/**
 * Search matches every word anywhere in the title or tags, in any order,
 * so "prelude chopin" and "left hand" both work.
 */
export function applyQuery(songs: Song[], q: LibraryQuery): Song[] {
  const words = normalize(q.text).split(/\s+/).filter(Boolean);
  const result = songs.filter((s) => {
    if (q.filter === "favorites" && !s.is_favorite) return false;
    if ((q.filter === "easy" || q.filter === "medium" || q.filter === "hard") && s.difficulty !== q.filter) return false;
    if (q.key && s.key_name !== q.key) return false;
    if (words.length) {
      const haystack = normalize([s.title, ...s.tags].join(" "));
      if (!words.every((w) => haystack.includes(w))) return false;
    }
    return true;
  });
  return result.sort(COMPARE[q.sort]);
}

const TONIC_ORDER = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "G", "G#", "Ab", "A", "Bb", "B"];

/** Only keys that exist in the library, ordered C to B, major before minor. */
export function keysInLibrary(songs: Song[]) {
  const keys = new Set(songs.map((s) => s.key_name).filter((k): k is string => !!k && k !== "Unknown"));
  return [...keys].sort((a, b) => {
    const [ta, ma] = a.split(" ");
    const [tb, mb] = b.split(" ");
    return TONIC_ORDER.indexOf(ta) - TONIC_ORDER.indexOf(tb) || ma.localeCompare(mb);
  });
}
