-- Fleet-treff på chassisnummer.
--
-- Bygger på funksjonene fra #27/#29 (nyreg_filter_scope). Kun Region tar
-- fortsatt ut bare Volvo Fleet: not is_fleet_focus. Kun Fleet er bare
-- is_fleet_focus. Oppslaget er utvidet fra «VIN i fleet_vins» til
-- «VIN i fleet_vins eller chassisnøkkel».
--
-- Nøkkel: tegn 11 i VIN (1-basert) pluss de siste 6 sifrene.
-- Chassis AA-123456 og AA123456 blir A123456. Z-000003 blir Z000003.
-- BB blir B. Eksisterende VIN-rader i fleet_vins virker som før.
-- En ny opplasting erstatter både VIN-er og chassisnummer.
-- Biler som ikke er registrert ennå treffer av seg selv når VIN-en
-- kommer inn, fordi nøkkelen ligger på registrations.
--
-- Lagret kolonne + delvis indeks, så filteret slår opp fleet_chassis
-- på primærnøkkelen. population har ikke dette filteret.

create or replace function public.fleet_match_key_from_vin(p_vin text)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select case
    when normalized is null or char_length(normalized) < 17 then null
    when right(normalized, 6) !~ '^[0-9]{6}$' then null
    when substring(normalized from 11 for 1) !~ '^[A-Z0-9]$' then null
    else substring(normalized from 11 for 1) || right(normalized, 6)
  end
  from (
    select nullif(
      upper(regexp_replace(btrim(coalesce(p_vin, '')), '\s', '', 'g')),
      ''
    ) as normalized
  ) s
$$;

comment on function public.fleet_match_key_from_vin(text) is
  'VIN-tegn 11 pluss siste 6 siffer. Samme nøkkel som fleet_chassis_parts.';

create or replace function public.fleet_chassis_parts(p_chassis text)
returns table (match_key text, chassis_label text)
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select
    right(m[1], 1) || m[2],
    m[1] || '-' || m[2]
  from regexp_match(
    upper(regexp_replace(btrim(coalesce(p_chassis, '')), '[^A-Za-z0-9]', '', 'g')),
    '^([A-Z]+)([0-9]{6})$'
  ) as m
  where m is not null
$$;

comment on function public.fleet_chassis_parts(text) is
  'AA-123456 og AA123456 blir nøkkel A123456 og etikett AA-123456. Z blir Z. BB blir B.';

alter table public.registrations
  add column fleet_match_key text
  generated always as (public.fleet_match_key_from_vin(vin)) stored;

comment on column public.registrations.fleet_match_key is
  'Tegn 11 i VIN pluss de siste 6 sifrene. Lik match_key i fleet_chassis.';

create index registrations_fleet_match_key_idx
  on public.registrations (fleet_match_key)
  where fleet_match_key is not null;

create table public.fleet_chassis (
  match_key text primary key
    check (match_key ~ '^[A-Z0-9][0-9]{6}$'),
  chassis_label text not null
    check (chassis_label ~ '^[A-Z]+-[0-9]{6}$'),
  created_at timestamptz not null default now()
);

comment on table public.fleet_chassis is
  'Volvo Fleet-chassis fra opplastet liste. match_key treffer registrations.fleet_match_key.';

alter table public.fleet_chassis enable row level security;

create policy "Authenticated read fleet chassis"
  on public.fleet_chassis
  for select
  to authenticated
  using (true);

revoke insert, update, delete on public.fleet_chassis from anon, authenticated;

alter table public.fleet_vin_uploads
  add column chassis_count int not null default 0 check (chassis_count >= 0),
  add column matched_count int not null default 0 check (matched_count >= 0),
  add column unregistered_count int not null default 0 check (unregistered_count >= 0);

