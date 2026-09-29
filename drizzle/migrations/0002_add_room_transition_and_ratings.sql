alter table public.rooms
  add column if not exists transition_seconds integer not null default 0,
  add column if not exists countdown_until timestamptz;

create table if not exists public.performance_ratings (
  id uuid primary key default gen_random_uuid(),
  queue_item_id uuid not null references public.queue_items(id) on delete cascade,
  rater_token text not null,
  score integer not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  unique (queue_item_id, rater_token)
);
