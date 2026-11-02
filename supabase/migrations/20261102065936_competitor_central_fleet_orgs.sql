-- Kun Region tar også ut konkurrentenes sentrale registreringer.
--
-- OFV har ingen forhandlerkode. Volvo Fleet kjennes igjen på fleet_vins
-- (dealer 896/890). Det treffet er urørt: fortsatt
--   make = fokusmerke og vin i fleet_vins (upper(r.vin)).
-- En parallell endring av chassis-treffet må beholde kallet
-- ofv_is_competitor_central_deal og vilkåret
--   when 'region' then not is_fleet_focus and not is_competitor_central
-- «Kun Fleet» er fortsatt bare Volvo-VIN-ene.
--
-- Konkurrentregel
--   Merke er ikke fokusmerket, og eier, bruker eller leasing har org.nr.
--   i central_fleet_orgs der active er true.
--   Det er importører og sentrale salgsselskap som står som part selv.
--   Ikke finansselskap (Volvo Finans er både fleet og region), ikke
--   regionale forhandlere (Nordren, Holtan, Trucknor) og ikke kundene
--   på en nasjonal avtale. De siste kan ikke skilles fra regionsalg.
--
-- Listen vedlikeholdes av super, ved siden av Fleet-VIN-registeret.
-- Migrasjonen er ikke kjørt mot prod.
--
-- reg_filtered_count/page har ikke p_focus_make og bruker 'Volvo', samme
-- default som region-RPC-ene.
--
-- security invoker på lesing og på region-RPC-ene, så RLS gjelder.
-- Skriv skjer i security definer som krever jwt_can_manage_fleet_vins()
-- (super). EXECUTE kun til authenticated. Ikke anon, ikke PUBLIC.

