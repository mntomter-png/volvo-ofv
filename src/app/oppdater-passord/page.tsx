import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { getSessionUser } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Oppdater passord",
};

export default async function UpdatePasswordPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <UpdatePasswordForm />
      </div>
    </main>
  );
}
