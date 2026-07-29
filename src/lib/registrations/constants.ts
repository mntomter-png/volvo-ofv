export const REGISTRATIONS_PAGE_SIZE = 25;

export const REGISTRATION_LIST_COLUMNS = [
  "registration_number",
  "transaction_time",
  "make_name",
  "model_name",
  "pabygg_segment",
  "bodywork_code",
  "bodywork_name",
  "maximum_laden_mass_kg",
  "primary_owner_name",
  "primary_owner_postal_code",
  "primary_owner_postal_district",
  "primary_user_name",
  "primary_user_postal_code",
  "primary_user_postal_district",
] as const;

export type RegistrationListColumn =
  (typeof REGISTRATION_LIST_COLUMNS)[number];
