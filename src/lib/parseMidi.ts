import { Midi } from "@tonejs/midi";
import type { Difficulty, PreviewNote, SongInsert } from "@/types";

/** Everything we learn from the file itself. Storage path and ids are added by songs.ts. */
export type ParsedMidi = Omit<SongInsert, "storage_path" | "file_name" | "file_size_bytes">;

// Krumhansl-Kessler key profiles: how strongly each scale degree implies a key.
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
// Conventional spellings: Db major (not C# major), but C# minor (not Db minor).
const MAJOR_NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MINOR_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

const PREVIEW_MAX_NOTES = 500;
const MIDDLE_C = 60;
/** Notes starting within 30ms of each other are played together (a chord), so they count as one onset. */
const CHORD_WINDOW_SEC = 0.03;

/** Track and sequence names that DAWs and notation apps write by default. Never a song title. */
const GENERIC_NAME =
  /^(untitled|piano|acoustic grand piano|grand piano|track|control track|sequence|midi|song|melody|part)(\s*[-_#]?\s*\d+)?$/i;

function correlate(a: number[], b: number[]) {
  const ma = a.reduce((s, x) => s + x, 0) / 12;
  const mb = b.reduce((s, x) => s + x, 0) / 12;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < 12; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db || 1);
}

/** Correlates a duration-weighted pitch-class histogram against all 24 major and minor keys. */
export function detectKey(hist: number[]) {
  let best = { name: "Unknown", score: -Infinity };
  for (let tonic = 0; tonic < 12; tonic++) {
    const rotated = hist.map((_, i) => hist[(i + tonic) % 12]);
    const maj = correlate(rotated, MAJOR);
    const min = correlate(rotated, MINOR);
    if (maj > best.score) best = { name: `${MAJOR_NAMES[tonic]} major`, score: maj };
    if (min > best.score) best = { name: `${MINOR_NAMES[tonic]} minor`, score: min };
  }
  return { key: best.name, confidence: Math.max(0, best.score) };
}

/**
 * How demanding a song is to play, from three things a teacher would look at:
 * how often the hands have to move (onsets per second), how many notes each move
 * carries (chord size), and how much of the keyboard it covers (span).
 * Raw notes per second alone rates a slow chordal prelude as "hard".
 */
export function difficultyScore(onsetsPerSec: number, avgChordSize: number, spanSemitones: number) {
  const octavesBeyondThree = Math.max(0, spanSemitones / 12 - 3);
  return onsetsPerSec + 0.6 * (avgChordSize - 1) + 0.25 * octavesBeyondThree;
}

export function difficultyFor(score: number): Difficulty {
  return score < 3 ? "easy" : score < 5.5 ? "medium" : "hard";
}

export async function hashBuffer(buf: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Stay lowercase inside a title: "Chopin Prelude in E minor", "Clair de Lune".
// "a" is left out on purpose: in file names it is usually a note ("Minuet in A minor").
const SMALL_WORDS = new Set(["an", "and", "de", "du", "for", "in", "la", "le", "of", "on", "the", "to", "major", "minor"]);

export function prettifyFileName(name: string) {
  return name
    .replace(/\.midi?$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w, i) =>
      i > 0 && SMALL_WORDS.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

/** Prefer the title embedded in the file, unless it's a default like "Piano" or "Track 1". */
function pickTitle(embedded: string | undefined, fileName: string) {
  const name = embedded?.trim();
  if (name && name.length > 1 && !GENERIC_NAME.test(name)) return name;
  return prettifyFileName(fileName) || "Untitled song";
}

/** Parses raw bytes. Kept separate from `File` so Node scripts can run it too. */
export async function parseMidiBuffer(buf: ArrayBuffer, fileName: string): Promise<ParsedMidi> {
  let midi: Midi;
  try {
    midi = new Midi(buf);
  } catch {
    throw new MidiParseError("unreadable");
  }

  const notes = midi.tracks.flatMap((t) => t.notes);
  if (notes.length === 0) throw new MidiParseError("no_notes");

  const hist = new Array<number>(12).fill(0);
  let low = 127;
  let high = 0;
  let rightHand = 0;
  for (const n of notes) {
    hist[n.midi % 12] += n.duration;
    low = Math.min(low, n.midi);
    high = Math.max(high, n.midi);
    if (n.midi >= MIDDLE_C) rightHand++;
  }

  const duration = midi.duration;
  const playable = Math.max(duration, 1);
  const nps = notes.length / playable;
  const { key, confidence } = detectKey(hist);
  const ts = midi.header.timeSignatures[0]?.timeSignature;

  const sorted = [...notes].sort((a, b) => a.time - b.time || a.midi - b.midi);
  let onsets = 0;
  let lastOnset = -Infinity;
  for (const n of sorted) {
    if (n.time - lastOnset > CHORD_WINDOW_SEC) {
      onsets++;
      lastOnset = n.time;
    }
  }
  const ops = onsets / playable;
  const avgChord = notes.length / onsets;
  const score = difficultyScore(ops, avgChord, high - low);

  // The preview is the opening of the song, every note intact, rather than every Nth note of the
  // whole piece: skipping notes breaks chords apart and long pieces turn into noise. The opening is
  // also what a learner practices first.
  const preview: PreviewNote[] = sorted
    .slice(0, PREVIEW_MAX_NOTES)
    .map((n) => ({ p: n.midi, t: +n.time.toFixed(2), d: +n.duration.toFixed(2) }));

  return {
    file_hash: await hashBuffer(buf),
    title: pickTitle(midi.name, fileName),
    duration_sec: +duration.toFixed(2),
    bpm: Math.round(midi.header.tempos[0]?.bpm ?? 120),
    time_signature: ts ? `${ts[0]}/${ts[1]}` : "4/4",
    key_name: key,
    key_confidence: +confidence.toFixed(2),
    note_count: notes.length,
    notes_per_sec: +nps.toFixed(2),
    onsets_per_sec: +ops.toFixed(2),
    avg_chord_size: +avgChord.toFixed(2),
    difficulty_score: +score.toFixed(2),
    difficulty: difficultyFor(score),
    lowest_pitch: low,
    highest_pitch: high,
    right_hand_ratio: +(rightHand / notes.length).toFixed(2),
    track_count: midi.tracks.filter((t) => t.notes.length).length,
    preview_notes: preview,
  };
}

export async function parseMidi(file: File) {
  return parseMidiBuffer(await file.arrayBuffer(), file.name);
}

export class MidiParseError extends Error {
  constructor(public reason: "unreadable" | "no_notes") {
    super(
      reason === "no_notes"
        ? "That file has no notes in it. Try a different MIDI file."
        : "We couldn't read the notes in that file. Try exporting it again, or choose another.",
    );
    this.name = "MidiParseError";
  }
}
