CREATE TABLE IF NOT EXISTS public.performance_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_item_id uuid NOT NULL REFERENCES public.queue_items(id) ON DELETE CASCADE,
  rater_token text NOT NULL,
  score smallint NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (queue_item_id, rater_token)
);

CREATE INDEX IF NOT EXISTS performance_ratings_queue_item_id_idx
  ON public.performance_ratings(queue_item_id);

CREATE OR REPLACE FUNCTION public.auto_start_queue_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_playing boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.room_id::text));

  SELECT EXISTS (
    SELECT 1
    FROM public.queue_items
    WHERE room_id = NEW.room_id
      AND status = 'playing'
  ) INTO has_playing;

  IF NOT has_playing THEN
    UPDATE public.queue_items
    SET status = 'playing'
    WHERE id = NEW.id;

    UPDATE public.rooms
    SET is_playing = true
    WHERE id = NEW.room_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS queue_item_auto_start ON public.queue_items;
CREATE TRIGGER queue_item_auto_start
AFTER INSERT ON public.queue_items
FOR EACH ROW
EXECUTE FUNCTION public.auto_start_queue_item();
