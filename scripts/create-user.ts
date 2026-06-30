import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const email = process.argv[2];
const password = process.argv[3];
const role = process.argv[4] ?? "leder";

const VALID_ROLES = ["salg", "service", "leder", "super"];

if (!email || !password) {
  console.error(
    "Bruk: tsx scripts/create-user.ts <epost> <passord> [salg|service|leder|super]",
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
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
  });

  if (error) {
    console.error("Feil:", error.message);
    process.exit(1);
  }

  console.log(
    "Bruker opprettet:",
    data.user?.email,
    `(rolle: ${role}, id: ${data.user?.id})`,
  );
}

main();
