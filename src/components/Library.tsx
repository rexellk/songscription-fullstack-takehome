"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { Header } from "@/components/Header";
import { NoResults } from "@/components/NoResults";
import { SongGrid } from "@/components/SongGrid";
import { Toolbar } from "@/components/Toolbar";
import { SongDrawer, type DrawerMode } from "@/components/SongDrawer";
import { UpNext, UpNextSkeleton } from "@/components/UpNext";
import { demoHistory } from "@/lib/seed";
import { suggest, type Suggestion } from "@/lib/suggestions";
import { DEFAULT_QUERY, applyQuery, isFiltering, keysInLibrary, type LibraryQuery } from "@/lib/query";
import { track, type SuggestionSlot } from "@/lib/track";
import { DropOverlay, FilePicker, useWindowFileDrop, type FilePickerHandle } from "@/components/UploadDropzone";
import { FIRST_SAMPLE, SAMPLE_FILES } from "@/lib/samples";
import { deleteSong, practicePatch, sampleFile, type SongSource } from "@/lib/songs";
import { useLibrary } from "@/lib/useLibrary";
import { stopPreview } from "@/lib/usePlayer";
import { DrawerPreview } from "@/components/DrawerPreview";
import type { Song } from "@/types";
import { toast } from "sonner";

/** Search and filters earn their space once there's something to search. */
const TOOLBAR_FROM = 4;

