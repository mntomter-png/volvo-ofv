-- Phase 2: OFV-datalag (lastebiler) – registreringer, populasjon og synk-logg.

create type public.sync_type as enum ('registrations', 'population', 'full');
create type public.sync_status as enum ('running', 'completed', 'failed');

-- Logg over datasynk fra OFV.
create table public.sync_logs (
  id                uuid primary key default gen_random_uuid(),
  sync_type         public.sync_type not null,
  status            public.sync_status not null default 'running',
  started_at        timestamptz not null default now(),
  completed_at      timestamptz,
  ofv_data_version  integer,
  ofv_publish_date  date,
  records_fetched   integer not null default 0,
  records_upserted  integer not null default 0,
  error_message     text,
  metadata          jsonb not null default '{}'::jsonb
);

create index sync_logs_started_at_idx on public.sync_logs (started_at desc);
create index sync_logs_status_idx on public.sync_logs (status);

-- Nyregistreringer og andre transaksjoner (lastebiler, alle merker).
create table public.registrations (
  id                          uuid primary key default gen_random_uuid(),
  registration_number         text not null,
  transaction_time            timestamptz not null,
  transaction_type_id         text not null,
  transaction_type_name       text,
  make_id                     text,
  make_name                   text,
  model_id                    text,
  model_name                  text,
  variant_id                  text,
  variant_name                text,
  fuel_id                     text,
  fuel_name                   text,
  usage_id                    text,
  usage_name                  text,
  vehicle_type_id             text,
  vehicle_type_name           text,
  authority_vehicle_type_id   text,
  authority_vehicle_type_name text,
  maximum_laden_mass_kg       integer,
  mass_in_running_order_kg    integer,
  engine_power_kw             integer,
  engine_power_hp             integer,
  number_of_axles             integer,
  vin                         text,
  first_registration_date     date,
  vehicle_status              text,
  primary_owner_name          text,
  primary_owner_orgnr         text,
  primary_owner_postal_code   text,
  primary_owner_postal_district text,
  primary_owner_street        text,
  primary_owner_company_postal_code text,
  primary_owner_company_postal_district text,
  primary_user_name           text,
  primary_user_orgnr          text,
  primary_user_postal_code    text,
  primary_user_postal_district text,
  primary_user_street         text,
  primary_user_company_postal_code text,
  primary_user_company_postal_district text,
  leasing_company_name        text,
  leasing_company_orgnr       text,
  ofv_data_version            integer not null,
  synced_at                   timestamptz not null default now(),
  unique (registration_number, transaction_time, transaction_type_id)
);

create index registrations_transaction_time_idx on public.registrations (transaction_time desc);
create index registrations_make_name_idx on public.registrations (make_name);
create index registrations_transaction_type_id_idx on public.registrations (transaction_type_id);

-- Populasjon / bestand (snapshot per publiseringsdato).
create table public.population (
  id                          uuid primary key default gen_random_uuid(),
  registration_number         text not null,
  snapshot_date               date not null,
  make_id                     text,
  make_name                   text,
  model_id                    text,
  model_name                  text,
  variant_id                  text,
  variant_name                text,
  fuel_id                     text,
  fuel_name                   text,
  usage_id                    text,
  usage_name                  text,
  vehicle_type_id             text,
  vehicle_type_name           text,
  authority_vehicle_type_id   text,
  authority_vehicle_type_name text,
  maximum_laden_mass_kg       integer,
  mass_in_running_order_kg    integer,
  engine_power_kw             integer,
  engine_power_hp             integer,
  number_of_axles             integer,
  vin                         text,
  first_registration_date     date,
  vehicle_status              text,
  primary_owner_name          text,
  primary_owner_orgnr         text,
  primary_owner_postal_code   text,
  primary_owner_postal_district text,
  primary_owner_street        text,
  primary_owner_company_postal_code text,
  primary_owner_company_postal_district text,
  primary_user_name           text,
  primary_user_orgnr          text,
  primary_user_postal_code    text,
  primary_user_postal_district text,
  primary_user_street         text,
  primary_user_company_postal_code text,
  primary_user_company_postal_district text,
  leasing_company_name        text,
  leasing_company_orgnr       text,
  ofv_data_version            integer not null,
  synced_at                   timestamptz not null default now(),
  unique (registration_number, snapshot_date)
);

create index population_snapshot_date_idx on public.population (snapshot_date desc);
create index population_make_name_idx on public.population (make_name);

-- RLS: innloggede brukere kan lese OFV-data; skriving skjer kun via service role.
alter table public.sync_logs enable row level security;
alter table public.registrations enable row level security;
alter table public.population enable row level security;

create policy "Authenticated users can read sync logs"
  on public.sync_logs for select to authenticated using (true);

create policy "Authenticated users can read registrations"
  on public.registrations for select to authenticated using (true);

create policy "Authenticated users can read population"
  on public.population for select to authenticated using (true);
