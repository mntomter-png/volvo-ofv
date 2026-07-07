-- Fleet VIN-register: manuelt opplastede VIN-er (dealer 896) for markedsandel-filter.

create table public.fleet_vins (
  vin text primary key check (char_length(vin) between 11 and 17),
  created_at timestamptz not null default now()
);

create index fleet_vins_vin_idx on public.fleet_vins (vin);

create table public.fleet_vin_uploads (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references auth.users (id) on delete cascade,
  vin_count int not null check (vin_count >= 0),
  source_label text,
  created_at timestamptz not null default now()
);

create index fleet_vin_uploads_created_at_idx
  on public.fleet_vin_uploads (created_at desc);

alter table public.fleet_vins enable row level security;
alter table public.fleet_vin_uploads enable row level security;

create policy "Authenticated read fleet vins"
  on public.fleet_vins for select to authenticated
  using (true);

create policy "Leder read fleet vin uploads"
  on public.fleet_vin_uploads for select to authenticated
  using (public.jwt_app_role() in ('leder', 'super', 'admin'));

create or replace function public.jwt_can_manage_fleet_vins()
returns boolean
language sql
stable
as $$
  select public.jwt_app_role() in ('leder', 'super', 'admin');
$$;

grant execute on function public.jwt_can_manage_fleet_vins() to authenticated;

create or replace function public.replace_fleet_vins(
  p_vins text[],
  p_source_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.jwt_can_manage_fleet_vins() then
    raise exception 'Ingen tilgang til å oppdatere fleet-VIN-register';
  end if;

  delete from public.fleet_vins;

  insert into public.fleet_vins (vin)
  select distinct upper(trim(v))
  from unnest(coalesce(p_vins, array[]::text[])) as v
  where char_length(trim(v)) between 11 and 17;

  get diagnostics v_count = row_count;

  insert into public.fleet_vin_uploads (uploaded_by, vin_count, source_label)
  values (auth.uid(), v_count, nullif(trim(p_source_label), ''));

  return jsonb_build_object('vin_count', v_count);
end;
$$;

grant execute on function public.replace_fleet_vins(text[], text) to authenticated;

create or replace function public.get_fleet_vin_registry_info()
returns table(
  vin_count int,
  last_uploaded_at timestamptz,
  last_source_label text
)
language sql
stable
security invoker
as $$
  select
    (select count(*)::int from public.fleet_vins) as vin_count,
    (
      select u.created_at
      from public.fleet_vin_uploads u
      order by u.created_at desc
      limit 1
    ) as last_uploaded_at,
    (
      select u.source_label
      from public.fleet_vin_uploads u
      order by u.created_at desc
      limit 1
    ) as last_source_label;
$$;

grant execute on function public.get_fleet_vin_registry_info() to authenticated;

create index if not exists registrations_vin_upper_idx
  on public.registrations (upper(vin))
  where vin is not null;

-- Fleet-filter på region-/distriktsammendrag (matcher fleet.ts-logikk).
drop function if exists public.reg_summary_by_region(int, text, text, int, int, int, text, text, int, text, date, date, text);
drop function if exists public.reg_summary_by_district(int, text, text, int, int, int, text, text, int, text, date, date, text);

create or replace function public.reg_summary_by_region(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_from date default null,
  p_to date default null,
  p_fleet_filter text default 'all',
  p_focus_make text default 'Volvo'
)
returns table(region smallint, count int, volvo_count int)
language sql stable security invoker
as $$
  with filtered as (
    select
      r.sales_region as region,
      r.make_name = p_focus_make as is_focus,
      (
        r.make_name = p_focus_make
        and r.vin is not null
        and exists (
          select 1
          from public.fleet_vins fv
          where fv.vin = upper(r.vin)
        )
      ) as is_fleet_focus
    from public.registrations r
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and r.sales_region is not null
      and (p_from is not null or p_to is not null
           or extract(year from r.transaction_time) = p_year)
      and (p_from is null or r.transaction_time >= p_from)
      and (p_to is null or r.transaction_time < (p_to + 1))
      and (p_segment is null or r.usage_name = p_segment)
      and (p_make is null or r.make_name = p_make)
      and (p_month is null or extract(month from r.transaction_time) = p_month)
      and (p_region is null or r.sales_region = p_region)
      and (p_hp is null or r.hp_bucket = p_hp)
      and (p_fuel is null or r.fuel_name = p_fuel)
      and (p_pabygg is null or r.pabygg_segment = p_pabygg)
      and (p_disp is null or r.disp_bucket = p_disp)
      and (p_chassis is null or r.trekker_jevnlast = p_chassis)
  )
  select
    region,
    count(*) filter (
      where case
        when coalesce(p_fleet_filter, 'all') = 'fleet' then is_fleet_focus
        when p_fleet_filter = 'region' then not is_fleet_focus
        else true
      end
    )::int,
    count(*) filter (
      where is_focus
        and case
          when coalesce(p_fleet_filter, 'all') = 'fleet' then is_fleet_focus
          when p_fleet_filter = 'region' then not is_fleet_focus
          else true
        end
    )::int
  from filtered
  group by region
  order by region;
$$;

create or replace function public.reg_summary_by_district(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_from date default null,
  p_to date default null,
  p_fleet_filter text default 'all',
  p_focus_make text default 'Volvo'
)
returns table(district text, region smallint, count int, focus_count int)
language sql stable security invoker
as $$
  with filtered as (
    select
      public.ofv_district_from_postal(r.primary_user_postal_code) as district,
      r.sales_region as region,
      r.make_name = p_focus_make as is_focus,
      (
        r.make_name = p_focus_make
        and r.vin is not null
        and exists (
          select 1
          from public.fleet_vins fv
          where fv.vin = upper(r.vin)
        )
      ) as is_fleet_focus
    from public.registrations r
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and public.ofv_district_from_postal(r.primary_user_postal_code) is not null
      and (p_from is not null or p_to is not null
           or extract(year from r.transaction_time) = p_year)
      and (p_from is null or r.transaction_time >= p_from)
      and (p_to is null or r.transaction_time < (p_to + 1))
      and (p_segment is null or r.usage_name = p_segment)
      and (p_make is null or r.make_name = p_make)
      and (p_month is null or extract(month from r.transaction_time) = p_month)
      and (p_region is null or r.sales_region = p_region)
      and (p_hp is null or r.hp_bucket = p_hp)
      and (p_fuel is null or r.fuel_name = p_fuel)
      and (p_pabygg is null or r.pabygg_segment = p_pabygg)
      and (p_disp is null or r.disp_bucket = p_disp)
      and (p_chassis is null or r.trekker_jevnlast = p_chassis)
  )
  select
    district,
    region,
    count(*) filter (
      where case
        when coalesce(p_fleet_filter, 'all') = 'fleet' then is_fleet_focus
        when p_fleet_filter = 'region' then not is_fleet_focus
        else true
      end
    )::int,
    count(*) filter (
      where is_focus
        and case
          when coalesce(p_fleet_filter, 'all') = 'fleet' then is_fleet_focus
          when p_fleet_filter = 'region' then not is_fleet_focus
          else true
        end
    )::int
  from filtered
  group by district, region
  order by count(*) desc;
$$;

grant execute on function public.reg_summary_by_region(int, text, text, int, int, int, text, text, int, text, date, date, text, text) to authenticated;
grant execute on function public.reg_summary_by_district(int, text, text, int, int, int, text, text, int, text, date, date, text, text) to authenticated;
