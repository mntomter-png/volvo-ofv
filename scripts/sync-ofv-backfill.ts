import {
  HISTORICAL_REGISTRATION_SYNC_FROM_YEAR,
} from "../src/lib/ofv/constants";
import {
  runHistoricalRegistrationBackfill,
  runOfvSync,
} from "../src/lib/sync/run-ofv-sync";

const scope = (process.argv[2] as "full" | "registrations" | "population") ?? "registrations";

function parseYearArg(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const year = Number.parseInt(value, 10);
  if (!Number.isFinite(year) || year < 2000) {
    throw new Error(`Ugyldig år: ${value}`);
  }
  return year;
}

const currentYear = new Date().getFullYear();
const fromYear = parseYearArg(process.argv[3], HISTORICAL_REGISTRATION_SYNC_FROM_YEAR);
const toYear = parseYearArg(process.argv[4], currentYear);

if (scope === "registrations") {
  console.log(
    `Starter historisk OFV-backfill for nyregistreringer (${fromYear}–${toYear})…`,
  );

  runHistoricalRegistrationBackfill(fromYear, toYear)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
} else {
  const from = `${fromYear}-01-01T00:00:00`;
  console.log(`Starter OFV backfill (scope=${scope}, from=${from})…`);

  runOfvSync({
    scope,
    force: true,
    registrationsFrom: from,
  })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
