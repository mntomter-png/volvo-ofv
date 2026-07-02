/** Tillater kun interne stier (unngår open redirect). */
export function safeRedirectPath(input: string | null | undefined): string {
  const value = input?.trim() || "/";
  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/";
}
