import { dispatchPopulationFullExport } from "@/lib/population/export-dispatch";
import { markCurrentFullExportFailed } from "@/lib/population/export-supabase";

/**
 * Etter en vellykket bestandssynk, eller når en synk hoppes over fordi
 * versjonen allerede er inne. Feil her skal ikke feile selve synken.
 *
 * `wait: true` venter bare på den lokale in-process-byggingen, slik at
 * `scripts/sync-ofv.ts` ikke avslutter prosessen midt i filen. På Netlify
 * ignoreres `wait`: kallet returnerer når bakgrunnsfunksjonen har svart 202.
 * Selve xlsx-filen bygges ikke i synk-funksjonen.
 *
 * `force: false` (hopp-over) tar en fastlåst `building`-rad, men rører ikke
 * en fil som allerede er klar.
 */
export async function scheduleFullPopulationExport(options?: {
  force?: boolean;
  dispatch?: (options: { force: boolean; wait: boolean }) => Promise<void>;
  recordFailure?: (message: string) => Promise<void>;
}): Promise<void> {
  const dispatch = options?.dispatch ?? dispatchPopulationFullExport;
  const force = options?.force !== false;
  try {
    await dispatch({ force, wait: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunne ikke starte forhåndsbygging.";
    console.error("[population-export] forhåndsbygging", message);
    const record = options?.recordFailure ?? markCurrentFullExportFailed;
    try {
      await record(message);
    } catch (recordError) {
      console.error(
        "[population-export] kunne ikke lagre feil",
        recordError instanceof Error ? recordError.message : recordError,
      );
    }
  }
}
