import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Glemt passord",
};

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
