/** OFV Statistikk API – konstanter for lastebiler (alle merker). */

export const OFV_VEHICLE_TYPE_TRUCK = "13000";

/** Førstegangsregistrerte nye */
export const OFV_TRANSACTION_NEW_REGISTRATION = "10";

/** Tunge lastebiler – totalvekt over 16 tonn */
export const HEAVY_TRUCK_MIN_KG = 16000;

export const OFV_PAGE_SIZE = 500;

export const OFV_SYNC_FIELDS = [
  "RegistrationNumber",
  "Make",
  "Model",
  "Variant",
  "AuthorityVehicleType",
  "VehicleType",
  "Fuel",
  "Usage",
  "Bodywork",
  "Bodywork_Code",
  "AdditionalBodyworks",
  "CertificateVariantDesignation",
  "TransactionType",
  "TransactionTime",
  "FirstRegistrationDate",
  "VehicleIdentificationNumber",
  "MaximumLadenMassKg",
  "MassInRunningOrderKg",
  "EnginePowerKw",
  "EnginePowerHp",
  "NumberOfAxles",
  "PrimaryOwner",
  "PrimaryUser",
  "LeasingDetails",
  "CurrentStatus",
] as const;

export const TRUCK_FILTERS = {
  vehicleTypeIds: [OFV_VEHICLE_TYPE_TRUCK],
} as const;

export const NEW_REGISTRATION_FILTERS = {
  vehicleTypeIds: [OFV_VEHICLE_TYPE_TRUCK],
  transactionTypeIds: [OFV_TRANSACTION_NEW_REGISTRATION],
} as const;

/** Første synk henter registreringer fra dette året. */
export function defaultRegistrationSyncFrom(): string {
  const year = new Date().getFullYear();
  return `${year}-01-01T00:00:00`;
}
