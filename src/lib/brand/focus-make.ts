/** Legger til fokusmerke-parameter på RPC-kall (types oppdateres gradvis). */
export function withFocusMake<T extends object>(
  args: T,
  focusMake: string,
): T & { p_focus_make: string } {
  return { ...args, p_focus_make: focusMake };
}
