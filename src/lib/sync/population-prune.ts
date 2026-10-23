/** metadata.kind på sync_logs-rader som gjelder bestandsopprydding. */
export const POPULATION_PRUNE_LOG_KIND = "population_prune";

export const POPULATION_PRUNE_ERROR_PREFIX = "Populasjonsopprydding: ";

const MAX_PRUNE_ERROR_LENGTH = 500;

/** Stabil feilmelding som helsebadgen og SQL-watchdog skriver likt. */
export function formatPopulationPruneError(message: string): string {
  const trimmed = message.trim() || "ukjent feil";
  const full = trimmed.startsWith("Populasjonsopprydding:")
    ? trimmed
    : `${POPULATION_PRUNE_ERROR_PREFIX}${trimmed}`;
  if (full.length <= MAX_PRUNE_ERROR_LENGTH) return full;
  return `${full.slice(0, MAX_PRUNE_ERROR_LENGTH - 3)}...`;
}

/**
 * PostgREST svarer PGRST202 når migrasjonen med prune-funksjonen
 * ikke er kjørt, eller schema-cachen ikke har sett den ennå.
 */
export function isMissingPopulationPruneRpc(error: {
  code?: string;
  message?: string;
}): boolean {
  if (error.code === "PGRST202") return true;
  const message = error.message ?? "";
  return (
    message.includes("prune_surplus_population_snapshots") &&
    /schema cache|Could not find the function/i.test(message)
  );
}
