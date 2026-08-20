/**
 * Ren rolle-modell (uten server-only/next-avhengigheter) slik at den kan
 * importeres både fra server-kode og klientkomponenter.
 */

/** Kanoniske brukerroller, sortert fra minst til mest tilgang. */
export const ROLES = ["salg", "service", "pkk", "leder", "super"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  salg: "Salg",
  service: "Service",
  pkk: "PKK / Service",
  leder: "Leder",
  super: "Super",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  salg: "Tilgang til nyregistreringer",
  service: "Tilgang til populasjon/bestand",
  pkk: "Tilgang til PKK-oppfølging",
  leder: "Tilgang til oversikt, nyregistreringer, populasjon, PKK, TMF og presentasjon",
  super: "Full tilgang inkl. TMF, presentasjon og brukeradministrasjon",
};

/** Sider/funksjoner i appen som kan tilgangsstyres. */
export type AppPage =
  | "dashboard"
  | "nyregistreringer"
  | "populasjon"
  | "pkk"
  | "tmf"
  | "rapportvisninger"
  | "presentasjon"
  | "admin";

/** Hvilke sider hver rolle har tilgang til. */
export const ROLE_PAGES: Record<Role, readonly AppPage[]> = {
  salg: ["nyregistreringer", "rapportvisninger"],
  service: ["populasjon", "rapportvisninger"],
  pkk: ["pkk", "rapportvisninger"],
  leder: [
    "dashboard",
    "nyregistreringer",
    "populasjon",
    "pkk",
    "tmf",
    "rapportvisninger",
    "presentasjon",
  ],
  super: [
    "dashboard",
    "nyregistreringer",
    "populasjon",
    "pkk",
    "tmf",
    "rapportvisninger",
    "presentasjon",
    "admin",
  ],
};

/**
 * Mapper en rå rolleverdi fra Supabase `app_metadata.role` til en kanonisk
 * rolle. Ukjent/tom → null (ingen tilgang — fail closed).
 * Legacy "admin" er fjernet; bruk "super".
 */
export function resolveRole(raw: unknown): Role | null {
  if (typeof raw === "string" && (ROLES as readonly string[]).includes(raw)) {
    return raw as Role;
  }
  return null;
}

/** True hvis rollen har tilgang til den gitte siden. */
export function roleCanAccess(
  role: Role | null | undefined,
  page: AppPage,
): boolean {
  if (!role) return false;
  return ROLE_PAGES[role].includes(page);
}
