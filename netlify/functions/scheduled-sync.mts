/**
 * Scheduled function (kjører på cron, maks 30s). Trigger den tunge
 * background-funksjonen som gjør selve OFV-synken, og returnerer raskt.
 */
export default async () => {
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL;
  const secret = process.env.SYNC_SECRET;

  if (!base || !secret) {
    console.error("scheduled-sync: mangler URL eller SYNC_SECRET");
    return;
  }

  try {
    const response = await fetch(`${base}/.netlify/functions/ofv-sync-background`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scope: "full" }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(
        `scheduled-sync: background returnerte ${response.status}: ${body.slice(0, 200)}`,
      );
      return;
    }

    console.log("scheduled-sync: trigget OFV-synk (background)");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ukjent feil";
    console.error("scheduled-sync: kunne ikke trigge synk:", message);
  }
};

export const config = {
  schedule: "0 5 * * *",
};
