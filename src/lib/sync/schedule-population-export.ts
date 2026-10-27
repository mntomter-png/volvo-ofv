import { dispatchPopulationFullExport } from "@/lib/population/export-dispatch";

/**
 * Etter en vellykket bestandssynk. Feil her skal ikke feile selve synken:
 * filen kan bygges med manuell trigging til neste synk.
 */
export async function scheduleFullPopulationExport(
  dispatch: (options: {
    force: boolean;
    wait: boolean;
  }) => Promise<void> = dispatchPopulationFullExport,
): Promise<void> {
  try {
    await dispatch({ force: true, wait: true });
  } catch (error) {
    console.error(
      "[population-export] forhåndsbygging",
      error instanceof Error ? error.message : error,
    );
  }
}
