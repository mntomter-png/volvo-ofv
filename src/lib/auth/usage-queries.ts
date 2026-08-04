import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertSuper } from "@/lib/auth/roles";
import { listAuthUsers, type AuthUserRow } from "@/lib/auth/queries";
import { ROLE_LABELS } from "@/lib/auth/role-config";
import {
  calendarDaysBetween,
  INACTIVE_AFTER_DAYS,
} from "@/lib/auth/usage-format";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export interface UserUsageRow {
  userId: string;
  email: string;
  roleLabel: string;
  lastPath: string | null;
  lastSeenAt: string | null;
  visitCount: number;
  daysSinceSeen: number | null;
  inactive: boolean;
}

export async function listUserUsage(): Promise<UserUsageRow[]> {
  await assertSuper();

  const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
  const [users, activityRes] = await Promise.all([
    listAuthUsers(),
    supabase
      .from("user_activity")
      .select("user_id, last_path, last_seen_at, visit_count"),
  ]);

  if (activityRes.error) {
    throw new Error(activityRes.error.message);
  }

  const activityByUser = new Map(
    (activityRes.data ?? []).map((row) => [row.user_id, row]),
  );

  const rows: UserUsageRow[] = users.map((user: AuthUserRow) => {
    const activity = activityByUser.get(user.id);
    const lastSeenAt = activity?.last_seen_at ?? user.lastSignInAt;
    const daysSinceSeen =
      lastSeenAt != null ? calendarDaysBetween(lastSeenAt) : null;

    return {
      userId: user.id,
      email: user.email,
      roleLabel: ROLE_LABELS[user.role],
      lastPath: activity?.last_path ?? null,
      lastSeenAt,
      visitCount: activity?.visit_count ?? 0,
      daysSinceSeen,
      inactive:
        daysSinceSeen == null || daysSinceSeen >= INACTIVE_AFTER_DAYS,
    };
  });

  return rows.sort((a, b) => {
    if (a.lastSeenAt == null && b.lastSeenAt == null) {
      return a.email.localeCompare(b.email, "nb");
    }
    if (a.lastSeenAt == null) return 1;
    if (b.lastSeenAt == null) return -1;
    return b.lastSeenAt.localeCompare(a.lastSeenAt);
  });
}

export { INACTIVE_AFTER_DAYS } from "@/lib/auth/usage-format";
