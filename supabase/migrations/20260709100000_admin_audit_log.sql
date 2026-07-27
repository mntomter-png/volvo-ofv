-- Varig audit-logg for super-admin-handlinger (brukeropprettelse, rolle, sletting).

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text not null,
  target_user_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);
create index admin_audit_log_actor_id_idx on public.admin_audit_log (actor_id);

alter table public.admin_audit_log enable row level security;

create policy "Super can read admin audit log"
  on public.admin_audit_log for select to authenticated
  using (public.jwt_app_role() in ('super', 'admin'));

-- Innsats skjer kun via service role fra server actions (ingen authenticated insert-policy).
