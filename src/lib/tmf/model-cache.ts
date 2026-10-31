import "server-only";

import { unstable_cache } from "next/cache";

import { buildDriverGroups, fetchSsbIndicatorPoints } from "@/lib/ssb/queries";
import { createAdminClient } from "@/lib/supabase/admin-core";
import { fetchTmfMonthlyMarketRows } from "@/lib/tmf/model-inputs";
import { fitTmfModel, type TmfModelSnapshot } from "@/lib/tmf/model-fit";
import { referenceFromDayKey } from "@/lib/tmf/model-cache-key";

/** Taggen kan brukes av en senere synk, men ugyldiggjøring skjer via nøkkelen. */
export const TMF_MODEL_CACHE_TAG = "tmf-model-fit";

/**
 * Ett døgn som sikkerhetsnett hvis data endres uten ny versjon eller SSB-tid.
 * En ny `ofv_data_version` treffer en annen nøkkel med en gang, uten å vente.
 */
export const TMF_MODEL_CACHE_REVALIDATE_SECONDS = 24 * 60 * 60;

async function loadTmfModelSnapshot(
  cacheKey: string,
  day: string,
  focusMake: string,
): Promise<TmfModelSnapshot> {
  if (!cacheKey) {
    throw new Error("TMF-cache nøkkel mangler");
  }

  const reference = referenceFromDayKey(day);
  const supabase = createAdminClient();
  const [rows, ssbPoints] = await Promise.all([
    fetchTmfMonthlyMarketRows(supabase, focusMake, reference),
    fetchSsbIndicatorPoints(supabase),
  ]);
  const driverGroups = buildDriverGroups(ssbPoints);

  return {
    rows,
    driverGroups,
    ssbPoints,
    ...fitTmfModel(rows, driverGroups, ssbPoints, reference),
  };
}

export const readCachedTmfModelSnapshot = unstable_cache(
  loadTmfModelSnapshot,
  ["tmf-model-fit"],
  {
    revalidate: TMF_MODEL_CACHE_REVALIDATE_SECONDS,
    tags: [TMF_MODEL_CACHE_TAG],
  },
);
