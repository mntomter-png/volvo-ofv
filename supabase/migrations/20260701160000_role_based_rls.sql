-- Rollebasert RLS: begrens tilgang til OFV-data etter app_metadata.role i JWT.
-- Speiler ROLE_PAGES i src/lib/auth/role-config.ts.

create or replace function public.jwt_app_role()
returns text
language sql
stable
as $$
  select coalesce(nullif(auth.jwt()->'app_metadata'->>'role', ''), 'salg');
$$;

create or replace function public.jwt_can_read_registrations()
returns boolean
language sql
stable
as $$
  select public.jwt_app_role() in ('salg', 'leder', 'super', 'admin');
$$;

create or replace function public.jwt_can_read_population()
returns boolean
language sql
stable
as $$
  select public.jwt_app_role() in ('service', 'pkk', 'leder', 'super', 'admin');
$$;

create or replace function public.jwt_can_read_sync_logs()
returns boolean
language sql
stable
as $$
  select public.jwt_app_role() in ('leder', 'super', 'admin');
$$;

drop policy if exists "Authenticated users can read registrations" on public.registrations;
drop policy if exists "Authenticated users can read population" on public.population;
drop policy if exists "Authenticated users can read sync logs" on public.sync_logs;

create policy "Role-based read registrations"
  on public.registrations for select to authenticated
  using (public.jwt_can_read_registrations());

create policy "Role-based read population"
  on public.population for select to authenticated
  using (public.jwt_can_read_population());

create policy "Role-based read sync logs"
  on public.sync_logs for select to authenticated
  using (public.jwt_can_read_sync_logs());

grant execute on function public.jwt_app_role() to authenticated;
grant execute on function public.jwt_can_read_registrations() to authenticated;
grant execute on function public.jwt_can_read_population() to authenticated;
grant execute on function public.jwt_can_read_sync_logs() to authenticated;
