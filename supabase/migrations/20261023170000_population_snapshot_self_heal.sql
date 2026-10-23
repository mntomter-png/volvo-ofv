-- Selvhelende opprydding av population-snapshots.
--
-- Prod (okt 2026): upsert mot public.population feiler stabilt rundt
-- 12,5–13k rader med "canceling statement due to statement timeout".
-- authenticator har statement_timeout=8s og lock_timeout=8s. service_role
-- har ingen rolconfig, og SET ROLE kopierer ikke rolconfig, så PostgREST
-- beholder authenticator sitt tak. postgres sin konfigurasjon (120s) gjelder
-- ikke API-kall.
--
-- GIN-indeksene på eier-/brukernavn har fastupdate på (default) og
-- gin_pending_list_limit 4MB. Etter ~12–13k rader flusher neste upsert
-- pending-lista inn i en stor trigram-indeks og sprenger 8s. Når flere
-- snapshots har hopet seg opp (~65k rader hver) blir flushen dyrere.
-- pruneOldPopulationSnapshots kjørte bare etter vellykket upsert og
-- logget feil kun til konsollet, så tabellen kunne ikke komme seg igjen.
--
-- Vi hever ikke statement_timeout på service_role: det ville ikke nå
-- API-kallene, og et høyere tak på authenticator gjelder også anon og
-- authenticated.
--
-- Denne migrasjonen er ikke kjørt mot prod av agenten. Kjør den når ingen
-- synk holder skrivelåser (manuell opprydding kan ellers få lock_timeout).

-- Bare denne migrasjonstransaksjonen. Pending-list-flush kan ta mer enn
-- postgres sin vanlige 120s når tabellen fortsatt er stor.
set local statement_timeout = '10min';
set local lock_timeout = '2min';

-- Forutsigbar skrivetid: hver rad oppdaterer hovedindeksen med en gang,
-- i stedet for en sjelden flush som varer lenger enn 8s. Lesing blir
-- heller litt raskere (ingen pending-liste å scanne).
alter index public.population_primary_owner_name_trgm_idx
  set (fastupdate = off);
alter index public.population_primary_user_name_trgm_idx
  set (fastupdate = off);

-- Tøm eventuell pending-liste nå, som postgres. Første upsert etterpå
-- skal ikke selv måtte flushe den under 8s-taket.
do $$
begin
  perform gin_clean_pending_list('public.population_primary_owner_name_trgm_idx'::regclass);
  perform gin_clean_pending_list('public.population_primary_user_name_trgm_idx'::regclass);
end $$;

