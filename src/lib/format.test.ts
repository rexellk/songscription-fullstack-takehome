import { describe, expect, it } from "vitest";
import { formatDuration, formatMinutes, pitchName, timeAgo, timeAgoSpoken } from "@/lib/format";

const NOW = new Date("2026-09-28T12:00:00Z").getTime();
const ago = (sec: number) => new Date(NOW - sec * 1000).toISOString();

describe("format", () => {
  it("formats durations and practice time", () => {
    expect(formatDuration(204)).toBe("3:24");
    expect(formatDuration(null)).toBe("–:––");
    expect(formatMinutes(372)).toBe("6h 12m");
    expect(formatMinutes(45)).toBe("45m");
  });

  it("names pitches with middle C as C4", () => {
    expect(pitchName(60)).toBe("C4");
    expect(pitchName(21)).toBe("A0");
  });

  it("writes short times for the screen and full words for screen readers", () => {
    expect(timeAgo(ago(30), NOW)).toBe("just now");
    expect(timeAgo(ago(3 * 86_400), NOW)).toBe("3d ago");
    expect(timeAgo(ago(21 * 86_400), NOW)).toBe("3w ago");
    expect(timeAgoSpoken(ago(3 * 86_400), NOW)).toBe("3 days ago");
    expect(timeAgoSpoken(ago(3_600), NOW)).toBe("1 hour ago");
  });
});
