import type { Context } from "@netlify/functions";

import { handlePopulationExportBackground } from "@/lib/population/export-background-handler";

/**
 * Bakgrunnsfunksjon (opptil 15 min). Bygger bestand-.xlsx og laster den
 * opp til privat Storage. Kalleren får 202 med en gang fra Netlify.
 */
export default async (req: Request, _context: Context) => {
  return handlePopulationExportBackground(req);
};
