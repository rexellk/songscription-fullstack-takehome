"use client";

import { Heart } from "@phosphor-icons/react";
import { memo, useState } from "react";
import { DifficultyMeter } from "@/components/DifficultyMeter";
import { PianoRoll } from "@/components/PianoRoll";
import { PreviewButton } from "@/components/PreviewButton";
import { usePreview } from "@/lib/usePlayer";
import { formatDuration, timeAgo, timeAgoSpoken } from "@/lib/format";
import type { Song } from "@/types";

type Props = {
  song: Song;
  fresh?: boolean;
  onOpen: (song: Song) => void;
  onToggleFavorite: (song: Song) => void;
};

const CARD_PREVIEW_SECONDS = 10;

export function songMeta(song: Song) {
  return [song.key_name, formatDuration(song.duration_sec), song.bpm ? `${Math.round(song.bpm)} bpm` : null]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The whole card opens the song. The title button stretches over the card with ::after,
 * so the favorite button can sit on top without nesting a button inside a button.
 */
export const SongCard = memo(function SongCard({ song, fresh, onOpen, onToggleFavorite }: Props) {
  const [active, setActive] = useState(false);
  const practiced = song.practice_count > 0 && song.last_practiced_at;
  const previewSeconds = Math.min(CARD_PREVIEW_SECONDS, Math.ceil(song.duration_sec ?? CARD_PREVIEW_SECONDS));
  const preview = usePreview(song.id, "card", song.preview_notes ?? [], previewSeconds);
  const sounding = preview.status === "playing" || preview.status === "loading";

  return (
    <article
      className={`group relative rounded border border-rule bg-paper-raised p-3 transition-colors hover:border-rule-strong has-[:focus-visible]:border-rule-strong ${fresh ? "animate-fade-in" : ""}`}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
    >
      <div className="relative overflow-hidden rounded-sm">
        <PianoRoll
          notes={song.preview_notes ?? []}
          height={96}
          emphasized={active || sounding}
          windowSec={sounding ? previewSeconds : undefined}
          playheadSec={preview.position}
          label={`Piano roll of ${song.title}`}
        />
      </div>

      <h3 className="mt-3 font-serif text-card-title text-ink">
        <button
          type="button"
          onClick={() => onOpen(song)}
          className="block w-full truncate text-left outline-none after:absolute after:inset-0 after:rounded after:content-[''] focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brass"
        >
          {song.title}
        </button>
      </h3>
      <p className="mt-1 truncate font-mono text-meta text-ink-3">{songMeta(song)}</p>

      <div className="mt-3 flex items-center justify-between">
        <DifficultyMeter difficulty={song.difficulty} onsetsPerSec={song.onsets_per_sec} />
        <span className="font-mono text-meta text-ink-3">
          <span aria-hidden>{practiced ? `practiced ${timeAgo(song.last_practiced_at)}` : "new"}</span>
          <span className="sr-only">{practiced ? `Practiced ${timeAgoSpoken(song.last_practiced_at)}` : "Not practiced yet"}</span>
        </span>
      </div>

      <PreviewButton
        status={preview.status}
        onToggle={() => void preview.toggle()}
        label={song.title}
        className={`absolute right-5 top-[68px] z-10 transition-opacity focus-visible:opacity-100 [@media(hover:none)]:opacity-100 ${
          sounding ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      />

      <button
        type="button"
        onClick={() => onToggleFavorite(song)}
        aria-pressed={song.is_favorite}
        aria-label={song.is_favorite ? `Remove ${song.title} from favorites` : `Add ${song.title} to favorites`}
        className={`absolute right-5 top-5 z-10 flex h-8 w-8 items-center justify-center rounded bg-paper-sunk text-ink-2 before:absolute before:-inset-1 before:content-[''] transition-opacity hover:text-ink focus-visible:opacity-100 [@media(hover:none)]:opacity-100 ${
          song.is_favorite ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <Heart
          size={18}
          weight={song.is_favorite ? "fill" : "light"}
          className={song.is_favorite ? "text-brass" : undefined}
          aria-hidden
        />
      </button>
    </article>
  );
});
