-- Bestandseksport utenfor Netlify sin synkrone 6 MB-respons.
--
-- Komprimert .xlsx for hele siste snapshot (~65k rader, samme kolonner som
-- eksporten) er ca. 10 MB. Lambda kutter kroppen, ZIP-en mister sentralkatalogen,
-- og Excel sier at filen er ødelagt. Filen bygges derfor i en Netlify
-- bakgrunnsfunksjon og lagres i en privat bucket.
--
-- population_export_page leser radene som service_role (SECURITY DEFINER,
-- RLS gjelder ikke for eieren). Den er ikke kjørbar for anon/authenticated.
-- Authenticator sin statement_timeout på 8s heves bare for dette kallet.
-- Nøkkelfilter (snapshot_date, registration_number) erstatter OFFSET.
--
-- Ikke kjørt mot prod av agenten. Martin appliserer migrasjonen før deploy.

-- Én gang per spørring, ikke per rad. jwt_can_read_population() er stable.
drop policy if exists "Role-based read population" on public.population;
create policy "Role-based read population"
  on public.population
  for select
  to authenticated
  using ((select public.jwt_can_read_population()));

-- Keyset for eksporten: snapshot + reg.nr., bare tunge kjøretøy.
create index if not exists population_snapshot_registration_number_idx
  on public.population (snapshot_date, registration_number)
  where maximum_laden_mass_kg >= 16000;

create table public.population_export_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'ready', 'failed')),
  filters jsonb not null,
  snapshot_date date,
  rows_fetched integer not null default 0 check (rows_fetched >= 0),
  row_count integer,
  truncated boolean not null default false,
  error_message text,
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.population_export_jobs is
  'Bakgrunnsjobb for bestandseksport. Filen ligger i bucket population-exports.';

alter table public.population_export_jobs enable row level security;

revoke all on table public.population_export_jobs from public, anon, authenticated;
grant select on table public.population_export_jobs to authenticated;
grant select, insert, update, delete on table public.population_export_jobs to service_role;

create policy "Users read own population export jobs"
  on public.population_export_jobs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create index population_export_jobs_user_created_idx
  on public.population_export_jobs (user_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'population-exports',
  'population-exports',
  false,
  52428800,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users read own population export files" on storage.objects;
create policy "Users read own population export files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'population-exports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Sidevis lesing. Filtrene speiler applyPopulationFilters / parsePopulationSearchParams.
-- p_disp = 0 og p_bodywork = -1 betyr IS NULL, som i eksporten i appen.
-- p_age_cutoff kommer fra populationAgeCutoff() slik at aldersfilteret matcher UI.
create or replace function public.population_export_page(
  p_snapshot_date date,
  p_after_registration_number text,
  p_limit int,
  p_segment text,
  p_make text,
  p_region int,
  p_district text,
  p_hp int,
  p_fuel text,
  p_pabygg text,
  p_disp int,
  p_chassis text,
  p_bodywork int,
  p_age text,
  p_age_cutoff date,
  p_q text
)
returns table (
  registration_number text,
  make_name text,
  model_name text,
  variant_name text,
  usage_name text,
  maximum_laden_mass_kg int,
  first_registration_date date,
  vehicle_status text,
  primary_owner_name text,
  primary_owner_postal_code text,
  primary_owner_postal_district text,
  primary_user_name text,
  primary_user_postal_code text,
  primary_user_postal_district text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int;
  v_q text;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  -- Lokal for PostgREST-transaksjonen. authenticator sin 8s gjelder ikke her.
  perform set_config('statement_timeout', '30s', true);
  perform set_config('plan_cache_mode', 'force_custom_plan', true);

  v_limit := least(greatest(coalesce(p_limit, 1000), 1), 1000);
  v_q := nullif(
    left(replace(replace(coalesce(p_q, ''), '%', ''), '_', ''), 80),
    ''
  );
  if v_q is not null and char_length(v_q) < 2 then
    v_q := null;
  end if;

  return query
  select
    p.registration_number,
    p.make_name,
    p.model_name,
    p.variant_name,
    p.usage_name,
    p.maximum_laden_mass_kg,
    p.first_registration_date,
    p.vehicle_status,
    p.primary_owner_name,
    p.primary_owner_postal_code,
    p.primary_owner_postal_district,
    p.primary_user_name,
    p.primary_user_postal_code,
    p.primary_user_postal_district
  from public.population p
  where p.snapshot_date = p_snapshot_date
    and p.maximum_laden_mass_kg >= 16000
    and (
      p_after_registration_number is null
      or p.registration_number > p_after_registration_number
    )
    and (p_segment is null or p.usage_name = p_segment)
    and (p_make is null or p.make_name = p_make)
    and (p_region is null or p.sales_region = p_region)
    and (p_district is null or p.sales_district = p_district)
    and (p_hp is null or p.hp_bucket = p_hp)
    and (p_fuel is null or p.fuel_name = p_fuel)
    and (p_pabygg is null or p.pabygg_segment = p_pabygg)
    and (
      p_disp is null
      or (p_disp = 0 and p.disp_bucket is null)
      or (p_disp <> 0 and p.disp_bucket = p_disp)
    )
    and (p_chassis is null or p.trekker_jevnlast = p_chassis)
    and (
      p_bodywork is null
      or (p_bodywork = -1 and p.bodywork_code is null)
      or (p_bodywork <> -1 and p.bodywork_code = p_bodywork)
    )
    and (
      p_age is null
      or (
        p_age = 'under10'
        and p_age_cutoff is not null
        and p.first_registration_date >= p_age_cutoff
      )
      or (
        p_age = 'over10'
        and p_age_cutoff is not null
        and p.first_registration_date < p_age_cutoff
      )
    )
    and (
      v_q is null
      or p.primary_owner_name ilike '%' || v_q || '%'
      or p.primary_user_name ilike '%' || v_q || '%'
      or (
        v_q ~ '^[0-9]{3,}$'
        and (
          p.primary_owner_orgnr like v_q || '%'
          or p.primary_user_orgnr like v_q || '%'
        )
      )
    )
  order by p.registration_number
  limit v_limit;
end;
$$;

revoke all on function public.population_export_page(
  date, text, int, text, text, int, text, int, text, text, int, text, int, text, date, text
) from public, anon, authenticated;

grant execute on function public.population_export_page(
  date, text, int, text, text, int, text, int, text, text, int, text, int, text, date, text
) to service_role;

do $$
declare
  fn text := 'public.population_export_page(date, text, int, text, text, int, text, int, text, text, int, text, int, text, date, text)';
begin
  if has_function_privilege('anon', fn, 'execute')
     or has_function_privilege('authenticated', fn, 'execute')
     or has_function_privilege('public', fn, 'execute') then
    raise exception 'population_export_page er kjørbar for anon, authenticated eller PUBLIC';
  end if;
  if not has_function_privilege('service_role', fn, 'execute') then
    raise exception 'population_export_page mangler EXECUTE for service_role';
  end if;
end $$;
