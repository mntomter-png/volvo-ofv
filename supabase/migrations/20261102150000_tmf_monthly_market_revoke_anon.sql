-- TMF monthly market: steng EXECUTE for PUBLIC/anon.
-- 20261031195512 gjenskapte funksjonen og ga PUBLIC/anon på nytt
-- (legacy default). Appen kaller den med innlogget sesjon (TMF-siden).
-- Må kjøres i prod — denne filen er kun repo til den er applisert.

revoke all on function public.tmf_monthly_market(date, date, text) from public, anon;
grant execute on function public.tmf_monthly_market(date, date, text) to authenticated;
grant execute on function public.tmf_monthly_market(date, date, text) to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.tmf_monthly_market(date, date, text)', 'execute') then
    raise exception 'tmf_monthly_market er fortsatt kjørbar for anon';
  end if;
  if has_function_privilege('public', 'public.tmf_monthly_market(date, date, text)', 'execute') then
    raise exception 'tmf_monthly_market har fortsatt EXECUTE for PUBLIC';
  end if;
  if not has_function_privilege('authenticated', 'public.tmf_monthly_market(date, date, text)', 'execute') then
    raise exception 'tmf_monthly_market mangler EXECUTE for authenticated';
  end if;
end $$;
