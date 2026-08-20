import { type NextRequest } from "next/server";

import { handleAuthEmailExchange } from "@/lib/auth/email-exchange";

/**
 * Primær e-post-callback (recovery / invite).
 * Støtter token_hash (e-postmal) og PKCE code (ConfirmationURL-fallback).
 *
 * Mal (anbefalt):
 * {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/oppdater-passord
 */
export async function GET(request: NextRequest) {
  return handleAuthEmailExchange(request);
}
