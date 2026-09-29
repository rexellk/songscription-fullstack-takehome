"use client";

import { Heart, Trash, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { PianoRoll } from "@/components/PianoRoll";
import { PracticePlaceholder } from "@/components/PracticePlaceholder";
import { PracticeSettings } from "@/components/PracticeSettings";
import { AboutSong, Band, DifficultySection, Hands, Progress, Sub } from "@/components/SongDetails";
import { TagEditor } from "@/components/TagEditor";
import { TranscriptionCheck } from "@/components/TranscriptionCheck";
import { effectivePractice, usePracticeDefaults } from "@/lib/preferences";
import { track } from "@/lib/track";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { Song, SongUpdate } from "@/types";

export type DrawerMode = "details" | "practice";

type Props = {
  song: Song | null;
  mode: DrawerMode;
  onModeChange: (mode: DrawerMode) => void;
  onClose: () => void;
  onPatch: (song: Song, patch: SongUpdate) => Promise<boolean>;
  onPractice: (song: Song) => void;
  onDelete: (song: Song) => void;
  /** The preview player for the big roll. Supplied by the audio phase. */
  renderPreview?: (song: Song) => React.ReactNode;
};

const EXIT_MS = 220;

/**
 * Detail view. Slides in from the right on desktop, up from the bottom on phones.
 * Keeps the last song on screen while it animates out and traps focus while open.
 * The library returns focus to the card that opened it.
 */
export function SongDrawer({ song, mode, onModeChange, onClose, onPatch, onPractice, onDelete, renderPreview }: Props) {
  const [shown, setShown] = useState<Song | null>(song);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [defaults] = usePracticeDefaults();

  useEffect(() => {
    if (song) {
      setShown(song);
      const id = requestAnimationFrame(() => setOpen(true));
      return () => cancelAnimationFrame(id);
    }
    setOpen(false);
    const id = setTimeout(() => setShown(null), EXIT_MS);
    return () => clearTimeout(id);
  }, [song]);

  // Wait until the content has rendered, so there's something to move focus into.
  const { startGuard, endGuard } = useFocusTrap(panel, Boolean(song) && shown !== null, heading);

  useEffect(() => {
    if (!song) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [song, onClose]);

  useEffect(() => setScrolled(false), [shown?.id, mode]);

  if (!shown) return null;
  const current = song ?? shown;
  const stage = mode === "practice";

  return (
    <div className="fixed inset-0 z-40" role="presentation">
      <div
        className={`absolute inset-0 bg-scrim transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby="drawer-title"
        className={`absolute flex flex-col overflow-hidden outline-none transition-transform duration-[220ms] ease-drawer max-sm:inset-x-0 max-sm:bottom-0 max-sm:h-[88vh] max-sm:rounded-t-lg max-sm:border-t sm:bottom-0 sm:right-0 sm:top-0 sm:w-[460px] sm:border-l ${
          stage ? "border-ebony-line bg-ebony" : "border-rule bg-paper-raised"
        } ${open ? "translate-x-0 translate-y-0" : "max-sm:translate-y-full sm:translate-x-full"}`}
      >
        <span {...startGuard} />
        <div
          className={`relative flex h-12 shrink-0 items-center justify-end px-3 sm:h-14 ${
            scrolled && !stage ? "border-b border-rule" : "border-b border-transparent"
          }`}
        >
          <span
            className={`absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full sm:hidden ${stage ? "bg-ebony-line" : "bg-rule-strong"}`}
            aria-hidden
          />
          <button
            type="button"
            onClick={onClose}
            className={`flex h-10 w-10 items-center justify-center rounded ${stage ? "text-ivory-note" : "text-ink-2 hover:text-ink"}`}
            aria-label="Close song details"
          >
            <X size={18} weight="light" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}>
          {stage ? (
            <PracticePlaceholder song={current} settings={effectivePractice(current, defaults)} onBack={() => onModeChange("details")} />
          ) : (
            <Details
              song={current}
              headingRef={heading}
              defaults={defaults}
              onPatch={onPatch}
              onPractice={onPractice}
              onDelete={onDelete}
              renderPreview={renderPreview}
            />
          )}
        </div>
        <span {...endGuard} />
      </div>
    </div>
  );
}

function Details({
  song,
  headingRef,
  defaults,
  onPatch,
  onPractice,
  onDelete,
  renderPreview,
}: {
  song: Song;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  defaults: ReturnType<typeof usePracticeDefaults>[0];
  onPatch: Props["onPatch"];
  onPractice: Props["onPractice"];
  onDelete: Props["onDelete"];
  renderPreview?: Props["renderPreview"];
}) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setConfirming(false), [song.id]);

  return (
    <div className="pb-6">
      <div className="px-6 pb-6">
        <h2 id="drawer-title" ref={headingRef} tabIndex={-1} className="font-serif text-drawer text-ink outline-none">
          {song.title}
        </h2>
        <p className="mt-1 truncate font-mono text-meta text-ink-3">{song.file_name}</p>

        <div className="mt-6">
          {renderPreview ? (
            renderPreview(song)
          ) : (
            <div className="overflow-hidden rounded-sm">
              <PianoRoll notes={song.preview_notes ?? []} height={180} variant="ebony" windowSec={20} label={`Piano roll of ${song.title}`} />
            </div>
          )}
        </div>

        {confirming ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded border border-rule p-3" role="alertdialog" aria-label="Delete this song?">
            <p className="text-ui text-ink">Delete this song?</p>
            <p className="basis-full text-meta text-ink-3 sm:order-last">Its practice history goes with it.</p>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="h-10 rounded px-3 text-ui text-ink-2 hover:text-ink sm:h-9"
                autoFocus
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onDelete(song)}
                className="h-10 rounded border border-oxblood px-3 text-ui font-medium text-oxblood hover:bg-paper-sunk sm:h-9"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPractice(song)}
              className="h-10 flex-1 rounded bg-brass px-4 text-ui font-medium text-on-brass transition-opacity hover:opacity-90"
            >
              Practice
            </button>
            <button
              type="button"
              onClick={() => void onPatch(song, { is_favorite: !song.is_favorite })}
              aria-pressed={song.is_favorite}
              aria-label={song.is_favorite ? "Remove from favorites" : "Add to favorites"}
              className="flex h-10 w-10 items-center justify-center rounded border border-rule text-ink-2 hover:border-rule-strong hover:text-ink"
            >
              <Heart size={18} weight={song.is_favorite ? "fill" : "light"} className={song.is_favorite ? "text-brass" : undefined} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label="Delete song"
              className="flex h-10 w-10 items-center justify-center rounded border border-rule text-ink-2 hover:border-rule-strong hover:text-oxblood"
            >
              <Trash size={18} weight="light" aria-hidden />
            </button>
          </div>
        )}
      </div>

      <Band id="band-about" title="About this song">
        <AboutSong song={song} />
        <Hands song={song} />
        <DifficultySection song={song} />
      </Band>

      <Band id="band-practice" title="Your practice">
        <Progress song={song} />
        <Sub title="Practice settings">
          <PracticeSettings
            song={song}
            defaults={defaults}
            onChange={(patch, setting, value) => {
              void onPatch(song, patch);
              track("practice_settings_changed", { scope: "song", setting, value }, { songId: song.id });
            }}
          />
        </Sub>
      </Band>

      <Band id="band-feedback" title="Feedback">
        <TranscriptionCheck
          key={`quality-${song.id}`}
          song={song}
          onSave={(patch) => onPatch(song, patch)}
          onRated={(rating) => track("transcription_rated", { rating }, { songId: song.id })}
        />
        <TagEditor tags={song.tags} onChange={(tags) => void onPatch(song, { tags })} />
      </Band>
    </div>
  );
}
