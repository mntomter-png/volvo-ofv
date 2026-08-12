-- Legg til firmas gateadresse og postnr/poststed for eier og bruker.

alter table public.registrations
  add column if not exists primary_owner_street text,
  add column if not exists primary_owner_company_postal_code text,
  add column if not exists primary_owner_company_postal_district text,
  add column if not exists primary_user_street text,
  add column if not exists primary_user_company_postal_code text,
  add column if not exists primary_user_company_postal_district text;

alter table public.population
  add column if not exists primary_owner_street text,
  add column if not exists primary_owner_company_postal_code text,
  add column if not exists primary_owner_company_postal_district text,
  add column if not exists primary_user_street text,
  add column if not exists primary_user_company_postal_code text,
  add column if not exists primary_user_company_postal_district text;
