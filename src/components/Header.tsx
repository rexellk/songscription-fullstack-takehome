import { UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { SettingsMenu } from "@/components/SettingsMenu";
import { MINUTES_PER_SESSION, formatMinutes, plural } from "@/lib/format";
import type { Song } from "@/types";

type Props = {
  songs: Song[];
  loading: boolean;
  onAddSong: () => void;
};

export function Header({ songs, loading, onAddSong }: Props) {
  const sessions = songs.reduce((sum, s) => sum + s.practice_count, 0);
  const stats = [
    plural(songs.length, "song"),
    sessions > 0 ? `${formatMinutes(sessions * MINUTES_PER_SESSION)} practiced` : null,
  ].filter(Boolean);

  return (
    <header className="border-b border-rule pb-6">
      <div className="flex h-10 items-center justify-between gap-4">
        <span className="text-ui font-medium text-ink">Anything Piano</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddSong}
            className="inline-flex h-10 items-center gap-2 sm:h-9 rounded bg-brass px-3 text-ui font-medium text-on-brass transition-opacity hover:opacity-90"
          >
            <UploadSimple size={18} weight="light" aria-hidden />
            Add a song
          </button>
          <SettingsMenu />
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-serif text-display-sm text-ink sm:text-display">Library</h1>
        {!loading && songs.length > 0 && (
          <p className="font-mono text-meta text-ink-3">{stats.join(" · ")}</p>
        )}
      </div>
    </header>
  );
}
