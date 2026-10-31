-- Delte TMF-budsjettversjoner.
--
-- Tidligere kunne hver leder bare lese versjoner der auth.uid() = user_id.
-- TMF er en felles arbeidsflate for leder og super (samme modell som
-- tmf_commercial_indicators): alle med de rollene skal kunne lese alle
-- versjoner. Oppdatering og sletting blir hos den som opprettet raden.
-- Anon har verken policy eller tabell-grant.

alter table public.tmf_budget_versions
  add column if not exists creator_label text;

comment on column public.tmf_budget_versions.creator_label is
  'Navn eller e-post til den som lagret versjonen. Settes fra auth.users ved skriving og vises i budsjettlisten. Ikke et tilgangsfelt.';

-- Backfill uten å flytte updated_at. Triggeren som setter e-post finnes ikke
-- ennå, så verdien skrives rett fra auth.users.
alter table public.tmf_budget_versions
  disable trigger tmf_budget_versions_set_updated_at;

update public.tmf_budget_versions as v
set creator_label = coalesce(
  nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
  nullif(btrim(u.raw_user_meta_data->>'name'), ''),
  nullif(u.email, '')
)
from auth.users as u
where u.id = v.user_id
  and coalesce(
    nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(u.raw_user_meta_data->>'name'), ''),
    nullif(u.email, '')
  ) is not null
  and v.creator_label is distinct from coalesce(
    nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(u.raw_user_meta_data->>'name'), ''),
    nullif(u.email, '')
  );

alter table public.tmf_budget_versions
  enable trigger tmf_budget_versions_set_updated_at;

-- Funksjonen leser auth.users og må være security definer. Den ligger i
-- private slik at PostgREST (som eksponerer public) ikke tilbyr den som API.
-- authenticated trenger likevel EXECUTE, fordi den som kjører INSERT/UPDATE
-- må ha lov til å fyre triggeren.
create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.tmf_budget_versions_set_creator_label()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_label text;
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
  end if;

  -- Visningsnavn fra user_metadata er bare etikett. Tilgang styres av
  -- app_metadata.role og user_id, aldri av dette feltet.
  select coalesce(
    nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(u.raw_user_meta_data->>'name'), ''),
    nullif(u.email, '')
  )
  into v_label
  from auth.users as u
  where u.id = new.user_id;

  if v_label is not null then
    new.creator_label := v_label;
  elsif tg_op = 'INSERT' then
    new.creator_label := null;
  end if;

  return new;
end;
$$;

comment on function private.tmf_budget_versions_set_creator_label() is
  'Setter creator_label til navn eller e-post fra auth.users og hindrer bytte av user_id. Ikke et API.';

revoke all on function private.tmf_budget_versions_set_creator_label() from public, anon;
grant execute on function private.tmf_budget_versions_set_creator_label() to authenticated, service_role;

drop trigger if exists tmf_budget_versions_set_creator_label
  on public.tmf_budget_versions;

create trigger tmf_budget_versions_set_creator_label
  before insert or update on public.tmf_budget_versions
  for each row
  execute function private.tmf_budget_versions_set_creator_label();

-- (select ...) evaluerer rolle og uid én gang per spørring, ikke per rad.
drop policy if exists "Users can view their own TMF budgets"
  on public.tmf_budget_versions;
drop policy if exists "TMF roles can view all budget versions"
  on public.tmf_budget_versions;

create policy "TMF roles can view all budget versions"
  on public.tmf_budget_versions
  for select
  to authenticated
  using ((select public.jwt_app_role()) in ('leder', 'super'));

drop policy if exists "Users can create their own TMF budgets"
  on public.tmf_budget_versions;
drop policy if exists "TMF roles can create their own budget versions"
  on public.tmf_budget_versions;

create policy "TMF roles can create their own budget versions"
  on public.tmf_budget_versions
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select public.jwt_app_role()) in ('leder', 'super')
  );

drop policy if exists "Users can update their own TMF budgets"
  on public.tmf_budget_versions;
drop policy if exists "Creators can update their own TMF budgets"
  on public.tmf_budget_versions;

create policy "Creators can update their own TMF budgets"
  on public.tmf_budget_versions
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and (select public.jwt_app_role()) in ('leder', 'super')
  )
  with check (
    (select auth.uid()) = user_id
    and (select public.jwt_app_role()) in ('leder', 'super')
  );

drop policy if exists "Users can delete their own TMF budgets"
  on public.tmf_budget_versions;
drop policy if exists "Creators can delete their own TMF budgets"
  on public.tmf_budget_versions;

create policy "Creators can delete their own TMF budgets"
  on public.tmf_budget_versions
  for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and (select public.jwt_app_role()) in ('leder', 'super')
  );

revoke all on table public.tmf_budget_versions from anon;
grant select, insert, update, delete on table public.tmf_budget_versions to authenticated;
