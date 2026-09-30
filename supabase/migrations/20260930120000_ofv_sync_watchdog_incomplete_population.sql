-- Utvid OFV-watchdog: oppdag ufullstendige population-snapshots og reparer.
--
-- Problem: mislykket synk kan etterlate en nyere snapshot med f.eks. ~20k rader
-- mens UI alltid leser max(snapshot_date). Watchdog så kun på sync_logs.completed,
-- ikke på om bestanden faktisk er komplett (~65k rader).
--
-- Terskler: komplette snapshots har historisk vært ~65–66k rader. 55k gir margin
-- for naturlig svingning uten å godta halvferdige synker (~15–25k).

create or replace function public.delete_population_snapshot(p_snapshot_date date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch int;
  v_total int := 0;
begin
  if p_snapshot_date is null then
    return 0;
  end if;

  loop
    with doomed as (
      select id
      from public.population
      where snapshot_date = p_snapshot_date
      order by id
      limit 2000
    )
    delete from public.population p
    using doomed d
    where p.id = d.id;

    get diagnostics v_batch = row_count;
    v_total := v_total + v_batch;
    exit when v_batch = 0;
  end loop;

  return v_total;
end;
$$;

revoke all on function public.delete_population_snapshot(date) from public, anon, authenticated;

-- Slett ufullstendige snapshots nyere enn siste komplette (fallback for UI).
-- Returnerer antall snapshots som ble slettet.
create or replace function public.prune_incomplete_population_snapshots(
  p_min_rows int default 55000
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_latest date;
  v_latest_rows bigint;
  v_keep date;
  v_deleted_snaps int := 0;
  r record;
begin
  select max(snapshot_date) into v_latest from public.population;
  if v_latest is null then
    return 0;
  end if;

  select count(*) into v_latest_rows
  from public.population
  where snapshot_date = v_latest;

  -- Nyeste er komplett nok → ingen opprydding.
  if v_latest_rows >= p_min_rows then
    return 0;
  end if;

  -- Finn siste komplette snapshot å falle tilbake til.
  select snapshot_date into v_keep
  from (
    select snapshot_date, count(*) as n
    from public.population
    group by snapshot_date
  ) s
  where s.n >= p_min_rows
  order by snapshot_date desc
  limit 1;

  -- Ingen komplett snapshot → ikke slett alt (unngå tom bestand).
  if v_keep is null then
    return 0;
  end if;

  for r in
    select snapshot_date
    from public.population
    group by snapshot_date
    having count(*) < p_min_rows
       and snapshot_date > v_keep
    order by snapshot_date desc
  loop
    perform public.delete_population_snapshot(r.snapshot_date);
    v_deleted_snaps := v_deleted_snaps + 1;
  end loop;

  return v_deleted_snaps;
end;
$$;

revoke all on function public.prune_incomplete_population_snapshots(int)
  from public, anon, authenticated;

create or replace view public.ofv_sync_health
with (security_invoker = true) as
select
  (select max(completed_at) from public.sync_logs
     where sync_type = 'full' and status = 'completed') as last_full_sync_at,
  (select ofv_data_version from public.sync_logs
     where sync_type = 'full' and status = 'completed'
     order by completed_at desc limit 1) as last_full_data_version,
  (select ofv_publish_date from public.sync_logs
     where sync_type = 'full' and status = 'completed'
     order by completed_at desc limit 1) as last_full_publish_date,
  (select max(completed_at) from public.sync_logs
     where status = 'completed') as last_any_sync_at,
  round(
    extract(epoch from (now() - (
      select max(completed_at) from public.sync_logs where status = 'completed'
    ))) / 3600.0, 1
  ) as hours_since_last_sync,
  (select count(*)::int from public.sync_logs
     where status = 'running' and started_at < now() - interval '20 minutes'
  ) as stale_running_locks,
  (select max(snapshot_date) from public.population) as latest_population_snapshot,
  (select count(*)::bigint from public.population p
     where p.snapshot_date = (select max(snapshot_date) from public.population)
  ) as latest_population_rows,
  (
    coalesce(
      (select count(*) from public.population p
         where p.snapshot_date = (select max(snapshot_date) from public.population)),
      0
    ) < 55000
  ) as population_incomplete;

grant select on public.ofv_sync_health to authenticated;

create or replace function public.ofv_sync_watchdog()
returns void
language plpgsql
security definer
set search_path = public, net, vault
as $$
declare
  v_last timestamptz;
  v_pruned int;
  v_latest_rows bigint;
  v_running int;
begin
  perform public.cleanup_stale_sync_locks();

  -- Unngå overlapping med en synk som faktisk kjører.
  select count(*)::int into v_running
  from public.sync_logs
  where status = 'running'
    and started_at >= now() - interval '20 minutes';
  if v_running > 0 then
    return;
  end if;

  -- 1) Ufullstendig nyeste snapshot → fjern den (fallback til komplett) + re-synk.
  v_pruned := public.prune_incomplete_population_snapshots(55000);
  if v_pruned > 0 then
    perform public.trigger_ofv_sync('full');
    return;
  end if;

  -- 2) Ingen population / ekstremt lav (etter mislykket prune uten fallback).
  select count(*) into v_latest_rows
  from public.population p
  where p.snapshot_date = (select max(snapshot_date) from public.population);

  if v_latest_rows is null or v_latest_rows < 55000 then
    perform public.trigger_ofv_sync('full');
    return;
  end if;

  -- 3) Ingen vellykket synk siste 20 timer → sikkerhetsnett (som før).
  select max(completed_at) into v_last
  from public.sync_logs
  where sync_type in ('full', 'registrations') and status = 'completed';

  if v_last is null or v_last < now() - interval '20 hours' then
    perform public.trigger_ofv_sync('full');
  end if;
end;
$$;

revoke all on function public.ofv_sync_watchdog() from public, anon, authenticated;

-- Kjør oftere (hver time) slik at ufullstendig bestand ikke ligger synlig i timesvis.
select cron.unschedule('ofv-sync-watchdog')
where exists (select 1 from cron.job where jobname = 'ofv-sync-watchdog');

select cron.schedule(
  'ofv-sync-watchdog',
  '30 * * * *',
  $$select public.ofv_sync_watchdog();$$
);