create table public.central_fleet_orgs (
  orgnr text primary key check (orgnr ~ '^[0-9]{9}$'),
  name text not null check (char_length(name) between 2 and 200),
  note text check (note is null or char_length(note) <= 500),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.central_fleet_orgs is
  'Sentrale importører og salgsselskap. Kun Region tar ut andre merker enn fokus når eier, bruker eller leasing matcher et aktivt org.nr.';

alter table public.central_fleet_orgs enable row level security;

create policy "Authenticated read central fleet orgs"
  on public.central_fleet_orgs for select to authenticated
  using (true);

revoke all on table public.central_fleet_orgs from public, anon, authenticated;
grant select on table public.central_fleet_orgs to authenticated;

create function public.ofv_is_competitor_central_deal(
  p_make text,
  p_focus_make text,
  p_owner_orgnr text,
  p_user_orgnr text,
  p_leasing_orgnr text
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    p_make is distinct from coalesce(p_focus_make, 'Volvo')
    and exists (
      select 1
      from public.central_fleet_orgs o
      where o.active
        and o.orgnr in (
          nullif(btrim(p_owner_orgnr), ''),
          nullif(btrim(p_user_orgnr), ''),
          nullif(btrim(p_leasing_orgnr), '')
        )
    );
$$;

comment on function public.ofv_is_competitor_central_deal(text, text, text, text, text) is
  'Konkurrentens sentrale registrering: annet merke enn fokus, og eier, bruker eller leasing er en aktiv rad i central_fleet_orgs.';

create function public.list_central_fleet_orgs()
returns table (
  orgnr text,
  name text,
  note text,
  active boolean,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select o.orgnr, o.name, o.note, o.active, o.updated_at
  from public.central_fleet_orgs o
  order by o.active desc, o.name;
$$;

create function public.upsert_central_fleet_org(
  p_orgnr text,
  p_name text,
  p_note text default null,
  p_active boolean default true
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orgnr text := regexp_replace(coalesce(p_orgnr, ''), '\s', '', 'g');
  v_name text := btrim(coalesce(p_name, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.jwt_can_manage_fleet_vins() then
    raise exception 'Ingen tilgang til å endre sentrale flåteorganisasjoner';
  end if;

  if v_orgnr !~ '^[0-9]{9}$' then
    raise exception 'Org.nr. må være 9 siffer';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 200 then
    raise exception 'Navn må være mellom 2 og 200 tegn';
  end if;

  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Merknaden er for lang';
  end if;

  insert into public.central_fleet_orgs (orgnr, name, note, active)
  values (v_orgnr, v_name, v_note, coalesce(p_active, true))
  on conflict (orgnr) do update
    set name = excluded.name,
        note = excluded.note,
        active = excluded.active,
        updated_at = now();

  return v_orgnr;
end;
$$;

create function public.delete_central_fleet_org(p_orgnr text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orgnr text := regexp_replace(coalesce(p_orgnr, ''), '\s', '', 'g');
  v_count int;
begin
  if not public.jwt_can_manage_fleet_vins() then
    raise exception 'Ingen tilgang til å endre sentrale flåteorganisasjoner';
  end if;

  if v_orgnr !~ '^[0-9]{9}$' then
    raise exception 'Org.nr. må være 9 siffer';
  end if;

  delete from public.central_fleet_orgs where orgnr = v_orgnr;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function public.ofv_is_competitor_central_deal(text, text, text, text, text) from public, anon;
grant execute on function public.ofv_is_competitor_central_deal(text, text, text, text, text) to authenticated;

revoke all on function public.list_central_fleet_orgs() from public, anon;
grant execute on function public.list_central_fleet_orgs() to authenticated;

revoke all on function public.upsert_central_fleet_org(text, text, text, boolean) from public, anon;
grant execute on function public.upsert_central_fleet_org(text, text, text, boolean) to authenticated;

revoke all on function public.delete_central_fleet_org(text) from public, anon;
grant execute on function public.delete_central_fleet_org(text) to authenticated;

insert into public.central_fleet_orgs (orgnr, name, note)
values
  (
    '879263662',
    'Norsk Scania AS',
    'Importør. Kun Region tar ut biler der selskapet selv er eier, bruker eller leasing. Regionale Scania-forhandlere som Nordren og Holtan er ikke med.'
  ),
  (
    '824387842',
    'MAN Truck & Bus Norge AS',
    'Importør. Samme org.nr. dekker hovedkontoret og avdelingene, så avdelingslager følger med.'
  ),
  (
    '926342347',
    'Bertel O. Steen Trucks & Buses AS',
    'Mercedes-importør. Samme org.nr. dekker Lørenskog og avdelingene.'
  ),
  (
    '826342552',
    'Bertel O. Steen Lastebil og Buss AS',
    'Eldre Mercedes-selskap, samme rolle som Trucks & Buses.'
  ),
  (
    '910712799',
    'Volvo Norge AS',
    'Sentralt selskap i Volvo-konsernet. Volvo-biler styres av VIN-listen og tas ikke ut av denne regelen. Andre merker som står på Volvo Norge, i praksis Renault, tas ut.'
  )
on conflict (orgnr) do nothing;

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
        and exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        ),
        false
      ) as is_fleet_focus,
      public.ofv_is_competitor_central_deal(
        r.make_name,
        p_focus_make,
        r.primary_owner_orgnr,
        r.primary_user_orgnr,
        r.leasing_company_orgnr
      ) as is_competitor_central
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
        when 'region' then not is_fleet_focus and not is_competitor_central
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
        and exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        ),
        false
      ) as is_fleet_focus,
      public.ofv_is_competitor_central_deal(
        r.make_name,
        p_focus_make,
        r.primary_owner_orgnr,
        r.primary_user_orgnr,
        r.leasing_company_orgnr
      ) as is_competitor_central
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
        when 'region' then not is_fleet_focus and not is_competitor_central
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
        and exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        ),
        false
      ) as is_fleet_focus,
      public.ofv_is_competitor_central_deal(
        r.make_name,
        p_focus_make,
        r.primary_owner_orgnr,
        r.primary_user_orgnr,
        r.leasing_company_orgnr
      ) as is_competitor_central
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
        when 'region' then not is_fleet_focus and not is_competitor_central
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
        and exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        ),
        false
      ) as is_fleet_focus,
      public.ofv_is_competitor_central_deal(
        r.make_name,
        p_focus_make,
        r.primary_owner_orgnr,
        r.primary_user_orgnr,
        r.leasing_company_orgnr
      ) as is_competitor_central
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
        when 'region' then not is_fleet_focus and not is_competitor_central
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
        and exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        ),
        false
      ) as is_fleet_focus,
      public.ofv_is_competitor_central_deal(
        r.make_name,
        p_focus_make,
        r.primary_owner_orgnr,
        r.primary_user_orgnr,
        r.leasing_company_orgnr
      ) as is_competitor_central
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
        when 'region' then not is_fleet_focus and not is_competitor_central
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
        and exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        ),
        false
      ) as is_fleet_focus,
      public.ofv_is_competitor_central_deal(
        r.make_name,
        p_focus_make,
        r.primary_owner_orgnr,
        r.primary_user_orgnr,
        r.leasing_company_orgnr
      ) as is_competitor_central
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
        when 'region' then not is_fleet_focus and not is_competitor_central
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
        and exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        ),
        false
      ) as is_fleet_focus,
      public.ofv_is_competitor_central_deal(
        r.make_name,
        p_focus_make,
        r.primary_owner_orgnr,
        r.primary_user_orgnr,
        r.leasing_company_orgnr
      ) as is_competitor_central
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
        when 'region' then not is_fleet_focus and not is_competitor_central
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
        and exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        ),
        false
      ) as is_fleet_focus,
      public.ofv_is_competitor_central_deal(
        r.make_name,
        p_focus_make,
        r.primary_owner_orgnr,
        r.primary_user_orgnr,
        r.leasing_company_orgnr
      ) as is_competitor_central
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
        when 'region' then not is_fleet_focus and not is_competitor_central
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
        and exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        )
      )
      or (
        p_fleet_filter = 'region'
        and not exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        )
        -- Ingen p_focus_make her. Volvo er samme default som region-RPC-ene.
        and not public.ofv_is_competitor_central_deal(
          r.make_name,
          'Volvo',
          r.primary_owner_orgnr,
          r.primary_user_orgnr,
          r.leasing_company_orgnr
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
        and exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        )
      )
      or (
        p_fleet_filter = 'region'
        and not exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        )
        -- Ingen p_focus_make her. Volvo er samme default som region-RPC-ene.
        and not public.ofv_is_competitor_central_deal(
          r.make_name,
          'Volvo',
          r.primary_owner_orgnr,
          r.primary_user_orgnr,
          r.leasing_company_orgnr
        )
      )
    )
  order by r.transaction_time desc, r.registration_number desc
  limit least(greatest(coalesce(p_limit, 25), 0), 1000)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

