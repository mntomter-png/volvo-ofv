import "server-only";

import { resolveRole, type Role } from "@/lib/auth/role-config";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AuthUserRow {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  role: Role;
}

/** Henter alle brukere fra Supabase Auth (admin API). */
export async function listAuthUsers(): Promise<AuthUserRow[]> {
  const admin = createAdminClient();
  const users: AuthUserRow[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(error.message);

    for (const user of data.users) {
      users.push({
        id: user.id,
        email: user.email ?? "ukjent",
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
        role: resolveRole(user.app_metadata?.role),
      });
    }

    if (data.users.length < 200) break;
    page += 1;
  }

  return users.sort((a, b) => a.email.localeCompare(b.email, "nb"));
}