create or replace function public.replace_fleet_register(
  p_vins text[] default null,
  p_chassis text[] default null,
  p_source_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vin_count int;
  v_chassis_count int;
  v_matched int;
begin
  if not public.jwt_can_manage_fleet_vins() then
    raise exception 'Ingen tilgang til å oppdatere fleet-registeret';
  end if;

  delete from public.fleet_vins;
  delete from public.fleet_chassis;

  insert into public.fleet_vins (vin)
  select distinct upper(trim(v))
  from unnest(coalesce(p_vins, array[]::text[])) as v
  where char_length(trim(v)) between 11 and 17;

  get diagnostics v_vin_count = row_count;

  insert into public.fleet_chassis (match_key, chassis_label)
  select distinct on (parts.match_key)
    parts.match_key,
    parts.chassis_label
  from unnest(coalesce(p_chassis, array[]::text[])) as raw(chassis)
  cross join lateral public.fleet_chassis_parts(raw.chassis) as parts
  order by parts.match_key;

  get diagnostics v_chassis_count = row_count;

  if v_vin_count = 0 and v_chassis_count = 0 then
    raise exception 'Ingen gyldige VIN-er eller chassisnummer';
  end if;

  select count(*)::int into v_matched
  from public.fleet_chassis fc
  where exists (
    select 1
    from public.registrations r
    where r.fleet_match_key = fc.match_key
  );

  insert into public.fleet_vin_uploads (
    uploaded_by,
    vin_count,
    source_label,
    chassis_count,
    matched_count,
    unregistered_count
  )
  values (
    auth.uid(),
    v_vin_count,
    nullif(trim(p_source_label), ''),
    v_chassis_count,
    v_matched,
    greatest(v_chassis_count - v_matched, 0)
  );

  return jsonb_build_object(
    'vin_count', v_vin_count,
    'chassis_count', v_chassis_count,
    'matched_count', v_matched,
    'unregistered_count', greatest(v_chassis_count - v_matched, 0)
  );
end;
$$;

comment on function public.replace_fleet_register(text[], text[], text) is
  'Erstatter fleet-listen. Kun super, via jwt_can_manage_fleet_vins().';

revoke all on function public.replace_fleet_register(text[], text[], text) from public, anon;
grant execute on function public.replace_fleet_register(text[], text[], text) to authenticated;

drop function if exists public.get_fleet_vin_registry_info();

create function public.get_fleet_vin_registry_info()
returns table (
  vin_count int,
  chassis_count int,
  matched_count int,
  unregistered_count int,
  last_uploaded_at timestamptz,
  last_source_label text
)
language sql
stable
security invoker
set search_path = public
as $$
  with counts as (
    select
      (select count(*)::int from public.fleet_vins) as vin_count,
      (select count(*)::int from public.fleet_chassis) as chassis_count,
      (
        select count(*)::int
        from public.fleet_chassis fc
        where exists (
          select 1
          from public.registrations r
          where r.fleet_match_key = fc.match_key
        )
      ) as matched_count
  )
  select
    c.vin_count,
    c.chassis_count,
    c.matched_count,
    greatest(c.chassis_count - c.matched_count, 0),
    (
      select u.created_at
      from public.fleet_vin_uploads u
      order by u.created_at desc
      limit 1
    ),
    (
      select u.source_label
      from public.fleet_vin_uploads u
      order by u.created_at desc
      limit 1
    )
  from counts c;
$$;

revoke all on function public.get_fleet_vin_registry_info() from public, anon;
grant execute on function public.get_fleet_vin_registry_info() to authenticated;

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
  p_bodywork int default null,
  p_from date default null,
  p_to date default null,
  p_fleet_filter text default 'all',
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(region smallint, count int, volvo_count int, market_count int)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select
      r.sales_region as region,
      r.make_name = p_focus_make as is_focus,
      coalesce(
        r.make_name = p_focus_make
        and r.vin is not null
        and (
          exists (
            select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
          )
          or exists (
            select 1 from public.fleet_chassis fc
            where fc.match_key = r.fleet_match_key
          )
        ),
        false
      ) as is_fleet_focus
    from public.registrations r
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and r.sales_region is not null
      and (p_from is not null or p_to is not null
           or extract(year from r.transaction_time at time zone 'Europe/Oslo') = p_year)
      and (p_from is null or r.transaction_time >= (p_from::timestamp at time zone 'Europe/Oslo'))
      and (p_to is null or r.transaction_time < ((p_to + 1)::timestamp at time zone 'Europe/Oslo'))
      and (p_segment is null or r.usage_name = p_segment)
      and (p_make is null or r.make_name = p_make)
      and (p_month is null or extract(month from r.transaction_time at time zone 'Europe/Oslo') = p_month)
      and (p_region is null or r.sales_region = p_region)
      and (p_hp is null or r.hp_bucket = p_hp)
      and (p_fuel is null or r.fuel_name = p_fuel)
      and (p_pabygg is null or r.pabygg_segment = p_pabygg)
      and public.ofv_disp_matches(r.disp_bucket, p_disp)
      and (p_chassis is null or r.trekker_jevnlast = p_chassis)
      and (
        p_bodywork is null
        or (p_bodywork = -1 and r.bodywork_code is null)
        or r.bodywork_code = p_bodywork
      )
      and (
        p_q is null
        or r.primary_owner_name ilike '%' || p_q || '%'
        or r.primary_user_name ilike '%' || p_q || '%'
        or (p_q ~ '^[0-9]{3,}$' and (
          r.primary_owner_orgnr like p_q || '%'
          or r.primary_user_orgnr like p_q || '%'
        ))
      )
  ),
  tagged as (
    select
      *,
      case coalesce(p_fleet_filter, 'all')
        when 'fleet' then is_fleet_focus
        when 'region' then not is_fleet_focus
        else true
      end as included
    from base
  )
  select
    region,
    count(*) filter (where included)::int,
    count(*) filter (where included and is_focus)::int,
    count(*)::int
  from tagged
  group by region
  having count(*) filter (where included) > 0
  order by count(*) filter (where included) desc, region;
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
  p_bodywork int default null,
  p_from date default null,
  p_to date default null,
  p_fleet_filter text default 'all',
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(
  district text,
  region smallint,
  count int,
  focus_count int,
  market_count int
)
language sql
stable
security invoker
set search_path = public
as $$
  with located as (
    select
      public.ofv_district_from_postal(r.primary_user_postal_code) as district,
      r.sales_region as region,
      r.make_name = p_focus_make as is_focus,
      coalesce(
        r.make_name = p_focus_make
        and r.vin is not null
        and (
          exists (
            select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
          )
          or exists (
            select 1 from public.fleet_chassis fc
            where fc.match_key = r.fleet_match_key
          )
        ),
        false
      ) as is_fleet_focus
    from public.registrations r
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and (p_from is not null or p_to is not null
           or extract(year from r.transaction_time at time zone 'Europe/Oslo') = p_year)
      and (p_from is null or r.transaction_time >= (p_from::timestamp at time zone 'Europe/Oslo'))
      and (p_to is null or r.transaction_time < ((p_to + 1)::timestamp at time zone 'Europe/Oslo'))
      and (p_segment is null or r.usage_name = p_segment)
      and (p_make is null or r.make_name = p_make)
      and (p_month is null or extract(month from r.transaction_time at time zone 'Europe/Oslo') = p_month)
      and (p_region is null or r.sales_region = p_region)
      and (p_hp is null or r.hp_bucket = p_hp)
      and (p_fuel is null or r.fuel_name = p_fuel)
      and (p_pabygg is null or r.pabygg_segment = p_pabygg)
      and public.ofv_disp_matches(r.disp_bucket, p_disp)
      and (p_chassis is null or r.trekker_jevnlast = p_chassis)
      and (
        p_bodywork is null
        or (p_bodywork = -1 and r.bodywork_code is null)
        or r.bodywork_code = p_bodywork
      )
      and (
        p_q is null
        or r.primary_owner_name ilike '%' || p_q || '%'
        or r.primary_user_name ilike '%' || p_q || '%'
        or (p_q ~ '^[0-9]{3,}$' and (
          r.primary_owner_orgnr like p_q || '%'
          or r.primary_user_orgnr like p_q || '%'
        ))
      )
  ),
  base as (
    select * from located where district is not null
  ),
  tagged as (
    select
      *,
      case coalesce(p_fleet_filter, 'all')
        when 'fleet' then is_fleet_focus
        when 'region' then not is_fleet_focus
        else true
      end as included
    from base
  )
  select
    district,
    region,
    count(*) filter (where included)::int,
    count(*) filter (where included and is_focus)::int,
    count(*)::int
  from tagged
  group by district, region
  having count(*) filter (where included) > 0
  order by count(*) filter (where included) desc, district;
