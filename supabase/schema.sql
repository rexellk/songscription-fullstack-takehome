-- Anything Piano library: schema for the take-home.
-- Run once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- Safe to re-run: everything is guarded with "if not exists" or dropped first.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- songs: one row per song in the user's library.
-- Grouped by where each column comes from, so a reader can see what is real
-- (parsed from the file), what is mocked (learner data, no auth), and what is
-- research (quality feedback).
-- ---------------------------------------------------------------------------
create table if not exists songs (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  file_name         text not null,
  storage_path      text not null,
  file_size_bytes   int,
  file_hash         text unique,        -- SHA-256 of the file: blocks duplicate uploads (and duplicate GPU work)

  -- parsed from the MIDI on upload, so the library can be filtered and sorted without re-reading files
  duration_sec      real,
  bpm               real,
  time_signature    text,
  key_name          text,               -- "G major"
  key_confidence    real,               -- 0..1, correlation from key detection
  note_count        int,
  notes_per_sec     real,
  onsets_per_sec    real,               -- notes starting together count once: how often the hands move
  avg_chord_size    real,               -- notes per onset
  difficulty_score  real,               -- onsets/s + chord weight + keyboard span; bucketed into difficulty
  difficulty        text check (difficulty in ('easy','medium','hard')),
  lowest_pitch      int,
  highest_pitch     int,
  right_hand_ratio  real,               -- share of notes at or above middle C
  track_count       int,
  preview_notes     jsonb,              -- downsampled [{p,t,d}], max 500 notes, drawn as the card thumbnail

  -- learner data (mocked for the demo; per-user in production)
  is_favorite       boolean not null default false,
  tags              text[] not null default '{}',
  practice_count    int not null default 0,
  last_practiced_at timestamptz,
  best_accuracy     real check (best_accuracy between 0 and 100),

  -- transcription quality feedback (user research + labeled data for the model team)
  quality_rating    text check (quality_rating in ('right','some_off','unusable')),
  quality_note      text,

  -- per-song practice settings; null means "use the library default"
  practice_speed    real check (practice_speed in (0.5, 0.75, 1)),
  practice_hand     text check (practice_hand in ('both','left','right')),
  practice_theme    text check (practice_theme in ('off','embers','petals','snow','stardust')),

  created_at        timestamptz not null default now()
);

-- columns added after the first version of this file (no-ops on a fresh install)
alter table songs add column if not exists onsets_per_sec   real;
alter table songs add column if not exists avg_chord_size   real;
alter table songs add column if not exists difficulty_score real;

create index if not exists songs_created_idx   on songs (created_at desc);
-- The next three back server-side search and sort once libraries outgrow a single fetch
-- (see DECISIONS.md #22). Today the client filters the one list it already has.
create index if not exists songs_practiced_idx on songs (last_practiced_at desc nulls last);
create index if not exists songs_tags_idx      on songs using gin (tags);
create index if not exists songs_title_trgm    on songs using gin (title gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- events: product analytics. Answers "what do users actually do?"
-- Fire-and-forget from the client. Never stores raw search text.
-- ---------------------------------------------------------------------------
create table if not exists events (
  id         bigint generated always as identity primary key,
  name       text not null,
  song_id    uuid references songs(id) on delete set null,
  props      jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists events_name_time_idx on events (name, created_at desc);
-- song_id is joined on by every per-song question, and "on delete set null" scans it when a song is deleted
create index if not exists events_song_idx on events (song_id) where song_id is not null;

-- ---------------------------------------------------------------------------
-- Row level security. Single mocked user and no auth, so the demo policies are
-- open. In production these become "auth.uid() = user_id" on a user_id column.
-- ---------------------------------------------------------------------------
alter table songs  enable row level security;
alter table events enable row level security;

drop policy if exists "demo all"    on songs;
drop policy if exists "demo events" on events;
create policy "demo all"    on songs  for all using (true) with check (true);
create policy "demo events" on events for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Storage: the original .mid files, kept so the song can be re-parsed or
-- played back in full later.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('midi', 'midi', true)
  on conflict (id) do nothing;

drop policy if exists "demo midi read"   on storage.objects;
drop policy if exists "demo midi insert" on storage.objects;
drop policy if exists "demo midi delete" on storage.objects;
create policy "demo midi read"   on storage.objects for select using (bucket_id = 'midi');
create policy "demo midi insert" on storage.objects for insert with check (bucket_id = 'midi');
create policy "demo midi delete" on storage.objects for delete using (bucket_id = 'midi');
