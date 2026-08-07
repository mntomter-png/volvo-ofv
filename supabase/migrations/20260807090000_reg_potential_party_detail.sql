-- Potensial: flåte-/segmentdetalj for én bruker (klikk i handlingsliste).
-- SECURITY DEFINER: unngå RLS-kost på filtrert party-key-oppslag.

create or replace function public.reg_potential_party_detail(
  p_party_key text,
  p_customer_party text default 'user',
  p_lookback_years int default 10,
  p_focus_make text default 'Volvo'
)
returns table(
  section text,
  name text,
  count int,
  focus_count int
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_lookback timestamp;
begin
  if p_party_key is null or length(trim(p_party_key)) = 0 then
    return;
  end if;

  if not public.jwt_can_read_registrations() then
    raise exception 'Ikke tilgang til registreringer' using errcode = '42501';
  end if;

  perform set_config('statement_timeout', '15s', true);
  v_lookback := (current_date - make_interval(years => greatest(p_lookback_years, 1)))::timestamp;

  return query
  with scoped as materialized (
    select
      r.make_name,
      coalesce(r.bodywork_code, -1) as bodywork_code,
      coalesce(
        nullif(r.bodywork_name, ''),
        case
          when r.bodywork_code is null then 'Uten påbygg'
          else 'Kode ' || r.bodywork_code::text
        end
      ) as bodywork_name,
      coalesce(nullif(r.pabygg_segment, ''), 'Annet') as pabygg_segment
    from public.registrations r
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and r.transaction_time >= v_lookback
      and (
        case
          when coalesce(p_customer_party, 'user') = 'owner' then
            coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name)
          else
            coalesce(nullif(r.primary_user_orgnr, ''), r.primary_user_name)
        end
      ) = p_party_key
  ),
  by_make as (
    select
      'make'::text as section,
      s.make_name as name,
      count(*)::int as count,
      count(*) filter (where s.make_name = p_focus_make)::int as focus_count
    from scoped s
    where s.make_name is not null
    group by s.make_name
  ),
  by_bodywork as (
    select
      'bodywork'::text as section,
      s.bodywork_name as name,
      count(*)::int as count,
      count(*) filter (where s.make_name = p_focus_make)::int as focus_count
    from scoped s
    group by s.bodywork_code, s.bodywork_name
  ),
  by_pabygg as (
    select
      'pabygg'::text as section,
      s.pabygg_segment as name,
      count(*)::int as count,
      count(*) filter (where s.make_name = p_focus_make)::int as focus_count
    from scoped s
    group by s.pabygg_segment
  )
  select b.section, b.name, b.count, b.focus_count
  from (
    select * from by_make
    union all
    select * from by_bodywork
    union all
    select * from by_pabygg
  ) b
  order by
    case b.section
      when 'make' then 1
      when 'pabygg' then 2
      else 3
    end,
    b.count desc,
    b.name;
end;
$$;

grant execute on function public.reg_potential_party_detail(text, text, int, text)
  to authenticated;

notify pgrst, 'reload schema';
