-- Biblioteca global de músicas
CREATE TABLE public.songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id text NOT NULL UNIQUE,
  title text NOT NULL,
  author text,
  thumbnail_url text,
  play_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.songs TO anon;
GRANT SELECT, INSERT, UPDATE ON public.songs TO authenticated;
GRANT ALL ON public.songs TO service_role;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "songs readable by everyone" ON public.songs FOR SELECT USING (true);
CREATE POLICY "songs insertable by everyone" ON public.songs FOR INSERT WITH CHECK (true);
CREATE POLICY "songs updatable by everyone" ON public.songs FOR UPDATE USING (true) WITH CHECK (true);

-- Salas de karaoke
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT 'Karaoke',
  host_token text NOT NULL,
  is_playing boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.rooms TO anon;
GRANT SELECT, INSERT, UPDATE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms readable by everyone" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "rooms insertable by everyone" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "rooms updatable by everyone" ON public.rooms FOR UPDATE USING (true) WITH CHECK (true);

-- Fila de músicas
CREATE TABLE public.queue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  singer_name text NOT NULL,
  requester_token text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  position bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX queue_items_room_idx ON public.queue_items (room_id, status, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.queue_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.queue_items TO authenticated;
GRANT ALL ON public.queue_items TO service_role;
ALTER TABLE public.queue_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "queue readable by everyone" ON public.queue_items FOR SELECT USING (true);
CREATE POLICY "queue insertable by everyone" ON public.queue_items FOR INSERT WITH CHECK (true);
CREATE POLICY "queue updatable by everyone" ON public.queue_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "queue deletable by everyone" ON public.queue_items FOR DELETE USING (true);

ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.queue_items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_items;
