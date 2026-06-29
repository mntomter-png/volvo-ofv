/** OFV Statistikk API – typer basert på live-responser og Swagger. */

export interface OfvDimension {
  id?: string;
  code?: string;
  name?: string;
}

export interface OfvCompany {
  name?: string;
  companyRegistrationNumber?: string;
  streetAndNumber?: string;
  postalCode?: string;
  postalDistrict?: string;
}

export interface OfvRegistrant {
  displayName?: string;
  postalCode?: string;
  postalDistrict?: string;
  company?: OfvCompany;
}

export interface OfvLeasingDetails {
  leasingCompany?: {
    name?: string;
    companyRegistrationNumber?: string;
  };
}

export interface OfvTransaction {
  registrationNumber?: string;
  transactionTime?: string;
  transactionType?: OfvDimension;
  make?: OfvDimension;
  model?: OfvDimension;
  variant?: OfvDimension;
  fuel?: OfvDimension;
  usage?: OfvDimension;
  vehicleType?: OfvDimension;
  authorityVehicleType?: OfvDimension;
  bodywork?: OfvDimension;
  bodyworkCode?: string;
  bodyworkName?: string;
  additionalBodyworks?: string | OfvDimension[];
  certificateVariantDesignation?: string;
  maximumLadenMassKg?: string;
  massInRunningOrderKg?: string;
  primaryOwner?: OfvRegistrant;
  primaryUser?: OfvRegistrant;
  leasingDetails?: OfvLeasingDetails;
}

export interface OfvVehicleDetails {
  firstRegistrationDate?: string;
  vehicleIdentificationNumber?: string;
  currentStatus?: { name?: string };
  numberOfAxles?: string;
  enginePowerKw?: string;
  enginePowerHp?: string;
  certificateVariantDesignation?: string;
  bodywork?: OfvDimension;
  bodyworkCode?: string;
}

export interface OfvVehicle {
  transactions?: OfvTransaction[];
  vehicleDetails?: OfvVehicleDetails;
}

export interface OfvVehiclesResponse {
  vehicles: OfvVehicle[];
  totalNumberOfVehicles: number;
  dataVersion: number;
  latestTimestampInResult?: string;
}

export interface OfvCreateRequestResponse {
  handle: string;
  dataVersion: number;
}

export interface OfvStatusResponse {
  publishDate: string;
  dataVersion: number;
}

export interface OfvRequestDescription {
  fields: string[];
  filters?: Record<string, string[]>;
  population?: { populationDate: string };
  transactions?: {
    fromTransactionTime: string;
    toTransactionTime: string;
  };
}

export interface RegistrationInsert {
  registration_number: string;
  transaction_time: string;
  transaction_type_id: string;
  transaction_type_name?: string | null;
  make_id?: string | null;
  make_name?: string | null;
  model_id?: string | null;
  model_name?: string | null;
  variant_id?: string | null;
  variant_name?: string | null;
  fuel_id?: string | null;
  fuel_name?: string | null;
  usage_id?: string | null;
  usage_name?: string | null;
  vehicle_type_id?: string | null;
  vehicle_type_name?: string | null;
  authority_vehicle_type_id?: string | null;
  authority_vehicle_type_name?: string | null;
  bodywork_code?: number | null;
  bodywork_name?: string | null;
  certificate_variant_designation?: string | null;
  maximum_laden_mass_kg?: number | null;
  mass_in_running_order_kg?: number | null;
  engine_power_kw?: number | null;
  engine_power_hp?: number | null;
  number_of_axles?: number | null;
  vin?: string | null;
  first_registration_date?: string | null;
  vehicle_status?: string | null;
  primary_owner_name?: string | null;
  primary_owner_orgnr?: string | null;
  primary_owner_postal_code?: string | null;
  primary_owner_postal_district?: string | null;
  primary_owner_street?: string | null;
  primary_owner_company_postal_code?: string | null;
  primary_owner_company_postal_district?: string | null;
  primary_user_name?: string | null;
  primary_user_orgnr?: string | null;
  primary_user_postal_code?: string | null;
  primary_user_postal_district?: string | null;
  primary_user_street?: string | null;
  primary_user_company_postal_code?: string | null;
  primary_user_company_postal_district?: string | null;
  leasing_company_name?: string | null;
  leasing_company_orgnr?: string | null;
  ofv_data_version: number;
}

export interface PopulationInsert extends Omit<RegistrationInsert, "transaction_time" | "transaction_type_id" | "transaction_type_name"> {
  snapshot_date: string;
}

/** @deprecated Bruk RegistrationInsert / PopulationInsert */
export interface VehicleRecordInsert extends RegistrationInsert {
  snapshot_date?: string;
}
