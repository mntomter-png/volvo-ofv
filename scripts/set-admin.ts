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
  let userId: string | undefined;
  let page = 1;
  while (!userId) {
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
    if (match) userId = match.id;
    if (data.users.length < 200) break;
    page += 1;
  }

  if (!userId) {
    console.error("Fant ingen bruker med e-post:", email);
    process.exit(1);
  }

  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { role: "admin" },
  });

  if (error) {
    console.error("Feil:", error.message);
    process.exit(1);
  }

  console.log("Satt som admin:", data.user?.email);
}

main();
