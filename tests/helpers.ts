import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Midi } from "@tonejs/midi";

/** Every song the suite creates has a title starting with this, so cleanup never touches real songs. */
export const QA_PREFIX = "QA test ";

function readEnv(): Record<string, string> {
  const file = path.resolve(__dirname, "..", ".env.local");
  const env: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

let client: SupabaseClient | null = null;

/**
 * Cleanup must never hang the suite: a stalled request (flaky wifi, laptop waking from sleep)
 * is aborted after 15s and retried a couple of times.
 */
async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fetch(input, { ...init, signal: AbortSignal.timeout(15_000) });
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * Node 20 has no global WebSocket and supabase-js refuses to construct its realtime
 * client without one. The suite never uses realtime, so a stub transport is enough.
 */
export function db(): SupabaseClient {
  if (client) return client;
  const env = readEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars in .env.local");
  const transport = (globalThis as { WebSocket?: unknown }).WebSocket ?? class StubWebSocket {};
  client = createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: fetchWithRetry },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    realtime: { transport: transport as any },
  });
  return client;
}

export type Fixture = { title: string; filePath: string };

/** A MIDI file no one has uploaded before: random notes, unique embedded name. */
export function makeUniqueMidi(): Fixture {
  const id = randomBytes(3).toString("hex");
  const title = `${QA_PREFIX}${id}`;
  const midi = new Midi();
  midi.name = title;
  const track = midi.addTrack();
  track.name = title;
  for (let i = 0; i < 12; i++) {
    track.addNote({
      midi: 48 + Math.floor(Math.random() * 30),
      time: i * 0.4 + Math.random() * 0.1,
      duration: 0.3,
      velocity: 0.8,
    });
  }
  const dir = mkdtempSync(path.join(tmpdir(), "qa-midi-"));
  const filePath = path.join(dir, `qa-${id}.mid`);
  writeFileSync(filePath, Buffer.from(midi.toArray()));
  return { title, filePath };
}

/** Removes QA songs (row, storage object, and their analytics events). Only ever titles with QA_PREFIX. */
export async function deleteSongsByTitle(titles: string[]) {
  const safe = titles.filter((t) => t.startsWith(QA_PREFIX));
  if (!safe.length) return 0;
  const supabase = db();
  const { data, error } = await supabase.from("songs").select("id, storage_path").in("title", safe);
  if (error) throw new Error(error.message);
  return removeRows(data ?? []);
}

/** Safety net: anything left behind by a crashed run. */
export async function deleteAllQaSongs() {
  const { data, error } = await db().from("songs").select("id, storage_path").like("title", `${QA_PREFIX}%`);
  if (error) throw new Error(error.message);
  return removeRows(data ?? []);
}

async function removeRows(rows: { id: string; storage_path: string | null }[]) {
  if (!rows.length) return 0;
  const supabase = db();
  const ids = rows.map((r) => r.id);
  await supabase.from("events").delete().in("song_id", ids);
  const { error } = await supabase.from("songs").delete().in("id", ids);
  if (error) throw new Error(error.message);
  const paths = rows.map((r) => r.storage_path).filter((p): p is string => Boolean(p));
  if (paths.length) await supabase.storage.from("midi").remove(paths);
  return rows.length;
}

export async function songCount() {
  const { count, error } = await db().from("songs").select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Analytics events the suite can cause that are not tied to a song (or lose their song_id when a
 * song is deleted through the UI, since events.song_id is ON DELETE SET NULL).
 */
const QA_EVENT_NAMES = [
  "song_added",
  "upload_failed",
  "duplicate_detected",
  "search_used",
  "filter_used",
  "sort_changed",
  "theme_changed",
  "practice_settings_changed",
  "preview_played",
  "practice_started",
  "transcription_rated",
  "suggestion_clicked",
  "practice_theme_changed",
  "drawer_opened",
];

/**
 * Events the suite causes on demo songs by only reading them (opening a demo song's drawer logs
 * drawer_opened with that song's id). Teardown removes the ones this run created.
 */
const QA_DEMO_READ_EVENTS = ["drawer_opened"];

/** Highest events.id right now. Everything the run creates has a larger id. */
export async function maxEventId(): Promise<number> {
  const { data, error } = await db().from("events").select("id").order("id", { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  return data?.[0]?.id ?? 0;
}

/** Removes song-less events created after `afterId` (i.e. during this run). */
export async function deleteRunEvents(afterId: number) {
  const { data, error } = await db()
    .from("events")
    .delete()
    .gt("id", afterId)
    .is("song_id", null)
    .in("name", QA_EVENT_NAMES)
    .select("id");
  if (error) throw new Error(error.message);
  const { data: reads, error: readsError } = await db()
    .from("events")
    .delete()
    .gt("id", afterId)
    .in("name", QA_DEMO_READ_EVENTS)
    .select("id");
  if (readsError) throw new Error(readsError.message);
  return (data?.length ?? 0) + (reads?.length ?? 0);
}
