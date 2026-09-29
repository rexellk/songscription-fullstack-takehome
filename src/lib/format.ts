const PITCH_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

/** 204 -> "3:24" */
export function formatDuration(sec: number | null | undefined) {
  if (sec == null || !Number.isFinite(sec)) return "–:––";
  const total = Math.round(sec);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** 60 -> "C4" (scientific pitch notation, middle C is C4). */
export function pitchName(midi: number | null | undefined) {
  if (midi == null) return "";
  return `${PITCH_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

/** ISO timestamp -> "just now", "5m ago", "3h ago", "3d ago", "2w ago", "4mo ago". */
export function timeAgo(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "";
  const sec = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = sec / 60;
  if (min < 60) return `${Math.floor(min)}m ago`;
  const hr = min / 60;
  if (hr < 24) return `${Math.floor(hr)}h ago`;
  const day = hr / 24;
  if (day < 14) return `${Math.floor(day)}d ago`;
  if (day < 60) return `${Math.floor(day / 7)}w ago`;
  return `${Math.floor(day / 30)}mo ago`;
}

/** The same moment written out for screen readers: "3 days ago", not "3d ago". */
export function timeAgoSpoken(iso: string | null | undefined, now = Date.now()) {
  const short = timeAgo(iso, now);
  const m = short.match(/^(\d+)(m|h|d|w|mo) ago$/);
  if (!m) return short;
  const n = Number(m[1]);
  const unit = { m: "minute", h: "hour", d: "day", w: "week", mo: "month" }[m[2] as "m" | "h" | "d" | "w" | "mo"];
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

export function daysSince(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return Infinity;
  return Math.floor((now - new Date(iso).getTime()) / 86_400_000);
}

/** 372 -> "6h 12m", 45 -> "45m" */
export function formatMinutes(min: number) {
  const m = Math.round(min);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Mocked until real sessions are logged: each practice session counts as about 12 minutes. */
export const MINUTES_PER_SESSION = 12;

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
