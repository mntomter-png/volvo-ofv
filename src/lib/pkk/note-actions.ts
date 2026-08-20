"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { assertPageAccess } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export interface PkkCustomerNote {
  contactEmail: string;
  note: string;
}

export type PkkCustomerNotesMap = Record<string, PkkCustomerNote>;

/** Henter notater for en bruker (kaller uten ekstra page-redirect). */
export async function fetchPkkCustomerNotesForUser(
  userId: string,
): Promise<PkkCustomerNotesMap> {
  const supabase = (await createClient()) as unknown as SupabaseClient<Database>;

  const { data, error } = await supabase
    .from("pkk_customer_notes")
    .select("owner_key, contact_email, note")
    .eq("user_id", userId);

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

export async function getPkkCustomerNotes(): Promise<PkkCustomerNotesMap> {
  const user = await assertPageAccess("pkk");
  return fetchPkkCustomerNotesForUser(user.id);
}

export type SavePkkNoteState = { error?: string; success?: boolean };

export async function savePkkCustomerNote(
  ownerKey: string,
  contactEmail: string,
  note: string,
): Promise<SavePkkNoteState> {
  let user;
  try {
    user = await assertPageAccess("pkk");
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Ingen tilgang.",
    };
  }

  const trimmedKey = ownerKey.trim();
  if (!trimmedKey) {
    return { error: "Ugyldig kunde." };
  }

  const supabase = (await createClient()) as unknown as SupabaseClient<Database>;

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
