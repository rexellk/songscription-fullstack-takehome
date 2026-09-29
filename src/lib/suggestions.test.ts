import { describe, expect, it } from "vitest";
import { suggest } from "@/lib/suggestions";
import { makeSong } from "@/lib/testing";

const NOW = new Date("2026-09-28T12:00:00Z").getTime();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

describe("suggest", () => {
  it("stays hidden until there are two songs", () => {
    expect(suggest([], NOW)).toEqual([]);
    expect(suggest([makeSong()], NOW)).toEqual([]);
  });

  it("starts a brand-new library with its easiest song", () => {
    const [first] = suggest(
      [makeSong({ id: "hard", difficulty_score: 7 }), makeSong({ id: "easy", difficulty_score: 1.5 }), makeSong({ id: "mid", difficulty_score: 4 })],
      NOW,
    );
    expect(first).toMatchObject({ slot: "start_here", label: "Start here" });
    expect(first.song.id).toBe("easy");
  });

  it("offers keep going, a slipping favorite, and something new, without repeats", () => {
    const songs = [
      makeSong({ id: "recent", practice_count: 3, last_practiced_at: daysAgo(0.2) }),
      makeSong({ id: "fav", practice_count: 5, last_practiced_at: daysAgo(12), is_favorite: true }),
      makeSong({ id: "old", practice_count: 5, last_practiced_at: daysAgo(20) }),
      makeSong({ id: "fresh" }),
    ];
    const out = suggest(songs, NOW);
    expect(out.map((s) => [s.slot, s.song.id])).toEqual([
      ["keep_going", "recent"],
      ["revisit", "fav"],
      ["something_new", "fresh"],
    ]);
    expect(out[1].label).toBe("Haven't played in 12 days");
    expect(new Set(out.map((s) => s.song.id)).size).toBe(out.length);
  });

  it("says weeks once it's been two weeks or more", () => {
    const out = suggest(
      [makeSong({ id: "a", practice_count: 1, last_practiced_at: daysAgo(1) }), makeSong({ id: "b", practice_count: 1, last_practiced_at: daysAgo(21) })],
      NOW,
    );
    expect(out.find((s) => s.slot === "revisit")?.label).toBe("Haven't played in 3 weeks");
  });

  it("keeps 'something new' stable within a day", () => {
    const songs = [makeSong({ id: "p", practice_count: 1, last_practiced_at: daysAgo(1) }), ...["n1", "n2", "n3", "n4"].map((id) => makeSong({ id }))];
    const pick = (t: number) => suggest(songs, t).find((s) => s.slot === "something_new")?.song.id;
    expect(pick(NOW)).toBe(pick(NOW + 3 * 3_600_000));
  });
});