-- Sletter rader i snapshots eldre enn nyeste komplette bestand.
-- Nyere ufullstendige snapshots (færre enn p_min_rows) røres ikke; de
-- tas av prune_incomplete_population_snapshots.
-- Returnerer antall slettede rader. Hele kallet er én transaksjon, så
-- kalleren (synken) looper med kort p_max_seconds og commiter mellom.
-- set_config er lokal for transaksjonen og hever authenticator sitt 8s-tak
-- bare for dette kallet (samme mønster som reg_potential_*).
create or replace function public.prune_surplus_population_snapshots(
  p_min_rows int default 55000,
  p_max_seconds int default 45
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min_rows int;
  v_budget int;
  v_keep date;
  v_old date;
  v_deadline timestamptz;
  v_batch int;
  v_total int := 0;
begin
  v_min_rows := case
    when p_min_rows is null or p_min_rows < 1000 then 55000
    else p_min_rows
  end;
  -- 15s margin så siste batch rekker å bli ferdig innen statement_timeout.
  v_budget := least(greatest(coalesce(p_max_seconds, 45), 20), 90);

  perform set_config('statement_timeout', v_budget || 's', true);

  select snapshots.snapshot_date
    into v_keep
  from (
    select snapshot_date, count(*) as n
    from public.population
    group by snapshot_date
  ) snapshots
  where snapshots.n >= v_min_rows
  order by snapshots.snapshot_date desc
  limit 1;

  if v_keep is not null then
    v_deadline := clock_timestamp()
      + make_interval(secs => greatest(v_budget - 15, 1));

    loop
      exit when clock_timestamp() >= v_deadline;

      -- Eldste versjon først, uten å sortere hele tabellen.
      select min(snapshot_date)
        into v_old
      from public.population
      where snapshot_date < v_keep;

      exit when v_old is null;

      with doomed as (
        select id
        from public.population
        where snapshot_date = v_old
        limit 250
      )
      delete from public.population p
      using doomed d
      where p.id = d.id;

      get diagnostics v_batch = row_count;
      v_total := v_total + v_batch;
      exit when v_batch = 0;
    end loop;
  end if;

  -- Vellykket kall kvitterer ut tidligere feil. Flere gjenstående
  -- versjoner varsles via ofv_sync_health.population_snapshot_count.
  update public.sync_logs
  set metadata = metadata || jsonb_build_object('resolved', true)
  where metadata->>'kind' = 'population_prune'
    and status = 'failed'
    and coalesce(metadata->>'resolved', 'false') <> 'true';

  return v_total;
end;
$$;

comment on function public.prune_surplus_population_snapshots(int, int) is
  'Sletter population-rader eldre enn nyeste komplette snapshot, i batches. Bare service_role.';

revoke all on function public.prune_surplus_population_snapshots(int, int)
  from public, anon, authenticated;
grant execute on function public.prune_surplus_population_snapshots(int, int)
  to service_role;

do $$
declare
  fn text := 'public.prune_surplus_population_snapshots(int, int)';
begin
  if has_function_privilege('anon', fn, 'execute') then
    raise exception '% er fortsatt kjørbar for anon', fn;
  end if;
  if has_function_privilege('authenticated', fn, 'execute') then
    raise exception '% er fortsatt kjørbar for authenticated', fn;
  end if;
  if has_function_privilege('public', fn, 'execute') then
    raise exception '% har fortsatt EXECUTE for PUBLIC', fn;
  end if;
  if not has_function_privilege('service_role', fn, 'execute') then
    raise exception '% mangler EXECUTE for service_role', fn;
  end if;
end $$;

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
  ) as population_prune_error;

grant select on public.ofv_sync_health to authenticated;

create or replace function public.ofv_sync_watchdog()
returns void
language plpgsql
security definer
set search_path = public, net, vault
as $$
declare
  v_last timestamptz;
  v_pruned int := 0;
  v_deleted int := 0;
  v_snaps int := 0;
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

  begin
    v_pruned := public.prune_incomplete_population_snapshots(55000);
    v_deleted := public.prune_surplus_population_snapshots(55000, 90);
  exception
    when others then
      insert into public.sync_logs (
        sync_type,
        status,
        completed_at,
        records_fetched,
        records_upserted,
        error_message,
        metadata
      ) values (
        'population',
        'failed',
        now(),
        0,
        0,
        left('Populasjonsopprydding: ' || sqlerrm, 500),
        jsonb_build_object('kind', 'population_prune')
      );
      return;
  end;

  select count(*)::int into v_snaps
  from (
    select snapshot_date
    from public.population
    group by snapshot_date
  ) snapshots;

  -- Ikke legg en ny synk oppå en tabell vi fortsatt slanker. Neste kjøring
  -- fortsetter slettingen. UI leser fortsatt nyeste komplette snapshot.
  if v_deleted > 0 and v_snaps > 1 then
    raise notice
      'Utsetter OFV-synk: % bestandsversjoner igjen etter sletting av % rader',
      v_snaps,
      v_deleted;
    return;
  end if;

  if v_pruned > 0 then
    perform public.trigger_ofv_sync('full');
    return;
  end if;

  select count(*) into v_latest_rows
  from public.population p
  where p.snapshot_date = (select max(snapshot_date) from public.population);

  if v_latest_rows is null or v_latest_rows < 55000 then
    perform public.trigger_ofv_sync('full');
    return;
  end if;

  select max(completed_at) into v_last
  from public.sync_logs
  where sync_type in ('full', 'registrations') and status = 'completed';

  if v_last is null or v_last < now() - interval '20 hours' then
    perform public.trigger_ofv_sync('full');
  end if;
end;
$$;

revoke all on function public.ofv_sync_watchdog() from public, anon, authenticated;
