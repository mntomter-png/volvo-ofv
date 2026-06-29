import { defaultRegistrationSyncFrom } from "../src/lib/ofv/constants";
import { runOfvSync } from "../src/lib/sync/run-ofv-sync";

const scope = (process.argv[2] as "full" | "registrations" | "population") ?? "full";
const from = defaultRegistrationSyncFrom();

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
