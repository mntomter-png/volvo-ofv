/**
 * Rekkefølgen i en OFV-synk etter at versjonssjekken er gjort.
 * Forhåndsbygging av bestand startes etter registreringer. En feil eller
 * et heng i eksporten skal ikke feile synken og ikke hindre registreringer.
 * Hopp-over og ren registreringssynk kaller ikke denne med bestand, og
 * starter derfor ikke eksport (samme som før).
 */

export interface SyncPhaseCounts {
  fetched: number;
  upserted: number;
}

function logExportFailure(error: unknown): void {
  console.error(
    "[population-export] forhåndsbygging",
    error instanceof Error ? error.message : error,
  );
}

export async function runOfvSyncPhases(input: {
  population: (() => Promise<SyncPhaseCounts>) | null;
  registrations: (() => Promise<SyncPhaseCounts>) | null;
  finish: (
    status: "completed" | "failed",
    fetched: number,
    upserted: number,
    errorMessage?: string,
  ) => Promise<void>;
  scheduleExport: () => Promise<void>;
  logExportError?: (error: unknown) => void;
}): Promise<{
  population?: SyncPhaseCounts;
  registrations?: SyncPhaseCounts;
}> {
  let population: SyncPhaseCounts | undefined;
  let registrations: SyncPhaseCounts | undefined;
  let fetched = 0;
  let upserted = 0;
  const log = input.logExportError ?? logExportFailure;

  try {
    if (input.population) {
      population = await input.population();
      fetched += population.fetched;
      upserted += population.upserted;
    }
    if (input.registrations) {
      registrations = await input.registrations();
      fetched += registrations.fetched;
      upserted += registrations.upserted;
    }
    await input.finish("completed", fetched, upserted);
    return { population, registrations };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ukjent feil";
    await input.finish("failed", fetched, upserted, message);
    throw error;
  } finally {
    // Bare etter en faktisk bestandssynk. `await` her venter på POST (Netlify)
    // eller den lokale filen, aldri før registreringer er forsøkt.
    if (population) {
      try {
        await input.scheduleExport();
      } catch (error) {
        log(error);
      }
    }
  }
}
