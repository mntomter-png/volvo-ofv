import { readFileSync } from "node:fs";

import { buildPopulationStreamingXlsx } from "@/lib/population/export-workbook";
import type { PopulationExportRow } from "@/lib/population/export-shared";

function row(index: number): PopulationExportRow {
  return {
    registration_number: "AB" + String(index).padStart(6, "0"),
    make_name: "Volvo",
    model_name: "FH Aero",
    variant_name: "FH 460 4x2",
    usage_name: "Godstransport",
    maximum_laden_mass_kg: 26_000,
    first_registration_date: "2018-04-12",
    vehicle_status: "Registrert",
    primary_owner_name: "Posten Norge AS Avdeling",
    primary_owner_postal_code: "0001",
    primary_owner_postal_district: "Oslo",
    primary_user_name: "A & B Transport",
    primary_user_postal_code: "5003",
    primary_user_postal_district: "Bergen",
  };
}

async function main(): Promise<void> {
  const count = 20_000;
  await buildPopulationStreamingXlsx(async (write) => {
    for (let index = 0; index < count; index += 1) {
      await write(row(index));
    }
  });

  const status = readFileSync("/proc/self/status", "utf8");
  const peakKb = Number(status.match(/^VmHWM:\s+(\d+)/m)?.[1] ?? "0");
  console.log(JSON.stringify({ peakRssMb: Math.round(peakKb / 1024), rows: count }));
}

void main();
