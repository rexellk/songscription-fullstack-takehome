// Row types mirror supabase/schema.sql. Keep the two in sync by hand; the schema is small
// enough that generated types would add tooling without adding safety.

export type Difficulty = "easy" | "medium" | "hard";
export type QualityRating = "right" | "some_off" | "unusable";
export type PracticeHand = "both" | "left" | "right";
export type PracticeTheme = "off" | "embers" | "petals" | "snow" | "stardust";

/** A downsampled note stored for thumbnails: pitch (MIDI number), start (s), duration (s). */
export type PreviewNote = { p: number; t: number; d: number };

export type Song = {
  id: string;
  title: string;
  file_name: string;
  storage_path: string;
  file_size_bytes: number | null;
  file_hash: string | null;

  duration_sec: number | null;
  bpm: number | null;
  time_signature: string | null;
  key_name: string | null;
  key_confidence: number | null;
  note_count: number | null;
  notes_per_sec: number | null;
  /** Notes played together count once; this is how often the hands actually move. */
  onsets_per_sec: number | null;
  avg_chord_size: number | null;
  /** Continuous score behind `difficulty`; used for "easiest first" sorting. */
  difficulty_score: number | null;
  difficulty: Difficulty | null;
  /** Onsets per second across the whole song in 40 equal sections: where it gets hard. */
  density: number[] | null;
  lowest_pitch: number | null;
  highest_pitch: number | null;
  right_hand_ratio: number | null;
  track_count: number | null;
  preview_notes: PreviewNote[] | null;

  is_favorite: boolean;
  tags: string[];
  practice_count: number;
  last_practiced_at: string | null;
  best_accuracy: number | null;

  quality_rating: QualityRating | null;
  quality_note: string | null;

  /** Per-song overrides of the library-wide practice defaults. Null means "use the default". */
  practice_speed: number | null;
  practice_hand: PracticeHand | null;
  practice_theme: PracticeTheme | null;

  created_at: string;
};

/** Columns the database fills in or defaults. */
type SongGenerated =
  | "id"
  | "created_at"
  | "is_favorite"
  | "tags"
  | "practice_count"
  | "last_practiced_at"
  | "best_accuracy"
  | "quality_rating"
  | "quality_note"
  | "practice_speed"
  | "practice_hand"
  | "practice_theme";

export type SongInsert = Omit<Song, SongGenerated> & Partial<Pick<Song, SongGenerated>>;
export type SongUpdate = Partial<Song>;

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type EventRow = {
  id: number;
  name: string;
  song_id: string | null;
  props: Json;
  created_at: string;
};

export type EventInsert = {
  name: string;
  song_id?: string | null;
  props?: Json;
};

export type Database = {
  public: {
    Tables: {
      songs: {
        Row: Song;
        Insert: SongInsert;
        Update: SongUpdate;
        Relationships: [];
      };
      events: {
        Row: EventRow;
        Insert: EventInsert;
        Update: Partial<EventInsert>;
        Relationships: [
          {
            foreignKeyName: "events_song_id_fkey";
            columns: ["song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
