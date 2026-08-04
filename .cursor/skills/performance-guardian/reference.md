# Volvo OFV — Performance Reference

Living inventory of indexes, RPCs, query modules, and known bottlenecks. Update when adding migrations.

## Scale-sensitive tables

| Table | Growth pattern | Primary risk |
| --- | --- | --- |
| `registrations` | Append on each OFV sync | Filtered aggregations, counts, district/region functions per row |
| `population` | Snapshot per publish date | Same as registrations; always scope to latest `snapshot_date` |
| `user_report_views` | Per user, per page | RLS + index on `(user_id, page_type)`; keep `config` small |

## Indexes (current)

### registrations

| Index | Column(s) |
| --- | --- |
| `registrations_transaction_time_idx` | `transaction_time DESC` |
| `registrations_make_name_idx` | `make_name` |
| `registrations_transaction_type_id_idx` | `transaction_type_id` |
| `registrations_sales_region_idx` | `sales_region` |
| `registrations_heavy_time_idx` | `transaction_time DESC` (partial: type 10, ≥16t) |
| `registrations_heavy_district_idx` | `(sales_district, transaction_time DESC)` (partial: type 10, ≥16t) |
| `registrations_hp_bucket_idx` | `hp_bucket` |
| `registrations_pabygg_segment_idx` | `pabygg_segment` |
| `registrations_bodywork_code_idx` | `bodywork_code` |
| `registrations_disp_bucket_idx` | `disp_bucket` |
| `registrations_trekker_jevnlast_idx` | `trekker_jevnlast` |

### population

| Index | Column(s) |
| --- | --- |
| `population_snapshot_date_idx` | `snapshot_date DESC` |
| `population_make_name_idx` | `make_name` |
| `population_sales_region_idx` | `sales_region` |
| `population_hp_bucket_idx` | `hp_bucket` |
| `population_pabygg_segment_idx` | `pabygg_segment` |
| `population_bodywork_code_idx` | `bodywork_code` |
| `population_disp_bucket_idx` | `disp_bucket` |
| `population_trekker_jevnlast_idx` | `trekker_jevnlast` |

### user_report_views

| Index | Column(s) |
| --- | --- |
| `user_report_views_user_id_page_type_idx` | `(user_id, page_type)` |

**Not indexed (rely on composite filters + above):** `usage_name`, `fuel_name`, `primary_user_postal_code`. Adding these as filter dimensions may require new indexes.

## RPC functions

### Segmentation helpers

| Function | Purpose |
| --- | --- |
| `ofv_hp_bucket(hp, kw)` | HP bucket from power fields |
| `ofv_region_from_postal(postal)` | Sales region from postal code |
| `ofv_district_from_postal(postal)` | Dealer district from postal code |
| `ofv_pabygg_segment(...)` | Påbygg segment derivation |
| `ofv_disp_bucket(cc, fuel_name)` | Displacement bucket |
| `ofv_trekker_jevnlast(...)` | Chassis / jevnlast classification |

### registrations (`reg_*`)

| RPC | Used for |
| --- | --- |
| `reg_summary_by_month` | Monthly trend, KPIs |
| `reg_summary_by_make` | Make breakdown, filter options |
| `reg_summary_by_region` | Regional benchmarks |
| `reg_summary_by_district` | District breakdown (postal-derived) |
| `reg_summary_by_hp` | HP bucket chart |
| `reg_summary_by_fuel` | Fuel breakdown |
| `reg_summary_by_pabygg` | Påbygg shares |
| `reg_summary_by_disp` | Displacement breakdown |
| `reg_summary_by_chassis` | Chassis breakdown |
| `reg_make_share_by_month` | Stacked make competition chart |
| `reg_make_share_by_pabygg` | Make share by påbygg |
| `reg_electric_share_by_segment_month` | Electric trend |
| `reg_top_buyers` | Top buyers table |
| `reg_buyer_loyalty` | Buyer loyalty KPIs |
| `reg_buyer_loyalty_owners` | Loyalty owner drill-down |
| `reg_fleet_owners` | Fleet owner analytics |

### population (`pop_*`)

