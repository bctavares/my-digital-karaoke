DROP POLICY IF EXISTS "queue deletable by everyone" ON public.queue_items;
DROP POLICY IF EXISTS "queue insertable by everyone" ON public.queue_items;
DROP POLICY IF EXISTS "queue readable by everyone" ON public.queue_items;
DROP POLICY IF EXISTS "queue updatable by everyone" ON public.queue_items;
DROP POLICY IF EXISTS "rooms insertable by everyone" ON public.rooms;
DROP POLICY IF EXISTS "rooms readable by everyone" ON public.rooms;
DROP POLICY IF EXISTS "rooms updatable by everyone" ON public.rooms;
DROP POLICY IF EXISTS "songs insertable by everyone" ON public.songs;
DROP POLICY IF EXISTS "songs readable by everyone" ON public.songs;
DROP POLICY IF EXISTS "songs updatable by everyone" ON public.songs;

REVOKE ALL ON public.queue_items FROM anon, authenticated;
REVOKE ALL ON public.rooms FROM anon, authenticated;
REVOKE ALL ON public.songs FROM anon, authenticated;

GRANT ALL ON public.queue_items TO service_role;
GRANT ALL ON public.rooms TO service_role;
GRANT ALL ON public.songs TO service_role;