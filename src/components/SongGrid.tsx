import { UploadSimple } from "@phosphor-icons/react";
import { SongCard } from "@/components/SongCard";
import { SongCardSkeleton } from "@/components/SongCardSkeleton";
import type { PendingUpload } from "@/lib/useLibrary";
import type { Song } from "@/types";

type Props = {
  songs: Song[];
  pending?: PendingUpload[];
  loading?: boolean;
  freshIds?: Set<string>;
  onOpen: (song: Song) => void;
  onToggleFavorite: (song: Song) => void;
  /** Shown at the end of a small library: the second and third songs are where the habit starts. */
  onAdd?: () => void;
};

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4";

export function SongGrid({ songs, pending = [], loading, freshIds, onOpen, onToggleFavorite, onAdd }: Props) {
  if (loading) {
    return (
      <div className={GRID} aria-label="Loading your library">
        {Array.from({ length: 8 }, (_, i) => (
          <SongCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <ul className={GRID} aria-label="Songs">
      {pending.map((p) => (
        <li key={p.id}>
          <SongCardSkeleton fileName={p.fileName} />
        </li>
      ))}
      {songs.map((song) => (
        <li key={song.id}>
          <SongCard song={song} fresh={freshIds?.has(song.id)} onOpen={onOpen} onToggleFavorite={onToggleFavorite} />
        </li>
      ))}
      {onAdd && (
        <li>
          <button
            type="button"
            onClick={onAdd}
            className="flex h-full min-h-[208px] w-full flex-col items-center justify-center gap-2 rounded border border-dashed border-rule-strong text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
          >
            <UploadSimple size={18} weight="light" aria-hidden />
            <span className="text-ui">Add another song</span>
            <span className="font-mono text-meta text-ink-3">or drop a MIDI file anywhere</span>
          </button>
        </li>
      )}
    </ul>
  );
}
