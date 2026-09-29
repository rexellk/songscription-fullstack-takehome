import { hardPartAdvice, hardestPart, smooth } from "@/lib/density";
import { formatDuration } from "@/lib/format";

type Props = { density: number[] | null; durationSec: number | null };

/** Where the song gets busy, start to finish: the busiest stretch in ink, the rest in a quiet tone. */
export function DensityStrip({ density, durationSec }: Props) {
  const part = hardestPart(density, durationSec);
  if (!density || !part) return null;
  const bars = smooth(density);
  const max = part.peak;
  return (
    <div className="mt-4">
      <div
        className="flex h-6 items-end gap-[2px]"
        role="img"
        aria-label={`How busy the song is from start to finish. ${hardPartAdvice(part)}`}
      >
        {bars.map((d, i) => {
          const hot = !part.even && i >= part.from && i <= part.to;
          return (
            <span
              key={i}
              className={`flex-1 rounded-[1px] ${hot ? "bg-ink" : "bg-rule-strong"}`}
              style={{ height: `${Math.max(8, Math.min(100, (d / max) * 100))}%` }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between font-mono text-meta text-ink-3" aria-hidden>
        <span>0:00</span>
        <span>{formatDuration(durationSec)}</span>
      </div>
      <p className="mt-2 text-ui text-ink-2">{hardPartAdvice(part)}</p>
    </div>
  );
}
