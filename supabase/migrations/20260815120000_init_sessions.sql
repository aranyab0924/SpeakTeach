-- SpeakTeach starter schema.
-- Human team applies this in Supabase. FastAPI does not use this database.
-- No profiles table. No exercises table.

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null,
  duration_seconds double precision,
  transcript text,
  metrics jsonb not null default '{}'::jsonb,
  feedback jsonb not null default '{}'::jsonb,
  audio_path text,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_id_idx on public.sessions (user_id);

create table if not exists public.stutter_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  type text not null check (type in ('repetition', 'prolongation')),
  start_seconds double precision not null,
  end_seconds double precision not null,
  confidence double precision,
  text text,
  created_at timestamptz not null default now()
);

create index if not exists stutter_events_session_id_idx
  on public.stutter_events (session_id);

alter table public.sessions enable row level security;
alter table public.stutter_events enable row level security;

create policy sessions_owner_all
  on public.sessions
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy stutter_events_via_session
  on public.stutter_events
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = session_id
        and s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = session_id
        and s.user_id = (select auth.uid())
    )
  );
