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

export type PageType = "dashboard" | "nyregistreringer" | "populasjon" | "pkk";
export type SyncType = "registrations" | "population" | "full" | "ssb";
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
      pkk_customer_notes: {
        Row: {
          id: string;
          user_id: string;
          owner_key: string;
          contact_email: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          owner_key: string;
          contact_email?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          owner_key?: string;
          contact_email?: string | null;
          note?: string | null;
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
      ssb_indicators: {
        Row: {
          id: string;
          indicator_key: string;
          label: string;
          period: string;
          value: number;
          unit: string | null;
          tmf_driver: string;
          ssb_table_id: string;
          synced_at: string;
        };
        Insert: {
          id?: string;
          indicator_key: string;
          label: string;
          period: string;
          value: number;
          unit?: string | null;
          tmf_driver: string;
          ssb_table_id: string;
          synced_at?: string;
        };
        Update: {
          id?: string;
          indicator_key?: string;
          label?: string;
          period?: string;
          value?: number;
          unit?: string | null;
          tmf_driver?: string;
          ssb_table_id?: string;
          synced_at?: string;
        };
        Relationships: [];
      };
      tmf_budget_versions: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          target_year: number;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          target_year: number;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          target_year?: number;
          config?: Json;
          created_at?: string;
          updated_at?: string;
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
          bodywork_code: number | null;
          bodywork_name: string | null;
          certificate_variant_designation: string | null;
          maximum_laden_mass_kg: number | null;
          mass_in_running_order_kg: number | null;
          engine_power_kw: number | null;
          engine_power_hp: number | null;
          total_cylinder_capacity_cm3: number | null;
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
          sales_region: number | null;
          hp_bucket: number | null;
          pabygg_segment: string | null;
          disp_bucket: number | null;
          trekker_jevnlast: string | null;
          pkk_last_date: string | null;
          pkk_next_deadline: string | null;
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
          bodywork_code?: number | null;
          bodywork_name?: string | null;
          certificate_variant_designation?: string | null;
          maximum_laden_mass_kg?: number | null;
          mass_in_running_order_kg?: number | null;
          engine_power_kw?: number | null;
          engine_power_hp?: number | null;
          total_cylinder_capacity_cm3?: number | null;
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
          bodywork_code?: number | null;
          bodywork_name?: string | null;
          certificate_variant_designation?: string | null;
          maximum_laden_mass_kg?: number | null;
          mass_in_running_order_kg?: number | null;
          engine_power_kw?: number | null;
          engine_power_hp?: number | null;
          total_cylinder_capacity_cm3?: number | null;
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
          bodywork_code: number | null;
          bodywork_name: string | null;
          certificate_variant_designation: string | null;
          maximum_laden_mass_kg: number | null;
          mass_in_running_order_kg: number | null;
          engine_power_kw: number | null;
          engine_power_hp: number | null;
          total_cylinder_capacity_cm3: number | null;
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
          sales_region: number | null;
          hp_bucket: number | null;
          pabygg_segment: string | null;
          disp_bucket: number | null;
          trekker_jevnlast: string | null;
          pkk_last_date: string | null;
          pkk_next_deadline: string | null;
          sales_district: string | null;
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
          bodywork_code?: number | null;
          bodywork_name?: string | null;
          certificate_variant_designation?: string | null;
          maximum_laden_mass_kg?: number | null;
          mass_in_running_order_kg?: number | null;
          engine_power_kw?: number | null;
          engine_power_hp?: number | null;
          total_cylinder_capacity_cm3?: number | null;
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
          pkk_last_date?: string | null;
          pkk_next_deadline?: string | null;
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
          bodywork_code?: number | null;
          bodywork_name?: string | null;
          certificate_variant_designation?: string | null;
          maximum_laden_mass_kg?: number | null;
          mass_in_running_order_kg?: number | null;
          engine_power_kw?: number | null;
          engine_power_hp?: number | null;
          total_cylinder_capacity_cm3?: number | null;
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
    Views: {
      ofv_sync_health: {
        Row: {
          last_full_sync_at: string | null;
          last_full_data_version: number | null;
          last_full_publish_date: string | null;
          last_any_sync_at: string | null;
          hours_since_last_sync: number | null;
          stale_running_locks: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      dash_registrations_by_month: {
        Args: {
          p_segment: string | null;
          p_region?: number | null;
          p_pabygg?: string | null;
        };
        Returns: { month: string; count: number; volvo_count: number }[];
      };
      dash_registrations_by_make: {
        Args: {
          p_segment: string | null;
          p_region?: number | null;
          p_pabygg?: string | null;
        };
        Returns: { make_name: string; count: number }[];
      };
      dash_population_by_make: {
        Args: {
          p_segment: string | null;
          p_region?: number | null;
          p_pabygg?: string | null;
          p_focus_make?: string;
        };
        Returns: { make_name: string; count: number }[];
      };
      dash_registrations_by_segment: {
        Args: {
          p_segment: string | null;
          p_region?: number | null;
          p_pabygg?: string | null;
          p_focus_make?: string;
        };
        Returns: { segment: string; count: number; volvo_count: number }[];
      };
      dash_population_by_segment: {
        Args: {
          p_segment: string | null;
          p_region?: number | null;
          p_pabygg?: string | null;
          p_focus_make?: string;
        };
        Returns: { segment: string; count: number; volvo_count: number }[];
      };
      reg_summary_by_month: {
        Args: {
          p_year: number;
          p_from?: string | null;
          p_to?: string | null;
          p_segment: string | null;
          p_make: string | null;
          p_region?: number | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
        };
        Returns: { month: string; count: number; volvo_count: number }[];
      };
      reg_summary_by_make: {
        Args: {
          p_year: number;
          p_from?: string | null;
          p_to?: string | null;
          p_segment: string | null;
          p_make: string | null;
          p_month?: number | null;
          p_region?: number | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
        };
        Returns: { make_name: string; count: number }[];
      };
      reg_summary_by_region: {
        Args: {
          p_year: number;
          p_from?: string | null;
          p_to?: string | null;
          p_segment: string | null;
          p_make: string | null;
          p_month?: number | null;
          p_region?: number | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
        };
        Returns: { region: number; count: number; volvo_count: number }[];
      };
      reg_summary_by_district: {
        Args: {
          p_year: number;
          p_from?: string | null;
          p_to?: string | null;
          p_segment: string | null;
          p_make: string | null;
          p_month?: number | null;
          p_region?: number | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
          p_focus_make?: string;
        };
        Returns: {
          district: string;
          region: number;
          count: number;
          focus_count: number;
        }[];
      };
      reg_summary_by_hp: {
        Args: {
          p_year: number;
          p_from?: string | null;
          p_to?: string | null;
          p_segment: string | null;
          p_make: string | null;
          p_month?: number | null;
          p_region?: number | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
        };
        Returns: { bucket: number; count: number; volvo_count: number }[];
      };
      reg_summary_by_fuel: {
        Args: {
          p_year: number;
          p_from?: string | null;
          p_to?: string | null;
          p_segment: string | null;
          p_make: string | null;
          p_month?: number | null;
          p_region?: number | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
        };
        Returns: { fuel: string; count: number; volvo_count: number }[];
      };
      reg_fleet_owners: {
        Args: {
          p_year: number;
          p_from?: string | null;
          p_to?: string | null;
          p_segment: string | null;
          p_region?: number | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
          p_focus_make?: string;
        };
        Returns: {
          owner_key: string;
          owner_name: string;
          count: number;
          volvo_count: number;
        }[];
      };
      reg_make_share_by_pabygg: {
        Args: {
          p_year: number;
          p_from?: string | null;
          p_to?: string | null;
          p_segment: string | null;
          p_make: string | null;
          p_month?: number | null;
          p_region?: number | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
          p_focus_make?: string;
        };
        Returns: { pabygg: string; make_name: string; count: number }[];
      };
      reg_make_share_by_month: {
        Args: {
          p_year: number;
          p_from?: string | null;
          p_to?: string | null;
          p_segment: string | null;
          p_make: string | null;
          p_region?: number | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
          p_focus_make?: string;
        };
        Returns: { month: string; make_name: string; count: number }[];
      };
      reg_top_buyers: {
        Args: {
          p_year: number;
          p_from?: string | null;
          p_to?: string | null;
          p_segment: string | null;
          p_make: string | null;
          p_month?: number | null;
          p_region?: number | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
          p_limit?: number;
          p_focus_make?: string;
        };
        Returns: {
          owner_name: string;
          count: number;
          focus_count: number;
        }[];
      };
      reg_electric_share_by_segment_month: {
        Args: {
          p_year: number;
          p_from?: string | null;
          p_to?: string | null;
          p_segment: string | null;
          p_make: string | null;
          p_region?: number | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
          p_focus_make?: string;
        };
        Returns: {
          month: string;
          segment: string;
          total_count: number;
          electric_count: number;
        }[];
      };
      reg_buyer_loyalty: {
        Args: {
          p_year: number;
          p_from?: string | null;
          p_to?: string | null;
          p_segment: string | null;
          p_make: string | null;
          p_month?: number | null;
          p_region?: number | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
          p_focus_make?: string;
        };
        Returns: {
          buyer_type: string;
          owner_count: number;
          purchase_count: number;
          focus_count: number;
        }[];
      };
      reg_buyer_loyalty_owners: {
        Args: {
          p_year: number;
          p_buyer_type: string;
          p_from?: string | null;
          p_to?: string | null;
          p_segment: string | null;
          p_make: string | null;
          p_month?: number | null;
          p_region?: number | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
          p_limit?: number;
          p_focus_make?: string;
        };
        Returns: {
          owner_name: string;
          count: number;
          focus_count: number;
        }[];
      };
      reg_summary_by_pabygg: {
        Args: {
          p_year: number;
          p_from?: string | null;
          p_to?: string | null;
          p_segment: string | null;
          p_make: string | null;
          p_month?: number | null;
          p_region?: number | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
        };
        Returns: { pabygg: string; count: number; volvo_count: number }[];
      };
      reg_summary_by_disp: {
        Args: {
          p_year: number;
          p_from?: string | null;
          p_to?: string | null;
          p_segment: string | null;
          p_make: string | null;
          p_month?: number | null;
          p_region?: number | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
        };
        Returns: { bucket: number; count: number; volvo_count: number }[];
      };
      reg_summary_by_segment: {
        Args: {
          p_year: number;
          p_from?: string | null;
          p_to?: string | null;
          p_segment: string | null;
          p_make: string | null;
          p_month?: number | null;
          p_region?: number | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
        };
        Returns: { segment: string; count: number; volvo_count: number }[];
      };
      reg_summary_by_chassis: {
        Args: {
          p_year: number;
          p_from?: string | null;
          p_to?: string | null;
          p_segment: string | null;
          p_make: string | null;
          p_month?: number | null;
          p_region?: number | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
        };
        Returns: { chassis: string; count: number; volvo_count: number }[];
      };
      pop_summary_by_make: {
        Args: {
          p_segment: string | null;
          p_make: string | null;
          p_region?: number | null;
          p_district?: string | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
          p_age?: string | null;
          p_focus_make?: string;
        };
        Returns: { make_name: string; count: number }[];
      };
      pop_summary_by_segment: {
        Args: {
          p_segment: string | null;
          p_make: string | null;
          p_region?: number | null;
          p_district?: string | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
          p_age?: string | null;
          p_focus_make?: string;
        };
        Returns: { segment: string; count: number; volvo_count: number }[];
      };
      pop_summary_by_region: {
        Args: {
          p_segment: string | null;
          p_make: string | null;
          p_region?: number | null;
          p_district?: string | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
          p_age?: string | null;
          p_focus_make?: string;
        };
        Returns: { region: number; count: number; volvo_count: number }[];
      };
      pop_summary_by_fuel: {
        Args: {
          p_segment: string | null;
          p_make: string | null;
          p_region?: number | null;
          p_district?: string | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
          p_age?: string | null;
          p_focus_make?: string;
        };
        Returns: { fuel: string; count: number; volvo_count: number }[];
      };
      pop_fleet_owners: {
        Args: {
          p_segment: string | null;
          p_make: string | null;
          p_region?: number | null;
          p_district?: string | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
          p_age?: string | null;
          p_min_vehicles?: number;
          p_limit?: number;
          p_focus_make?: string;
        };
        Returns: {
          owner_name: string;
          count: number;
          focus_count: number;
        }[];
      };
      pop_pkk_fleet_owners: {
        Args: {
          p_segment: string | null;
          p_make: string | null;
          p_region?: number | null;
          p_district?: string | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
          p_age?: string | null;
          p_min_volvo?: number;
          p_limit?: number;
          p_focus_make?: string;
        };
        Returns: {
          owner_key: string;
          owner_name: string;
          focus_count: number;
          total_count: number;
          pkk_due_count: number;
        }[];
      };
      pop_pkk_summary: {
        Args: {
          p_region?: number | null;
          p_min_volvo?: number;
          p_customer_limit?: number;
          p_only_follow_up?: boolean;
          p_horizon?: string;
          p_exclude_finance?: boolean;
          p_customer_party?: string;
          p_focus_make?: string;
        };
        Returns: {
          customer_count: number;
          volvo_vehicles: number;
          overdue_count: number;
          due_30_count: number;
          due_90_count: number;
          due_180_count: number;
          no_pkk_date_count: number;
        }[];
      };
      pop_pkk_customers: {
        Args: {
          p_region?: number | null;
          p_min_volvo?: number;
          p_customer_limit?: number;
          p_only_follow_up?: boolean;
          p_horizon?: string;
          p_exclude_finance?: boolean;
          p_customer_party?: string;
          p_focus_make?: string;
        };
        Returns: {
          owner_key: string;
          owner_name: string;
          owner_orgnr: string | null;
          owner_location: string | null;
          sales_region: number | null;
          focus_count: number;
          overdue_count: number;
          due_30_count: number;
          due_90_count: number;
          due_180_count: number;
          no_pkk_count: number;
          next_deadline: string | null;
          days_to_next: number | null;
        }[];
      };
      pop_pkk_owner_vehicles: {
        Args: {
          p_owner_key: string;
          p_region?: number | null;
          p_months?: number;
          p_include_no_date?: boolean;
          p_horizon?: string;
          p_customer_party?: string;
          p_limit?: number;
          p_focus_make?: string;
        };
        Returns: {
          registration_number: string;
          make_name: string | null;
          model_name: string | null;
          first_registration_date: string | null;
          pkk_last_date: string | null;
          pkk_next_deadline: string | null;
          days_until_due: number | null;
        }[];
      };
      pop_pkk_due_soon_vehicles: {
        Args: {
          p_segment: string | null;
          p_make: string | null;
          p_region?: number | null;
          p_hp?: number | null;
          p_fuel?: string | null;
          p_pabygg?: string | null;
          p_disp?: number | null;
          p_chassis?: string | null;
          p_age?: string | null;
          p_months?: number;
          p_min_volvo?: number;
          p_owner_limit?: number;
          p_vehicle_limit?: number;
          p_customer_party?: string;
          p_focus_make?: string;
        };
        Returns: {
          owner_key: string;
          owner_name: string;
          focus_fleet_size: number;
          registration_number: string;
          model_name: string | null;
          first_registration_date: string | null;
          pkk_last_date: string | null;
          pkk_next_deadline: string | null;
          days_until_due: number | null;
        }[];
      };
      tmf_monthly_market: {
        Args: {
          p_from?: string | null;
          p_to?: string | null;
          p_focus_make?: string;
        };
        Returns: { month: string; pabygg: string; count: number; volvo_count: number }[];
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
