-- Ukentlig SSB-synk via pg_cron + pg_net (samme mønster som OFV-synk).
-- Erstatter Netlify scheduled function scheduled-ssb-sync.

create or replace function public.trigger_ssb_sync()
returns bigint
language plpgsql
security definer
set search_path = public, net, vault
as $$
declare
  v_secret text;
  v_request_id bigint;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'ofv_sync_secret';

  if v_secret is null then
    raise exception 'Vault-hemmelighet ofv_sync_secret mangler';
  end if;

  select net.http_post(
    url := 'https://volvo-ofv.netlify.app/.netlify/functions/ssb-sync-background',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    timeout_milliseconds := 15000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.trigger_ssb_sync() from public;
revoke all on function public.trigger_ssb_sync() from anon, authenticated;

select cron.unschedule('ssb-weekly-sync')
where exists (select 1 from cron.job where jobname = 'ssb-weekly-sync');

-- Mandag 06:00 UTC – SSB publiserer kvartalsdata med noe forsinkelse.
select cron.schedule(
  'ssb-weekly-sync',
  '0 6 * * 1',
  $$select public.trigger_ssb_sync();$$
);