export function Library() {
  const picker = useRef<FilePickerHandle>(null);
  const [selected, setSelected] = useState<{ id: string; mode: DrawerMode; slot?: SuggestionSlot } | null>(null);
  // The element that opened the drawer. Saved before the page goes inert, restored after it wakes up.
  const opener = useRef<HTMLElement | null>(null);
  const openSong = useCallback(
    (song: Song, mode: DrawerMode = "details", surface: "card" | "up_next" | "duplicate" = "card", slot?: SuggestionSlot) => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setSelected({ id: song.id, mode, slot });
      track("drawer_opened", { surface }, { songId: song.id });
    },
    [],
  );
  const closeSong = useCallback(() => {
    setSelected(null);
    stopPreview();
  }, []);
  const drawerOpen = selected !== null;
  useEffect(() => {
    if (drawerOpen) return;
    const el = opener.current;
    opener.current = null;
    if (el && document.contains(el)) el.focus({ preventScroll: true });
  }, [drawerOpen]);
  const onDuplicate = useCallback((song: Song) => openSong(song, "details", "duplicate"), [openSong]);
  // Uploading a song that's already here opens it, so the answer to "did it work?" is the song itself.
  const library = useLibrary({ onDuplicate });
  const { songs, status, pending, freshIds, addFiles, patchSong, removeSong, insertSong } = library;
  const selectedSong = selected ? (songs.find((s) => s.id === selected.id) ?? null) : null;
  const [fetchingSamples, setFetchingSamples] = useState(false);
  const [query, setQuery] = useState<LibraryQuery>(DEFAULT_QUERY);
  // Typing stays instant at 300 songs; the grid catches up a frame later if it has to.
  const deferredQuery = useDeferredValue(query);
  // Without a toolbar there's no way to see or clear a filter, so small libraries ignore it.
  const hasToolbar = songs.length >= TOOLBAR_FROM;
  const visible = useMemo(() => applyQuery(songs, hasToolbar ? deferredQuery : DEFAULT_QUERY), [songs, deferredQuery, hasToolbar]);
  const keys = useMemo(() => keysInLibrary(songs), [songs]);
  const filtering = hasToolbar && isFiltering(query);
  // True for the frame or two while a big library catches up with what was just typed.
  const catchingUp = query !== deferredQuery;

  const changeQuery = useCallback((patch: Partial<LibraryQuery>) => {
    setQuery((q) => ({ ...q, ...patch }));
    if (patch.filter !== undefined) track("filter_used", { filter: patch.filter });
    if (patch.key !== undefined) track("filter_used", { filter: patch.key ? `key:${patch.key}` : "key:any" });
    if (patch.sort !== undefined) track("sort_changed", { value: patch.sort });
  }, []);

  // Log a search once typing settles: how long the query was and how many songs it found, never the text.
  const resultCount = visible.length;
  useEffect(() => {
    const length = query.text.trim().length;
    if (!length) return;
    const id = setTimeout(() => track("search_used", { query_length: length, result_count: resultCount }), 800);
    return () => clearTimeout(id);
  }, [query.text, resultCount]);

  const onFiles = useCallback((files: File[]) => void addFiles(files, "upload"), [addFiles]);
  const dragging = useWindowFileDrop(onFiles);
  const openPicker = useCallback(() => picker.current?.open(), []);

  const addSamples = async (names: readonly string[], source: SongSource) => {
    setFetchingSamples(true);
    try {
      const files = await Promise.all(names.map(sampleFile));
      const results = (await addFiles(files, source)) ?? [];
      if (source === "seed") {
        // Give the demo library a few weeks of practice history, so Up next and progress have a story to tell.
        for (const r of results) {
          const history = r.status === "added" ? demoHistory(r.song) : null;
          if (history && r.status === "added") void patchSong(r.song, history, "The demo songs were added without their practice history.");
        }
      }
    } catch {
      toast.error("We couldn't load the sample songs. Refresh the page and try again.");
    } finally {
      setFetchingSamples(false);
    }
  };

  const toggleFavorite = useCallback(
    (song: Song) => void patchSong(song, { is_favorite: !song.is_favorite }, "We couldn't update your favorites. Try again."),
    [patchSong],
  );

  const practice = useCallback(
    (song: Song, surface: "drawer" | "up_next" = "drawer", slot?: SuggestionSlot) => {
      if (surface === "up_next") opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setSelected({ id: song.id, mode: "practice", slot });
      track("practice_started", { surface, ...(slot ? { slot } : {}) }, { songId: song.id });
      void patchSong(song, practicePatch(song), "We couldn't save that practice. Try again.");
    },
    [patchSong],
  );

  const remove = useCallback(
    async (song: Song) => {
      setSelected(null);
      stopPreview();
      removeSong(song.id);
      try {
        await deleteSong(song);
        toast(`Deleted ${song.title}`);
      } catch {
        insertSong(song);
        toast.error("We couldn't delete that song. Try again.");
      }
    },
    [removeSong, insertSong],
  );

  const empty = status === "ready" && songs.length === 0 && pending.length === 0;
  const suggestions = useMemo(() => suggest(songs), [songs]);
  const openSuggestion = useCallback(
    (s: Suggestion) => {
      track("suggestion_clicked", { slot: s.slot }, { songId: s.song.id });
      openSong(s.song, "details", "up_next", s.slot);
    },
    [openSong],
  );
  const practiceSuggestion = useCallback(
    (s: Suggestion) => {
      track("suggestion_clicked", { slot: s.slot }, { songId: s.song.id });
      practice(s.song, "up_next", s.slot);
    },
    [practice],
  );

  return (
    <>
      {/* While the drawer is open, the page behind it can't be reached by keyboard or screen reader. */}
      <div inert={selectedSong ? true : undefined}>
        <Header songs={songs} loading={status === "loading"} onAddSong={openPicker} />
        <FilePicker ref={picker} onFiles={onFiles} />
        <DropOverlay visible={dragging} />

        <div className="mt-10">
          {status === "error" && <LoadError onRetry={() => void library.reload()} />}
          {empty && (
            <EmptyState
              onChooseFile={openPicker}
              onTrySample={() => void addSamples([FIRST_SAMPLE], "sample")}
              onLoadDemo={() => void addSamples(SAMPLE_FILES, "seed")}
              busy={fetchingSamples}
            />
          )}
          {status === "loading" && (
          <>
            <UpNextSkeleton />
            <ToolbarSkeleton />
          </>
        )}
          {status === "ready" && (
            <UpNext suggestions={suggestions} onOpen={openSuggestion} onPractice={practiceSuggestion} />
          )}
          {status === "ready" && hasToolbar && (
            <div className="mb-6">
              {suggestions.length > 0 && <h2 className="mb-4 font-serif text-section text-ink">All songs</h2>}
              <Toolbar
                query={query}
                keys={keys}
                total={songs.length}
                shown={visible.length}
                filtering={filtering}
                onChange={changeQuery}
              />
            </div>
          )}
          {status === "ready" && !empty && visible.length === 0 && pending.length === 0 && (
            <NoResults text={query.text} onClear={() => setQuery((q) => ({ ...DEFAULT_QUERY, sort: q.sort }))} />
          )}
          {(status === "loading" || (status === "ready" && !empty && (visible.length > 0 || pending.length > 0))) && (
            <div className={`transition-opacity duration-150 ${catchingUp ? "opacity-60" : "opacity-100"}`} aria-busy={catchingUp}>
              <SongGrid
                songs={visible}
                pending={pending}
                loading={status === "loading"}
                freshIds={freshIds}
                onOpen={openSong}
                onToggleFavorite={toggleFavorite}
                onAdd={status === "ready" && !hasToolbar ? openPicker : undefined}
              />
            </div>
          )}
        </div>
      </div>
      <SongDrawer
        song={selectedSong}
        mode={selected?.mode ?? "details"}
        onModeChange={(mode) => setSelected((s) => (s ? { ...s, mode } : s))}
        onClose={closeSong}
        onPatch={patchSong}
        // A song opened from Up next keeps its slot, so a practice started in the drawer is still credited to it.
        onPractice={(song) => practice(song, "drawer", selected?.slot)}
        onDelete={(song) => void remove(song)}
        renderPreview={(song) => <DrawerPreview song={song} />}
      />
    </>
  );
}

function ToolbarSkeleton() {
  return (
    <div className="mb-6" aria-hidden>
      <div className="mb-4 h-7 w-28 animate-skeleton rounded-sm bg-paper-sunk" />
      <div className="h-10 animate-skeleton rounded bg-paper-sunk sm:h-9 sm:w-80" />
      <div className="mt-3 flex gap-2">
        {[44, 76, 52, 64, 48].map((w) => (
          <div key={w} className="h-10 animate-skeleton rounded-sm bg-paper-sunk sm:h-8" style={{ width: w }} />
        ))}
      </div>
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="max-w-xl" role="alert">
      <h2 className="font-serif text-section text-ink">We couldn&apos;t load your library</h2>
      <p className="mt-2 text-body text-ink-2">Your songs are safe. Check your connection, then try again.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 h-10 rounded border sm:h-9 border-rule-strong px-3 text-ui font-medium text-ink transition-colors hover:border-ink-3"
      >
        Try again
      </button>
    </section>
  );
}
