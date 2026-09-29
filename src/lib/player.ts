"use client";

import type { PreviewNote } from "@/types";

/**
 * One piano for the whole app. Tone.js and the Salamander grand piano samples are
 * loaded on the first play (a user gesture, which browsers require before audio),
 * so neither costs anything on page load. Only one song plays at a time.
 */

export type Surface = "card" | "drawer";
export type PlayerState =
  | { status: "idle" }
  | { status: "loading"; songId: string; surface: Surface }
  | { status: "playing"; songId: string; surface: Surface; startedAt: number; seconds: number }
  | { status: "error"; songId: string; surface: Surface };

type ToneModule = typeof import("tone");

const SALAMANDER = "https://tonejs.github.io/audio/salamander/";
// Salamander ships every minor third; the sampler repitches the notes in between.
const SAMPLE_URLS: Record<string, string> = (() => {
  const urls: Record<string, string> = { A0: "A0.mp3", C8: "C8.mp3" };
  for (let octave = 1; octave <= 7; octave++) {
    urls[`C${octave}`] = `C${octave}.mp3`;
    urls[`D#${octave}`] = `Ds${octave}.mp3`;
    urls[`F#${octave}`] = `Fs${octave}.mp3`;
    urls[`A${octave}`] = `A${octave}.mp3`;
  }
  return urls;
})();

let tone: ToneModule | null = null;
let sampler: import("tone").Sampler | null = null;
let loading: Promise<void> | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let state: PlayerState = { status: "idle" };
const listeners = new Set<() => void>();

function setState(next: PlayerState) {
  state = next;
  listeners.forEach((l) => l());
}

export const player = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Seconds since the current preview started, from the audio clock, not a timer. */
  position() {
    if (state.status !== "playing" || !tone) return 0;
    return Math.max(0, tone.getTransport().seconds);
  },
};

async function ensurePiano() {
  if (sampler && tone) return;
  loading ??= (async () => {
    tone = await import("tone");
    await tone.start();
    sampler = new tone.Sampler({ urls: SAMPLE_URLS, baseUrl: SALAMANDER, release: 1.2 }).toDestination();
    sampler.volume.value = -6;
    await tone.loaded();
  })();
  try {
    await loading;
  } catch (err) {
    loading = null;
    sampler = null;
    throw err;
  }
}

export async function play(songId: string, surface: Surface, notes: PreviewNote[], seconds: number) {
  stop();
  setState({ status: "loading", songId, surface });
  try {
    await ensurePiano();
  } catch {
    setState({ status: "error", songId, surface });
    return false;
  }
  // Something else was started (or stop was pressed) while the samples loaded.
  if (state.status !== "loading" || state.songId !== songId || state.surface !== surface) return false;
  if (!tone || !sampler) return false;

  const transport = tone.getTransport();
  const piano = sampler;
  const Tone = tone;
  transport.cancel();
  transport.position = 0;
  for (const n of notes) {
    if (n.t >= seconds) continue;
    const length = Math.max(0.05, Math.min(n.d, seconds - n.t));
    transport.schedule((time) => {
      piano.triggerAttackRelease(Tone.Frequency(n.p, "midi").toNote(), length, time, 0.7);
    }, n.t);
  }
  transport.start("+0.05");
  setState({ status: "playing", songId, surface, startedAt: Date.now(), seconds });
  stopTimer = setTimeout(stop, (seconds + 0.2) * 1000);
  return true;
}

export function stop() {
  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = null;
  if (tone) {
    const transport = tone.getTransport();
    transport.stop();
    transport.cancel();
  }
  sampler?.releaseAll();
  if (state.status !== "idle") setState({ status: "idle" });
}
