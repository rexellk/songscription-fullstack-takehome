import { MidiParseError, parseMidi } from "@/lib/parseMidi";
import { MIDI_BUCKET, getSupabase } from "@/lib/supabase";
import { track, type UploadFailureReason } from "@/lib/track";
import type { Song, SongUpdate } from "@/types";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export type SongSource = "upload" | "sample" | "seed";

export type AddSongResult =
  | { status: "added"; song: Song }
  | { status: "duplicate"; song: Song }
  | { status: "failed"; reason: UploadFailureReason; message: string };

/** Plain-language copy for each failure, written for the person holding the file. */
export const FAILURE_COPY: Record<UploadFailureReason, string> = {
  wrong_type: "That file isn't a MIDI file. Try a .mid file.",
  too_large: "That file is larger than 5 MB. Try a smaller MIDI file.",
  parse_error: "We couldn't read the notes in that file. Try exporting it again, or choose another.",
  storage_error: "We couldn't save that song. Check your connection and try again.",
  insert_error: "We couldn't save that song. Check your connection and try again.",
};

const UNIQUE_VIOLATION = "23505";

/** Cheap checks first, before reading a byte of the file. */
export function validateFile(file: File): UploadFailureReason | null {
  if (!/\.midi?$/i.test(file.name)) return "wrong_type";
  if (file.size > MAX_FILE_BYTES) return "too_large";
  return null;
}

/** Every Standard MIDI File starts with "MThd". Catches a renamed .txt or .mp3. */
async function hasMidiHeader(file: File) {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return String.fromCharCode(...head) === "MThd";
}

/** Uses the unique index on file_hash. Throws if the lookup itself fails, so we never upload blind. */
async function findByHash(hash: string) {
  const { data, error } = await getSupabase().from("songs").select("*").eq("file_hash", hash).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function fail(reason: UploadFailureReason, source: SongSource, message = FAILURE_COPY[reason]): AddSongResult {
  track("upload_failed", { reason, source });
  return { status: "failed", reason, message };
}

/**
 * The whole "add a song" pipeline: validate, parse, dedupe, store the file, insert the row.
 * Never throws. Every outcome comes back as a result the UI can show.
 */
export async function addSong(file: File, source: SongSource = "upload"): Promise<AddSongResult> {
  const invalid = validateFile(file);
  if (invalid) return fail(invalid, source);
  if (!(await hasMidiHeader(file))) return fail("wrong_type", source);

  let parsed;
  try {
    parsed = await parseMidi(file);
  } catch (err) {
    const message = err instanceof MidiParseError ? err.message : FAILURE_COPY.parse_error;
    return fail("parse_error", source, message);
  }

  // Same file already in the library: skip the upload (and, in production, the GPU work).
  let existing: Song | null = null;
  try {
    existing = parsed.file_hash ? await findByHash(parsed.file_hash) : null;
  } catch {
    return fail("storage_error", source);
  }
  if (existing) {
    track("duplicate_detected", { source }, { songId: existing.id });
    return { status: "duplicate", song: existing };
  }

  const supabase = getSupabase();
  const storagePath = `${crypto.randomUUID()}.mid`;
  const upload = await supabase.storage
    .from(MIDI_BUCKET)
    .upload(storagePath, file, { contentType: "audio/midi", upsert: false });
  if (upload.error) return fail("storage_error", source);

  const { data: song, error } = await supabase
    .from("songs")
    .insert({ ...parsed, file_name: file.name, storage_path: storagePath, file_size_bytes: file.size })
    .select("*")
    .single();

  if (error || !song) {
    // Don't leave an orphaned file behind.
    await supabase.storage.from(MIDI_BUCKET).remove([storagePath]);
    // Two identical uploads raced and the other one won: that's a duplicate, not an error.
    if (error?.code === UNIQUE_VIOLATION && parsed.file_hash) {
      const winner = await findByHash(parsed.file_hash).catch(() => null);
      if (winner) {
        track("duplicate_detected", { source }, { songId: winner.id });
        return { status: "duplicate", song: winner };
      }
    }
    return fail("insert_error", source);
  }

  track("song_added", { source, duration_sec: song.duration_sec, difficulty: song.difficulty }, { songId: song.id });
  return { status: "added", song };
}

export async function listSongs(): Promise<Song[]> {
  const { data, error } = await getSupabase().from("songs").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Saves a partial change and returns only the columns that changed, not the whole row:
 * a favorite toggle shouldn't download the 500-note preview again.
 */
export async function updateSong(id: string, patch: SongUpdate): Promise<SongUpdate> {
  const columns = ["id", ...Object.keys(patch)].join(",");
  const { data, error } = await getSupabase().from("songs").update(patch).eq("id", id).select(columns).single();
  if (error) throw new Error(error.message);
  return data as SongUpdate;
}

export async function deleteSong(song: Pick<Song, "id" | "storage_path">) {
  const supabase = getSupabase();
  const { error } = await supabase.from("songs").delete().eq("id", song.id);
  if (error) throw new Error(error.message);
  // The row is what the user sees. If the file cleanup fails, it's an orphan, not a broken library.
  await supabase.storage.from(MIDI_BUCKET).remove([song.storage_path]);
}

/**
 * A practice session, mocked until the real piano roll reports scores: one more session,
 * practiced now, and an accuracy that tends to improve with practice and depends on difficulty.
 */
export function practicePatch(song: Song, now = new Date()): SongUpdate {
  const base = song.difficulty === "hard" ? 55 : song.difficulty === "medium" ? 65 : 75;
  const learning = Math.min(20, song.practice_count * 1.5);
  const attempt = Math.min(99, base + learning + Math.random() * 12);
  return {
    practice_count: song.practice_count + 1,
    last_practiced_at: now.toISOString(),
    best_accuracy: Math.round(Math.max(song.best_accuracy ?? 0, attempt)),
  };
}

/** Turns a file in public/samples into a File, so samples go through the real pipeline. */
export async function sampleFile(fileName: string): Promise<File> {
  const res = await fetch(`/samples/${fileName}`);
  if (!res.ok) throw new Error(`Sample ${fileName} is missing`);
  return new File([await res.blob()], fileName, { type: "audio/midi" });
}