$$;
create or replace function public.reg_region_scope_summary(
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
  p_bodywork int default null,
  p_from date default null,
  p_to date default null,
  p_fleet_filter text default 'all',
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(
  total int,
  focus_count int,
  electric_count int,
  market_total int
)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select
      r.make_name = p_focus_make as is_focus,
      coalesce(r.fuel_name ilike '%elektr%', false) as is_electric,
      coalesce(
        r.make_name = p_focus_make
        and r.vin is not null
        and (
          exists (
            select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
          )
          or exists (
            select 1 from public.fleet_chassis fc
            where fc.match_key = r.fleet_match_key
          )
        ),
        false
      ) as is_fleet_focus
    from public.registrations r
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and (p_from is not null or p_to is not null
           or extract(year from r.transaction_time at time zone 'Europe/Oslo') = p_year)
      and (p_from is null or r.transaction_time >= (p_from::timestamp at time zone 'Europe/Oslo'))
      and (p_to is null or r.transaction_time < ((p_to + 1)::timestamp at time zone 'Europe/Oslo'))
      and (p_segment is null or r.usage_name = p_segment)
      and (p_make is null or r.make_name = p_make)
      and (p_month is null or extract(month from r.transaction_time at time zone 'Europe/Oslo') = p_month)
      and (p_region is null or r.sales_region = p_region)
      and (p_hp is null or r.hp_bucket = p_hp)
      and (p_fuel is null or r.fuel_name = p_fuel)
      and (p_pabygg is null or r.pabygg_segment = p_pabygg)
      and public.ofv_disp_matches(r.disp_bucket, p_disp)
      and (p_chassis is null or r.trekker_jevnlast = p_chassis)
      and (
        p_bodywork is null
        or (p_bodywork = -1 and r.bodywork_code is null)
        or r.bodywork_code = p_bodywork
      )
      and (
        p_q is null
        or r.primary_owner_name ilike '%' || p_q || '%'
        or r.primary_user_name ilike '%' || p_q || '%'
        or (p_q ~ '^[0-9]{3,}$' and (
          r.primary_owner_orgnr like p_q || '%'
          or r.primary_user_orgnr like p_q || '%'
        ))
      )
  ),
  tagged as (
    select
      *,
      case coalesce(p_fleet_filter, 'all')
        when 'fleet' then is_fleet_focus
        when 'region' then not is_fleet_focus
        else true
      end as included
    from base
  )
  select
    count(*) filter (where included)::int,
    count(*) filter (where included and is_focus)::int,
    count(*) filter (where included and is_electric)::int,
    count(*)::int
  from tagged;
