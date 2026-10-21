-- App-laget tillater kun super å erstatte fleet-VIN-registeret
-- (canManageFleetVins / assertFleetManager). RLS speilet leder — lukk gapet.

create or replace function public.jwt_can_manage_fleet_vins()
returns boolean
language sql
stable
as $$
  select public.jwt_app_role() = 'super';
$$;

comment on function public.jwt_can_manage_fleet_vins() is
  'Kun super kan kalle replace_fleet_vins. Speiler canManageFleetVins().';

drop policy if exists "Leder read fleet vin uploads" on public.fleet_vin_uploads;
create policy "Super read fleet vin uploads"
  on public.fleet_vin_uploads for select to authenticated
  using (public.jwt_app_role() = 'super');

-- Snapshot-funksjonen kalles fra OFV-synk med service_role. Authenticated
-- har ingen INSERT-policy, så GRANT var død kode og et unødvendig angrepsflate.
revoke execute on function public.tmf_capture_renewal_snapshot(date, date, text, int)
  from authenticated;
