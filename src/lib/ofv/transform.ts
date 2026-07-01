import type {
  OfvRegistrant,
  OfvTransaction,
  OfvVehicle,
  OfvVehicleDetails,
  PopulationInsert,
  RegistrationInsert,
} from "@/lib/ofv/types";

function parseIntOrNull(value?: string | number | null): number | null {
  if (value == null || value === "") return null;
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBodyworkFields(
  txn: OfvTransaction,
  details: OfvVehicleDetails | undefined,
) {
  // OFV leverer påbygg via `additionalBodyworks` (array av {id, name}) for
  // lastebiler – ikke via `bodywork`/`bodyworkCode`. Vi bruker første oppføring
  // som primært påbygg, med eldre felt som fallback.
  const additional = Array.isArray(txn.additionalBodyworks)
    ? txn.additionalBodyworks[0]
    : undefined;
  const bodywork = txn.bodywork ?? details?.bodywork;
  const codeRaw =
    additional?.id ??
    additional?.code ??
    txn.bodyworkCode ??
    bodywork?.code ??
    bodywork?.id ??
    details?.bodyworkCode;
  const name =
    additional?.name ?? txn.bodyworkName ?? bodywork?.name ?? null;

  return {
    bodywork_code: parseIntOrNull(codeRaw),
    bodywork_name: name,
  };
}

function parseDateOrNull(value?: string): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function isPkkInspection(typeName?: string): boolean {
  if (!typeName) return true;
  return /periodisk|pkk|kjøretøy kontroll/i.test(typeName);
}

function parsePkkFields(vehicle: OfvVehicle): {
  pkk_last_date: string | null;
  pkk_next_deadline: string | null;
} {
  const pkk_next_deadline = parseDateOrNull(
    vehicle.vehicleDetails?.nextInspectionDate,
  );

  const pkkTimes = (vehicle.inspections ?? [])
    .filter((inspection) => isPkkInspection(inspection.typeName))
    .map((inspection) => inspection.time)
    .filter((time): time is string => Boolean(time))
    .sort()
    .reverse();

  const pkk_last_date = pkkTimes[0] ? parseDateOrNull(pkkTimes[0]) : null;

  return { pkk_last_date, pkk_next_deadline };
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function companyName(registrant?: {
  displayName?: string;
  company?: { name?: string };
}): string | null {
  return registrant?.company?.name ?? registrant?.displayName ?? null;
}

function companyOrgnr(registrant?: {
  company?: { companyRegistrationNumber?: string };
}): string | null {
  return registrant?.company?.companyRegistrationNumber ?? null;
}

function registrantAddressFields(registrant?: OfvRegistrant) {
  return {
    postal_code: registrant?.postalCode ?? null,
    postal_district: registrant?.postalDistrict ?? null,
    street: registrant?.company?.streetAndNumber ?? null,
    company_postal_code: registrant?.company?.postalCode ?? null,
    company_postal_district: registrant?.company?.postalDistrict ?? null,
  };
}

function baseVehicleFields(
  txn: OfvTransaction,
  details: OfvVehicleDetails | undefined,
  dataVersion: number,
): Omit<
  RegistrationInsert,
  "registration_number" | "transaction_time" | "transaction_type_id"
> {
  const owner = registrantAddressFields(txn.primaryOwner);
  const user = registrantAddressFields(txn.primaryUser);

  return {
    make_id: txn.make?.id ?? null,
    make_name: txn.make?.name ?? null,
    model_id: txn.model?.id ?? null,
    model_name: txn.model?.name ?? null,
    variant_id: txn.variant?.id ?? null,
    variant_name: txn.variant?.name ?? null,
    fuel_id: txn.fuel?.id ?? null,
    fuel_name: txn.fuel?.name ?? null,
    usage_id: txn.usage?.id ?? null,
    usage_name: txn.usage?.name ?? null,
    vehicle_type_id: txn.vehicleType?.id ?? null,
    vehicle_type_name: txn.vehicleType?.name ?? null,
    authority_vehicle_type_id: txn.authorityVehicleType?.id ?? null,
    authority_vehicle_type_name: txn.authorityVehicleType?.name ?? null,
    ...parseBodyworkFields(txn, details),
    maximum_laden_mass_kg: parseIntOrNull(txn.maximumLadenMassKg),
    mass_in_running_order_kg: parseIntOrNull(txn.massInRunningOrderKg),
    engine_power_kw: parseIntOrNull(details?.enginePowerKw),
    engine_power_hp: parseIntOrNull(details?.enginePowerHp),
    total_cylinder_capacity_cm3: parseIntOrNull(
      details?.totalCylinderCapacityCm3,
    ),
    number_of_axles: parseIntOrNull(details?.numberOfAxles),
    vin: details?.vehicleIdentificationNumber ?? null,
    first_registration_date: parseDateOrNull(details?.firstRegistrationDate),
    vehicle_status: details?.currentStatus?.name ?? null,
    certificate_variant_designation:
      readString(txn.certificateVariantDesignation) ??
      readString(details?.certificateVariantDesignation) ??
      null,
    primary_owner_name: companyName(txn.primaryOwner),
    primary_owner_orgnr: companyOrgnr(txn.primaryOwner),
    primary_owner_postal_code: owner.postal_code,
    primary_owner_postal_district: owner.postal_district,
    primary_owner_street: owner.street,
    primary_owner_company_postal_code: owner.company_postal_code,
    primary_owner_company_postal_district: owner.company_postal_district,
    primary_user_name: companyName(txn.primaryUser),
    primary_user_orgnr: companyOrgnr(txn.primaryUser),
    primary_user_postal_code: user.postal_code,
    primary_user_postal_district: user.postal_district,
    primary_user_street: user.street,
    primary_user_company_postal_code: user.company_postal_code,
    primary_user_company_postal_district: user.company_postal_district,
    leasing_company_name: txn.leasingDetails?.leasingCompany?.name ?? null,
    leasing_company_orgnr:
      txn.leasingDetails?.leasingCompany?.companyRegistrationNumber ?? null,
    ofv_data_version: dataVersion,
  };
}

export function vehicleToRegistrationRows(
  vehicle: OfvVehicle,
  dataVersion: number,
): RegistrationInsert[] {
  const details = vehicle.vehicleDetails;
  const transactions = vehicle.transactions ?? [];

  return transactions
    .filter((txn) => txn.registrationNumber && txn.transactionTime && txn.transactionType?.id)
    .map((txn) => ({
      registration_number: txn.registrationNumber!,
      transaction_time: txn.transactionTime!,
      transaction_type_id: txn.transactionType!.id!,
      transaction_type_name: txn.transactionType?.name ?? null,
      ...baseVehicleFields(txn, details, dataVersion),
    }));
}

export function vehicleToPopulationRows(
  vehicle: OfvVehicle,
  snapshotDate: string,
  dataVersion: number,
): PopulationInsert[] {
  const details = vehicle.vehicleDetails;
  const transactions = vehicle.transactions ?? [];
  const txn = transactions.at(-1) ?? transactions[0];

  if (!txn?.registrationNumber) return [];

  return [
    {
      registration_number: txn.registrationNumber,
      snapshot_date: snapshotDate,
      ...baseVehicleFields(txn, details, dataVersion),
      ...parsePkkFields(vehicle),
    },
  ];
}
