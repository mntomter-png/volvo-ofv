-- Forslagsliste til eier/bruker-søket.
--
-- Fritekstsøket er kraftig, men gir ingen hjelp til å formulere treffet: søker
-- du «as» får du 40 000 kjøretøy, altså i praksis hele markedet. Her kommer
-- RPC-ene bak autocomplete, som lar selgeren velge en konkret kunde i stedet.
--
-- Forslagene grupperes på navn, ikke på (navn, org.nr.), fordi det er navnet
-- som havner i `?q=` når brukeren velger et forslag. Da matcher tallet i
-- forslaget det siden faktisk viser etterpå. Org.nr. returneres bare når
-- navnet har ett entydig nummer – ellers ville vi vise et tilfeldig av flere.
--
-- Søkepredikatet er identisk med summary-funksjonene (se migrasjonen
-- `owner_user_search_rpc`) og skrives ut inline, slik at planleggeren ser
-- ILIKE-uttrykket og kan bruke trigram-indeksene. Ikke sett `search_path` på
-- funksjonen: det hindrer inlining, og da faller kallet ned på en generisk
-- plan som er ~10× treigere enn den inlinede BitmapOr-planen.

-- ---------------------------------------------------------------------------
-- registrations
-- ---------------------------------------------------------------------------

create or replace function public.reg_customer_suggestions(
  p_q text,
  p_year int default null,
  p_from date default null,
  p_to date default null,
  p_focus_make text default 'Volvo',
  p_limit int default 8
)
returns table(name text, orgnr text, vehicle_count int, focus_count int)
language sql
stable
security invoker
as $$
  with scoped as (
    select id, primary_owner_name, primary_owner_orgnr,
           primary_user_name, primary_user_orgnr, make_name
    from public.registrations
    where transaction_type_id = '10'
      and maximum_laden_mass_kg >= 16000
      and p_q is not null
      and char_length(p_q) >= 2
      and (p_from is not null or p_to is not null or p_year is null
           or extract(year from transaction_time) = p_year)
      and (p_from is null or transaction_time >= p_from)
      and (p_to is null or transaction_time < (p_to + 1))
      and (
        primary_owner_name ilike '%' || p_q || '%'
        or primary_user_name ilike '%' || p_q || '%'
        or (p_q ~ '^[0-9]{3,}$' and (
          primary_owner_orgnr like p_q || '%'
          or primary_user_orgnr like p_q || '%'
        ))
      )
  ),
  -- Eier- og brukersiden slås sammen. Er samme selskap begge, dukker kjøretøyet
  -- opp på begge sider, og `union` (ikke `union all`) sørger for at det telles
  -- én gang. Dedupliseringen her er billigere enn count(distinct) per gruppe.
  parties as (
    select id, primary_owner_name as name, primary_owner_orgnr as orgnr, make_name
    from scoped
    where primary_owner_name ilike '%' || p_q || '%'
       or (p_q ~ '^[0-9]{3,}$' and primary_owner_orgnr like p_q || '%')
    union
    select id, primary_user_name as name, primary_user_orgnr as orgnr, make_name
    from scoped
    where primary_user_name ilike '%' || p_q || '%'
       or (p_q ~ '^[0-9]{3,}$' and primary_user_orgnr like p_q || '%')
  )
  select
    name,
    case when count(distinct orgnr) = 1 then min(orgnr) end as orgnr,
    count(*)::int as vehicle_count,
    count(*) filter (where make_name = p_focus_make)::int as focus_count
  from parties
  where name is not null
  group by name
  -- Flåtestørrelse først: en selger vil se sin største kunde øverst. Prefiks er
  -- bare en tiebreaker – ellers havner «Posten Bring Bildrift» med 38 kjøretøy
  -- under navn som bare har ett, fordi de tilfeldigvis starter med søkeordet.
  order by count(*) desc, (name ilike p_q || '%') desc, name
  limit least(greatest(coalesce(p_limit, 8), 1), 25);
$$;

-- ---------------------------------------------------------------------------
-- population
-- ---------------------------------------------------------------------------

create or replace function public.pop_customer_suggestions(
  p_q text,
  p_focus_make text default 'Volvo',
  p_limit int default 8
)
returns table(name text, orgnr text, vehicle_count int, focus_count int)
language sql
stable
security invoker
as $$
  with scoped as (
    select id, primary_owner_name, primary_owner_orgnr,
           primary_user_name, primary_user_orgnr, make_name
    from public.population
    where snapshot_date = (select max(snapshot_date) from public.population)
      and maximum_laden_mass_kg >= 16000
      and p_q is not null
      and char_length(p_q) >= 2
      and (
        primary_owner_name ilike '%' || p_q || '%'
        or primary_user_name ilike '%' || p_q || '%'
        or (p_q ~ '^[0-9]{3,}$' and (
          primary_owner_orgnr like p_q || '%'
          or primary_user_orgnr like p_q || '%'
        ))
      )
  ),
  parties as (
    select id, primary_owner_name as name, primary_owner_orgnr as orgnr, make_name
    from scoped
    where primary_owner_name ilike '%' || p_q || '%'
       or (p_q ~ '^[0-9]{3,}$' and primary_owner_orgnr like p_q || '%')
    union
    select id, primary_user_name as name, primary_user_orgnr as orgnr, make_name
    from scoped
    where primary_user_name ilike '%' || p_q || '%'
       or (p_q ~ '^[0-9]{3,}$' and primary_user_orgnr like p_q || '%')
  )
  select
    name,
    case when count(distinct orgnr) = 1 then min(orgnr) end as orgnr,
    count(*)::int as vehicle_count,
    count(*) filter (where make_name = p_focus_make)::int as focus_count
  from parties
  where name is not null
  group by name
  order by count(*) desc, (name ilike p_q || '%') desc, name
  limit least(greatest(coalesce(p_limit, 8), 1), 25);
$$;

grant execute on function public.reg_customer_suggestions(
  text, int, date, date, text, int
) to authenticated, service_role;

grant execute on function public.pop_customer_suggestions(
  text, text, int
) to authenticated, service_role;
