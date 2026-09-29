import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const MIDI_BUCKET = "midi";

/** False until .env.local is filled in. The page shows a setup notice instead of crashing. */
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient<Database> | null = null;

/** Lazily created so a missing env var never breaks `next build` or prerendering. */
export function getSupabase(): SupabaseClient<Database> {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase isn't configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
    );
  }
  client ??= createClient<Database>(url, anonKey, {
    auth: { persistSession: false },
  });
  return client;
}
