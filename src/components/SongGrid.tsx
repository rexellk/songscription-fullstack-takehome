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
};

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4";

export function SongGrid({ songs, pending = [], loading, freshIds, onOpen, onToggleFavorite }: Props) {
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
    </ul>
  );
}
