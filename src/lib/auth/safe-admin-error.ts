/** Mapper leverandørfeil til generiske norske meldinger (unngår intern lekkasje). */
export function toSafeAdminError(
  error: { message?: string } | null | undefined,
  fallback: string,
): string {
  const message = error?.message?.toLowerCase() ?? "";
  if (!message) return fallback;

  if (message.includes("already") || message.includes("registered")) {
    return "En bruker med denne e-posten finnes allerede.";
  }
  if (message.includes("not found") || message.includes("user not found")) {
    return "Fant ikke brukeren.";
  }
  if (message.includes("rate") || message.includes("too many")) {
    return "For mange forespørsler. Prøv igjen senere.";
  }

  console.error("[admin]", error?.message);
  return fallback;
}
