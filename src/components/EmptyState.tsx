import { UploadSimple } from "@phosphor-icons/react";
import { PianoRoll } from "@/components/PianoRoll";
import type { PreviewNote } from "@/types";

// "Twinkle Twinkle" in two hands: a hint of what every song becomes once it's added.
const MELODY = [60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60];
const HINT: PreviewNote[] = [
  ...MELODY.map((p, i) => ({ p, t: i * 0.5 + (i >= 7 ? 0.5 : 0), d: i === 6 || i === 13 ? 0.9 : 0.42 })),
  ...[48, 53, 48, 43, 48].map((p, i) => ({ p, t: i * 1.5, d: 1.3 })),
];

type Props = {
  onChooseFile: () => void;
  onTrySample: () => void;
  onLoadDemo: () => void;
  busy?: boolean;
};

/** The first thing a new user sees. There's no catalog to browse, so this is onboarding. */
export function EmptyState({ onChooseFile, onTrySample, onLoadDemo, busy }: Props) {
  return (
    <section className="max-w-2xl pt-4" aria-labelledby="empty-title">
      <h2 id="empty-title" className="font-serif text-display-sm text-ink">
        Start your library
      </h2>
      <p className="mt-3 max-w-lg text-body text-ink-2">
        Add a MIDI file of a song you want to learn. It&apos;ll show up here with its key, tempo, and a preview of the
        notes.
      </p>

      <button
        type="button"
        onClick={onChooseFile}
        className="relative mt-8 flex h-[200px] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded border border-dashed border-ink-3 bg-paper-raised text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
      >
        <div className="empty-hint pointer-events-none absolute inset-x-6 inset-y-6 opacity-25" aria-hidden>
          <PianoRoll notes={HINT} height={150} label="" />
        </div>
        <span className="relative flex flex-col items-center gap-3 rounded bg-paper-raised px-4 py-3">
        <UploadSimple size={18} weight="light" aria-hidden />
        <span className="text-ui">
          Drop a MIDI file here or <span className="text-ink underline decoration-rule-strong underline-offset-4">choose one</span>
        </span>
        <span className="font-mono text-meta text-ink-3">.mid or .midi, up to 5 MB</span>
        </span>
      </button>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-ui text-ink-3">No file handy?</span>
        <span className="flex items-center gap-4">
          <button
            type="button"
            onClick={onTrySample}
            disabled={busy}
            className="h-10 rounded border sm:h-9 border-rule-strong px-3 text-ui font-medium text-ink transition-colors hover:border-ink-3 disabled:opacity-50"
          >
            Try a sample
          </button>
          <button
            type="button"
            onClick={onLoadDemo}
            disabled={busy}
            className="h-10 rounded text-ui text-ink-2 underline sm:h-9 decoration-rule-strong underline-offset-4 transition-colors hover:text-ink disabled:opacity-50"
          >
            Load demo library
          </button>
        </span>
      </div>
    </section>
  );
}
