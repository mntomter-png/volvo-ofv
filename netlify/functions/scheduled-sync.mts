import type { Config } from "@netlify/functions";

/**
 * Scheduled function (kjører på cron, maks 30s). Trigger den tunge
 * background-funksjonen som gjør selve OFV-synken, og returnerer raskt.
 *
 * Full synk er versjons-bevisst: hopper over hvis OFVs dataVersion allerede
 * er synket, så daglig kjøring er trygt og fanger nye publiseringer.
 */
export default async () => {
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL;
  const secret = process.env.SYNC_SECRET;

  if (!base || !secret) {
    console.error("scheduled-sync: mangler URL eller SYNC_SECRET");
    return;
  }

  try {
    await fetch(`${base}/.netlify/functions/ofv-sync-background`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scope: "full" }),
    });
    console.log("scheduled-sync: trigget OFV-synk (background)");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ukjent feil";
    console.error("scheduled-sync: kunne ikke trigge synk:", message);
  }
};

export const config: Config = {
  // Daglig kl. 05:00 UTC (07:00 norsk sommertid).
  schedule: "0 5 * * *",
};
