import { DensityStrip } from "@/components/DensityStrip";
import { DifficultyMeter, difficultyPace } from "@/components/DifficultyMeter";
import { formatDuration, pitchName, timeAgo } from "@/lib/format";
import type { Song } from "@/types";

/** A titled group of related sections in the drawer, separated from the next by a hairline. */
export function Band({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-rule px-6 py-6">
      <h3 id={id} className="font-serif text-section text-ink">
        {title}
      </h3>
      <div className="mt-4 flex flex-col gap-6">{children}</div>
    </section>
  );
}

export function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-ui font-medium text-ink">{title}</h4>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/** Learner-facing facts about the song, all computed from the MIDI itself. */
export function AboutSong({ song }: { song: Song }) {
  const likely = song.key_confidence != null && song.key_confidence < 0.9;
  const rows: [string, React.ReactNode][] = [
    [
      "Key",
      <>
        {song.key_name ?? "Unknown"}
        {likely && (
          <span className="ml-2 text-ink-3" title={`Detected with ${Math.round((song.key_confidence ?? 0) * 100)}% confidence`}>
            likely
          </span>
        )}
      </>,
    ],
    ["Tempo", song.bpm ? `${Math.round(song.bpm)} bpm` : "Unknown"],
    ["Time signature", song.time_signature ?? "4/4"],
    ["Length", formatDuration(song.duration_sec)],
    ["Notes", song.note_count?.toLocaleString() ?? "Unknown"],
    ["Range", song.lowest_pitch != null ? `${pitchName(song.lowest_pitch)} to ${pitchName(song.highest_pitch)}` : "Unknown"],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-ui text-ink-3">{label}</dt>
          <dd className="mt-1 font-mono text-ui text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function handsAdvice(left: number) {
  if (left >= 0.55) return "Most of this song sits in the left hand. Try the left hand alone first.";
  if (left <= 0.2) return "Almost all of this song sits in the right hand.";
  if (left <= 0.4) return "Most of this song sits in the right hand.";
  return "Both hands share the work about evenly.";
}

export function Hands({ song }: { song: Song }) {
  const left = 1 - (song.right_hand_ratio ?? 0.5);
  const l = Math.round(left * 100);
  return (
    <Sub title="Hands">
      <div className="flex justify-between font-mono text-meta text-ink-2">
        <span>Left {l}%</span>
        <span>Right {100 - l}%</span>
      </div>
      <div
        className="mt-2 flex h-2 gap-[2px] overflow-hidden rounded-sm"
        role="img"
        aria-label={`Left hand ${l} percent, right hand ${100 - l} percent`}
      >
        {l > 0 && <div className="bg-brass" style={{ width: `${l}%` }} />}
        {l < 100 && <div className="flex-1 bg-ink" />}
      </div>
      <p className="mt-2 text-ui text-ink-2">{handsAdvice(left)}</p>
      <p className="mt-1 text-meta text-ink-3">Split at middle C. Colors match the piano roll.</p>
    </Sub>
  );
}

export function DifficultySection({ song }: { song: Song }) {
  if (!song.difficulty) return null;
  const chords = song.avg_chord_size != null && song.avg_chord_size >= 1.8 ? " Many notes are played together as chords." : "";
  const pace = difficultyPace(song.onsets_per_sec);
  return (
    <Sub title="Difficulty">
      <DifficultyMeter difficulty={song.difficulty} onsetsPerSec={song.onsets_per_sec} withTitle={false} />
      {(pace || chords) && (
        <p className="mt-2 text-ui text-ink-2">
          {pace}
          {chords}
        </p>
      )}
      <DensityStrip density={song.density} durationSec={song.duration_sec} />
    </Sub>
  );
}

export function Progress({ song }: { song: Song }) {
  if (song.practice_count === 0) {
    return (
      <Sub title="Progress">
        <p className="text-ui text-ink-2">You haven&apos;t practiced this song yet. Your first practice sets a starting score.</p>
      </Sub>
    );
  }
  const stats: [string, string][] = [
    ["Times practiced", String(song.practice_count)],
    ["Best accuracy", song.best_accuracy != null ? `${Math.round(song.best_accuracy)}%` : "None yet"],
    ["Last practiced", timeAgo(song.last_practiced_at) || "Not yet"],
  ];
  return (
    <Sub title="Progress">
      <dl className="grid grid-cols-3 gap-4">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt className="text-ui text-ink-3">{label}</dt>
            <dd className="mt-1 font-mono text-ui text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </Sub>
  );
}
