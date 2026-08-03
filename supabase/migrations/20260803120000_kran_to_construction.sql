-- Flytt OFV AdditionalBodyworks-kode 26 (Kran) fra Annet til Construction (Anlegg).
-- Oppdaterer funksjonen og tvinger recompute av generated pabygg_segment
-- kun for berørte rader (unngår full tabell-rewrite).

create or replace function public.ofv_pabygg_segment(
  bodywork_code int,
  usage_name text,
  model_name text default null,
  certificate_variant text default null,
  number_of_axles int default null
)
returns text
language sql
immutable
as $$
  select case
    when bodywork_code is not null then case bodywork_code
      when 3 then 'Distribution'   -- Skap
      when 4 then 'Distribution'   -- Isolert skap med kjøleaggregat
      when 5 then 'Distribution'   -- Isolert skap uten kjøleaggregat
      when 6 then 'Distribution'   -- Gardin
      when 9 then 'Construction'   -- Krokløft
      when 10 then 'Construction'  -- Tipp
      when 15 then 'Construction'  -- Betongblander
      when 16 then 'Construction'  -- Pumpebil for betong
      when 26 then 'Construction'  -- Kran
      when 79 then 'Long Haul'     -- Med svingskive (dolly)
      else 'Annet'                 -- Tank, tømmer, plan, kapell, m.fl.
    end
    when usage_name ilike '%trekk%' then 'Long Haul'
    when usage_name ilike '%lukket godsrom%' then 'Distribution'
    else 'Annet'
  end;
$$;

-- Touch base-kolonne → generated pabygg_segment reberegnes.
update public.registrations
set bodywork_code = bodywork_code
where bodywork_code = 26;

update public.population
set bodywork_code = bodywork_code
where bodywork_code = 26;

grant execute on function
  public.ofv_pabygg_segment(int, text, text, text, int) to authenticated;
