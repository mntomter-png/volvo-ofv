-- Bruk ofv_disp_matches i øvrige reg_*-filtre slik at p_disp = 0 (ukjent) virker.

create or replace function public.ofv_disp_matches(p_bucket smallint, p_disp int)
returns boolean
language sql
immutable
parallel safe
as $$
  select
    p_disp is null
    or (p_disp = 0 and p_bucket is null)
    or p_bucket = p_disp;
$$;

-- Patcher kun den vanlige filterlinjen via temporær omskriving er upraktisk;
-- derfor oppdaterer vi de mest brukte overview-RPC-ene eksplisitt nedenfor
-- ved å beholde eksisterende signaturer og bytte p_disp-predikatet.

do $$
declare
  r record;
  def text;
  new_def text;
begin
  for r in
    select p.oid, p.proname, pg_get_functiondef(p.oid) as definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'reg_%'
      and pg_get_functiondef(p.oid) like '%p_disp is null or%disp_bucket%'
  loop
    def := r.definition;
    new_def := replace(
      def,
      '(p_disp is null or disp_bucket = p_disp)',
      'public.ofv_disp_matches(disp_bucket, p_disp)'
    );
    new_def := replace(
      new_def,
      '(p_disp is null or r.disp_bucket = p_disp)',
      'public.ofv_disp_matches(r.disp_bucket, p_disp)'
    );
    new_def := replace(
      new_def,
      'and (p_disp is null or disp_bucket = p_disp)',
      'and public.ofv_disp_matches(disp_bucket, p_disp)'
    );
    new_def := replace(
      new_def,
      'and (p_disp is null or r.disp_bucket = p_disp)',
      'and public.ofv_disp_matches(r.disp_bucket, p_disp)'
    );
    if new_def is distinct from def then
      execute new_def;
    end if;
  end loop;
end $$;

grant execute on function public.ofv_disp_matches(smallint, int) to authenticated;
