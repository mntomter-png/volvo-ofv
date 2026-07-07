-- Pålitelig cron for OFV-synk via Supabase pg_cron + pg_net.
--
-- Bakgrunn: Netlify scheduled functions (netlify/functions/scheduled-sync.mts)
-- trigget aldri en synk i produksjon (ingen synk på cron-tidene i sync_logs).
-- Vi flytter derfor triggeren inn i databasen, som er fullt observerbar via
-- cron.job_run_details og net._http_response. Selve synken kjører fortsatt i
-- Netlify background-funksjonen `ofv-sync-background` (håndterer 15 min runtime).
--
-- SYNC_SECRET ligger kryptert i Vault (vault.secrets, navn = 'ofv_sync_secret')
-- og injiseres i Authorization-headeren ved kjøretid – aldri i klartekst her.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.trigger_ofv_sync(p_scope text default 'full')
returns bigint
language plpgsql
security definer
set search_path = public, net, vault
as $$
declare
  v_secret text;
  v_request_id bigint;
begin
  if p_scope not in ('full', 'registrations', 'population') then
    raise exception 'Ugyldig scope: %', p_scope;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'ofv_sync_secret';

  if v_secret is null then
    raise exception 'Vault-hemmelighet ofv_sync_secret mangler';
  end if;

  select net.http_post(
    -- Bruk det kanoniske netlify.app-domenet (alltid løsbart tjeneste-til-tjeneste).
    -- Det egendefinerte domenet app.biloversikt.com løses ikke fra pg_net/eksternt.
    url := 'https://volvo-ofv.netlify.app/.netlify/functions/ofv-sync-background',
    body := jsonb_build_object('scope', p_scope),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    timeout_milliseconds := 15000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.trigger_ofv_sync(text) from public;
revoke all on function public.trigger_ofv_sync(text) from anon, authenticated;

-- Kjør daglig 10:00 og 14:00 UTC (12:00/16:00 norsk sommertid). Andre kjøring er
-- en sikkerhetsmargin hvis OFV ikke har publisert ny dataVersion ved første forsøk.
-- Versjonskontrollen i runOfvSync gjør dobbel kjøring trygg (hopper over kjent versjon).
select cron.unschedule('ofv-daily-sync-primary')
where exists (select 1 from cron.job where jobname = 'ofv-daily-sync-primary');
select cron.unschedule('ofv-daily-sync-backup')
where exists (select 1 from cron.job where jobname = 'ofv-daily-sync-backup');

select cron.schedule(
  'ofv-daily-sync-primary',
  '0 10 * * *',
  $$select public.trigger_ofv_sync('full');$$
);

select cron.schedule(
  'ofv-daily-sync-backup',
  '0 14 * * *',
  $$select public.trigger_ofv_sync('full');$$
);
