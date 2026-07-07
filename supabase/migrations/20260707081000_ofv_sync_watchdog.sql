-- Monitorering og selvhealing for OFV-synk (in-database "vaktbikkje").
--
-- 1. ofv_sync_health: lett view for å se hvor fersk synken er (kan vises i UI).
-- 2. cleanup_stale_sync_locks: markerer hengende 'running'-logger som failed.
-- 3. ofv_sync_watchdog: rydder låser og re-trigger synk hvis den er for gammel.
--
-- Watchdog kjører hver 4. time som et sikkerhetsnett i tillegg til de faste
-- daglige kjøringene. Versjonskontrollen i runOfvSync gjør ekstra kjøringer
-- trygge (kjent dataVersion hoppes over).

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
  ) as stale_running_locks;

grant select on public.ofv_sync_health to authenticated;

create or replace function public.cleanup_stale_sync_locks()
returns int
language sql
security definer
set search_path = public
as $$
  with upd as (
    update public.sync_logs
    set status = 'failed',
        completed_at = now(),
        error_message = coalesce(
          error_message,
          'Automatisk markert feilet: lås eldre enn 30 min uten fullføring'
        )
    where status = 'running'
      and started_at < now() - interval '30 minutes'
    returning 1
  )
  select count(*)::int from upd;
$$;

revoke all on function public.cleanup_stale_sync_locks() from public, anon, authenticated;

create or replace function public.ofv_sync_watchdog()
returns void
language plpgsql
security definer
set search_path = public, net, vault
as $$
declare
  v_last timestamptz;
begin
  perform public.cleanup_stale_sync_locks();

  select max(completed_at) into v_last
  from public.sync_logs
  where sync_type in ('full', 'registrations') and status = 'completed';

  -- Ingen vellykket synk siste 20 timer → trigger en full synk som sikkerhetsnett.
  if v_last is null or v_last < now() - interval '20 hours' then
    perform public.trigger_ofv_sync('full');
  end if;
end;
$$;

revoke all on function public.ofv_sync_watchdog() from public, anon, authenticated;

-- Rydd bort en gammel hengende 'running'-lås fra 2026-07-02 (dokumentert i sync_logs).
select public.cleanup_stale_sync_locks();

select cron.unschedule('ofv-sync-watchdog')
where exists (select 1 from cron.job where jobname = 'ofv-sync-watchdog');

select cron.schedule(
  'ofv-sync-watchdog',
  '30 */4 * * *',
  $$select public.ofv_sync_watchdog();$$
);
