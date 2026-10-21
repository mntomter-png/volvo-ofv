-- Lukk EXECUTE på tmf_capture_renewal_snapshot til eier og service_role.
--
-- 20261019090000 revoket bare fra authenticated. Det lot PUBLIC (=X) og
-- anon stå igjen. PUBLIC gjelder også authenticated, så funksjonen var
-- fortsatt kallbar uten service_role. Produksjons-ACL etter den migrasjonen:
--   {=X/postgres,postgres=X/postgres,anon=X/postgres,service_role=X/postgres}
--
-- OFV-synk kaller funksjonen med service_role (createAdminClient i
-- src/lib/tmf/renewal-snapshot.ts). Funksjonen er security invoker, og
-- service_role har allerede INSERT på tmf_renewal_snapshots.
--
-- tmf_renewal_pool fra samme fornyelsesløp er ikke tatt med. TMF-siden
-- kaller den med brukerens sesjon (createClient), så authenticated skal
-- beholde EXECUTE der.

revoke all on function public.tmf_capture_renewal_snapshot(date, date, text, int)
  from public, anon, authenticated;

grant execute on function public.tmf_capture_renewal_snapshot(date, date, text, int)
  to postgres, service_role;

comment on function public.tmf_capture_renewal_snapshot(date, date, text, int) is
  'Lagrer maanedlig fornyelsesaggregat fra siste OFV-populasjon. EXECUTE kun for postgres og service_role (OFV-synk).';

do $$
declare
  v_bad text;
  v_missing text;
begin
  select string_agg(grantee, ', ' order by grantee)
    into v_bad
  from (
    select case when e.grantee = 0 then 'PUBLIC' else r.rolname end as grantee
    from pg_proc p
    cross join lateral aclexplode(p.proacl) as e
    left join pg_roles r on r.oid = e.grantee
    where p.oid = 'public.tmf_capture_renewal_snapshot(date, date, text, int)'::regprocedure
      and e.privilege_type = 'EXECUTE'
      and (
        e.grantee = 0
        or r.rolname is null
        or r.rolname not in ('postgres', 'service_role')
      )
  ) unexpected;

  if v_bad is not null then
    raise exception
      'tmf_capture_renewal_snapshot har EXECUTE for %; kun postgres og service_role er tillatt',
      v_bad;
  end if;

  select string_agg(required, ', ' order by required)
    into v_missing
  from (
    select required
    from (values ('postgres'), ('service_role')) as req(required)
    where not exists (
      select 1
      from pg_proc p
      cross join lateral aclexplode(p.proacl) as e
      join pg_roles r on r.oid = e.grantee
      where p.oid = 'public.tmf_capture_renewal_snapshot(date, date, text, int)'::regprocedure
        and e.privilege_type = 'EXECUTE'
        and r.rolname = required
    )
  ) missing;

  if v_missing is not null then
    raise exception
      'tmf_capture_renewal_snapshot mangler EXECUTE for %',
      v_missing;
  end if;
end $$;
