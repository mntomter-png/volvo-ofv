-- M3 i databasen: tom/ukjent rolle skal ikke default'e til 'salg'.
-- Speiler resolveRole() i src/lib/auth/role-config.ts (fail closed).

create or replace function public.jwt_app_role()
returns text
language sql
stable
as $$
  select nullif(auth.jwt()->'app_metadata'->>'role', '');
$$;

comment on function public.jwt_app_role() is
  'JWT app_metadata.role uten default. Tom/null → ingen RLS-tilgang (fail closed).';
