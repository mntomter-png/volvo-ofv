/**
 * Supabase-databasetyper.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PageType = "dashboard" | "nyregistreringer" | "populasjon";
export type SyncType = "registrations" | "population" | "full";
export type SyncStatus = "running" | "completed" | "failed";

export interface ReportViewConfig {
  filters?: Record<string, Json>;
  visibleColumns?: string[];
  sorting?: { id: string; desc: boolean }[];
  dateRange?: { from: string | null; to: string | null };
  chart?: {
    type?: "bar" | "line" | "area" | "pie";
    metric?: string;
    groupBy?: string;
  };
  [key: string]: Json | undefined;
}

export interface VehicleRecordRow {
  id: string;
  registration_number: string;
  make_id: string | null;
  make_name: string | null;
  model_id: string | null;
  model_name: string | null;
  variant_id: string | null;
  variant_name: string | null;
  fuel_id: string | null;
  fuel_name: string | null;
  usage_id: string | null;
  usage_name: string | null;
  vehicle_type_id: string | null;
  vehicle_type_name: string | null;
  authority_vehicle_type_id: string | null;
  authority_vehicle_type_name: string | null;
  maximum_laden_mass_kg: number | null;
  mass_in_running_order_kg: number | null;
  engine_power_kw: number | null;
  engine_power_hp: number | null;
  number_of_axles: number | null;
  vin: string | null;
  first_registration_date: string | null;
  vehicle_status: string | null;
  primary_owner_name: string | null;
  primary_owner_orgnr: string | null;
  primary_owner_postal_code: string | null;
  primary_owner_postal_district: string | null;
  primary_owner_street: string | null;
  primary_owner_company_postal_code: string | null;
  primary_owner_company_postal_district: string | null;
  primary_user_name: string | null;
  primary_user_orgnr: string | null;
  primary_user_postal_code: string | null;
  primary_user_postal_district: string | null;
  primary_user_street: string | null;
  primary_user_company_postal_code: string | null;
  primary_user_company_postal_district: string | null;
  leasing_company_name: string | null;
  leasing_company_orgnr: string | null;
  ofv_data_version: number;
  synced_at: string;
}

export interface Database {
  public: {
    Tables: {
      user_report_views: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          page_type: PageType;
          config: ReportViewConfig;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          page_type: PageType;
          config?: ReportViewConfig;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          page_type?: PageType;
          config?: ReportViewConfig;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sync_logs: {
        Row: {
          id: string;
          sync_type: SyncType;
          status: SyncStatus;
          started_at: string;
          completed_at: string | null;
          ofv_data_version: number | null;
          ofv_publish_date: string | null;
          records_fetched: number;
          records_upserted: number;
          error_message: string | null;
          metadata: Json;
        };
        Insert: {
          id?: string;
          sync_type: SyncType;
          status?: SyncStatus;
          started_at?: string;
          completed_at?: string | null;
          ofv_data_version?: number | null;
          ofv_publish_date?: string | null;
          records_fetched?: number;
          records_upserted?: number;
          error_message?: string | null;
          metadata?: Json;
        };
        Update: {
          id?: string;
          sync_type?: SyncType;
          status?: SyncStatus;
          started_at?: string;
          completed_at?: string | null;
          ofv_data_version?: number | null;
          ofv_publish_date?: string | null;
          records_fetched?: number;
          records_upserted?: number;
          error_message?: string | null;
          metadata?: Json;
        };
        Relationships: [];
      };
      registrations: {
        Row: {
          id: string;
          registration_number: string;
          transaction_time: string;
          transaction_type_id: string;
          transaction_type_name: string | null;
          make_id: string | null;
          make_name: string | null;
          model_id: string | null;
          model_name: string | null;
          variant_id: string | null;
          variant_name: string | null;
          fuel_id: string | null;
          fuel_name: string | null;
          usage_id: string | null;
          usage_name: string | null;
          vehicle_type_id: string | null;
          vehicle_type_name: string | null;
          authority_vehicle_type_id: string | null;
          authority_vehicle_type_name: string | null;
          maximum_laden_mass_kg: number | null;
          mass_in_running_order_kg: number | null;
          engine_power_kw: number | null;
          engine_power_hp: number | null;
          number_of_axles: number | null;
          vin: string | null;
          first_registration_date: string | null;
          vehicle_status: string | null;
          primary_owner_name: string | null;
          primary_owner_orgnr: string | null;
          primary_owner_postal_code: string | null;
          primary_owner_postal_district: string | null;
          primary_owner_street: string | null;
          primary_owner_company_postal_code: string | null;
          primary_owner_company_postal_district: string | null;
          primary_user_name: string | null;
          primary_user_orgnr: string | null;
          primary_user_postal_code: string | null;
          primary_user_postal_district: string | null;
          primary_user_street: string | null;
          primary_user_company_postal_code: string | null;
          primary_user_company_postal_district: string | null;
          leasing_company_name: string | null;
          leasing_company_orgnr: string | null;
          ofv_data_version: number;
          synced_at: string;
        };
        Insert: {
          id?: string;
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
          synced_at?: string;
        };
        Update: {
          id?: string;
          registration_number?: string;
          transaction_time?: string;
          transaction_type_id?: string;
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
          ofv_data_version?: number;
          synced_at?: string;
        };
        Relationships: [];
      };
      population: {
        Row: {
          id: string;
          registration_number: string;
          snapshot_date: string;
          make_id: string | null;
          make_name: string | null;
          model_id: string | null;
          model_name: string | null;
          variant_id: string | null;
          variant_name: string | null;
          fuel_id: string | null;
          fuel_name: string | null;
          usage_id: string | null;
          usage_name: string | null;
          vehicle_type_id: string | null;
          vehicle_type_name: string | null;
          authority_vehicle_type_id: string | null;
          authority_vehicle_type_name: string | null;
          maximum_laden_mass_kg: number | null;
          mass_in_running_order_kg: number | null;
          engine_power_kw: number | null;
          engine_power_hp: number | null;
          number_of_axles: number | null;
          vin: string | null;
          first_registration_date: string | null;
          vehicle_status: string | null;
          primary_owner_name: string | null;
          primary_owner_orgnr: string | null;
          primary_owner_postal_code: string | null;
          primary_owner_postal_district: string | null;
          primary_owner_street: string | null;
          primary_owner_company_postal_code: string | null;
          primary_owner_company_postal_district: string | null;
          primary_user_name: string | null;
          primary_user_orgnr: string | null;
          primary_user_postal_code: string | null;
          primary_user_postal_district: string | null;
          primary_user_street: string | null;
          primary_user_company_postal_code: string | null;
          primary_user_company_postal_district: string | null;
          leasing_company_name: string | null;
          leasing_company_orgnr: string | null;
          ofv_data_version: number;
          synced_at: string;
        };
        Insert: {
          id?: string;
          registration_number: string;
          snapshot_date: string;
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
          synced_at?: string;
        };
        Update: {
          id?: string;
          registration_number?: string;
          snapshot_date?: string;
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
          ofv_data_version?: number;
          synced_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      dash_registrations_by_month: {
        Args: { p_segment: string | null };
        Returns: { month: string; count: number }[];
      };
      dash_registrations_by_make: {
        Args: { p_segment: string | null };
        Returns: { make_name: string; count: number }[];
      };
      dash_population_by_make: {
        Args: { p_segment: string | null };
        Returns: { make_name: string; count: number }[];
      };
      reg_summary_by_month: {
        Args: {
          p_year: number;
          p_segment: string | null;
          p_make: string | null;
        };
        Returns: { month: string; count: number }[];
      };
      reg_summary_by_make: {
        Args: {
          p_year: number;
          p_segment: string | null;
          p_make: string | null;
          p_month?: number | null;
        };
        Returns: { make_name: string; count: number }[];
      };
      pop_summary_by_make: {
        Args: {
          p_segment: string | null;
          p_make: string | null;
        };
        Returns: { make_name: string; count: number }[];
      };
      pop_summary_by_segment: {
        Args: {
          p_segment: string | null;
          p_make: string | null;
        };
        Returns: { segment: string; count: number; volvo_count: number }[];
      };
    };
    Enums: {
      page_type: PageType;
      sync_type: SyncType;
      sync_status: SyncStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
