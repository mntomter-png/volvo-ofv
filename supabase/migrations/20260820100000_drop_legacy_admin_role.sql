-- Fjern legacy JWT-rolle 'admin' fra RLS-hjelpere og policies.
-- Brukere med role=admin er migrert til super (scripts/migrate-admin-role.ts).

create or replace function public.jwt_can_read_registrations()
returns boolean
language sql
stable
as $$
  select public.jwt_app_role() in ('salg', 'leder', 'super');
$$;

create or replace function public.jwt_can_read_population()
returns boolean
language sql
stable
as $$
  select public.jwt_app_role() in ('service', 'pkk', 'leder', 'super');
$$;

create or replace function public.jwt_can_read_sync_logs()
returns boolean
language sql
stable
as $$
  select public.jwt_app_role() in ('leder', 'super');
$$;

create or replace function public.jwt_can_read_ssb_indicators()
returns boolean
language sql
stable
as $$
  select public.jwt_app_role() in ('leder', 'super');
$$;

create or replace function public.jwt_can_manage_fleet_vins()
returns boolean
language sql
stable
as $$
  select public.jwt_app_role() in ('leder', 'super');
$$;

drop policy if exists "Super can read admin audit log" on public.admin_audit_log;
create policy "Super can read admin audit log"
  on public.admin_audit_log for select to authenticated
  using (public.jwt_app_role() = 'super');

drop policy if exists "Super can read user activity" on public.user_activity;
create policy "Super can read user activity"
  on public.user_activity for select to authenticated
  using (public.jwt_app_role() = 'super');

drop policy if exists "Super can read user page visits" on public.user_page_visits;
create policy "Super can read user page visits"
  on public.user_page_visits for select to authenticated
  using (public.jwt_app_role() = 'super');

drop policy if exists "Leder read fleet vin uploads" on public.fleet_vin_uploads;
create policy "Leder read fleet vin uploads"
  on public.fleet_vin_uploads for select to authenticated
  using (public.jwt_app_role() in ('leder', 'super'));
