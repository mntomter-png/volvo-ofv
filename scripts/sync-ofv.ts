import { runOfvSync } from "../src/lib/sync/run-ofv-sync";

const scope = (process.argv[2] as "full" | "registrations" | "population") ?? "full";
const force = process.argv.includes("--force");

runOfvSync({ scope, force })
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
