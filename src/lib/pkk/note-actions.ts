"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requirePageAccess } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export interface PkkCustomerNote {
  contactEmail: string;
  note: string;
}

export type PkkCustomerNotesMap = Record<string, PkkCustomerNote>;

export async function getPkkCustomerNotes(): Promise<PkkCustomerNotesMap> {
  await requirePageAccess("pkk");

  const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return {};

  const { data, error } = await supabase
    .from("pkk_customer_notes")
    .select("owner_key, contact_email, note")
    .eq("user_id", user.id);

  if (error || !data) return {};

  return Object.fromEntries(
    data.map((row) => [
      row.owner_key,
      {
        contactEmail: row.contact_email ?? "",
        note: row.note ?? "",
      },
    ]),
  );
}

export type SavePkkNoteState = { error?: string; success?: boolean };

export async function savePkkCustomerNote(
  ownerKey: string,
  contactEmail: string,
  note: string,
): Promise<SavePkkNoteState> {
  try {
    await requirePageAccess("pkk");
  } catch {
    return { error: "Ingen tilgang." };
  }

  const trimmedKey = ownerKey.trim();
  if (!trimmedKey) {
    return { error: "Ugyldig kunde." };
  }

  const supabase = (await createClient()) as unknown as SupabaseClient<Database>;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Du må være innlogget." };
  }

  const email = contactEmail.trim() || null;
  const noteText = note.trim() || null;

  if (!email && !noteText) {
    const { error } = await supabase
      .from("pkk_customer_notes")
      .delete()
      .eq("user_id", user.id)
      .eq("owner_key", trimmedKey);

    if (error) return { error: error.message };
    revalidatePath("/pkk");
    return { success: true };
  }

  const { error } = await supabase.from("pkk_customer_notes").upsert(
    {
      user_id: user.id,
      owner_key: trimmedKey,
      contact_email: email,
      note: noteText,
    },
    { onConflict: "user_id,owner_key" },
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/pkk");
  return { success: true };
}
