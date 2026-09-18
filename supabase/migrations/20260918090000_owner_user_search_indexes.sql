-- Fritekstsøk på eier/bruker i Nyregistreringer og Populasjon.
--
-- Navn søkes som delstreng (ILIKE '%navn%') og krever trigram-indeks; en vanlig
-- btree kan ikke brukes når mønsteret starter med wildcard.
-- Org.nr. søkes som prefiks (LIKE '984%') og dekkes av btree med
-- text_pattern_ops, som er uavhengig av databasens collation.
--
-- Merk: GIN-byggingen tar write-lock på tabellen mens den kjører. Migrasjonen
-- kjøres i transaksjon, så CONCURRENTLY er ikke mulig her.

create extension if not exists pg_trgm;

create index if not exists registrations_primary_owner_name_trgm_idx
  on public.registrations using gin (primary_owner_name gin_trgm_ops);

create index if not exists registrations_primary_user_name_trgm_idx
  on public.registrations using gin (primary_user_name gin_trgm_ops);

create index if not exists registrations_primary_owner_orgnr_prefix_idx
  on public.registrations (primary_owner_orgnr text_pattern_ops);

create index if not exists registrations_primary_user_orgnr_prefix_idx
  on public.registrations (primary_user_orgnr text_pattern_ops);

create index if not exists population_primary_owner_name_trgm_idx
  on public.population using gin (primary_owner_name gin_trgm_ops);

create index if not exists population_primary_user_name_trgm_idx
  on public.population using gin (primary_user_name gin_trgm_ops);

create index if not exists population_primary_owner_orgnr_prefix_idx
  on public.population (primary_owner_orgnr text_pattern_ops);

create index if not exists population_primary_user_orgnr_prefix_idx
  on public.population (primary_user_orgnr text_pattern_ops);
