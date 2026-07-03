/**
 * Scheduled function som trigger ukentlig SSB-synk (mandag 06:00 UTC).
 */
export default async () => {
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL;
  const secret = process.env.SYNC_SECRET;

  if (!base || !secret) {
    console.error("scheduled-ssb-sync: mangler URL eller SYNC_SECRET");
    return;
  }

  try {
    const response = await fetch(`${base}/.netlify/functions/ssb-sync-background`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(
        `scheduled-ssb-sync: background returnerte ${response.status}: ${body.slice(0, 200)}`,
      );
      return;
    }

    console.log("scheduled-ssb-sync: trigget SSB-synk (background)");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ukjent feil";
    console.error("scheduled-ssb-sync: kunne ikke trigge synk:", message);
  }
};

export const config = {
  // Mandag 06:00 UTC – SSB publiserer kvartalsdata med noe forsinkelse.
  schedule: "0 6 * * 1",
};
