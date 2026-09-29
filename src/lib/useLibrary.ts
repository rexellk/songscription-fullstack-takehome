"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { addSong, listSongs, updateSong, type AddSongResult, type SongSource } from "@/lib/songs";
import type { Song, SongUpdate } from "@/types";

export type PendingUpload = { id: string; fileName: string };
export type LibraryStatus = "loading" | "ready" | "error";

type Options = {
  /** Called when an upload turns out to be a song that's already in the library. */
  onDuplicate?: (song: Song) => void;
};

const UPLOAD_CONCURRENCY = 3;

async function runPool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await worker(items[i]);
      }
    }),
  );
  return results;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function useLibrary({ onDuplicate }: Options = {}) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [status, setStatus] = useState<LibraryStatus>("loading");
  const [pending, setPending] = useState<PendingUpload[]>([]);
  /** Songs added this session, so only they fade in (not the whole library on load). */
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());
  const onDuplicateRef = useRef(onDuplicate);
  useEffect(() => {
    onDuplicateRef.current = onDuplicate;
  }, [onDuplicate]);

  const reload = useCallback(async () => {
    setStatus("loading");
    try {
      setSongs(await listSongs());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addFiles = useCallback(async (files: File[], source: SongSource = "upload") => {
    if (files.length === 0) return;
    const jobs = files.map((file) => ({ file, id: crypto.randomUUID() }));
    setPending((p) => [...jobs.map(({ id, file }) => ({ id, fileName: file.name })), ...p]);

    const results = await runPool(jobs, UPLOAD_CONCURRENCY, async ({ file, id }) => {
      const result = await addSong(file, source);
      setPending((p) => p.filter((u) => u.id !== id));
      if (result.status === "added") {
        setSongs((s) => [result.song, ...s.filter((x) => x.id !== result.song.id)]);
        setFreshIds((f) => new Set(f).add(result.song.id));
      }
      return { file, result };
    });

    announce(results, source, (file) => addFiles([file], source), onDuplicateRef.current);
    return results.map((r) => r.result);
  }, []);

  /** Local-only change after a successful server update, or to roll one back. */
  const replaceSong = useCallback((song: Song) => {
    setSongs((s) => s.map((x) => (x.id === song.id ? song : x)));
  }, []);

  const removeSong = useCallback((id: string) => {
    setSongs((s) => s.filter((x) => x.id !== id));
  }, []);

  const insertSong = useCallback((song: Song) => {
    setSongs((s) => [song, ...s.filter((x) => x.id !== song.id)].sort((a, b) => b.created_at.localeCompare(a.created_at)));
  }, []);

  /**
   * Optimistic update: show the change now, save in the background, put it back if saving fails.
   * The server's copy replaces the optimistic one on success so both stay in sync.
   */
  const patchSong = useCallback(
    async (song: Song, patch: SongUpdate, failure = "We couldn't save that change. Try again.") => {
      replaceSong({ ...song, ...patch });
      try {
        const saved = await updateSong(song.id, patch);
        replaceSong({ ...song, ...patch, ...saved });
        return true;
      } catch {
        replaceSong(song);
        toast.error(failure);
        return false;
      }
    },
    [replaceSong],
  );

  return { songs, status, pending, freshIds, reload, addFiles, replaceSong, removeSong, insertSong, patchSong };
}

/**
 * One toast per outcome that needs attention. A single upload gets specific copy;
 * a batch gets one summary so ten files don't mean ten toasts.
 */
function announce(
  results: { file: File; result: AddSongResult }[],
  source: SongSource,
  retry: (file: File) => void,
  onDuplicate?: (song: Song) => void,
) {
  const added = results.flatMap((r) => (r.result.status === "added" ? [r.result.song] : []));
  const duplicates = results.flatMap((r) => (r.result.status === "duplicate" ? [r.result.song] : []));
  const failed = results.filter((r) => r.result.status === "failed");

  if (results.length === 1) {
    const [{ result }] = results;
    if (result.status === "added") toast(`Added ${result.song.title}`);
    if (result.status === "duplicate") {
      toast("Already in your library", { description: result.song.title });
      onDuplicate?.(result.song);
    }
  } else if (added.length || duplicates.length) {
    const parts = [];
    if (added.length) parts.push(`Added ${plural(added.length, "song", "songs")}`);
    if (duplicates.length) parts.push(`${duplicates.length} ${duplicates.length === 1 ? "was" : "were"} already in your library`);
    toast(parts.length > 1 ? `${parts.join(". ")}.` : parts[0]);
  }

  for (const { file, result } of failed) {
    if (result.status !== "failed") continue;
    const canRetry = result.reason === "storage_error" || result.reason === "insert_error";
    toast.error(result.message, {
      description: file.name,
      action: canRetry && source === "upload" ? { label: "Try again", onClick: () => retry(file) } : undefined,
    });
  }
}
