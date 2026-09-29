import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Json } from "@/types";

/**
 * Every event the product logs, with the props each one carries.
 * Typed so a call site can't drift from what the README's SQL queries expect.
 * Search is logged as lengths and counts only, never the text someone typed.
 */
export type TrackEvents = {
  song_added: { source: "upload" | "sample" | "seed"; duration_sec: number | null; difficulty: string | null };
  upload_failed: { reason: UploadFailureReason; source: "upload" | "sample" | "seed" };
  duplicate_detected: { source: "upload" | "sample" | "seed" };
  preview_played: { surface: "card" | "drawer" | "practice" };
  drawer_opened: { surface: "card" | "up_next" | "duplicate" };
  practice_started: { surface: "up_next" | "drawer"; slot?: SuggestionSlot };
  suggestion_clicked: { slot: SuggestionSlot };
  search_used: { query_length: number; result_count: number };
  filter_used: { filter: string };
  sort_changed: { value: string };
  transcription_rated: { rating: string };
  theme_changed: { mode: string };
  practice_theme_changed: { scope: "library" | "song"; theme: string | null };
  practice_settings_changed: { scope: "library" | "song"; setting: string; value: string | number | null };
};

export type UploadFailureReason = "wrong_type" | "too_large" | "parse_error" | "storage_error" | "insert_error";
export type SuggestionSlot = "keep_going" | "revisit" | "something_new" | "start_here";

type TrackOptions = { songId?: string | null };

/** Fire and forget. Never awaited by the UI, never throws, never blocks an interaction. */
export function track<E extends keyof TrackEvents>(name: E, props: TrackEvents[E], options: TrackOptions = {}) {
  if (process.env.NODE_ENV === "development") {
    console.debug("[track]", name, props, options.songId ?? "");
  }
  if (!isSupabaseConfigured) return;

  try {
    void getSupabase()
      .from("events")
      .insert({ name, song_id: options.songId ?? null, props: props as Json })
      .then(({ error }) => {
        if (error && process.env.NODE_ENV === "development") console.debug("[track] dropped", name, error.message);
      });
  } catch {
    // Analytics must never break the product.
  }
}