do $$
declare
  fn text;
  app_fns text[] := array[
    'public.ofv_is_competitor_central_deal(text, text, text, text, text)',
    'public.list_central_fleet_orgs()',
    'public.upsert_central_fleet_org(text, text, text, boolean)',
    'public.delete_central_fleet_org(text)'
  ];
begin
  foreach fn in array app_fns loop
    if has_function_privilege('anon', fn, 'execute') then
      raise exception '% er fortsatt kjørbar for anon', fn;
    end if;
    if has_function_privilege('public', fn, 'execute') then
      raise exception '% har fortsatt EXECUTE for PUBLIC', fn;
    end if;
    if not has_function_privilege('authenticated', fn, 'execute') then
      raise exception '% mangler EXECUTE for authenticated', fn;
    end if;
  end loop;

  if (
    select p.prosecdef
    from pg_proc p
    where p.oid = 'public.ofv_is_competitor_central_deal(text, text, text, text, text)'::regprocedure
  ) then
    raise exception 'ofv_is_competitor_central_deal skal være security invoker';
  end if;

  if not (
    select p.prosecdef
    from pg_proc p
    where p.oid = 'public.upsert_central_fleet_org(text, text, text, boolean)'::regprocedure
  ) then
    raise exception 'upsert_central_fleet_org skal være security definer';
  end if;

  if not (
    select p.prosecdef
    from pg_proc p
    where p.oid = 'public.delete_central_fleet_org(text)'::regprocedure
  ) then
    raise exception 'delete_central_fleet_org skal være security definer';
  end if;
end $$;

notify pgrst, 'reload schema';
