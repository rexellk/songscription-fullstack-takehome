import { FillHeight } from "@/components/FillHeight";
import { PianoRoll } from "@/components/PianoRoll";
import { HAND_LABEL, speedLabel } from "@/lib/preferences";
import type { PracticeHand, Song } from "@/types";

type Props = {
  song: Song;
  settings: { speed: number; hand: PracticeHand };
  onBack: () => void;
};

const SOFT = "text-[color-mix(in_srgb,var(--ivory-note)_70%,transparent)]";

/** Stands in for the real practice experience. Always dark, like a stage. */
export function PracticePlaceholder({ song, settings, onBack }: Props) {
  return (
    <div className="flex min-h-full flex-col px-6 pb-6 text-ivory-note">
      <p className={`font-mono text-meta ${SOFT}`}>
        Practicing · {speedLabel(settings.speed)} · {HAND_LABEL[settings.hand].toLowerCase()}
      </p>
      {/* Same id as the details heading, so the dialog keeps its name in both modes. */}
      <h2 id="drawer-title" className="mt-2 font-serif text-drawer">
        {song.title}
      </h2>
      <div className="mt-6 flex min-h-[240px] flex-1 overflow-hidden rounded-sm">
        <PianoRollFill song={song} />
      </div>
      <div className="mt-6 border-t border-ebony-line pt-6 text-center">
        <p className="text-body">The interactive piano roll opens here.</p>
        <p className={`mx-auto mt-2 max-w-xs text-ui ${SOFT}`}>
          It listens through your microphone or MIDI keyboard and scores each note as you play.
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

/** The roll fills whatever height the stage has. */
function PianoRollFill({ song }: { song: Song }) {
  return (
    <div className="relative w-full">
      <div className="absolute inset-0">
        <FillHeight>{(h) => <PianoRoll notes={song.preview_notes ?? []} height={h} variant="ebony" windowSec={20} label={`Piano roll of ${song.title}`} />}</FillHeight>
      </div>
    </div>
  );
}
