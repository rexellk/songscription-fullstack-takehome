"use client";

import { Segmented } from "@/components/Segmented";
import { HAND_OPTIONS, SPEED_OPTIONS, speedLabel, type PracticeDefaults } from "@/lib/preferences";
import type { PracticeHand, Song, SongUpdate } from "@/types";

export const SHORT_HAND: Record<PracticeHand, string> = { both: "Both", left: "Left", right: "Right" };

type Props = {
  song: Song;
  defaults: PracticeDefaults;
  onChange: (patch: SongUpdate, setting: "speed" | "hand", value: string | number | null) => void;
};

/**
 * Per-song overrides. "Default" stores null, so changing the practice default later
 * still reaches every song the learner never customized.
 */
export function PracticeSettings({ song, defaults, onChange }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-ui text-ink-2">For this song only. Default follows your practice defaults in Settings.</p>
      <Segmented
        legend="Speed"
        name={`speed-${song.id}`}
        value={song.practice_speed}
        options={[{ value: null, label: "Default" }, ...SPEED_OPTIONS.map((s) => ({ value: s, label: speedLabel(s) }))]}
        onChange={(v) => onChange({ practice_speed: v }, "speed", v)}
        hint={`Default is ${speedLabel(defaults.speed)}`}
      />
      <Segmented<PracticeHand>
        legend="Hands"
        name={`hand-${song.id}`}
        value={song.practice_hand}
        options={[{ value: null, label: "Default" }, ...HAND_OPTIONS.map((h) => ({ value: h, label: SHORT_HAND[h] }))]}
        onChange={(v) => onChange({ practice_hand: v }, "hand", v)}
        hint={`Default is ${SHORT_HAND[defaults.hand].toLowerCase()} ${defaults.hand === "both" ? "hands" : "hand"}`}
      />
    </div>
  );
}
