"use client";

import { PianoRoll } from "@/components/PianoRoll";
import { PreviewButton } from "@/components/PreviewButton";
import { formatDuration } from "@/lib/format";
import { previewStart } from "@/lib/player";
import { usePreview } from "@/lib/usePlayer";
import type { Song } from "@/types";

const PREVIEW_SECONDS = 20;

/** The big ebony roll in the drawer, with the first 20 seconds on a real piano. */
export function DrawerPreview({ song }: { song: Song }) {
  const notes = song.preview_notes ?? [];
  const seconds = Math.min(PREVIEW_SECONDS, Math.ceil(song.duration_sec ?? PREVIEW_SECONDS));
  const { status, position, toggle } = usePreview(song.id, "drawer", notes, seconds);
  const start = previewStart(notes);

  return (
    <div className="overflow-hidden rounded-sm bg-ebony">
      <PianoRoll
        notes={notes}
        height={180}
        variant="ebony"
        windowSec={PREVIEW_SECONDS}
        windowStart={start}
        playheadSec={position}
        emphasized={status === "playing"}
        label={`First ${seconds} seconds of ${song.title}`}
      />
      <div className="flex items-center gap-3 border-t border-ebony-line px-3 py-2">
        <span className="relative">
          <PreviewButton status={status} onToggle={() => void toggle()} label={song.title} tone="ebony" />
        </span>
        <span className="font-mono text-meta text-ivory-note" aria-live="off">
          {formatDuration(position != null ? position - start : 0)} / {formatDuration(seconds)}
        </span>
        <span className="ml-auto font-mono text-meta text-[color-mix(in_srgb,var(--ivory-note)_70%,transparent)]">
          {status === "loading" ? "Loading piano…" : "Preview"}
        </span>
      </div>
    </div>
  );
}
