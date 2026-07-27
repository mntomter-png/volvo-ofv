import "server-only";

import type { User } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

export type AdminAuditAction =
  | "user.invite"
  | "user.password_reset"
  | "user.delete"
  | "user.role_change";

export async function logAdminAudit(params: {
  actor: User;
  action: AdminAuditAction;
  targetUserId?: string;
  metadata?: Json;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("admin_audit_log").insert({
    actor_id: params.actor.id,
    actor_email: params.actor.email ?? null,
    action: params.action,
    target_user_id: params.targetUserId ?? null,
    metadata: params.metadata ?? {},
  });

  if (error) {
    console.error("[audit] kunne ikke lagre admin_audit_log:", error.message);
  }
}
