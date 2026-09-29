import { readFileSync } from "node:fs";
import { Midi } from "@tonejs/midi";
import { describe, expect, it } from "vitest";
import { MidiParseError, detectKey, difficultyFor, difficultyScore, parseMidiBuffer, prettifyFileName } from "@/lib/parseMidi";

const sample = (name: string) => {
  const bytes = readFileSync(`public/samples/${name}`);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};

/** Pitch-class histogram with weight on the given scale degrees (semitones from C). */
const hist = (weights: Record<number, number>) => Array.from({ length: 12 }, (_, i) => weights[i] ?? 0);

describe("detectKey", () => {
  it("finds C major from a C major scale weighted toward the tonic triad", () => {
    expect(detectKey(hist({ 0: 4, 2: 2, 4: 3, 5: 1.5, 7: 3.5, 9: 1.5, 11: 1 })).key).toBe("C major");
  });

  it("finds A minor when A and its triad dominate the same notes", () => {
    expect(detectKey(hist({ 9: 4, 11: 1.5, 0: 3, 2: 1.5, 4: 3.5, 5: 1, 7: 1 })).key).toBe("A minor");
  });

  it("spells major keys with flats the way sheet music does", () => {
    // D flat major scale: Db Eb F Gb Ab Bb C
    const key = detectKey(hist({ 1: 4, 3: 2, 5: 3, 6: 1.5, 8: 3.5, 10: 1.5, 0: 1 })).key;
    expect(key).toBe("Db major");
  });

  it("reports a confidence between 0 and 1", () => {
    const { confidence } = detectKey(hist({ 0: 4, 4: 3, 7: 3 }));
    expect(confidence).toBeGreaterThan(0);
    expect(confidence).toBeLessThanOrEqual(1);
  });
});

describe("difficulty", () => {
  it("rates a slow chordal piece as medium, not hard", () => {
    // Chopin's A major prelude: about 2 onsets a second, chords of 3 to 4 notes, 4 octaves.
    expect(difficultyFor(difficultyScore(2.04, 3.43, 52))).toBe("medium");
  });

  it("rates a simple melody as easy and a fast rag as hard", () => {
    expect(difficultyFor(difficultyScore(1.76, 1, 9))).toBe("easy");
    expect(difficultyFor(difficultyScore(6.98, 2.55, 60))).toBe("hard");
  });

  it("only counts span beyond three octaves", () => {
    expect(difficultyScore(2, 1, 36)).toBe(2);
    expect(difficultyScore(2, 1, 48)).toBeCloseTo(2.25);
  });
});

describe("prettifyFileName", () => {
  it("keeps small words and key qualities lowercase but note names uppercase", () => {
    expect(prettifyFileName("bach-minuet-in-a-minor.mid")).toBe("Bach Minuet in A minor");
    expect(prettifyFileName("debussy_clair_de_lune.MIDI")).toBe("Debussy Clair de Lune");
  });
});

describe("parseMidiBuffer on real files", () => {
  it("reads Für Elise as A minor, medium, and falls back to the file name for its title", async () => {
    const song = await parseMidiBuffer(sample("beethoven-fur-elise.mid"), "beethoven-fur-elise.mid");
    expect(song.key_name).toBe("A minor");
    expect(song.difficulty).toBe("medium");
    expect(song.title).toBe("Beethoven Fur Elise");
  });

  it("uses a meaningful embedded title and ignores generic ones like 'control track'", async () => {
    expect((await parseMidiBuffer(sample("twinkle-twinkle.mid"), "twinkle-twinkle.mid")).title).toBe("Twinkle Twinkle Little Star");
    expect((await parseMidiBuffer(sample("chopin-prelude-in-e-minor.mid"), "chopin-prelude-in-e-minor.mid")).title).toBe(
      "Chopin Prelude in E minor",
    );
  });

  it("keeps the opening notes intact for the thumbnail, at most 500", async () => {
    const song = await parseMidiBuffer(sample("joplin-maple-leaf-rag.mid"), "joplin-maple-leaf-rag.mid");
    expect(song.preview_notes).toHaveLength(500);
    const times = song.preview_notes!.map((n) => n.t);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("produces the same hash for the same bytes, so duplicates are caught", async () => {
    const a = await parseMidiBuffer(sample("c-major-scale.mid"), "a.mid");
    const b = await parseMidiBuffer(sample("c-major-scale.mid"), "b.mid");
    expect(a.file_hash).toBe(b.file_hash);
    expect(a.file_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects a file with no notes and a file that isn't MIDI", async () => {
    const empty = new Midi();
    empty.addTrack();
    await expect(parseMidiBuffer(empty.toArray().buffer as ArrayBuffer, "empty.mid")).rejects.toMatchObject({ reason: "no_notes" });
    await expect(parseMidiBuffer(new TextEncoder().encode("hello").buffer as ArrayBuffer, "x.mid")).rejects.toBeInstanceOf(MidiParseError);
  });
});
