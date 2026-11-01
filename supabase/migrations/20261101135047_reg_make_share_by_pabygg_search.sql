-- Eier/bruker-søk på konkurrentandelen per påbygg.
--
-- Marked-fanen viser merkenes andel per segment fra reg_make_share_by_pabygg.
-- De andre fordelingskortene følger ?q= via p_q. Denne funksjonen gjorde det
-- ikke, så søk på fanen ville vist hele markedet. Parameteren legges sist med
-- default null, så eksisterende kall uten p_q fortsatt treffer.
--
-- Predikatet er det samme som i reg_summary_by_pabygg og er skrevet ut inline,
-- slik at planleggeren ser ILIKE og kan bruke trigram-indeksene.
--
-- search_path settes ikke. Funksjonen er language sql og skal inlines; et
-- SET-klausul hindrer inlining, og da kan ikke planleggeren fjerne
-- `p_q is null` eller velge trigram-planen (samme valg som
-- reg_customer_suggestions). Alle objekter er schema-kvalifisert.
--
-- Slagvolum bruker public.ofv_disp_matches, som i prod i dag, så filteret
-- «Ukjent» (p_disp = 0) fortsetter å virke.
--
-- p_pabygg og p_focus_make ligger i signaturen så kall med felles
-- filterargumenter matcher. De brukes ikke i WHERE: påbygg er
-- grupperingsdimensjonen, og fokusmerkets plassering regnes i appen.

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'reg_make_share_by_pabygg'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.reg_make_share_by_pabygg(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_bodywork int default null,
  p_from date default null,
  p_to date default null,
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(pabygg text, make_name text, count int)
language sql
stable
security invoker
as $$
  select pabygg_segment as pabygg,
         r.make_name,
         count(*)::int
  from public.registrations r
  where r.transaction_type_id = '10'
    and r.maximum_laden_mass_kg >= 16000
    and r.pabygg_segment is not null
    and r.make_name is not null
    and (
      p_from is not null
      or p_to is not null
      or extract(year from r.transaction_time) = p_year
    )
    and (p_from is null or r.transaction_time >= p_from)
    and (p_to is null or r.transaction_time < (p_to + 1))
    and (p_segment is null or r.usage_name = p_segment)
    and (p_make is null or r.make_name = p_make)
    and (p_month is null or extract(month from r.transaction_time) = p_month)
    and (p_region is null or r.sales_region = p_region)
    and (p_hp is null or r.hp_bucket = p_hp)
    and (p_fuel is null or r.fuel_name = p_fuel)
    and public.ofv_disp_matches(r.disp_bucket, p_disp)
    and (p_chassis is null or r.trekker_jevnlast = p_chassis)
    and (
      p_bodywork is null
      or (p_bodywork = -1 and r.bodywork_code is null)
      or r.bodywork_code = p_bodywork
    )
    and (
      p_q is null
      or r.primary_owner_name ilike '%' || p_q || '%'
      or r.primary_user_name ilike '%' || p_q || '%'
      or (
        p_q ~ '^[0-9]{3,}$'
        and (
          r.primary_owner_orgnr like p_q || '%'
          or r.primary_user_orgnr like p_q || '%'
        )
      )
    )
  group by r.pabygg_segment, r.make_name
  order by r.pabygg_segment, count(*) desc;
$$;

revoke all on function public.reg_make_share_by_pabygg(
  int, text, text, int, int, int, text, text, int, text, int, date, date, text, text
) from public, anon;

grant execute on function public.reg_make_share_by_pabygg(
  int, text, text, int, int, int, text, text, int, text, int, date, date, text, text
) to authenticated, service_role;
