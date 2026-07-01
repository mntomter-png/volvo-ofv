import { createClient } from "@supabase/supabase-js";

import { authCallbackUrl } from "../src/lib/auth/site-url";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const email = process.argv[2];
const role = process.argv[3] ?? "leder";

const VALID_ROLES = ["salg", "service", "leder", "super"];

if (!email) {
  console.error(
    "Bruk: tsx scripts/create-user.ts <epost> [salg|service|leder|super]",
  );
  process.exit(1);
}

if (!VALID_ROLES.includes(role)) {
  console.error(`Ugyldig rolle: ${role}. Gyldige: ${VALID_ROLES.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email!, {
    redirectTo: authCallbackUrl("/oppdater-passord"),
  });

  if (error) {
    console.error("Feil:", error.message);
    process.exit(1);
  }

  if (data.user) {
    const { error: roleError } = await supabase.auth.admin.updateUserById(
      data.user.id,
      { app_metadata: { role } },
    );
    if (roleError) {
      console.error("Invitasjon sendt, men rolle feilet:", roleError.message);
      process.exit(1);
    }
  }

  console.log(
    "Invitasjon sendt:",
    data.user?.email,
    `(rolle: ${role}, id: ${data.user?.id})`,
  );
}

main();
