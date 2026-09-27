import "dotenv/config";
import { officialScholarshipAggregator } from "../src/modules/scholarships/OfficialScholarshipAggregator";

async function main() {
  if (process.env.REAL_DATA_MODE === "false" || process.env.DEMO_MODE === "true") {
    throw new Error("Real scholarship sync is disabled while DEMO_MODE=true or REAL_DATA_MODE=false.");
  }
  const summary = await officialScholarshipAggregator.syncAll();
  console.log(`Official scholarship sync completed: ${summary.uniqueRecords} unique record(s), ${summary.upserted} upserted.`);
  for (const source of summary.sources) {
    const suffix = source.error ? ` — ${source.error}` : "";
    console.log(`${source.sourceName}: ${source.status} | ${source.recordsFound} found | ${source.recordsUpserted} primary | ${source.durationMs}ms${suffix}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
