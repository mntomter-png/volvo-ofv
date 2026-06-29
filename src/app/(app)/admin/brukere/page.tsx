import type { Metadata } from "next";

import { CreateUserForm } from "@/components/admin/create-user-form";
import { UsersTable } from "@/components/admin/users-table";
import { PageHeader } from "@/components/layout/page-header";
import { getSessionUser } from "@/lib/auth/roles";
import { listAuthUsers } from "@/lib/auth/queries";

export const metadata: Metadata = {
  title: "Brukere",
};

export default async function AdminUsersPage() {
  const [users, currentUser] = await Promise.all([
    listAuthUsers(),
    getSessionUser(),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Brukere"
        description="Opprett og administrer brukerkontoer for Volvo OFV."
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
    </div>
  );
}
