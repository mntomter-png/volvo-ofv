import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Glemt passord",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <ForgotPasswordForm
          initialError={
            error === "auth"
              ? "Lenken er ugyldig eller allerede brukt. For nye brukere: be admin om ny invitasjon. Ellers be om ny passordlenke under."
              : undefined
          }
        />
      </div>
    </main>
  );
}
