import type { SupabaseClient } from "@supabase/supabase-js";

import type { CentralFleetOrg } from "@/lib/fleet/central-orgs";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export async function getCentralFleetOrgs(): Promise<{
  orgs: CentralFleetOrg[];
  error: string | null;
}> {
  const supabase = await createClient();
  const rpcClient = supabase as unknown as SupabaseClient<Database>;
  const { data, error } = await rpcClient.rpc("list_central_fleet_orgs");

  if (error) {
    console.error("[fleet] list_central_fleet_orgs:", error.message);
    return { orgs: [], error: "Kunne ikke hente organisasjonslisten." };
  }

  return {
    orgs: (data ?? []).map((row) => ({
      orgnr: row.orgnr,
      name: row.name,
      note: row.note,
      active: row.active,
      updatedAt: row.updated_at,
    })),
    error: null,
  };
}
