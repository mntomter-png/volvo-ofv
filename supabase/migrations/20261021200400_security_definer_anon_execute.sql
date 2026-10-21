-- Advisor: SECURITY DEFINER-funksjoner som er kallbare uten innlogging.
--
-- Postgres gir EXECUTE til PUBLIC som standard, og Supabase sine default
-- privileges gir i tillegg anon (og authenticated/service_role). GRANT til
-- authenticated fjerner ingen av de to. Revoke fra PUBLIC alene lar også
-- anons eksplisitte grant stå igjen — det er tilfellet for record_page_visit,
-- som allerede revoket PUBLIC i 20260804100000.
--
-- Appen kaller disse med innlogget sesjon (createClient → authenticated):
--   record_page_visit          src/lib/auth/track-activity.ts
--   reg_potential_profile      src/lib/registrations/potential-queries.ts
--   reg_potential_list         src/lib/registrations/potential-queries.ts
--   reg_potential_party_detail src/lib/registrations/potential-actions.ts
--   replace_fleet_vins         src/lib/fleet/actions.ts
-- authenticated beholder derfor EXECUTE. Funksjonene sjekker selv rolle/jwt.
--
-- rls_auto_enable() er en plattform-funksjon (event trigger), ikke opprettet
-- i dette repoet. Den skal ikke være kallbar via API for anon eller
-- authenticated. Selve event-triggeren røres ikke.

revoke all on function public.record_page_visit(text) from public, anon;
grant execute on function public.record_page_visit(text) to authenticated;

revoke all on function public.reg_potential_profile(
  int, text, int, text, int, text, text, int, text, int, date, date, text, numeric, int
) from public, anon;
grant execute on function public.reg_potential_profile(
  int, text, int, text, int, text, text, int, text, int, date, date, text, numeric, int
) to authenticated;

revoke all on function public.reg_potential_list(
  int, text, int, text, int, text, text, int, text, int, date, date, int, boolean, text, text, numeric, int
) from public, anon;
grant execute on function public.reg_potential_list(
  int, text, int, text, int, text, text, int, text, int, date, date, int, boolean, text, text, numeric, int
) to authenticated;

revoke all on function public.reg_potential_party_detail(text, text, int, text)
  from public, anon;
grant execute on function public.reg_potential_party_detail(text, text, int, text)
  to authenticated;

revoke all on function public.replace_fleet_vins(text[], text) from public, anon;
grant execute on function public.replace_fleet_vins(text[], text) to authenticated;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is null then
    raise notice 'public.rls_auto_enable() finnes ikke her — hopper over revoke';
    return;
  end if;

  revoke all on function public.rls_auto_enable() from public, anon, authenticated;
end $$;

-- Rester i prod som ikke refereres noe sted i repoet.
-- Funksjonssignaturen ligger ikke i migrasjonene, så alle eventuelle
-- overloads droppes. IF EXISTS / tom løkke gjør steget ufarlig der de
-- allerede er borte.
drop table if exists public.schema_migrations_backup_20260918;

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'ofv_pabygg_segment_test_tmp'
  loop
    execute format('drop function if exists %s', r.sig);
  end loop;
end $$;

do $$
declare
  fn text;
  app_fns text[] := array[
    'public.record_page_visit(text)',
    'public.reg_potential_profile(int, text, int, text, int, text, text, int, text, int, date, date, text, numeric, int)',
    'public.reg_potential_list(int, text, int, text, int, text, text, int, text, int, date, date, int, boolean, text, text, numeric, int)',
    'public.reg_potential_party_detail(text, text, int, text)',
    'public.replace_fleet_vins(text[], text)'
  ];
begin
  foreach fn in array app_fns loop
    if has_function_privilege('anon', fn, 'execute') then
      raise exception '% er fortsatt kjørbar for anon', fn;
    end if;
    if has_function_privilege('public', fn, 'execute') then
      raise exception '% har fortsatt EXECUTE for PUBLIC', fn;
    end if;
    if not has_function_privilege('authenticated', fn, 'execute') then
      raise exception '% mangler EXECUTE for authenticated', fn;
    end if;
  end loop;

  if to_regprocedure('public.rls_auto_enable()') is not null then
    if has_function_privilege('anon', 'public.rls_auto_enable()', 'execute')
       or has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute')
       or has_function_privilege('public', 'public.rls_auto_enable()', 'execute') then
      raise exception 'rls_auto_enable er fortsatt kjørbar for anon, authenticated eller PUBLIC';
    end if;
  end if;
end $$;
