"use client";

import { useState } from "react";
import { chip } from "@/components/ui";
import type { QualityRating, Song, SongUpdate } from "@/types";

const OPTIONS: { value: QualityRating; label: string }[] = [
  { value: "right", label: "Sounds right" },
  { value: "some_off", label: "A few parts are off" },
  { value: "unusable", label: "Not usable" },
];

const LABEL = Object.fromEntries(OPTIONS.map((o) => [o.value, o.label])) as Record<QualityRating, string>;

type Props = {
  song: Song;
  onSave: (patch: SongUpdate) => Promise<boolean>;
  onRated: (rating: QualityRating) => void;
};

/**
 * Research built into the product: one tap tells the model team which transcriptions
 * miss, by genre and source, right where the learner notices it.
 */
export function TranscriptionCheck({ song, onSave, onRated }: Props) {
  const [editing, setEditing] = useState(song.quality_rating === null);
  const [justRated, setJustRated] = useState(false);
  const [note, setNote] = useState(song.quality_note ?? "");
  const [noteSaved, setNoteSaved] = useState(false);
  const rating = song.quality_rating;

  const choose = async (value: QualityRating) => {
    const keepNote = value !== "right";
    const ok = await onSave({ quality_rating: value, quality_note: keepNote ? note.trim() || null : null });
    if (!ok) return;
    onRated(value);
    setJustRated(true);
    setNoteSaved(false);
    if (!keepNote) {
      setNote("");
      setEditing(false);
    }
  };

  const saveNote = async () => {
    const ok = await onSave({ quality_note: note.trim() || null });
    if (ok) {
      setNoteSaved(true);
      setEditing(false);
    }
  };

  return (
    <div>
      <h4 id="quality-title" className="text-ui font-medium text-ink">
        How does this transcription sound?
      </h4>

      {!editing && rating ? (
        <div className="mt-3">
          <p className="text-ui text-ink">
            <span className="text-ink-3">You said </span>
            &ldquo;{LABEL[rating]}&rdquo;
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="ml-3 text-ui text-ink-2 underline decoration-rule-strong underline-offset-4 hover:text-ink"
            >
              Change
            </button>
          </p>
          {song.quality_note && <p className="mt-1 text-ui text-ink-2">&ldquo;{song.quality_note}&rdquo;</p>}
          {(justRated || noteSaved) && (
            <p className="mt-2 text-meta text-ink-3" role="status">
              Thanks, this helps improve transcriptions.
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="mt-1 text-ui text-ink-2">Listen to the preview, then tell us.</p>
          <div role="radiogroup" aria-labelledby="quality-title" className="-mx-6 mt-3 flex gap-2 overflow-x-auto px-6 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
            {OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={rating === o.value}
                onClick={() => void choose(o.value)}
                className={`h-10 shrink-0 px-3 sm:h-8 ${chip(rating === o.value)}`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {(rating === "some_off" || rating === "unusable") && (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void saveNote();
              }}
            >
              <label className="min-w-0 flex-1">
                <span className="sr-only">Which part sounds off? (optional)</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={200}
                  placeholder="Which part? For example, the bridge"
                  className="h-10 w-full rounded border border-rule bg-paper px-3 text-ui text-ink placeholder:text-ink-3 hover:border-rule-strong sm:h-9"
                />
              </label>
              <button
                type="submit"
                className="h-10 shrink-0 rounded border border-rule-strong px-3 text-ui font-medium text-ink hover:border-ink-3 sm:h-9"
              >
                {note.trim() ? "Save note" : "Skip"}
              </button>
            </form>
          )}
          {justRated && rating && (
            <p className="mt-2 text-meta text-ink-3" role="status">
              Thanks, this helps improve transcriptions.
            </p>
          )}
        </>
      )}
    </div>
  );
}
