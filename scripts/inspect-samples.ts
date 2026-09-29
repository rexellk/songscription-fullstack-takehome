// Runs the real parser over every file in public/samples and prints what the library would show.
// Run: npx tsx scripts/inspect-samples.ts
import { readdirSync, readFileSync } from "node:fs";
import { Midi } from "@tonejs/midi";
import { parseMidiBuffer } from "../src/lib/parseMidi";

const dir = "public/samples";
const pitch = (p: number) => ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"][p % 12] + (Math.floor(p / 12) - 1);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

async function main() {
const rows = [];
for (const f of readdirSync(dir).filter((f) => /\.midi?$/i.test(f)).sort()) {
  const bytes = readFileSync(`${dir}/${f}`);
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const s = await parseMidiBuffer(buf, f);
  const raw = new Midi(buf);
  rows.push({
    file: f,
    embedded: raw.name || "(none)",
    title: s.title,
    key: `${s.key_name} (${s.key_confidence})`,
    bpm: s.bpm,
    ts: s.time_signature,
    len: mmss(s.duration_sec ?? 0),
    notes: s.note_count,
    nps: s.notes_per_sec,
    ops: s.onsets_per_sec,
    score: s.difficulty_score,
    diff: s.difficulty,
    hands: `L ${Math.round((1 - (s.right_hand_ratio ?? 0)) * 100)} / R ${Math.round((s.right_hand_ratio ?? 0) * 100)}`,
    range: `${pitch(s.lowest_pitch ?? 0)}-${pitch(s.highest_pitch ?? 0)}`,
    preview: s.preview_notes?.length,
  });
}
console.table(rows);
}

main();
