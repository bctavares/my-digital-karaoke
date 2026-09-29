ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS transition_seconds smallint NOT NULL DEFAULT 5
    CHECK (transition_seconds BETWEEN 0 AND 30);

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS countdown_until timestamptz;

CREATE OR REPLACE FUNCTION public.auto_start_queue_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_playing boolean;
  waiting_until timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.room_id::text));

  SELECT EXISTS (
    SELECT 1 FROM public.queue_items
    WHERE room_id = NEW.room_id AND status = 'playing'
  ) INTO has_playing;

  SELECT countdown_until
  FROM public.rooms
  WHERE id = NEW.room_id
  FOR UPDATE
  INTO waiting_until;

  IF NOT has_playing AND (waiting_until IS NULL OR waiting_until <= now()) THEN
    UPDATE public.queue_items SET status = 'playing' WHERE id = NEW.id;
    UPDATE public.rooms
    SET is_playing = true, countdown_until = NULL
    WHERE id = NEW.room_id;
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