$$;
create or replace function public.reg_region_summary_by_month(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_bodywork int default null,
  p_from date default null,
  p_to date default null,
  p_fleet_filter text default 'all',
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(month date, count int, volvo_count int, market_count int)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select
      date_trunc('month', r.transaction_time at time zone 'Europe/Oslo')::date as month,
      r.make_name = p_focus_make as is_focus,
      coalesce(
        r.make_name = p_focus_make
        and r.vin is not null
        and (
          exists (
            select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
          )
          or exists (
            select 1 from public.fleet_chassis fc
            where fc.match_key = r.fleet_match_key
          )
        ),
        false
      ) as is_fleet_focus
    from public.registrations r
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and (p_from is not null or p_to is not null
           or extract(year from r.transaction_time at time zone 'Europe/Oslo') = p_year)
      and (p_from is null or r.transaction_time >= (p_from::timestamp at time zone 'Europe/Oslo'))
      and (p_to is null or r.transaction_time < ((p_to + 1)::timestamp at time zone 'Europe/Oslo'))
      and (p_segment is null or r.usage_name = p_segment)
      and (p_make is null or r.make_name = p_make)
      and (p_region is null or r.sales_region = p_region)
      and (p_hp is null or r.hp_bucket = p_hp)
      and (p_fuel is null or r.fuel_name = p_fuel)
      and (p_pabygg is null or r.pabygg_segment = p_pabygg)
      and public.ofv_disp_matches(r.disp_bucket, p_disp)
      and (p_chassis is null or r.trekker_jevnlast = p_chassis)
      and (
        p_bodywork is null
        or (p_bodywork = -1 and r.bodywork_code is null)
        or r.bodywork_code = p_bodywork
      )
      and (
        p_q is null
        or r.primary_owner_name ilike '%' || p_q || '%'
        or r.primary_user_name ilike '%' || p_q || '%'
        or (p_q ~ '^[0-9]{3,}$' and (
          r.primary_owner_orgnr like p_q || '%'
          or r.primary_user_orgnr like p_q || '%'
        ))
      )
  ),
  tagged as (
    select
      *,
      case coalesce(p_fleet_filter, 'all')
        when 'fleet' then is_fleet_focus
        when 'region' then not is_fleet_focus
        else true
      end as included
    from base
  )
  select
    month,
    count(*) filter (where included)::int,
    count(*) filter (where included and is_focus)::int,
    count(*)::int
  from tagged
  group by month
  having count(*) filter (where included) > 0
  order by month;
$$;
create or replace function public.reg_region_summary_by_make(
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
  p_bodywork int default null,
  p_from date default null,
  p_to date default null,
  p_fleet_filter text default 'all',
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(make_name text, count int)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select
      r.make_name,
      coalesce(
        r.make_name = p_focus_make
        and r.vin is not null
        and (
          exists (
            select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
          )
          or exists (
            select 1 from public.fleet_chassis fc
            where fc.match_key = r.fleet_match_key
          )
        ),
        false
      ) as is_fleet_focus
    from public.registrations r
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and r.make_name is not null
      and (p_from is not null or p_to is not null
           or extract(year from r.transaction_time at time zone 'Europe/Oslo') = p_year)
      and (p_from is null or r.transaction_time >= (p_from::timestamp at time zone 'Europe/Oslo'))
      and (p_to is null or r.transaction_time < ((p_to + 1)::timestamp at time zone 'Europe/Oslo'))
      and (p_segment is null or r.usage_name = p_segment)
      and (p_make is null or r.make_name = p_make)
      and (p_month is null or extract(month from r.transaction_time at time zone 'Europe/Oslo') = p_month)
      and (p_region is null or r.sales_region = p_region)
      and (p_hp is null or r.hp_bucket = p_hp)
      and (p_fuel is null or r.fuel_name = p_fuel)
      and (p_pabygg is null or r.pabygg_segment = p_pabygg)
      and public.ofv_disp_matches(r.disp_bucket, p_disp)
      and (p_chassis is null or r.trekker_jevnlast = p_chassis)
      and (
        p_bodywork is null
        or (p_bodywork = -1 and r.bodywork_code is null)
        or r.bodywork_code = p_bodywork
      )
      and (
        p_q is null
        or r.primary_owner_name ilike '%' || p_q || '%'
        or r.primary_user_name ilike '%' || p_q || '%'
        or (p_q ~ '^[0-9]{3,}$' and (
          r.primary_owner_orgnr like p_q || '%'
          or r.primary_user_orgnr like p_q || '%'
        ))
      )
  ),
  tagged as (
    select
      *,
      case coalesce(p_fleet_filter, 'all')
        when 'fleet' then is_fleet_focus
        when 'region' then not is_fleet_focus
        else true
      end as included
    from base
  )
  select make_name, count(*)::int
  from tagged
  where included
  group by make_name
  order by count(*) desc;
