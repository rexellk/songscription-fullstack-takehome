import { formatDuration } from "@/lib/format";

export type HardPart = {
  /** Bucket indexes of the busiest stretch. */
  from: number;
  to: number;
  startSec: number;
  endSec: number;
  peak: number;
  /** True when no stretch stands out: the pace is about even throughout. */
  even: boolean;
};

const MIN_SONG_SEC = 30;

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
const MIN_SPAN = 3;

/** A 5-point triangular moving average, so one busy chord can't pass for a hard passage. */
export function smooth(values: number[]) {
  const w = [1, 2, 3, 2, 1];
  return values.map((_, i) => {
    let sum = 0;
    let weight = 0;
    for (let k = -2; k <= 2; k++) {
      const v = values[i + k];
      if (v === undefined) continue;
      sum += v * w[k + 2];
      weight += w[k + 2];
    }
    return sum / weight;
  });
}

/**
 * The busiest stretch of the song: the peak of the smoothed profile plus its neighbors
 * that are at least 80% as busy, at least three sections wide. "Even" when that stretch
 * is barely busier than a typical section. Short pieces return null: at under 30 seconds the question
 * "which part is hard" doesn't have a useful answer.
 */
export function hardestPart(density: number[] | null, durationSec: number | null): HardPart | null {
  if (!density?.length || !durationSec || durationSec < MIN_SONG_SEC) return null;
  const n = density.length;
  const smoothed = smooth(density);
  const peak = Math.max(...smoothed);
  if (peak <= 0) return null;
  const at = smoothed.indexOf(peak);
  let from = at;
  let to = at;
  while (from > 0 && smoothed[from - 1] >= peak * 0.8) from--;
  while (to < n - 1 && smoothed[to + 1] >= peak * 0.8) to++;
  while (to - from + 1 < MIN_SPAN) {
    if (from > 0) from--;
    if (to - from + 1 < MIN_SPAN && to < n - 1) to++;
  }
  // Judge the stretch by the median of its raw sections, so one loud chord can't carry it.
  const typical = median(density.filter((d) => d > 0));
  const even = median(density.slice(from, to + 1)) < typical * 1.35;
  const size = durationSec / n;
  return { from, to, startSec: from * size, endSec: (to + 1) * size, peak, even };
}

/** One plain sentence a teacher might say, with a speed to try when the passage is fast. */
export function hardPartAdvice(part: HardPart) {
  if (part.even) return "The pace stays about the same all the way through.";
  const where = `Busiest from ${formatDuration(Math.floor(part.startSec))} to ${formatDuration(Math.ceil(part.endSec))}.`;
  if (part.peak >= 8) return `${where} Try that part at 50% first.`;
  if (part.peak >= 5) return `${where} Try that part at 75% first.`;
  return where;
}
