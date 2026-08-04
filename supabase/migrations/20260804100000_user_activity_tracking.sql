-- Bruksstatistikk: siste aktivitet + sidebesøk (90 dagers retention).
-- Kun super/admin kan lese. Brukere kan bare skrive egen aktivitet via RPC.

create table public.user_activity (
  user_id uuid primary key,
  last_path text not null,
  last_seen_at timestamptz not null default now(),
  visit_count integer not null default 1 check (visit_count >= 0)
);

create index user_activity_last_seen_at_idx
  on public.user_activity (last_seen_at desc);

create table public.user_page_visits (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  path text not null,
  visited_at timestamptz not null default now()
);

create index user_page_visits_user_visited_idx
  on public.user_page_visits (user_id, visited_at desc);

create index user_page_visits_visited_at_idx
  on public.user_page_visits (visited_at);

alter table public.user_activity enable row level security;
alter table public.user_page_visits enable row level security;

-- Kun super (og legacy JWT-rolle admin) kan lese.
create policy "Super can read user activity"
  on public.user_activity for select to authenticated
  using (public.jwt_app_role() in ('super', 'admin'));

create policy "Super can read user page visits"
  on public.user_page_visits for select to authenticated
  using (public.jwt_app_role() in ('super', 'admin'));

-- Ingen direkte INSERT/UPDATE for authenticated – kun via RPC.

create or replace function public.record_page_visit(p_path text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_path text;
  v_throttled boolean;
begin
  if v_uid is null then
    return false;
  end if;

  v_path := left(coalesce(nullif(trim(p_path), ''), '/'), 200);

  -- Ignorer API/auth/statiske stier.
  if v_path like '/api/%'
     or v_path like '/auth/%'
     or v_path like '/_next/%' then
    return false;
  end if;

  select exists (
    select 1
    from public.user_activity ua
    where ua.user_id = v_uid
      and ua.last_seen_at > now() - interval '5 minutes'
  ) into v_throttled;

  if v_throttled then
    return false;
  end if;

  insert into public.user_activity as ua (user_id, last_path, last_seen_at, visit_count)
  values (v_uid, v_path, now(), 1)
  on conflict (user_id) do update
    set last_path = excluded.last_path,
        last_seen_at = excluded.last_seen_at,
        visit_count = ua.visit_count + 1;

  insert into public.user_page_visits (user_id, path, visited_at)
  values (v_uid, v_path, now());

  -- Opportunistisk retention (maks 200 rader per kall).
  delete from public.user_page_visits
  where id in (
    select id
    from public.user_page_visits
    where visited_at < now() - interval '90 days'
    order by visited_at
    limit 200
  );

  return true;
end;
$$;

revoke all on function public.record_page_visit(text) from public;
grant execute on function public.record_page_visit(text) to authenticated;
