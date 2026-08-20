import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Mangler NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let page = 1;
  const legacy: { id: string; email: string | undefined }[] = [];

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;

    for (const user of data.users) {
      if (user.app_metadata?.role === "admin") {
        legacy.push({ id: user.id, email: user.email });
      }
    }

    if (data.users.length < 200) break;
    page += 1;
  }

  if (legacy.length === 0) {
    console.log("Ingen brukere med role=admin.");
    return;
  }

  for (const user of legacy) {
    const { data: existing, error: fetchError } =
      await admin.auth.admin.getUserById(user.id);
    if (fetchError || !existing.user) {
      throw new Error(fetchError?.message ?? `Fant ikke ${user.id}`);
    }

    const brand = existing.user.app_metadata?.brand ?? "volvo";
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...existing.user.app_metadata,
        role: "super",
        brand,
      },
    });
    if (error) throw error;
    console.log(`Migrert ${user.email ?? user.id}: admin → super`);
  }

  console.log(`Ferdig: ${legacy.length} bruker(e).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
