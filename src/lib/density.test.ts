import { describe, expect, it } from "vitest";
import { hardPartAdvice, hardestPart, smooth } from "@/lib/density";
import { densityProfile } from "@/lib/parseMidi";

const flat = (v: number) => new Array(40).fill(v);

describe("densityProfile", () => {
  it("counts onsets per second in 40 equal sections", () => {
    const profile = densityProfile([0, 0.5, 1, 1.5, 38, 39.9], 40);
    expect(profile).toHaveLength(40);
    expect(profile[0]).toBe(2);
    expect(profile[39]).toBe(1);
  });
});

describe("hardestPart", () => {
  it("finds a busy middle section and suggests slowing it down", () => {
    const d = flat(2);
    for (let i = 18; i < 24; i++) d[i] = 9;
    const part = hardestPart(d, 200)!;
    expect(part.even).toBe(false);
    expect(part.from).toBeGreaterThanOrEqual(16);
    expect(part.to).toBeLessThanOrEqual(25);
    expect(hardPartAdvice(part)).toMatch(/^Busiest from \d:\d\d to \d:\d\d\. Try that part at (50|75)% first\.$/);
  });

  it("calls a steady song even, and ignores a single busy chord", () => {
    expect(hardestPart(flat(3), 120)!.even).toBe(true);
    const spike = flat(3);
    spike[39] = 7;
    expect(hardestPart(spike, 120)!.even).toBe(true);
  });

  it("stays quiet for short pieces and missing data", () => {
    expect(hardestPart(flat(3), 20)).toBeNull();
    expect(hardestPart(null, 120)).toBeNull();
  });

  it("smooths without changing length", () => {
    expect(smooth([0, 0, 10, 0, 0])).toHaveLength(5);
    expect(smooth([0, 0, 10, 0, 0])[2]).toBeCloseTo(10 * 3 / 9);
  });
});
