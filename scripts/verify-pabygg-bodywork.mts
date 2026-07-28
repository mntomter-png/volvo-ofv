/**
 * Smoke-test: alle nyregistreringsfaner + populasjon + dashboard RPCs
 * med pabygg/bodywork-filtre. Kjører mot lokal Next data-lag / Supabase.
 */
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const year = new Date().getFullYear();
const base = {
  p_year: year,
  p_segment: null,
  p_make: null,
  p_region: null,
  p_hp: null,
  p_fuel: null,
  p_pabygg: null as string | null,
  p_disp: null,
  p_chassis: null,
  p_bodywork: null as number | null,
  p_from: `${year}-01-01`,
  p_to: `${year}-12-31`,
};

const withFocus = { ...base, p_focus_make: "Volvo" };

type Case = {
  name: string;
  args: Record<string, unknown>;
  rpc: string;
  expectRows?: boolean;
};

const cases: Case[] = [
  // Dashboard
  {
    name: "dash segment = pabygg keys",
    rpc: "dash_registrations_by_segment",
    args: { p_segment: null, p_region: null, p_pabygg: null, p_focus_make: "Volvo" },
    expectRows: true,
  },
  {
    name: "dash population segment = pabygg",
    rpc: "dash_population_by_segment",
    args: { p_segment: null, p_region: null, p_pabygg: null, p_focus_make: "Volvo" },
    expectRows: true,
  },
  // Oversikt
  { name: "reg month", rpc: "reg_summary_by_month", args: { ...withFocus }, expectRows: true },
  { name: "reg make", rpc: "reg_summary_by_make", args: { ...base, p_month: null }, expectRows: true },
  { name: "reg pabygg", rpc: "reg_summary_by_pabygg", args: { ...withFocus, p_month: null }, expectRows: true },
  { name: "reg segment(=pabygg)", rpc: "reg_summary_by_segment", args: { ...withFocus, p_month: null }, expectRows: true },
  { name: "reg hp", rpc: "reg_summary_by_hp", args: { ...withFocus, p_month: null }, expectRows: true },
  { name: "reg fuel", rpc: "reg_summary_by_fuel", args: { ...withFocus, p_month: null }, expectRows: true },
  { name: "reg disp", rpc: "reg_summary_by_disp", args: { ...withFocus, p_month: null }, expectRows: true },
  // Region
  {
    name: "reg region + fleet",
    rpc: "reg_summary_by_region",
    args: { ...withFocus, p_month: null, p_fleet_filter: "all" },
    expectRows: true,
  },
  {
    name: "reg district",
    rpc: "reg_summary_by_district",
    args: { ...withFocus, p_month: null, p_fleet_filter: "all" },
    expectRows: true,
  },
  // Marked
  {
    name: "reg make share month (Construction)",
    rpc: "reg_make_share_by_month",
    args: { ...withFocus, p_pabygg: "Construction" },
    expectRows: true,
  },
  {
    name: "reg electric by pabygg",
    rpc: "reg_electric_share_by_segment_month",
    args: { ...withFocus },
    expectRows: true,
  },
  // Kjøpere
  {
    name: "reg top buyers",
    rpc: "reg_top_buyers",
    args: { ...withFocus, p_month: null, p_limit: 5 },
    expectRows: true,
  },
  {
    name: "reg buyer loyalty",
    rpc: "reg_buyer_loyalty",
    args: { ...withFocus, p_month: null },
    expectRows: true,
  },
  // Bodywork Krokløft
  {
    name: "bodywork=9 Krokløft → Construction only",
    rpc: "reg_summary_by_pabygg",
    args: { ...withFocus, p_month: null, p_bodywork: 9 },
    expectRows: true,
  },
  {
    name: "bodywork=-1 null bodywork",
    rpc: "reg_summary_by_pabygg",
    args: { ...withFocus, p_month: null, p_bodywork: -1 },
    expectRows: true,
  },
  {
    name: "pabygg Construction + bodywork 9",
    rpc: "reg_summary_by_make",
    args: { ...base, p_month: null, p_pabygg: "Construction", p_bodywork: 9 },
    expectRows: true,
  },
  // Population
  {
    name: "pop segment = pabygg",
    rpc: "pop_summary_by_segment",
    args: {
      p_segment: null,
      p_make: null,
      p_region: null,
      p_district: null,
      p_hp: null,
      p_fuel: null,
      p_pabygg: null,
      p_disp: null,
      p_chassis: null,
      p_age: null,
      p_bodywork: null,
      p_focus_make: "Volvo",
    },
    expectRows: true,
  },
  {
    name: "pop make + bodywork 10 tipp",
    rpc: "pop_summary_by_make",
    args: {
      p_segment: null,
      p_make: null,
      p_region: null,
      p_district: null,
      p_hp: null,
      p_fuel: null,
      p_pabygg: null,
      p_disp: null,
      p_chassis: null,
      p_age: null,
      p_bodywork: 10,
    },
    expectRows: true,
  },
];

const PABYGG = new Set(["Construction", "Distribution", "Long Haul", "Annet"]);

async function main() {
  let failed = 0;
  for (const c of cases) {
    const { data, error } = await sb.rpc(c.rpc, c.args);
    if (error) {
      console.error(`FAIL ${c.name}: ${error.message}`);
      failed++;
      continue;
    }
    const rows = (data ?? []) as Record<string, unknown>[];
    if (c.expectRows && rows.length === 0) {
      console.error(`FAIL ${c.name}: empty result`);
      failed++;
      continue;
    }

    if (c.name.includes("dash segment") || c.name.includes("pop segment") || c.rpc === "reg_summary_by_segment") {
      const keys = rows.map((r) => String(r.segment));
      const bad = keys.filter((k) => !PABYGG.has(k));
      if (bad.length) {
        console.error(`FAIL ${c.name}: non-pabygg keys ${bad.join(", ")}`);
        failed++;
        continue;
      }
    }

    if (c.name.includes("bodywork=9")) {
      if (rows.length !== 1 || rows[0].pabygg !== "Construction") {
        console.error(`FAIL ${c.name}: expected only Construction, got`, rows);
        failed++;
        continue;
      }
    }

    if (c.rpc === "reg_electric_share_by_segment_month") {
      const segs = [...new Set(rows.map((r) => String(r.segment)))];
      const bad = segs.filter((k) => !PABYGG.has(k));
      if (bad.length) {
        console.error(`FAIL ${c.name}: electric still on Usage: ${bad.join(", ")}`);
        failed++;
        continue;
      }
    }

    console.log(`OK   ${c.name} (${rows.length} rows)`);
  }

  // UI leftover scan in built source strings (static)
  console.log("\n--- leftover UI string scan ---");
  const scan = execSync(
    `rg -n "OFV-segment|OFV-oppbygning|\\?segment=" src/components src/app src/lib/registrations src/lib/population src/lib/dashboard src/lib/report-views || true`,
    { encoding: "utf8" },
  );
  if (scan.trim()) {
    console.error("Leftover UI references:\n" + scan);
    failed++;
  } else {
    console.log("OK   no OFV-segment / ?segment= leftovers in src UI paths");
  }

  if (failed) {
    console.error(`\n${failed} failure(s)`);
    process.exit(1);
  }
  console.log("\nAll checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
