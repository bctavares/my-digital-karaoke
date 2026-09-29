CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id text NOT NULL UNIQUE,
  title text NOT NULL,
  author text,
  thumbnail_url text,
  play_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT 'Karaoke',
  host_token text NOT NULL,
  is_playing boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  transition_seconds smallint NOT NULL DEFAULT 5 CHECK (transition_seconds BETWEEN 0 AND 30),
  countdown_until timestamptz
);

CREATE TABLE IF NOT EXISTS public.queue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  singer_name text NOT NULL,
  requester_token text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  position bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS queue_items_room_idx ON public.queue_items (room_id, status, position);

CREATE TABLE IF NOT EXISTS public.performance_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_item_id uuid NOT NULL REFERENCES public.queue_items(id) ON DELETE CASCADE,
  rater_token text NOT NULL,
  score smallint NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT performance_ratings_queue_item_rater_unique UNIQUE (queue_item_id, rater_token)
);

CREATE INDEX IF NOT EXISTS performance_ratings_queue_item_idx ON public.performance_ratings (queue_item_id);
