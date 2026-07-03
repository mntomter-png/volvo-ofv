-- PKK: velg om storkunder grupperes på eier eller bruker.

drop function if exists public.pop_pkk_summary(int, int, int, boolean, text, boolean, text);
drop function if exists public.pop_pkk_customers(int, int, int, boolean, text, boolean, text);
drop function if exists public.pop_pkk_owner_vehicles(text, int, int, boolean, text, int, text);
drop function if exists public.pop_pkk_due_soon_vehicles(
  text, text, int, int, text, text, int, text, text, int, int, int, int, text
);

create or replace function public.pop_pkk_customers(
  p_region int default null,
  p_min_volvo int default 5,
  p_customer_limit int default 50,
  p_only_follow_up boolean default true,
  p_horizon text default 'actionable',
  p_exclude_finance boolean default true,
  p_customer_party text default 'owner',
  p_focus_make text default 'Volvo'
)
returns table(
  owner_key text,
  owner_name text,
  owner_orgnr text,
  owner_location text,
  sales_region int,
  focus_count int,
  overdue_count int,
  due_30_count int,
  due_90_count int,
  due_180_count int,
  no_pkk_count int,
  next_deadline date,
  days_to_next int
)
language sql stable security invoker
as $$
  with latest as (
    select max(snapshot_date) as snapshot_date
    from public.population
  ),
  vehicles as (
    select
      case
        when coalesce(p_customer_party, 'owner') = 'user' then
          coalesce(nullif(p.primary_user_orgnr, ''), p.primary_user_name)
        else
          coalesce(nullif(p.primary_owner_orgnr, ''), p.primary_owner_name)
      end as owner_key,
      case
        when coalesce(p_customer_party, 'owner') = 'user' then p.primary_user_name
        else p.primary_owner_name
      end as party_name,
      case
        when coalesce(p_customer_party, 'owner') = 'user' then p.primary_user_orgnr
        else p.primary_owner_orgnr
      end as party_orgnr,
      case
        when coalesce(p_customer_party, 'owner') = 'user' then
          coalesce(
            nullif(p.primary_user_company_postal_district, ''),
            nullif(p.primary_user_postal_district, '')
          )
        else
          coalesce(
            nullif(p.primary_owner_company_postal_district, ''),
            nullif(p.primary_owner_postal_district, '')
          )
      end as owner_location,
      p.sales_region,
      p.pkk_next_deadline,
      case
        when p_horizon = 'all' then
          p.pkk_next_deadline is not null
        when p_horizon = 'upcoming' then
          p.pkk_next_deadline is not null
          and p.pkk_next_deadline >= current_date
          and p.pkk_next_deadline <= (current_date + make_interval(months => 6))
        else
          p.pkk_next_deadline is not null
          and p.pkk_next_deadline >= (current_date - interval '90 days')
          and p.pkk_next_deadline <= (current_date + make_interval(months => 6))
      end as in_horizon
    from public.population p
    cross join latest l
    where p.snapshot_date = l.snapshot_date
      and p.maximum_laden_mass_kg >= 16000
      and p.make_name = p_focus_make
      and (p_region is null or p.sales_region = p_region)
      and (
        (coalesce(p_customer_party, 'owner') = 'user' and p.primary_user_name is not null)
        or (coalesce(p_customer_party, 'owner') <> 'user' and p.primary_owner_name is not null)
      )
  ),
  base as (
    select owner_key,
           max(party_name) as owner_name,
           max(nullif(party_orgnr, '')) as owner_orgnr,
           max(owner_location) as owner_location,
           max(sales_region)::int as sales_region,
           count(*)::int as focus_count,
           count(*) filter (
             where in_horizon and pkk_next_deadline < current_date
           )::int as overdue_count,
           count(*) filter (
             where in_horizon
               and pkk_next_deadline >= current_date
               and pkk_next_deadline <= (current_date + interval '30 days')
           )::int as due_30_count,
           count(*) filter (
             where in_horizon
               and pkk_next_deadline >= current_date
               and pkk_next_deadline <= (current_date + interval '90 days')
           )::int as due_90_count,
           count(*) filter (where in_horizon)::int as due_180_count,
           count(*) filter (where pkk_next_deadline is null)::int as no_pkk_count,
           min(pkk_next_deadline) filter (where in_horizon) as next_deadline
    from vehicles
    group by owner_key
    having count(*) >= greatest(p_min_volvo, 1)
  )
  select owner_key,
         owner_name,
         owner_orgnr,
         owner_location,
         sales_region,
         focus_count,
         overdue_count,
         due_30_count,
         due_90_count,
         due_180_count,
         no_pkk_count,
         next_deadline,
         (next_deadline - current_date)::int as days_to_next
  from base
  where (not p_exclude_finance or not public.ofv_is_excluded_fleet_owner(owner_name))
    and (
      not p_only_follow_up
      or overdue_count > 0
      or due_30_count > 0
      or due_90_count > 0
    )
  order by overdue_count desc,
           due_30_count desc,
           due_90_count desc,
           next_deadline asc nulls last,
           focus_count desc,
           owner_name
  limit greatest(p_customer_limit, 1);
