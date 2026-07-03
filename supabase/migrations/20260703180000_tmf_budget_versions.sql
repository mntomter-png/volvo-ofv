-- Lagrede TMF-budsjettversjoner per bruker.

create table public.tmf_budget_versions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  name                  text not null,
  description           text,
  target_year           int not null,
  config                jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index tmf_budget_versions_user_id_idx
  on public.tmf_budget_versions (user_id, updated_at desc);

create trigger tmf_budget_versions_set_updated_at
  before update on public.tmf_budget_versions
  for each row
  execute function public.set_updated_at();

alter table public.tmf_budget_versions enable row level security;

create policy "Users can view their own TMF budgets"
  on public.tmf_budget_versions for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their own TMF budgets"
  on public.tmf_budget_versions for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own TMF budgets"
  on public.tmf_budget_versions for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own TMF budgets"
  on public.tmf_budget_versions for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.tmf_budget_versions to authenticated;
