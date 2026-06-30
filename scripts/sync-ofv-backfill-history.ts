import { backfillRegistrationsRange } from "../src/lib/sync/run-ofv-sync";

const startYear = Number.parseInt(process.argv[2] ?? "2020", 10);
const endYear = Number.parseInt(process.argv[3] ?? "2025", 10);

if (
  !Number.isFinite(startYear) ||
  !Number.isFinite(endYear) ||
  startYear > endYear
) {
  console.error("Bruk: sync-ofv-backfill-history.ts [startYear] [endYear]");
  console.error("Eksempel: npm run sync:history 2020 2025");
  process.exit(1);
}

async function main() {
  let totalFetched = 0;
  let totalUpserted = 0;

  for (let year = startYear; year <= endYear; year++) {
    const from = `${year}-01-01T00:00:00`;
    const to = `${year + 1}-01-01T00:00:00`;
    console.log(`\n=== ${year} (${from} → ${to}) ===`);

    const result = await backfillRegistrationsRange(from, to);
    totalFetched += result.fetched;
    totalUpserted += result.upserted;

    console.log(
      `${year}: hentet ${result.fetched}, lagret ${result.upserted} (dataVersion ${result.dataVersion})`,
    );
  }

  console.log(
    `\nFerdig: ${totalFetched} hentet, ${totalUpserted} lagret (${startYear}–${endYear}).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
