import { describe, expect, it } from "vitest";
import { DEFAULT_QUERY, applyQuery, isFiltering, keysInLibrary, normalize } from "@/lib/query";
import { makeSong } from "@/lib/testing";

const library = [
  makeSong({ id: "a", title: "Für Elise", key_name: "A minor", difficulty: "medium", difficulty_score: 5.4, tags: ["recital"], created_at: "2026-09-03T00:00:00Z" }),
  makeSong({ id: "b", title: "Chopin Prelude in E minor", key_name: "E minor", difficulty: "medium", difficulty_score: 3.5, is_favorite: true, created_at: "2026-09-02T00:00:00Z" }),
  makeSong({ id: "c", title: "Twinkle Twinkle", key_name: "C major", difficulty: "easy", difficulty_score: 1.8, created_at: "2026-09-01T00:00:00Z", last_practiced_at: "2026-09-10T00:00:00Z" }),
  makeSong({ id: "d", title: "Maple Leaf Rag", key_name: "Ab major", difficulty: "hard", difficulty_score: 8.4, created_at: "2026-09-04T00:00:00Z" }),
];
const ids = (songs: { id: string }[]) => songs.map((s) => s.id);

describe("applyQuery", () => {
  it("folds accents and matches words in any order, across titles and tags", () => {
    expect(ids(applyQuery(library, { ...DEFAULT_QUERY, text: "fur elise" }))).toEqual(["a"]);
    expect(ids(applyQuery(library, { ...DEFAULT_QUERY, text: "minor chopin" }))).toEqual(["b"]);
    expect(ids(applyQuery(library, { ...DEFAULT_QUERY, text: "recital" }))).toEqual(["a"]);
  });

  it("combines a chip with the key filter", () => {
    expect(ids(applyQuery(library, { ...DEFAULT_QUERY, filter: "medium", key: "E minor" }))).toEqual(["b"]);
    expect(ids(applyQuery(library, { ...DEFAULT_QUERY, filter: "favorites" }))).toEqual(["b"]);
  });

  it("sorts by the continuous difficulty score, and by recency", () => {
    expect(ids(applyQuery(library, { ...DEFAULT_QUERY, sort: "easiest" }))).toEqual(["c", "b", "a", "d"]);
    expect(ids(applyQuery(library, { ...DEFAULT_QUERY, sort: "recent" }))).toEqual(["d", "a", "b", "c"]);
    expect(ids(applyQuery(library, { ...DEFAULT_QUERY, sort: "practiced" }))[0]).toBe("c");
  });

  it("doesn't mutate the library it's given", () => {
    const before = ids(library);
    applyQuery(library, { ...DEFAULT_QUERY, sort: "title" });
    expect(ids(library)).toEqual(before);
  });
});

describe("helpers", () => {
  it("knows when the user is filtering", () => {
    expect(isFiltering(DEFAULT_QUERY)).toBe(false);
    expect(isFiltering({ ...DEFAULT_QUERY, sort: "title" })).toBe(false);
    expect(isFiltering({ ...DEFAULT_QUERY, text: " x " })).toBe(true);
  });

  it("lists only keys present, C to B, major before minor", () => {
    expect(keysInLibrary(library)).toEqual(["C major", "E minor", "Ab major", "A minor"]);
  });

  it("normalizes case and accents", () => {
    expect(normalize("  Burgmüller ")).toBe("burgmuller");
  });
});
