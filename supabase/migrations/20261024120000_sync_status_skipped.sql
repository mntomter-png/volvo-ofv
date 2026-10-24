-- Ny sync_status: skipped.
--
-- En full synk som finner at OFV-versjonen allerede er hentet, returnerte
-- uten å skrive sync_logs. HTTP 202 fra Netlify sa bare at kallet ble tatt
-- imot. Da kan man ikke skille «ingen nye data» fra «kjørte aldri».
--
-- skipped er ikke en vellykket synk. Neste migrasjon legger kolonner for
-- siste skip på ofv_sync_health. Verdien kan ikke brukes i samme
-- transaksjon som ALTER TYPE (Postgres), derfor er viewet en egen fil.
--
-- Ikke kjørt mot prod av agenten.

alter type public.sync_status add value if not exists 'skipped';

comment on type public.sync_status is
  'running: pågår. completed: data er skrevet og teller som siste synk. failed: feilet. skipped: bevisst hoppet over, teller ikke som vellykket synk.';
