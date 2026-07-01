---
name: performance-guardian
description: >-
  Performance and scalability review for Volvo OFV. Use when implementing
  features, adding SQL migrations, data fetching, filters, report views, dashboard
  tabs, or RPC functions. Checks database indexes, Supabase RPC efficiency,
  React Server/Client boundaries, and scaling risks on registrations, population,
  and user_report_views.
---

# Volvo OFV Performance & Scalability Guardian

Ensure the Volvo OFV app stays fast as data, users, and saved report views grow.

Read [reference.md](reference.md) for the current index/RPC inventory and known bottlenecks.

## When to apply

Apply this skill when the task touches:

- `supabase/migrations/**` (schema, indexes, RPC, views)
- `src/lib/**/queries.ts` or `src/lib/**/actions.ts`
- `src/app/(app)/**` pages and tab panels
- Filters, charts, `user_report_views`, or `nuqs` URL state

**Do not** apply for copy, styling, auth UI, or changes with no data path.

## Core principles

1. **Database first** — Aggregations belong in Postgres RPC (`reg_*`, `pop_*`), not in the client. New filter dimensions need indexes on `registrations` and `population`.
2. **Minimize fan-out** — Each page load has a budget of parallel Supabase calls. Prefer tab-conditional loading over fetching everything upfront.
3. **Server by default** — Pages and data loaders are Server Components. `"use client"` only for interactivity (filters, charts, dialogs).
4. **Small config** — `user_report_views.config` stays minimal and validated in `src/lib/report-views/config.ts`. Never store chart data or row sets in JSONB.
5. **Explicit trade-offs** — When dev speed conflicts with performance, state both options and recommend the scalable one.

## Domain vocabulary (use these names)

| Concept | Column / field |
| --- | --- |
| Brand / make | `make_name`, focus make via `withFocusMake()` |
| Period | `transaction_time`, `year`, `month`, `p_from` / `p_to` |
| Segment | `usage_name` |
| Region | `sales_region` (derived from postal via `ofv_region_from_postal`) |
| District | `ofv_district_from_postal(primary_user_postal_code)` |
| Fuel | `fuel_name` |
| HP bucket | `hp_bucket` |
| Påbygg | `pabygg_segment` |
| Displacement | `disp_bucket` |
| Chassis | `trekker_jevnlast` |
| Heavy truck filter | `maximum_laden_mass_kg >= 16000`, `transaction_type_id = '10'` |
| Report views | `user_report_views` (`user_id`, `page_type`, `config`) |

## Review checklist

Before approving or implementing a change, verify:

- [ ] New filters have indexes on both `registrations` and `population` when queried
- [ ] Aggregations use existing or new RPC functions, not `select` + JS reduce
- [ ] Row-level functions (`ofv_*_from_postal`) run after selective `WHERE` clauses
- [ ] Page data is scoped to the active tab (see `getRegistrationsPageData` pattern)
- [ ] List queries use explicit column lists and pagination (`REGISTRATIONS_PAGE_SIZE` / `POPULATION_PAGE_SIZE`)
- [ ] Count queries use `{ count: 'exact', head: true }` only when needed — consider RPC counts at scale
- [ ] Client components do not fetch large datasets; data flows from server loaders
- [ ] `nuqs` drives filter URL state; saved views mirror only stable filter fields
- [ ] RPC functions use `security invoker` and match existing grant patterns

## Severity levels

| Level | Meaning | Action |
| --- | --- | --- |
| **Blocker** | Full table scan, unindexed new filter, client-side aggregation of large sets, N+1 queries | Must fix before merge |
| **Warning** | Extra RPC in `Promise.all`, heavy JSONB, unnecessary `"use client"`, duplicate count queries | Fix or document why acceptable |
| **OK** | UI-only, follows existing patterns, indexed filter, tab-scoped load | No perf comment needed |

## Review output format

When reviewing a feature or change, respond with:

```markdown
## Performance review

**Risk:** Low | Medium | High

### Findings
- [Blocker/Warning/OK] ...

### Recommended approach
...

### Trade-offs (if any)
- Fast to ship: ...
- Scales better: ...
```

## Patterns to preserve

- **Tab-conditional loading**: `getRegistrationsPageData(filters, focusMake, tab)` gates `loadOverview`, `loadDetaljer`, `loadKjopere`. Region and Marked tabs load in their own panel Server Components (`getRegionTabData`, `getMarkedTabData`).
- **Parallel RPC**: `Promise.all` for independent summaries — but watch total call count per page.
- **Filter builder**: `buildRegistrationFilterRpcArgs` / `applyRegistrationFilters` keep SQL and TS filters in sync.
- **Dashboard views**: `dashboard_registrations_by_*` for coarse dashboard aggregates; page-level detail uses RPC.
- **Dynamic pages**: `export const dynamic = "force-dynamic"` on data pages is intentional (auth + live filters). Do not add caching without analyzing stale-data risk.

## Warn explicitly when

- A proposal adds raw `from('registrations').select(...)` without filters on indexed columns
- A new tab or panel loads all RPCs regardless of visibility
- `config` JSONB grows beyond filter primitives (strings, numbers, null)
- A migration adds a computed column used in `WHERE` without an index
- Multiple `count: 'exact'` queries run per request without tab gating
