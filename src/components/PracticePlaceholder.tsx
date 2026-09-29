"use client";

import { PracticeStage } from "@/components/PracticeStage";
import { PreviewButton } from "@/components/PreviewButton";
import { ThemePicker } from "@/components/ThemePicker";
import { formatDuration } from "@/lib/format";
import { HAND_LABEL, speedLabel } from "@/lib/preferences";
import { previewStart } from "@/lib/player";
import { usePreview } from "@/lib/usePlayer";
import type { PracticeHand, PracticeTheme, Song } from "@/types";

type Props = {
  song: Song;
  settings: { speed: number; hand: PracticeHand; theme: PracticeTheme };
  defaultTheme: PracticeTheme;
  onThemeChange: (theme: PracticeTheme | null) => void;
  onBack: () => void;
};

const SOFT = "text-[color-mix(in_srgb,var(--ivory-note)_70%,transparent)]";
const STAGE_SECONDS = 45;

/**
 * Stands in for the real practice experience: the opening plays as falling notes onto a
 * keyboard, in the learner's practice theme. Scoring is the part that isn't built. Always dark.
 */
export function PracticePlaceholder({ song, settings, defaultTheme, onThemeChange, onBack }: Props) {
  const notes = song.preview_notes ?? [];
  const seconds = Math.min(STAGE_SECONDS, Math.ceil(song.duration_sec ?? STAGE_SECONDS));
  const { status, position, toggle } = usePreview(song.id, "practice", notes, seconds);
  const start = previewStart(notes);

  return (
    <div className="flex min-h-full flex-col px-6 pb-6 text-ivory-note">
      <p className={`font-mono text-meta ${SOFT}`}>
        Practicing · {speedLabel(settings.speed)} · {HAND_LABEL[settings.hand].toLowerCase()}
      </p>
      {/* Same id as the details heading, so the dialog keeps its name in both modes. */}
      <h2 id="drawer-title" className="mt-2 font-serif text-drawer">
        {song.title}
      </h2>

      <div className="relative mt-6 min-h-[280px] flex-1">
        <PracticeStage songId={song.id} notes={notes} theme={settings.theme} playing={status === "playing"} />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="relative">
          <PreviewButton status={status} onToggle={() => void toggle()} label={song.title} tone="ebony" />
        </span>
        <span className="font-mono text-meta" aria-live="off">
          {formatDuration(position != null ? position - start : 0)} / {formatDuration(seconds)}
        </span>
        <span className={`ml-auto font-mono text-meta ${SOFT}`}>{status === "loading" ? "Loading piano…" : "Song opening"}</span>
      </div>

      <fieldset className="mt-6">
        <legend className={`text-meta ${SOFT}`}>Practice theme for this song</legend>
        <div className="mt-2">
          <ThemePicker
            name={`theme-${song.id}`}
            value={song.practice_theme}
            defaultTheme={defaultTheme}
            onChange={onThemeChange}
            tone="ebony"
          />
        </div>
      </fieldset>

      <div className="mt-6 border-t border-ebony-line pt-6 text-center">
        <p className="text-body">The interactive piano roll opens here.</p>
        <p className={`mx-auto mt-2 max-w-xs text-ui ${SOFT}`}>
          For now it plays the opening so you can watch the notes land. The full version listens through your microphone
          or MIDI keyboard and scores each note.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 h-10 text-ui font-medium text-ivory-note underline decoration-[color-mix(in_srgb,var(--ivory-note)_40%,transparent)] underline-offset-4 hover:decoration-ivory-note"
        >
          Back to details
        </button>
      </div>
    </div>
  );
}
