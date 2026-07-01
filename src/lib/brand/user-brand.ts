import type { User } from "@supabase/supabase-js";

import {
  getBrandConfig,
  resolveBrandId,
  type BrandConfig,
  type BrandId,
} from "@/lib/brand/config";

export function getUserBrandId(user: User | null | undefined): BrandId {
  return resolveBrandId(user?.app_metadata?.brand);
}

export function getUserBrand(user: User | null | undefined): BrandConfig {
  return getBrandConfig(getUserBrandId(user));
}
