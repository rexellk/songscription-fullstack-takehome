"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { PracticeHand, PracticeTheme, Song } from "@/types";

/**
 * Library-wide practice defaults: how this person likes to practice.
 * Per-song overrides live on the song row (null means "use these").
 * Kept in localStorage because it's a personal preference on this device, not library data.
 */
export type PracticeDefaults = {
  speed: 0.5 | 0.75 | 1;
  hand: PracticeHand;
  theme: PracticeTheme;
};

export const DEFAULT_PRACTICE: PracticeDefaults = { speed: 1, hand: "both", theme: "embers" };

export const SPEED_OPTIONS = [0.5, 0.75, 1] as const;
export const HAND_OPTIONS: PracticeHand[] = ["both", "left", "right"];

export const speedLabel = (s: number) => `${Math.round(s * 100)}%`;
export const HAND_LABEL: Record<PracticeHand, string> = { both: "Both hands", left: "Left hand", right: "Right hand" };

const KEY = "anything-piano:practice-defaults";
const EVENT = "anything-piano:preferences";

let cachedRaw: string | null | undefined;
let cachedValue: PracticeDefaults = DEFAULT_PRACTICE;

function read(): PracticeDefaults {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return DEFAULT_PRACTICE; // private mode or blocked storage: fall back quietly
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    cachedValue = raw ? { ...DEFAULT_PRACTICE, ...(JSON.parse(raw) as Partial<PracticeDefaults>) } : DEFAULT_PRACTICE;
  } catch {
    cachedValue = DEFAULT_PRACTICE;
  }
  return cachedValue;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function usePracticeDefaults() {
  const value = useSyncExternalStore(subscribe, read, () => DEFAULT_PRACTICE);
  const update = useCallback((patch: Partial<PracticeDefaults>) => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch }));
    } catch {
      // Not saved across reloads, but the rest of the app keeps working.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [value, update] as const;
}

/** The settings a practice session would actually use for this song. */
export function effectivePractice(song: Pick<Song, "practice_speed" | "practice_hand" | "practice_theme">, d: PracticeDefaults) {
  return {
    speed: song.practice_speed ?? d.speed,
    hand: song.practice_hand ?? d.hand,
    theme: song.practice_theme ?? d.theme,
  };
}
