-- Fornyelsespulje til TMF: alder og forfalt PKK i OFV-populasjonen.
--
-- PKK innen 12 måneder er nesten hele bestanden (årlig kontroll) og kan ikke
-- brukes som erstatningssignal. I stedet teller vi kjøretøy ≥10 år, pluss
-- forfalt PKK som mild boost. Trykket måles relativt mellom segmentene mot
-- trailing registreringer — uten historiske snapshots kan vi ikke si om
-- totalmarkedet er «høyt» eller «lavt», bare hvor trykket sitter.
--
-- Indeksen dekker den vanlige TMF/populasjon-spørringen: siste snapshot, tunge,
-- gruppert på pabygg.

create index if not exists population_snapshot_heavy_pabygg_idx
  on public.population (snapshot_date, pabygg_segment)
  where maximum_laden_mass_kg >= 16000;

create or replace function public.tmf_renewal_pool(
  p_as_of date default current_date,
  p_focus_make text default 'Volvo',
  p_old_years int default 10
)
returns table(
  pabygg text,
  stock_count int,
  old_count int,
  overdue_count int,
  due_90_count int,
  focus_old_count int
)
language sql
stable
security invoker
as $$
  with latest as (
    select max(snapshot_date) as snapshot_date
    from public.population
  ),
  bounds as (
    select
      p_as_of as as_of,
      (p_as_of - make_interval(years => least(greatest(coalesce(p_old_years, 10), 5), 20)))::date
        as old_before,
      (p_as_of + interval '90 days')::date as due_90_end
  )
  select
    coalesce(p.pabygg_segment, 'Annet') as pabygg,
    count(*)::int as stock_count,
    count(*) filter (
      where p.first_registration_date is not null
        and p.first_registration_date < b.old_before
    )::int as old_count,
    count(*) filter (
      where p.pkk_next_deadline is not null
        and p.pkk_next_deadline < b.as_of
    )::int as overdue_count,
    count(*) filter (
      where p.pkk_next_deadline is not null
        and p.pkk_next_deadline >= b.as_of
        and p.pkk_next_deadline <= b.due_90_end
    )::int as due_90_count,
    count(*) filter (
      where p.make_name = p_focus_make
        and p.first_registration_date is not null
        and p.first_registration_date < b.old_before
    )::int as focus_old_count
  from public.population p
  cross join latest l
  cross join bounds b
  where p.snapshot_date = l.snapshot_date
    and p.maximum_laden_mass_kg >= 16000
  group by 1
  order by 1;
$$;

comment on function public.tmf_renewal_pool(date, text, int) is
  'TMF fornyelsespulje: stock, alder ≥N år, forfalt PKK og PKK ≤90 dager per pabygg.';

grant execute on function public.tmf_renewal_pool(date, text, int)
  to authenticated, service_role;

-- Drop den gamle signaturen hvis den ble lagt inn tidligere i samme migrasjonsløp.
drop function if exists public.tmf_renewal_pool(date, int, text, int);