| RPC | Used for |
| --- | --- |
| `pop_summary_by_make` | Make breakdown |
| `pop_summary_by_segment` | Segment breakdown |
| `pop_summary_by_region` | Region breakdown |
| `pop_summary_by_fuel` | Fuel breakdown |
| `pop_fleet_owners` | Fleet owners |
| `pop_pkk_fleet_owners` | PKK fleet list |
| `pop_pkk_owner_vehicles` | PKK vehicle drill-down |

### Dashboard views (not RPC)

- `dashboard_registrations_by_month`
- `dashboard_registrations_by_make`
- `dashboard_registrations_by_segment`

## Query modules and fan-out

| Module | Key exports | Notes |
| --- | --- | --- |
| `src/lib/registrations/queries.ts` | `getRegistrationsPageData`, `getRegionTabData`, `getMarkedTabData` | Highest fan-out; tab gating critical |
| `src/lib/population/queries.ts` | `getPopulationPageData` | ~11 parallel calls on full load |
| `src/lib/dashboard/queries.ts` | `getDashboardData` | Uses views + counts |
| `src/lib/pkk/queries.ts` | PKK fleet data | 2 parallel RPCs |
| `src/lib/report-views/queries.ts` | `getReportViews` | Small table, RLS-scoped |

### Known fan-out hotspots

| Loader | Approx. parallel calls | Mitigation |
| --- | --- | --- |
| `getRegistrationsPageData` (oversikt tab) | 15+ | Tab flags: `loadOverview`, `loadDetaljer`, `loadKjopere` |
| `getRegionTabData` | ~9 | Separate tab panel; only loads on region tab |
| `getMarkedTabData` | 3 | Separate tab panel |
| `getPopulationPageData` | ~11 | Consider tab/view splitting if new panels added |

### Count query pattern

`fetchRegistrationsSummary` and similar run two `count: 'exact', head: true` queries (total + focus make). Acceptable now; at very large scale consider a single RPC returning both counts.

## Report views

- **Table:** `user_report_views` with RLS (`auth.uid() = user_id`)
- **Config schema:** `src/lib/report-views/config.ts` — only `filters.segment`, `filters.make`, `filters.year`
- **Gap:** URL filters on nyregistreringer (region, hp, fuel, etc.) are not all persisted in saved views — extending config is OK if values stay primitive and small

## App conventions

| Pattern | Location |
| --- | --- |
| Server pages | `src/app/(app)/**/*.tsx` (no `"use client"` on pages) |
| Client filters | `registrations-filters.tsx`, `population-filters.tsx`, `dashboard-filters.tsx` |
| `nuqs` URL state | Filter components + `registrations-tab-nav.tsx` |
| `force-dynamic` | `nyregistreringer`, `populasjon`, `pkk` pages |
| Page sizes | `REGISTRATIONS_PAGE_SIZE = 25`, `POPULATION_PAGE_SIZE` in constants |
| Focus make | `withFocusMake()` in `src/lib/brand/focus-make.ts` |

## Known bottlenecks / watch list

1. **`reg_summary_by_district`** — applies `ofv_district_from_postal()` per row; ensure heavy filters (`transaction_type_id`, mass, date range) apply first.
2. **`ofv_region_from_postal` / `ofv_district_from_postal`** — logic duplicated with `src/lib/ofv/segmentation.ts` `DISTRICT_RANGES`; keep in sync.
3. **Duplicate RPC calls** — e.g. `pop_summary_by_make` called twice in `getPopulationPageData` for different arg shapes; avoid adding more without consolidating.
4. **Recharts client bundles** — chart components are `"use client"`; avoid importing them in server-only modules.
5. **No materialized views yet** — if dashboards slow down at millions of rows, consider mat views refreshed on sync.

## New filter checklist

When adding a filter dimension:

1. Add column or generated column on `registrations` + `population` (if applicable)
2. Add index on both tables
3. Extend `reg_*` / `pop_*` RPCs with `p_*` param (follow `buildRegistrationFilterRpcArgs`)
4. Extend `applyRegistrationFilters` / `applyPopulationFilters`
5. Add to `nuqs` filter component only if user-facing
6. Update `reference.md` index and RPC tables