$$;
create or replace function public.reg_region_top_buyers(
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
  p_bodywork int default null,
  p_from date default null,
  p_to date default null,
  p_limit int default 15,
  p_customer_party text default 'user',
  p_focus_make text default 'Volvo',
  p_fleet_filter text default 'all',
  p_q text default null
)
returns table(owner_name text, count int, focus_count int, market_count int)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select
      case
        when coalesce(p_customer_party, 'user') = 'owner' then
          coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name)
        else
          coalesce(nullif(r.primary_user_orgnr, ''), r.primary_user_name)
      end as party_key,
      case
        when coalesce(p_customer_party, 'user') = 'owner' then r.primary_owner_name
        else r.primary_user_name
      end as party_name,
      r.make_name = p_focus_make as is_focus,
      coalesce(
        r.make_name = p_focus_make
        and r.vin is not null
        and (
          exists (
            select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
          )
          or exists (
            select 1 from public.fleet_chassis fc
            where fc.match_key = r.fleet_match_key
          )
        ),
        false
      ) as is_fleet_focus
    from public.registrations r
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and (
        case
          when coalesce(p_customer_party, 'user') = 'owner' then r.primary_owner_name
          else r.primary_user_name
        end
      ) is not null
      and (p_from is not null or p_to is not null
           or extract(year from r.transaction_time at time zone 'Europe/Oslo') = p_year)
      and (p_from is null or r.transaction_time >= (p_from::timestamp at time zone 'Europe/Oslo'))
      and (p_to is null or r.transaction_time < ((p_to + 1)::timestamp at time zone 'Europe/Oslo'))
      and (p_segment is null or r.usage_name = p_segment)
      and (p_make is null or r.make_name = p_make)
      and (p_region is null or r.sales_region = p_region)
      and (p_hp is null or r.hp_bucket = p_hp)
      and (p_fuel is null or r.fuel_name = p_fuel)
      and (p_pabygg is null or r.pabygg_segment = p_pabygg)
      and public.ofv_disp_matches(r.disp_bucket, p_disp)
      and (p_chassis is null or r.trekker_jevnlast = p_chassis)
      and (p_month is null or extract(month from r.transaction_time at time zone 'Europe/Oslo') = p_month)
      and (
        p_bodywork is null
        or (p_bodywork = -1 and r.bodywork_code is null)
        or r.bodywork_code = p_bodywork
      )
    and (
      p_q is null
      or r.primary_owner_name ilike '%' || p_q || '%'
      or r.primary_user_name ilike '%' || p_q || '%'
      or (p_q ~ '^[0-9]{3,}$' and (
        r.primary_owner_orgnr like p_q || '%'
        or r.primary_user_orgnr like p_q || '%'
      ))
    )
  ),
  tagged as (
    select
      *,
      case coalesce(p_fleet_filter, 'all')
        when 'fleet' then is_fleet_focus
        when 'region' then not is_fleet_focus
        else true
      end as included
    from base
  )
  select
    max(party_name) as owner_name,
    count(*) filter (where included)::int,
    count(*) filter (where included and is_focus)::int,
    count(*)::int
  from tagged
  group by party_key
  having count(*) filter (where included) > 0
  order by count(*) filter (where included) desc, max(party_name)
  limit greatest(p_limit, 1);
