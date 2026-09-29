// One-off: fills songs.density for rows created before the column existed,
// by re-reading each song's original MIDI from storage. Safe to re-run.
// Run: npm run backfill:density
import { parseMidiBuffer } from "../src/lib/parseMidi";
import { supabase } from "./env";

async function main() {
  const { data: songs, error } = await supabase.from("songs").select("id, title, file_name, storage_path").is("density", null);
  if (error) throw new Error(error.message);
  let done = 0;
  for (const s of songs ?? []) {
    const file = await supabase.storage.from("midi").download(s.storage_path);
    if (file.error || !file.data) {
      console.log(`skip ${s.title}: file not found`);
      continue;
    }
    const parsed = await parseMidiBuffer(await file.data.arrayBuffer(), s.file_name);
    const { error: e } = await supabase.from("songs").update({ density: parsed.density }).eq("id", s.id);
    if (e) console.log(`skip ${s.title}: ${e.message}`);
    else done++;
  }
  console.log(`Backfilled ${done} of ${songs?.length ?? 0} songs.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
