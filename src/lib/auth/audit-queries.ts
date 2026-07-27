import "server-only";

import type { AdminAuditAction } from "@/lib/auth/audit-log";
import { assertSuper } from "@/lib/auth/roles";
import { ROLE_LABELS, type Role } from "@/lib/auth/role-config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

export interface AdminAuditLogRow {
  id: string;
  actorEmail: string | null;
  action: AdminAuditAction;
  targetUserId: string | null;
  metadata: Json;
  createdAt: string;
}

const AUDIT_LOG_LIMIT = 50;

export async function listAdminAuditLogs(): Promise<AdminAuditLogRow[]> {
  await assertSuper();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("admin_audit_log")
    .select(
      "id, actor_email, action, target_user_id, metadata, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(AUDIT_LOG_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    actorEmail: row.actor_email,
    action: row.action as AdminAuditAction,
    targetUserId: row.target_user_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));
}

export function formatAuditAction(action: AdminAuditAction): string {
  switch (action) {
    case "user.invite":
      return "Invitasjon sendt";
    case "user.password_reset":
      return "Passord tilbakestilt";
    case "user.delete":
      return "Bruker slettet";
    case "user.role_change":
      return "Rolle endret";
    default:
      return action;
  }
}

export function formatAuditDetails(
  action: AdminAuditAction,
  metadata: Json,
): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "";
  }

  const record = metadata as Record<string, Json | undefined>;

  switch (action) {
    case "user.invite": {
      const email = typeof record.email === "string" ? record.email : null;
      const role = typeof record.role === "string" ? record.role : null;
      const parts = [
        email,
        role ? ROLE_LABELS[role as Role] ?? role : null,
      ].filter(Boolean);
      return parts.join(" · ");
    }
    case "user.role_change": {
      const previous =
        typeof record.previousRole === "string" ? record.previousRole : null;
      const next = typeof record.newRole === "string" ? record.newRole : null;
      if (previous && next) {
        const from = ROLE_LABELS[previous as Role] ?? previous;
        const to = ROLE_LABELS[next as Role] ?? next;
        return `${from} → ${to}`;
      }
      return "";
    }
    default:
      return "";
  }
}
