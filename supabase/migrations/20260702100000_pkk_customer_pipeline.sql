-- PKK storkundeoppfølging: sammendrag og prioritert kundeliste.

drop function if exists public.pop_pkk_owner_vehicles(text, text, text, int, int, text, text, int, text, text, int, text);

create or replace function public.pop_pkk_summary(
  p_region int default null,
  p_min_volvo int default 5,
  p_customer_limit int default 50,
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
  with customers as (
    select coalesce(nullif(primary_owner_orgnr, ''), primary_owner_name) as owner_key
    from public.population
    where snapshot_date = (select max(snapshot_date) from public.population)
      and maximum_laden_mass_kg >= 16000
      and primary_owner_name is not null
      and make_name = p_focus_make
      and (p_region is null or sales_region = p_region)
    group by 1
    having count(*) >= greatest(p_min_volvo, 1)
    order by count(*) desc
    limit greatest(p_customer_limit, 1)
  ),
  fleet as (
    select p.*
    from public.population p
    inner join customers c
      on coalesce(nullif(p.primary_owner_orgnr, ''), p.primary_owner_name) = c.owner_key
    where p.snapshot_date = (select max(snapshot_date) from public.population)
      and p.maximum_laden_mass_kg >= 16000
      and p.make_name = p_focus_make
      and (p_region is null or p.sales_region = p_region)
  )
  select count(distinct coalesce(nullif(primary_owner_orgnr, ''), primary_owner_name))::int,
         count(*)::int,
         count(*) filter (
           where pkk_next_deadline is not null and pkk_next_deadline < current_date
         )::int,
         count(*) filter (
           where pkk_next_deadline is not null
             and pkk_next_deadline >= current_date
             and pkk_next_deadline <= (current_date + interval '30 days')
         )::int,
         count(*) filter (
           where pkk_next_deadline is not null
             and pkk_next_deadline >= current_date
             and pkk_next_deadline <= (current_date + interval '90 days')
         )::int,
         count(*) filter (
           where pkk_next_deadline is not null
             and pkk_next_deadline <= (current_date + make_interval(months => 6))
         )::int,
         count(*) filter (where pkk_next_deadline is null)::int
  from fleet;
$$;

create or replace function public.pop_pkk_customers(
  p_region int default null,
  p_min_volvo int default 5,
  p_customer_limit int default 50,
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
  next_deadline date,
  days_to_next int
)
language sql stable security invoker
as $$
  with base as (
    select coalesce(nullif(primary_owner_orgnr, ''), primary_owner_name) as owner_key,
           max(primary_owner_name) as owner_name,
           max(nullif(primary_owner_orgnr, '')) as owner_orgnr,
           max(coalesce(
             nullif(primary_owner_company_postal_district, ''),
             nullif(primary_owner_postal_district, '')
           )) as owner_location,
           max(sales_region)::int as sales_region,
           count(*)::int as focus_count,
           count(*) filter (
             where pkk_next_deadline is not null and pkk_next_deadline < current_date
           )::int as overdue_count,
           count(*) filter (
             where pkk_next_deadline is not null
               and pkk_next_deadline >= current_date
               and pkk_next_deadline <= (current_date + interval '30 days')
           )::int as due_30_count,
           count(*) filter (
             where pkk_next_deadline is not null
               and pkk_next_deadline >= current_date
               and pkk_next_deadline <= (current_date + interval '90 days')
           )::int as due_90_count,
           count(*) filter (
             where pkk_next_deadline is not null
               and pkk_next_deadline <= (current_date + make_interval(months => 6))
           )::int as due_180_count,
           min(pkk_next_deadline) filter (
             where pkk_next_deadline is not null
           ) as next_deadline
    from public.population
    where snapshot_date = (select max(snapshot_date) from public.population)
      and maximum_laden_mass_kg >= 16000
      and primary_owner_name is not null
      and make_name = p_focus_make
      and (p_region is null or sales_region = p_region)
    group by 1
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
         next_deadline,
         (next_deadline - current_date)::int as days_to_next
  from base
  order by overdue_count desc,
           due_30_count desc,
           due_90_count desc,
           next_deadline asc nulls last,
           focus_count desc,
           owner_name
  limit greatest(p_customer_limit, 1);
$$;

create or replace function public.pop_pkk_owner_vehicles(
  p_owner_key text,
  p_region int default null,
  p_months int default 6,
  p_include_no_date boolean default false,
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
    and coalesce(nullif(primary_owner_orgnr, ''), primary_owner_name) = p_owner_key
    and (p_region is null or sales_region = p_region)
    and (
      p_include_no_date
      or (
        pkk_next_deadline is not null
        and pkk_next_deadline <= (current_date + make_interval(months => greatest(p_months, 1)))
      )
    )
  order by pkk_next_deadline asc nulls last, registration_number
  limit greatest(p_limit, 1);
$$;

grant execute on function public.pop_pkk_summary(int, int, int, text) to authenticated;
grant execute on function public.pop_pkk_customers(int, int, int, text) to authenticated;
grant execute on function public.pop_pkk_owner_vehicles(text, int, int, boolean, int, text) to authenticated;
