// Dev only: fills the library with 300 mock songs to check that the grid, search, and sort
// stay smooth at scale. Rows are built from the real parsed samples (so thumbnails are real),
// with varied titles and learner data. They're marked with storage_path "mock/..." so they can
// be removed without touching real songs.
// Run: npm run seed:300        Remove: npm run seed:300 -- --remove
import { readFileSync, readdirSync } from "node:fs";
import { parseMidiBuffer, type ParsedMidi } from "../src/lib/parseMidi";
import type { SongInsert } from "../src/types";
import { supabase } from "./env";

const COUNT = 300;
const FORMS = ["Nocturne", "Etude", "Waltz", "Prelude", "Invention", "Sonatina", "Ballade", "Lullaby", "Rag", "Study", "Theme", "Song"];
const MOODS = ["in Blue", "for Rain", "at Dusk", "No. 2", "No. 5", "in Spring", "for Anna", "of the Sea", "Revisited", "for Two Hands"];
const TAGS = ["warm-up", "recital", "by ear", "left hand work", "slow practice"];

async function remove() {
  const { data } = await supabase.from("songs").delete().like("storage_path", "mock/%").select("id");
  console.log(`Removed ${data?.length ?? 0} mock songs.`);
}

async function seed() {
  const templates: ParsedMidi[] = [];
  for (const f of readdirSync("public/samples").filter((n) => n.endsWith(".mid"))) {
    const bytes = readFileSync(`public/samples/${f}`);
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    templates.push(await parseMidiBuffer(buf, f));
  }
  const now = Date.now();
  const rows: SongInsert[] = Array.from({ length: COUNT }, (_, i) => {
    const t = templates[i % templates.length];
    const practiced = i % 3 !== 0;
    const count = practiced ? 1 + ((i * 7) % 30) : 0;
    return {
      ...t,
      file_hash: null,
      title: `${FORMS[i % FORMS.length]} ${MOODS[(i * 3) % MOODS.length]} ${i + 1}`,
      file_name: `mock-${i + 1}.mid`,
      storage_path: `mock/${i + 1}.mid`,
      file_size_bytes: 4096,
      is_favorite: i % 11 === 0,
      tags: i % 4 === 0 ? [TAGS[i % TAGS.length]] : [],
      practice_count: count,
      last_practiced_at: practiced ? new Date(now - ((i * 37) % 30) * 86_400_000).toISOString() : null,
      best_accuracy: practiced ? 55 + ((i * 13) % 44) : null,
      created_at: new Date(now - i * 3_600_000).toISOString(),
    };
  });
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from("songs").insert(rows.slice(i, i + 100));
    if (error) throw new Error(error.message);
  }
  console.log(`Inserted ${COUNT} mock songs.`);
}

(process.argv.includes("--remove") ? remove() : seed()).catch((e) => {
  console.error(e);
  process.exit(1);
});
