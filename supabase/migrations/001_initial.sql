-- PageFlight — Initial Schema Migration
-- Run this in the Supabase SQL editor:
-- app.supabase.com → SQL Editor → New query → paste → Run

-- ─── Extensions ───────────────────────────────────────────────────────────────
-- pgcrypto is required for gen_random_uuid() (usually pre-enabled on Supabase)
create extension if not exists "pgcrypto";


-- ─── scan_jobs ────────────────────────────────────────────────────────────────
create table if not exists public.scan_jobs (
  id            uuid        primary key default gen_random_uuid(),
  url           text        not null,
  status        text        not null default 'queued'
                              check (status in ('queued', 'running', 'completed', 'failed')),
  user_id       uuid        references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists scan_jobs_user_id_idx on public.scan_jobs (user_id);
create index if not exists scan_jobs_status_idx  on public.scan_jobs (status);

-- RLS
alter table public.scan_jobs enable row level security;

-- Users can read their own jobs; anonymous jobs (user_id = null) are readable by anyone
-- (needed for the no-login free scan flow)
create policy "users_own_jobs"
  on public.scan_jobs
  for all
  using (user_id = auth.uid() or user_id is null);


-- ─── scan_results ─────────────────────────────────────────────────────────────
create table if not exists public.scan_results (
  id            uuid        primary key default gen_random_uuid(),
  job_id        uuid        not null references public.scan_jobs (id) on delete cascade,
  check_type    text        not null
                              check (check_type in ('adblock', 'mobile', 'form', 'seo')),
  passed        boolean     not null,
  issues        jsonb       not null default '[]'::jsonb,
  screenshots   jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists scan_results_job_id_idx on public.scan_results (job_id);

-- RLS
alter table public.scan_results enable row level security;

-- Readable if the parent scan_job is accessible to the current user
create policy "results_via_job"
  on public.scan_results
  for all
  using (
    exists (
      select 1 from public.scan_jobs
      where id = job_id
        and (user_id = auth.uid() or user_id is null)
    )
  );


-- ─── users (public profile, extends auth.users) ───────────────────────────────
create table if not exists public.users (
  id                  uuid        primary key references auth.users (id) on delete cascade,
  email               text        not null,
  plan                text        not null default 'free'
                                    check (plan in ('free', 'pro', 'agency')),
  lemon_customer_id   text,
  created_at          timestamptz not null default now()
);

-- RLS
alter table public.users enable row level security;

create policy "users_own_profile"
  on public.users
  for all
  using (id = auth.uid());

-- Auto-create a public.users row when a new auth.users row is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─── Grant usage to anon + authenticated roles ────────────────────────────────
grant usage on schema public to anon, authenticated;
grant all on public.scan_jobs    to anon, authenticated;
grant all on public.scan_results to anon, authenticated;
grant all on public.users        to authenticated;
