export const REGISTRATIONS_TAB_IDS = [
  "oversikt",
  "region",
  "marked",
  "kjopere",
  "kontoer",
  "potensial",
  "detaljer",
] as const;

export type RegistrationsTabId = (typeof REGISTRATIONS_TAB_IDS)[number];

export const DEFAULT_REGISTRATIONS_TAB: RegistrationsTabId = "oversikt";

export const REGISTRATIONS_TABS: {
  id: RegistrationsTabId;
  label: string;
}[] = [
  { id: "oversikt", label: "Oversikt" },
  { id: "region", label: "Region & distrikt" },
  { id: "marked", label: "Marked & konkurranse" },
  { id: "kjopere", label: "Kjøpere" },
  { id: "kontoer", label: "Kundeutvikling" },
  { id: "potensial", label: "Potensial" },
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
