"use client";

import { PianoRoll } from "@/components/PianoRoll";
import { songMeta } from "@/components/SongCard";
import type { Suggestion } from "@/lib/suggestions";
import type { Song } from "@/types";

type Props = {
  suggestions: Suggestion[];
  onOpen: (s: Suggestion) => void;
  onPractice: (s: Suggestion) => void;
};

/** One featured song and two quieter rows: not a row of three identical cards. */
export function UpNext({ suggestions, onOpen, onPractice }: Props) {
  if (suggestions.length === 0) return null;
  const [top, ...rest] = suggestions;

  return (
    <section aria-labelledby="up-next-title" className="mb-10">
      <h2 id="up-next-title" className="font-serif text-section text-ink">
        Up next
      </h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <article className="group relative rounded border border-rule bg-paper-raised p-4 transition-colors hover:border-rule-strong has-[:focus-visible]:border-rule-strong lg:col-span-2">
          <div className="overflow-hidden rounded-sm max-sm:hidden">
            <PianoRoll notes={top.song.preview_notes ?? []} height={120} label={`Piano roll of ${top.song.title}`} />
          </div>
          <div className="overflow-hidden rounded-sm sm:hidden">
            <PianoRoll notes={top.song.preview_notes ?? []} height={72} label={`Piano roll of ${top.song.title}`} />
          </div>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-meta text-ink-3">{top.label}</p>
              <h3 className="mt-1 font-serif text-section text-ink">
                <button
                  type="button"
                  onClick={() => onOpen(top)}
                  className="block max-w-full truncate text-left outline-none after:absolute after:inset-0 after:rounded after:content-[''] focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brass"
                >
                  {top.song.title}
                </button>
              </h3>
              <p className="mt-1 font-mono text-meta text-ink-3">{songMeta(top.song)}</p>
            </div>
            <button
              type="button"
              onClick={() => onPractice(top)}
              aria-label={`Practice ${top.song.title}`}
              className="relative z-10 h-10 w-full shrink-0 rounded bg-brass px-5 sm:w-auto text-ui font-medium text-on-brass transition-opacity hover:opacity-90"
            >
              Practice
            </button>
          </div>
        </article>

        {rest.length > 0 && (
          <ul className="flex flex-col divide-y divide-rule border-y border-rule">
            {rest.map((s) => (
              <li key={s.song.id} className="flex flex-1 items-center">
                <SuggestionRow suggestion={s} song={s.song} onOpen={onOpen} onPractice={onPractice} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SuggestionRow({
  suggestion,
  song,
  onOpen,
  onPractice,
}: {
  suggestion: Suggestion;
  song: Song;
  onOpen: Props["onOpen"];
  onPractice: Props["onPractice"];
}) {
  return (
    <div className="flex w-full items-center gap-3 py-4">
      <button type="button" onClick={() => onOpen(suggestion)} className="min-w-0 flex-1 text-left">
        <span className="block font-mono text-meta text-ink-3">{suggestion.label}</span>
        <span className="mt-1 block truncate font-serif text-card-title text-ink">{song.title}</span>
        <span className="mt-1 block truncate font-mono text-meta text-ink-3">{songMeta(song)}</span>
      </button>
      <button
        type="button"
        onClick={() => onPractice(suggestion)}
        className="h-10 shrink-0 rounded border border-rule-strong px-3 text-ui font-medium text-ink transition-colors hover:border-ink-3 sm:h-9"
        aria-label={`Practice ${song.title}`}
      >
        Practice
      </button>
    </div>
  );
}

export function UpNextSkeleton() {
  return (
    <div className="mb-10" aria-hidden>
      <div className="h-7 w-24 animate-skeleton rounded-sm bg-paper-sunk" />
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="h-[222px] animate-skeleton rounded border border-rule bg-paper-sunk lg:col-span-2" />
        <div className="flex flex-col justify-around gap-4 border-y border-rule py-4">
          {[0, 1].map((i) => (
            <div key={i}>
              <div className="h-3 w-24 animate-skeleton rounded-sm bg-paper-sunk" />
              <div className="mt-2 h-5 w-40 animate-skeleton rounded-sm bg-paper-sunk" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