$$;
create or replace function public.reg_region_buyer_loyalty(
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
  p_bodywork int default null,
  p_from date default null,
  p_to date default null,
  p_customer_party text default 'user',
  p_focus_make text default 'Volvo',
  p_fleet_filter text default 'all',
  p_q text default null
)
returns table(
  buyer_type text,
  owner_count int,
  purchase_count int,
  focus_count int,
  market_purchase_count int
)
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select
      case
        when p_month is not null then greatest(
          coalesce(p_from, make_date(p_year, 1, 1)),
          make_date(p_year, p_month, 1)
        )
        else coalesce(p_from, make_date(p_year, 1, 1))
      end::timestamp at time zone 'Europe/Oslo' as period_start,
      case
        when p_month is not null then least(
          coalesce(p_to + 1, make_date(p_year + 1, 1, 1)),
          (make_date(p_year, p_month, 1) + interval '1 month')::date
        )
        else coalesce(p_to + 1, make_date(p_year + 1, 1, 1))
      end::timestamp at time zone 'Europe/Oslo' as period_end_exclusive
  ),
  period_regs as (
    select
      case
        when coalesce(p_customer_party, 'user') = 'owner' then
          coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name)
        else
          coalesce(nullif(r.primary_user_orgnr, ''), r.primary_user_name)
      end as party_key,
      r.make_name,
      coalesce(
        r.make_name = p_focus_make
        and r.vin is not null
        and (
          exists (
            select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
          )
          or exists (
            select 1 from public.fleet_chassis fc
            where fc.match_key = r.fleet_match_key
          )
        ),
        false
      ) as is_fleet_focus
    from public.registrations r
    cross join bounds b
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and (
        case
          when coalesce(p_customer_party, 'user') = 'owner' then r.primary_owner_name
          else r.primary_user_name
        end
      ) is not null
      and r.transaction_time >= b.period_start
      and r.transaction_time < b.period_end_exclusive
      and (p_segment is null or r.usage_name = p_segment)
      and (p_make is null or r.make_name = p_make)
      and (p_region is null or r.sales_region = p_region)
      and (p_hp is null or r.hp_bucket = p_hp)
      and (p_fuel is null or r.fuel_name = p_fuel)
      and (p_pabygg is null or r.pabygg_segment = p_pabygg)
      and public.ofv_disp_matches(r.disp_bucket, p_disp)
      and (p_chassis is null or r.trekker_jevnlast = p_chassis)
      and (
        p_bodywork is null
        or (p_bodywork = -1 and r.bodywork_code is null)
        or r.bodywork_code = p_bodywork
      )
    and (
      p_q is null
      or r.primary_owner_name ilike '%' || p_q || '%'
      or r.primary_user_name ilike '%' || p_q || '%'
      or (p_q ~ '^[0-9]{3,}$' and (
        r.primary_owner_orgnr like p_q || '%'
        or r.primary_user_orgnr like p_q || '%'
      ))
    )
  ),
  tagged as (
    select
      *,
      case coalesce(p_fleet_filter, 'all')
        when 'fleet' then is_fleet_focus
        when 'region' then not is_fleet_focus
        else true
      end as included
    from period_regs
  ),
  prior_parties as (
    select
      case
        when coalesce(p_customer_party, 'user') = 'owner' then
          coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name)
        else
          coalesce(nullif(r.primary_user_orgnr, ''), r.primary_user_name)
      end as party_key,
      bool_or(r.make_name = p_focus_make) as had_focus
    from public.registrations r
    cross join bounds b
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and (
        case
          when coalesce(p_customer_party, 'user') = 'owner' then
            coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name)
          else
            coalesce(nullif(r.primary_user_orgnr, ''), r.primary_user_name)
        end
      ) is not null
      and r.transaction_time < b.period_start
      and (p_region is null or r.sales_region = p_region)
    group by 1
  ),
  party_period as (
    select
      p.party_key,
      count(*) filter (where p.included)::int as purchase_count,
      count(*) filter (
        where p.included and p.make_name = p_focus_make
      )::int as focus_count,
      count(*)::int as market_purchase_count,
      bool_or(p.included and p.make_name = p_focus_make) as bought_focus,
      coalesce(pr.had_focus, false) as had_focus,
      (pr.party_key is not null) as had_any_prior
    from tagged p
    left join prior_parties pr on pr.party_key = p.party_key
    group by p.party_key, pr.had_focus, pr.party_key
    having count(*) filter (where p.included) > 0
  ),
  classified as (
    select
      party_key,
      purchase_count,
      focus_count,
      market_purchase_count,
      case when had_any_prior then 'repeat' else 'new' end as loyalty_type,
      case
        when bought_focus and not had_focus then 'conquest'
        else null
      end as conquest_type
    from party_period
  ),
  loyalty as (
    select
      loyalty_type as buyer_type,
      count(*)::int as owner_count,
      sum(purchase_count)::int as purchase_count,
      sum(focus_count)::int as focus_count,
      sum(market_purchase_count)::int as market_purchase_count
    from classified
    group by loyalty_type
  ),
  conquest as (
    select
      'conquest'::text as buyer_type,
      count(*)::int as owner_count,
      coalesce(sum(purchase_count), 0)::int as purchase_count,
      coalesce(sum(focus_count), 0)::int as focus_count,
      coalesce(sum(market_purchase_count), 0)::int as market_purchase_count
    from classified
    where conquest_type = 'conquest'
  )
  select
    buyer_type,
    owner_count,
    purchase_count,
    focus_count,
    market_purchase_count
  from loyalty
  union all
  select
    buyer_type,
    owner_count,
    purchase_count,
    focus_count,
    market_purchase_count
  from conquest
  order by buyer_type;
