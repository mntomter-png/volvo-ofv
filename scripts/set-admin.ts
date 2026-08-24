import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const email = process.argv[2];

if (!email) {
  console.error("Bruk: tsx scripts/set-admin.ts <epost>");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Finn bruker via paginert listUsers (intern verktøy = få brukere).
  let existing:
    | { id: string; app_metadata: Record<string, unknown> | undefined }
    | undefined;
  let page = 1;
  while (!existing) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      console.error("Feil:", error.message);
      process.exit(1);
    }
    const match = data.users.find(
      (u) => u.email?.toLowerCase() === email!.toLowerCase(),
    );
    if (match) {
      existing = { id: match.id, app_metadata: match.app_metadata ?? {} };
    }
    if (data.users.length < 200) break;
    page += 1;
  }

  if (!existing) {
    console.error("Fant ingen bruker med e-post:", email);
    process.exit(1);
  }

  const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
    app_metadata: { ...existing.app_metadata, role: "super" },
  });

  if (error) {
    console.error("Feil:", error.message);
    process.exit(1);
  }

  console.log("Satt som super:", data.user?.email);
}

main();
