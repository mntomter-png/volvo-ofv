-- Flåtekjøp: nyregistreringer gruppert per eier (primary owner) i perioden.
-- Ekskludering (finans/leasing/eget merke) og størrelsesbånd håndteres i TS
-- (isExcludedFleetOwner / classifyFleetSize i src/lib/ofv/segmentation.ts),
-- så RPC-en returnerer rå eier-aggregater.

create or replace function public.reg_fleet_owners(
  p_year int,
  p_segment text default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null
)
returns table(owner_key text, owner_name text, count int, volvo_count int)
language sql stable security invoker
as $$
  select coalesce(nullif(primary_owner_orgnr, ''), primary_owner_name) as owner_key,
         max(primary_owner_name) as owner_name,
         count(*)::int,
         count(*) filter (where make_name = 'Volvo')::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg > 16000
    and coalesce(nullif(primary_owner_orgnr, ''), primary_owner_name) is not null
    and extract(year from transaction_time) = p_year
    and (p_segment is null or usage_name = p_segment)
    and (p_region is null or sales_region = p_region)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
  group by 1
  order by count(*) desc;
$$;

grant execute on function public.reg_fleet_owners(int, text, int, int, text) to authenticated;