$$;
create or replace function public.reg_region_buyer_loyalty_owners(
  p_year int,
  p_buyer_type text,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_bodywork int default null,
  p_from date default null,
  p_to date default null,
  p_limit int default 100,
  p_customer_party text default 'user',
  p_focus_make text default 'Volvo',
  p_fleet_filter text default 'all',
  p_q text default null
)
returns table(owner_name text, count int, focus_count int, market_count int)
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select
      case
        when p_month is not null then greatest(
          coalesce(p_from, make_date(p_year, 1, 1)),
          make_date(p_year, p_month, 1)
        )
        else coalesce(p_from, make_date(p_year, 1, 1))
      end::timestamp at time zone 'Europe/Oslo' as period_start,
      case
        when p_month is not null then least(
          coalesce(p_to + 1, make_date(p_year + 1, 1, 1)),
          (make_date(p_year, p_month, 1) + interval '1 month')::date
        )
        else coalesce(p_to + 1, make_date(p_year + 1, 1, 1))
      end::timestamp at time zone 'Europe/Oslo' as period_end_exclusive
  ),
  period_regs as (
    select
      case
        when coalesce(p_customer_party, 'user') = 'owner' then
          coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name)
        else
          coalesce(nullif(r.primary_user_orgnr, ''), r.primary_user_name)
      end as party_key,
      case
        when coalesce(p_customer_party, 'user') = 'owner' then r.primary_owner_name
        else r.primary_user_name
      end as party_name,
      r.make_name,
      coalesce(
        r.make_name = p_focus_make
        and r.vin is not null
        and (
          exists (
            select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
          )
          or exists (
            select 1 from public.fleet_chassis fc
            where fc.match_key = r.fleet_match_key
          )
        ),
        false
      ) as is_fleet_focus
    from public.registrations r
    cross join bounds b
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and (
        case
          when coalesce(p_customer_party, 'user') = 'owner' then r.primary_owner_name
          else r.primary_user_name
        end
      ) is not null
      and r.transaction_time >= b.period_start
      and r.transaction_time < b.period_end_exclusive
      and (p_segment is null or r.usage_name = p_segment)
      and (p_make is null or r.make_name = p_make)
      and (p_region is null or r.sales_region = p_region)
      and (p_hp is null or r.hp_bucket = p_hp)
      and (p_fuel is null or r.fuel_name = p_fuel)
      and (p_pabygg is null or r.pabygg_segment = p_pabygg)
      and public.ofv_disp_matches(r.disp_bucket, p_disp)
      and (p_chassis is null or r.trekker_jevnlast = p_chassis)
      and (
        p_bodywork is null
        or (p_bodywork = -1 and r.bodywork_code is null)
        or r.bodywork_code = p_bodywork
      )
    and (
      p_q is null
      or r.primary_owner_name ilike '%' || p_q || '%'
      or r.primary_user_name ilike '%' || p_q || '%'
      or (p_q ~ '^[0-9]{3,}$' and (
        r.primary_owner_orgnr like p_q || '%'
        or r.primary_user_orgnr like p_q || '%'
      ))
    )
  ),
  tagged as (
    select
      *,
      case coalesce(p_fleet_filter, 'all')
        when 'fleet' then is_fleet_focus
        when 'region' then not is_fleet_focus
        else true
      end as included
    from period_regs
  ),
  prior_parties as (
    select
      case
        when coalesce(p_customer_party, 'user') = 'owner' then
          coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name)
        else
          coalesce(nullif(r.primary_user_orgnr, ''), r.primary_user_name)
      end as party_key,
      bool_or(r.make_name = p_focus_make) as had_focus
    from public.registrations r
    cross join bounds b
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and (
        case
          when coalesce(p_customer_party, 'user') = 'owner' then
            coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name)
          else
            coalesce(nullif(r.primary_user_orgnr, ''), r.primary_user_name)
        end
      ) is not null
      and r.transaction_time < b.period_start
      and (p_region is null or r.sales_region = p_region)
    group by 1
  ),
  party_totals as (
    select
      p.party_key,
      max(p.party_name) as owner_name,
      count(*) filter (where p.included)::int as purchase_count,
      count(*) filter (
        where p.included and p.make_name = p_focus_make
      )::int as focus_count,
      count(*)::int as market_count,
      bool_or(p.included and p.make_name = p_focus_make) as bought_focus,
      coalesce(pr.had_focus, false) as had_focus,
      (pr.party_key is not null) as had_any_prior
    from tagged p
    left join prior_parties pr on pr.party_key = p.party_key
    group by p.party_key, pr.had_focus, pr.party_key
    having count(*) filter (where p.included) > 0
  )
  select owner_name, purchase_count, focus_count, market_count
  from party_totals
  where case p_buyer_type
    when 'repeat' then had_any_prior
    when 'new' then not had_any_prior
    when 'conquest' then bought_focus and not had_focus
    else false
  end
  order by purchase_count desc, owner_name
  limit greatest(p_limit, 1);
$$;
create or replace function public.reg_filtered_count(
  p_from date default null,
  p_to date default null,
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_bodywork int default null,
  p_disp int default null,
  p_chassis text default null,
  p_q text default null,
  p_fleet_filter text default 'all'
)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint
  from public.registrations r

  where r.transaction_type_id = '10'
    and r.maximum_laden_mass_kg >= 16000
    and (p_from is null or r.transaction_time >= (p_from::timestamp at time zone 'Europe/Oslo'))
    and (p_to is null or r.transaction_time < ((p_to + 1)::timestamp at time zone 'Europe/Oslo'))
    and (p_segment is null or r.usage_name = p_segment)
    and (p_make is null or r.make_name = p_make)
    and (p_region is null or r.sales_region = p_region)
    and (p_hp is null or r.hp_bucket = p_hp)
    and (p_fuel is null or r.fuel_name = p_fuel)
    and (p_pabygg is null or r.pabygg_segment = p_pabygg)
    and public.ofv_disp_matches(r.disp_bucket, p_disp)
    and (p_chassis is null or r.trekker_jevnlast = p_chassis)
    and (
      p_bodywork is null
      or (p_bodywork = -1 and r.bodywork_code is null)
      or r.bodywork_code = p_bodywork
    )
    and (
      p_q is null
      or r.primary_owner_name ilike '%' || p_q || '%'
      or r.primary_user_name ilike '%' || p_q || '%'
      or (p_q ~ '^[0-9]{3,}$' and (
        r.primary_owner_orgnr like p_q || '%'
        or r.primary_user_orgnr like p_q || '%'
      ))
    )
    and (
      coalesce(p_fleet_filter, 'all') not in ('fleet', 'region')
      or (
        p_fleet_filter = 'fleet'
        and (
          exists (
            select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
          )
          or exists (
            select 1 from public.fleet_chassis fc
            where fc.match_key = r.fleet_match_key
          )
        )
      )
      or (
        p_fleet_filter = 'region'
        and not (
          exists (
            select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
          )
          or exists (
            select 1 from public.fleet_chassis fc
            where fc.match_key = r.fleet_match_key
          )
        )
      )
    );
