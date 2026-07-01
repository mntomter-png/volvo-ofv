export const REGISTRATIONS_TAB_IDS = [
  "oversikt",
  "marked",
  "kjopere",
  "detaljer",
] as const;

export type RegistrationsTabId = (typeof REGISTRATIONS_TAB_IDS)[number];

export const DEFAULT_REGISTRATIONS_TAB: RegistrationsTabId = "oversikt";

export const REGISTRATIONS_TABS: {
  id: RegistrationsTabId;
  label: string;
}[] = [
  { id: "oversikt", label: "Oversikt" },
  { id: "marked", label: "Marked & konkurranse" },
  { id: "kjopere", label: "Kjøpere" },
  { id: "detaljer", label: "Detaljer" },
];

export function parseRegistrationsTab(
  value: unknown,
): RegistrationsTabId {
  if (
    typeof value === "string" &&
    (REGISTRATIONS_TAB_IDS as readonly string[]).includes(value)
  ) {
    return value as RegistrationsTabId;
  }
  return DEFAULT_REGISTRATIONS_TAB;
}
