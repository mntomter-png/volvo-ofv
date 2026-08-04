import type { Metadata } from "next";

import { AuditLogTable } from "@/components/admin/audit-log-table";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { UsageOverviewTable } from "@/components/admin/usage-overview-table";
import { UsersTable } from "@/components/admin/users-table";
import { PageHeader } from "@/components/layout/page-header";
import { listAdminAuditLogs } from "@/lib/auth/audit-queries";
import { getSessionUser } from "@/lib/auth/roles";
import { listAuthUsers } from "@/lib/auth/queries";
import { listUserUsage } from "@/lib/auth/usage-queries";

export const metadata: Metadata = {
  title: "Brukere",
};

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const [users, currentUser, auditLog, usage] = await Promise.all([
    listAuthUsers(),
    getSessionUser(),
    listAdminAuditLogs(),
    listUserUsage(),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Brukere"
        description="Inviter og administrer brukerkontoer for Volvo OFV."
      />

      <section className="mb-8">
        <CreateUserForm />
      </section>

      <section>
        <UsersTable
          users={users}
          currentUserId={currentUser?.id ?? ""}
        />
      </section>

      <section className="mt-8">
        <UsageOverviewTable rows={usage} />
      </section>

      <section className="mt-8">
        <AuditLogTable entries={auditLog} />
      </section>
    </div>
  );
}