$$;
create or replace function public.reg_filtered_page(
  p_from date default null,
  p_to date default null,
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_bodywork int default null,
  p_disp int default null,
  p_chassis text default null,
  p_q text default null,
  p_fleet_filter text default 'all',
  p_limit int default 25,
  p_offset int default 0
)
returns table(
  registration_number text,
  transaction_time timestamptz,
  make_name text,
  model_name text,
  variant_name text,
  usage_name text,
  maximum_laden_mass_kg int,
  sales_region int,
  hp_bucket int,
  fuel_name text,
  pabygg_segment text,
  bodywork_code int,
  bodywork_name text,
  primary_owner_name text,
  primary_owner_postal_code text,
  primary_owner_postal_district text,
  primary_user_name text,
  primary_user_postal_code text,
  primary_user_postal_district text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    r.registration_number,
    r.transaction_time,
    r.make_name,
    r.model_name,
    r.variant_name,
    r.usage_name,
    r.maximum_laden_mass_kg,
    r.sales_region::int,
    r.hp_bucket::int,
    r.fuel_name,
    r.pabygg_segment,
    r.bodywork_code::int,
    r.bodywork_name,
    r.primary_owner_name,
    r.primary_owner_postal_code,
    r.primary_owner_postal_district,
    r.primary_user_name,
    r.primary_user_postal_code,
    r.primary_user_postal_district
  from public.registrations r

  where r.transaction_type_id = '10'
    and r.maximum_laden_mass_kg >= 16000
    and (p_from is null or r.transaction_time >= (p_from::timestamp at time zone 'Europe/Oslo'))
    and (p_to is null or r.transaction_time < ((p_to + 1)::timestamp at time zone 'Europe/Oslo'))
    and (p_segment is null or r.usage_name = p_segment)
    and (p_make is null or r.make_name = p_make)
    and (p_region is null or r.sales_region = p_region)
    and (p_hp is null or r.hp_bucket = p_hp)
    and (p_fuel is null or r.fuel_name = p_fuel)
    and (p_pabygg is null or r.pabygg_segment = p_pabygg)
    and public.ofv_disp_matches(r.disp_bucket, p_disp)
    and (p_chassis is null or r.trekker_jevnlast = p_chassis)
    and (
      p_bodywork is null
      or (p_bodywork = -1 and r.bodywork_code is null)
      or r.bodywork_code = p_bodywork
    )
    and (
      p_q is null
      or r.primary_owner_name ilike '%' || p_q || '%'
      or r.primary_user_name ilike '%' || p_q || '%'
      or (p_q ~ '^[0-9]{3,}$' and (
        r.primary_owner_orgnr like p_q || '%'
        or r.primary_user_orgnr like p_q || '%'
      ))
    )
    and (
      coalesce(p_fleet_filter, 'all') not in ('fleet', 'region')
      or (
        p_fleet_filter = 'fleet'
        and (
          exists (
            select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
          )
          or exists (
            select 1 from public.fleet_chassis fc
            where fc.match_key = r.fleet_match_key
          )
        )
      )
      or (
        p_fleet_filter = 'region'
        and not (
          exists (
            select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
          )
          or exists (
            select 1 from public.fleet_chassis fc
            where fc.match_key = r.fleet_match_key
          )
        )
      )
    )
  order by r.transaction_time desc, r.registration_number desc
  limit least(greatest(coalesce(p_limit, 25), 0), 1000)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

do $$
declare
  name text;
  known text[] := array[
    'reg_summary_by_region',
    'reg_summary_by_district',
    'reg_region_scope_summary',
    'reg_region_summary_by_month',
    'reg_region_summary_by_make',
    'reg_region_top_buyers',
    'reg_region_buyer_loyalty',
    'reg_region_buyer_loyalty_owners',
    'reg_filtered_count',
    'reg_filtered_page'
  ];
begin
  foreach name in array known loop
    if exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = name
        and pg_get_functiondef(p.oid) not like '%fleet_match_key%'
    ) then
      raise exception '% mangler chassisnøkkel', name;
    end if;
  end loop;

  if has_function_privilege(
    'anon',
    'public.replace_fleet_register(text[], text[], text)',
    'execute'
  ) or has_function_privilege(
    'public',
    'public.replace_fleet_register(text[], text[], text)',
    'execute'
  ) then
    raise exception 'replace_fleet_register er kjørbar for anon eller PUBLIC';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.replace_fleet_register(text[], text[], text)',
    'execute'
  ) then
    raise exception 'replace_fleet_register mangler EXECUTE for authenticated';
  end if;
end $$;

notify pgrst, 'reload schema';
