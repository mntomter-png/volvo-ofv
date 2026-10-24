-- Siste bevisste skip på ofv_sync_health, uten å flytte «sist synket».
--
-- last_full_sync_at, last_any_sync_at og hours_since_last_sync leser kun
-- status = 'completed'. En skipped-rad skal ikke:
--   * nullstille sist synket
--   * gjøre forsinket (>26 t) eller ute av drift (>50 t) grønn
--   * hindre ofv_sync_watchdog() i å retrigge når siste completed er
--     eldre enn 20 timer
--
-- Watchdog-funksjonen endres ikke. Den filtrerer allerede på completed
-- (og running for overlapp). cleanup_stale_sync_locks() rører bare running.
--
-- Unik delindeks: én åpen skip-rad per sync_type, dataversjon og årsak.
-- Appen oppdaterer den raden når watchdog kjører hver time, i stedet for
-- å sette inn en ny.
--
-- Ikke kjørt mot prod av agenten.

create unique index if not exists sync_logs_skip_version_reason_uidx
  on public.sync_logs (sync_type, ofv_data_version, (metadata->>'reason'))
  where status = 'skipped';

comment on index public.sync_logs_skip_version_reason_uidx is
  'Én skipped-rad per type, OFV-versjon og årsak. Nye sjekker oppdaterer raden.';

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
  ) as population_incomplete,
  (
    select count(*)::int
    from (
      select snapshot_date
      from public.population
      group by snapshot_date
    ) snapshots
  ) as population_snapshot_count,
  (
    select left(error_message, 300)
    from public.sync_logs
    where metadata->>'kind' = 'population_prune'
      and status = 'failed'
      and coalesce(metadata->>'resolved', 'false') <> 'true'
    order by started_at desc
    limit 1
  ) as population_prune_error,
  skip.completed_at as last_skip_at,
  skip.ofv_data_version as last_skip_data_version,
  skip.reason as last_skip_reason
from (select 1) as anchor
left join lateral (
  select
    completed_at,
    ofv_data_version,
    left(error_message, 300) as reason
  from public.sync_logs
  where sync_type = 'full' and status = 'skipped'
  order by completed_at desc nulls last
  limit 1
) skip on true;

comment on column public.ofv_sync_health.last_skip_at is
  'Siste full-synk som ble hoppet over. Inngår ikke i hours_since_last_sync.';
comment on column public.ofv_sync_health.last_skip_data_version is
  'OFV-versjonen skip-raden sammenlignet mot.';
comment on column public.ofv_sync_health.last_skip_reason is
  'Hvorfor synken ble hoppet over, f.eks. at versjonen allerede er synket.';

grant select on public.ofv_sync_health to authenticated;

comment on function public.ofv_sync_watchdog() is
  'Retrigger OFV-synk når siste vellykkede synk (status completed, full eller registrations) er eldre enn 20 timer, eller bestanden er ufullstendig. En rad som er hoppet over teller ikke og nullstiller ikke fristen.';

-- Sjekk at view og watchdog fortsatt skiller skipped fra en vellykket synk.
do $$
declare
  view_def text := pg_get_viewdef('public.ofv_sync_health'::regclass, true);
  watchdog_def text := pg_get_functiondef('public.ofv_sync_watchdog()'::regprocedure);
  lock_def text := pg_get_functiondef('public.cleanup_stale_sync_locks()'::regprocedure);
begin
  if view_def !~ 'status[[:space:]]*=[[:space:]]*''completed''' then
    raise exception 'ofv_sync_health filtrerer ikke på status completed';
  end if;
  if view_def !~ 'status[[:space:]]*=[[:space:]]*''skipped''' then
    raise exception 'ofv_sync_health mangler status skipped for siste sjekk';
  end if;
  if watchdog_def ~ 'skipped' then
    raise exception 'ofv_sync_watchdog nevner skipped og kan komme til å telle det som synk';
  end if;
  if watchdog_def !~ 'status[[:space:]]*=[[:space:]]*''completed''' then
    raise exception 'ofv_sync_watchdog filtrerer ikke på status completed';
  end if;
  if lock_def ~ 'skipped' then
    raise exception 'cleanup_stale_sync_locks skal ikke røre skipped-rader';
  end if;
end $$;