$$;

create or replace function public.pop_pkk_summary(
  p_region int default null,
  p_min_volvo int default 5,
  p_customer_limit int default 50,
  p_only_follow_up boolean default true,
  p_horizon text default 'actionable',
  p_exclude_finance boolean default true,
  p_customer_party text default 'owner',
  p_focus_make text default 'Volvo'
)
returns table(
  customer_count int,
  volvo_vehicles int,
  overdue_count int,
  due_30_count int,
  due_90_count int,
  due_180_count int,
  no_pkk_date_count int
)
language sql stable security invoker
as $$
  select count(*)::int,
         coalesce(sum(focus_count), 0)::int,
         coalesce(sum(overdue_count), 0)::int,
         coalesce(sum(due_30_count), 0)::int,
         coalesce(sum(due_90_count), 0)::int,
         coalesce(sum(due_180_count), 0)::int,
         coalesce(sum(no_pkk_count), 0)::int
  from public.pop_pkk_customers(
    p_region,
    p_min_volvo,
    p_customer_limit,
    p_only_follow_up,
    p_horizon,
    p_exclude_finance,
    p_customer_party,
    p_focus_make
  );
$$;

create or replace function public.pop_pkk_owner_vehicles(
  p_owner_key text,
  p_region int default null,
  p_months int default 6,
  p_include_no_date boolean default false,
  p_horizon text default 'actionable',
  p_customer_party text default 'owner',
  p_limit int default 200,
  p_focus_make text default 'Volvo'
)
returns table(
  registration_number text,
  make_name text,
  model_name text,
  first_registration_date date,
  pkk_last_date date,
  pkk_next_deadline date,
  days_until_due int
)
language sql stable security invoker
as $$
  select registration_number,
         make_name,
         model_name,
         first_registration_date,
         pkk_last_date,
         pkk_next_deadline,
         (pkk_next_deadline - current_date)::int as days_until_due
  from public.population
  where snapshot_date = (select max(snapshot_date) from public.population)
    and maximum_laden_mass_kg >= 16000
    and make_name = p_focus_make
    and (
      case
        when coalesce(p_customer_party, 'owner') = 'user' then
          coalesce(nullif(primary_user_orgnr, ''), primary_user_name)
        else
          coalesce(nullif(primary_owner_orgnr, ''), primary_owner_name)
      end
    ) = p_owner_key
    and (p_region is null or sales_region = p_region)
    and (
      p_include_no_date
      or (
        p_horizon = 'all'
        and pkk_next_deadline is not null
        and pkk_next_deadline <= (current_date + make_interval(months => greatest(p_months, 1)))
      )
      or (
        p_horizon = 'upcoming'
        and pkk_next_deadline is not null
        and pkk_next_deadline >= current_date
        and pkk_next_deadline <= (current_date + make_interval(months => greatest(p_months, 1)))
      )
      or (
        coalesce(p_horizon, 'actionable') = 'actionable'
        and pkk_next_deadline is not null
        and pkk_next_deadline >= (current_date - interval '90 days')
        and pkk_next_deadline <= (current_date + make_interval(months => greatest(p_months, 1)))
      )
    )
  order by pkk_next_deadline asc nulls last, registration_number
  limit greatest(p_limit, 1);
$$;

