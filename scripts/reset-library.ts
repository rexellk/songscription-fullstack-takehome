// Empties the demo library: every song row, every stored MIDI file, and every event.
// Run: npm run reset
import { supabase } from "./env";

async function main() {
  const { data: files } = await supabase.storage.from("midi").list("", { limit: 1000 });
  const paths = (files ?? []).map((f) => f.name);
  if (paths.length) await supabase.storage.from("midi").remove(paths);
  const songs = await supabase.from("songs").delete().not("id", "is", null).select("id");
  const events = await supabase.from("events").delete().gte("id", 0).select("id");
  console.log(`Removed ${songs.data?.length ?? 0} songs, ${paths.length} files, ${events.data?.length ?? 0} events.`);
}

main();
