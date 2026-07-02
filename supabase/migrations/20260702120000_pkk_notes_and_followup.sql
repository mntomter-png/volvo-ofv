-- PKK: brukernotater per kunde + oppfølgingsfilter på RPC-er.

create table public.pkk_customer_notes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  owner_key     text not null,
  contact_email text,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, owner_key)
);

create index pkk_customer_notes_user_id_idx
  on public.pkk_customer_notes (user_id);

create trigger pkk_customer_notes_set_updated_at
  before update on public.pkk_customer_notes
  for each row
  execute function public.set_updated_at();

alter table public.pkk_customer_notes enable row level security;

create policy "Users can view their own PKK notes"
  on public.pkk_customer_notes for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their own PKK notes"
  on public.pkk_customer_notes for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own PKK notes"
  on public.pkk_customer_notes for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own PKK notes"
  on public.pkk_customer_notes for delete to authenticated
  using (auth.uid() = user_id);

drop function if exists public.pop_pkk_summary(int, int, int, text);
drop function if exists public.pop_pkk_customers(int, int, int, text);

create or replace function public.pop_pkk_customers(
  p_region int default null,
  p_min_volvo int default 5,
  p_customer_limit int default 50,
  p_only_follow_up boolean default false,
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
  ),
  filtered as (
    select *
    from base
    where not p_only_follow_up
       or overdue_count > 0
       or due_30_count > 0
       or due_90_count > 0
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
  from filtered
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
  p_only_follow_up boolean default false,
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
  with customer_stats as (
    select *
    from public.pop_pkk_customers(
      p_region,
      p_min_volvo,
      p_customer_limit,
      p_only_follow_up,
      p_focus_make
    )
  ),
  fleet as (
    select p.*
    from public.population p
    inner join customer_stats c
      on coalesce(nullif(p.primary_owner_orgnr, ''), p.primary_owner_name) = c.owner_key
    where p.snapshot_date = (select max(snapshot_date) from public.population)
      and p.maximum_laden_mass_kg >= 16000
      and p.make_name = p_focus_make
      and (p_region is null or p.sales_region = p_region)
  )
  select (select count(*)::int from customer_stats),
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

grant execute on function public.pop_pkk_summary(int, int, int, boolean, text) to authenticated;
grant execute on function public.pop_pkk_customers(int, int, int, boolean, text) to authenticated;
