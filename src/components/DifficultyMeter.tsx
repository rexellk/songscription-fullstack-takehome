import type { Difficulty } from "@/types";

const LEVEL: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };
const LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

/** "About 4.2 notes or chords a second." */
export function difficultyPace(onsetsPerSec: number | null) {
  return onsetsPerSec != null ? `About ${onsetsPerSec.toFixed(1)} notes or chords a second.` : "";
}

export function difficultySentence(difficulty: Difficulty, onsetsPerSec: number | null) {
  return `${LABEL[difficulty]}. ${difficultyPace(onsetsPerSec)}`.trim();
}

/** Three short bars, filled in ink. Difficulty is shown in tone and count, never in color. */
export function DifficultyMeter({
  difficulty,
  onsetsPerSec = null,
  withTitle = true,
}: {
  difficulty: Difficulty | null;
  onsetsPerSec?: number | null;
  withTitle?: boolean;
}) {
  if (!difficulty) return null;
  const level = LEVEL[difficulty];
  return (
    <span className="inline-flex items-center gap-2" title={withTitle ? difficultySentence(difficulty, onsetsPerSec) : undefined}>
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-3 w-1 rounded-[1px] ${i <= level ? "bg-ink" : "bg-rule-strong"}`} />
        ))}
      </span>
      <span className="text-meta text-ink-2">
        <span className="sr-only">Difficulty: </span>
        {LABEL[difficulty]}
      </span>
    </span>
  );
}
