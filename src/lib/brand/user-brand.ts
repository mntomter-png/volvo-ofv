import type { User } from "@supabase/supabase-js";

import {
  getBrandConfig,
  resolveBrandId,
  type BrandConfig,
  type BrandId,
} from "@/lib/brand/config";

export function getUserBrandId(user: User | null | undefined): BrandId | null {
  return resolveBrandId(user?.app_metadata?.brand);
}

/** Brand-konfig; kaster hvis merkevare er ugyldig (fail closed). */
export function getUserBrand(user: User | null | undefined): BrandConfig {
  const id = getUserBrandId(user);
  if (!id) {
    throw new Error("Kontoen mangler gyldig merkevare.");
  }
  return getBrandConfig(id);
}
