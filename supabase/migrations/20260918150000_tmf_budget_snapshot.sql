-- Fryser de beregnede tallene i en budsjettversjon.
--
-- `config` lagrer bare forutsetningene (scenario og justeringer), så en versjon
-- lagret i august viser i dag helt andre tall — OFV, SSB og kalibreringen har
-- flyttet seg. Det gjorde det umulig å se hva vi faktisk sa den gangen, og
-- dermed umulig å vurdere om prognosen traff.
--
-- `snapshot` tar vare på tallene slik de var da versjonen ble lagret, inkludert
-- modellparametrene, så avvik kan forklares og ikke bare observeres.

alter table public.tmf_budget_versions
  add column snapshot jsonb;

comment on column public.tmf_budget_versions.snapshot is
  'Fryste beregnede tall + modellparametre ved lagring. Null for versjoner lagret før dette ble innført.';
