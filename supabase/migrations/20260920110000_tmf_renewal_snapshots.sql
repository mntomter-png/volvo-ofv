-- Månedlige fornyelsesaggregater for TMF.
--
-- Live-signalet bruker bare dagens populasjon, så vi kan ikke kalibrere alder/
-- forfalt PKK mot historiske registreringer. Denne tabellen lagrer et lite
-- aggregat per påbygg hver måned (ikke radsett), slik at vi om ~12 måneder kan
-- backteste og kalibrere fornyelsesvekten — samme idé som ssb_indicator_snapshots.

create table public.tmf_renewal_snapshots (
  id                     uuid primary key default gen_random_uuid(),
  -- Måneden øyeblikksbildet gjelder for (alltid den 1.).
  snapshot_month         date not null,
  pabygg                 text not null,
  stock_count            int not null check (stock_count >= 0),
  old_count              int not null check (old_count >= 0),
  overdue_count          int not null check (overdue_count >= 0),
  due_90_count           int not null check (due_90_count >= 0),
  focus_old_count        int not null check (focus_old_count >= 0),
  -- Hvilken OFV-populasjonsdato aggregatet ble tatt fra.
  population_snapshot_date date,
  old_years              int not null default 10 check (old_years between 5 and 20),
  focus_make             text not null default 'Volvo',
  captured_at            timestamptz not null default now(),

  unique (snapshot_month, pabygg, focus_make, old_years),
  constraint tmf_renewal_snapshots_month_is_first
    check (date_trunc('month', snapshot_month)::date = snapshot_month)
);

comment on table public.tmf_renewal_snapshots is
  'Maanedlig TMF-fornyelsesaggregat per pabygg. Kun tellinger — ingen kjoretoeyrader.';

create index tmf_renewal_snapshots_month_idx
  on public.tmf_renewal_snapshots (snapshot_month desc);

create index tmf_renewal_snapshots_lookup_idx
  on public.tmf_renewal_snapshots (snapshot_month desc, pabygg);

alter table public.tmf_renewal_snapshots enable row level security;

create policy "TMF roles can view renewal snapshots"
  on public.tmf_renewal_snapshots for select to authenticated
  using (public.jwt_app_role() in ('leder', 'super'));

grant select on public.tmf_renewal_snapshots to authenticated;
grant select, insert, update, delete on public.tmf_renewal_snapshots to service_role;

-- Aggregerer siste populasjon via tmf_renewal_pool og lagrer/oppdaterer måneden.
-- Gjentatte kall samme måned overskriver, så snapshotet speiler siste synk.
create or replace function public.tmf_capture_renewal_snapshot(
  p_snapshot_month date default (date_trunc('month', current_date))::date,
  p_as_of date default current_date,
  p_focus_make text default 'Volvo',
  p_old_years int default 10
)
returns int
language plpgsql
security invoker
as $$
declare
  v_month date := (date_trunc('month', coalesce(p_snapshot_month, current_date)))::date;
  v_pop_date date;
  v_count int := 0;
begin
  select max(snapshot_date) into v_pop_date from public.population;
  if v_pop_date is null then
    return 0;
  end if;

  insert into public.tmf_renewal_snapshots (
    snapshot_month,
    pabygg,
    stock_count,
    old_count,
    overdue_count,
    due_90_count,
    focus_old_count,
    population_snapshot_date,
    old_years,
    focus_make,
    captured_at
  )
  select
    v_month,
    pool.pabygg,
    pool.stock_count,
    pool.old_count,
    pool.overdue_count,
    pool.due_90_count,
    pool.focus_old_count,
    v_pop_date,
    least(greatest(coalesce(p_old_years, 10), 5), 20),
    coalesce(nullif(p_focus_make, ''), 'Volvo'),
    now()
  from public.tmf_renewal_pool(
    coalesce(p_as_of, current_date),
    coalesce(nullif(p_focus_make, ''), 'Volvo'),
    least(greatest(coalesce(p_old_years, 10), 5), 20)
  ) as pool
  on conflict (snapshot_month, pabygg, focus_make, old_years) do update set
    stock_count = excluded.stock_count,
    old_count = excluded.old_count,
    overdue_count = excluded.overdue_count,
    due_90_count = excluded.due_90_count,
    focus_old_count = excluded.focus_old_count,
    population_snapshot_date = excluded.population_snapshot_date,
    captured_at = excluded.captured_at;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.tmf_capture_renewal_snapshot(date, date, text, int) is
  'Lagrer maaedlig fornyelsesaggregat fra siste OFV-populasjon.';

grant execute on function public.tmf_capture_renewal_snapshot(date, date, text, int)
  to authenticated, service_role;

-- Start historikken med dagens bestand, hvis populasjon finnes.
do $$
begin
  perform public.tmf_capture_renewal_snapshot();
exception
  when others then
    raise notice 'tmf_renewal_snapshots seed skipped: %', SQLERRM;
end $$;
