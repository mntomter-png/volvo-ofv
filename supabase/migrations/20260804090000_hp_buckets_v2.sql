-- HK-intervaller (6 bøtter): <500, 500-540, 540-580, 580-650, 650-750, >750.
-- Speiler classifyHpBucketKey() i src/lib/ofv/segmentation.ts.
-- Ordinaler: 1=<500, 2=500-539, 3=540-579, 4=580-649, 5=650-750, 6=>750.

drop index if exists public.registrations_hp_bucket_idx;
drop index if exists public.population_hp_bucket_idx;

alter table public.registrations drop column if exists hp_bucket;
alter table public.population drop column if exists hp_bucket;

create or replace function public.ofv_hp_bucket(hp int, kw int)
returns smallint
language sql
immutable
as $$
  select case
    when eff is null or eff <= 0 then null
    when eff > 750 then 6
    when eff >= 650 then 5
    when eff >= 580 then 4
    when eff >= 540 then 3
    when eff >= 500 then 2
    else 1
  end::smallint
  from (
    select case
      when coalesce(hp, 0) > 0 then hp
      when coalesce(kw, 0) > 0 then round(kw * 1.341)::int
      else null
    end as eff
  ) t;
$$;

alter table public.registrations
  add column hp_bucket smallint
  generated always as (public.ofv_hp_bucket(engine_power_hp, engine_power_kw)) stored;

alter table public.population
  add column hp_bucket smallint
  generated always as (public.ofv_hp_bucket(engine_power_hp, engine_power_kw)) stored;

create index registrations_hp_bucket_idx
  on public.registrations (hp_bucket);
create index population_hp_bucket_idx
  on public.population (hp_bucket);

grant execute on function public.ofv_hp_bucket(int, int) to authenticated;

notify pgrst, 'reload schema';
