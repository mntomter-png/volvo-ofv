-- Phase 1 (rest): Kjernetabell for lagrede Rapportvisninger.
-- Hver bruker eier sine egne visninger; RLS sikrer at ingen ser andres data.

-- Enum for hvilken side en visning hører til.
create type public.page_type as enum ('dashboard', 'nyregistreringer', 'populasjon');

create table public.user_report_views (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  description text,
  page_type   public.page_type not null,
  config      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Rask oppslag på brukerens visninger per side.
create index user_report_views_user_id_page_type_idx
  on public.user_report_views (user_id, page_type);

-- Hold updated_at i synk ved oppdatering.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_report_views_set_updated_at
  before update on public.user_report_views
  for each row
  execute function public.set_updated_at();

-- Row Level Security: kun eieren har tilgang til sine egne rader.
alter table public.user_report_views enable row level security;

create policy "Users can view their own report views"
  on public.user_report_views
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their own report views"
  on public.user_report_views
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own report views"
  on public.user_report_views
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own report views"
  on public.user_report_views
  for delete
  to authenticated
  using (auth.uid() = user_id);
