/**
 * Ren rolle-modell (uten server-only/next-avhengigheter) slik at den kan
 * importeres både fra server-kode og klientkomponenter.
 */

/** Kanoniske brukerroller, sortert fra minst til mest tilgang. */
export const ROLES = ["salg", "service", "leder", "super"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  salg: "Salg",
  service: "Service",
  leder: "Leder",
  super: "Super",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  salg: "Tilgang til nyregistreringer",
  service: "Tilgang til populasjon/bestand",
  leder: "Tilgang til nyregistreringer og populasjon",
  super: "Full tilgang, inkludert brukeradministrasjon",
};

/** Sider/funksjoner i appen som kan tilgangsstyres. */
export type AppPage =
  | "dashboard"
  | "nyregistreringer"
  | "populasjon"
  | "rapportvisninger"
  | "admin";

/** Hvilke sider hver rolle har tilgang til. */
export const ROLE_PAGES: Record<Role, readonly AppPage[]> = {
  salg: ["nyregistreringer", "rapportvisninger"],
  service: ["populasjon", "rapportvisninger"],
  leder: ["dashboard", "nyregistreringer", "populasjon", "rapportvisninger"],
  super: [
    "dashboard",
    "nyregistreringer",
    "populasjon",
    "rapportvisninger",
    "admin",
  ],
};

/**
 * Mapper en rå rolleverdi fra Supabase `app_metadata.role` til en kanonisk
 * rolle. Bakoverkompatibel: "admin" → super, "user"/ukjent/tom → leder.
 */
export function resolveRole(raw: unknown): Role {
  if (typeof raw === "string") {
    if ((ROLES as readonly string[]).includes(raw)) {
      return raw as Role;
    }
    if (raw === "admin") return "super";
  }
  // "user", ukjent eller uatt rolle → leder (ingen mister tilgang).
  return "leder";
}

/** True hvis rollen har tilgang til den gitte siden. */
export function roleCanAccess(role: Role, page: AppPage): boolean {
  return ROLE_PAGES[role].includes(page);
}
