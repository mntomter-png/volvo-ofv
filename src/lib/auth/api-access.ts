import "server-only";

import type { User } from "@supabase/supabase-js";

import {
  ApiAccessError,
  apiErrorResponse,
} from "@/lib/auth/api-access-core";
import type { AppPage } from "@/lib/auth/role-config";
import { canAccess, getSessionUser, getUserRole } from "@/lib/auth/roles";
import { getUserBrandId } from "@/lib/brand/user-brand";

export { ApiAccessError, apiErrorResponse };

/**
 * Side-tilgang for API-ruter (JSON 401/403, aldri redirect).
 * Bruk i stedet for requirePageAccess i route handlers.
 */
export async function requireApiPageAccess(page: AppPage): Promise<User> {
  const user = await getSessionUser();
  if (!user) {
    throw new ApiAccessError("Ikke innlogget.", 401);
  }
  if (!getUserBrandId(user)) {
    throw new ApiAccessError("Kontoen mangler gyldig merkevare.", 403);
  }
  if (!canAccess(user, page)) {
    const role = getUserRole(user);
    throw new ApiAccessError(
      role
        ? "Du har ikke tilgang til denne eksporten."
        : "Kontoen mangler gyldig rolle.",
      403,
    );
  }
  return user;
}