create or replace function public.pop_pkk_due_soon_vehicles(
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_age text default null,
  p_months int default 6,
  p_min_volvo int default 1,
  p_owner_limit int default 30,
  p_vehicle_limit int default 500,
  p_customer_party text default 'owner',
  p_focus_make text default 'Volvo'
)
returns table(
  owner_key text,
  owner_name text,
  focus_fleet_size int,
  registration_number text,
  model_name text,
  first_registration_date date,
  pkk_last_date date,
  pkk_next_deadline date,
  days_until_due int
)
language sql stable security invoker
as $$
  with top_owners as (
    select
      case
        when coalesce(p_customer_party, 'owner') = 'user' then
          coalesce(nullif(primary_user_orgnr, ''), primary_user_name)
        else
          coalesce(nullif(primary_owner_orgnr, ''), primary_owner_name)
      end as owner_key,
      case
        when coalesce(p_customer_party, 'owner') = 'user' then max(primary_user_name)
        else max(primary_owner_name)
      end as owner_name,
      count(*) filter (where make_name = p_focus_make)::int as focus_count
    from public.population
    where snapshot_date = (select max(snapshot_date) from public.population)
      and maximum_laden_mass_kg >= 16000
      and (
        (coalesce(p_customer_party, 'owner') = 'user' and primary_user_name is not null)
        or (coalesce(p_customer_party, 'owner') <> 'user' and primary_owner_name is not null)
      )
      and (p_segment is null or usage_name = p_segment)
      and (p_make is null or make_name = p_make)
      and (p_region is null or sales_region = p_region)
      and (p_hp is null or hp_bucket = p_hp)
      and (p_fuel is null or fuel_name = p_fuel)
      and (p_pabygg is null or pabygg_segment = p_pabygg)
      and (p_disp is null or disp_bucket = p_disp)
      and (p_chassis is null or trekker_jevnlast = p_chassis)
      and (
        p_age is null
        or (p_age = 'under10'
            and first_registration_date >= (current_date - interval '10 years')::date)
        or (p_age = 'over10'
            and first_registration_date < (current_date - interval '10 years')::date)
      )
    group by 1
    having count(*) filter (where make_name = p_focus_make) >= greatest(p_min_volvo, 1)
    order by focus_count desc, owner_name
    limit greatest(p_owner_limit, 1)
  )
  select
    case
      when coalesce(p_customer_party, 'owner') = 'user' then
        coalesce(nullif(p.primary_user_orgnr, ''), p.primary_user_name)
      else
        coalesce(nullif(p.primary_owner_orgnr, ''), p.primary_owner_name)
    end as owner_key,
    case
      when coalesce(p_customer_party, 'owner') = 'user' then p.primary_user_name
      else p.primary_owner_name
    end as owner_name,
    o.focus_count as focus_fleet_size,
    p.registration_number,
    p.model_name,
    p.first_registration_date,
    p.pkk_last_date,
    p.pkk_next_deadline,
    (p.pkk_next_deadline - current_date)::int as days_until_due
  from public.population p
  inner join top_owners o
    on (
      case
        when coalesce(p_customer_party, 'owner') = 'user' then
          coalesce(nullif(p.primary_user_orgnr, ''), p.primary_user_name)
        else
          coalesce(nullif(p.primary_owner_orgnr, ''), p.primary_owner_name)
      end
    ) = o.owner_key
  where p.snapshot_date = (select max(snapshot_date) from public.population)
    and p.maximum_laden_mass_kg >= 16000
    and p.make_name = p_focus_make
    and p.pkk_next_deadline is not null
    and p.pkk_next_deadline <= (current_date + make_interval(months => greatest(p_months, 1)))
    and (p_segment is null or p.usage_name = p_segment)
    and (p_make is null or p.make_name = p_make)
    and (p_region is null or p.sales_region = p_region)
    and (p_hp is null or p.hp_bucket = p_hp)
    and (p_fuel is null or p.fuel_name = p_fuel)
    and (p_pabygg is null or p.pabygg_segment = p_pabygg)
    and (p_disp is null or p.disp_bucket = p_disp)
    and (p_chassis is null or p.trekker_jevnlast = p_chassis)
    and (
      p_age is null
      or (p_age = 'under10'
          and p.first_registration_date >= (current_date - interval '10 years')::date)
      or (p_age = 'over10'
          and p.first_registration_date < (current_date - interval '10 years')::date)
    )
  order by p.pkk_next_deadline asc, o.focus_count desc, p.registration_number
  limit greatest(p_vehicle_limit, 1);
$$;

grant execute on function public.pop_pkk_summary(int, int, int, boolean, text, boolean, text, text) to authenticated;
grant execute on function public.pop_pkk_customers(int, int, int, boolean, text, boolean, text, text) to authenticated;
grant execute on function public.pop_pkk_owner_vehicles(text, int, int, boolean, text, text, int, text) to authenticated;
grant execute on function public.pop_pkk_due_soon_vehicles(
  text, text, int, int, text, text, int, text, text, int, int, int, int, text, text
) to authenticated;
