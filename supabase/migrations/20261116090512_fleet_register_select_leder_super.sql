-- Fleet-registeret var SELECT using (true) for alle innloggede.
-- Appen viser listen bare for leder/super (roleCanUseFleetRegionFilter).
-- service/pkk kan ikke lese registrations, men kunne dumpes VIN/chassis.
-- EXISTS i security-invoker-RPC-er fortsetter å virke for leder/super.

drop policy if exists "Authenticated read fleet vins" on public.fleet_vins;
create policy "Leder read fleet vins"
  on public.fleet_vins
  for select
  to authenticated
  using ((select public.jwt_app_role()) in ('leder', 'super'));

drop policy if exists "Authenticated read fleet chassis" on public.fleet_chassis;
create policy "Leder read fleet chassis"
  on public.fleet_chassis
  for select
  to authenticated
  using ((select public.jwt_app_role()) in ('leder', 'super'));

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('fleet_vins', 'fleet_chassis')
      and cmd = 'SELECT'
      and qual = 'true'
  ) then
    raise exception 'fleet_vins/fleet_chassis har fortsatt SELECT using (true)';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'fleet_vins'
      and policyname = 'Leder read fleet vins'
      and cmd = 'SELECT'
      and qual like '%jwt_app_role%'
      and qual like '%leder%'
  ) then
    raise exception 'Leder read fleet vins mangler eller speiler ikke leder/super';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'fleet_chassis'
      and policyname = 'Leder read fleet chassis'
      and cmd = 'SELECT'
      and qual like '%jwt_app_role%'
      and qual like '%leder%'
  ) then
    raise exception 'Leder read fleet chassis mangler eller speiler ikke leder/super';
  end if;
end $$;
