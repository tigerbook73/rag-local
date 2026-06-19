import { fetchBeirDatasets } from "../libs/hf-client.js";

// Meta-datasets under the BeIR HuggingFace org that are not actual test collections
const EXCLUDE = new Set(["beir", "beir-corpus"]);

export async function cmdList(): Promise<void> {
  try {
    console.log("[list] fetching available BEIR datasets from HuggingFace...");
    const datasets = (await fetchBeirDatasets()).filter((d) => !EXCLUDE.has(d));
    console.log(`\nFound ${datasets.length} datasets:\n`);
    for (const name of datasets) {
      console.log(`  ${name}`);
    }
  } catch (err) {
    console.error(`[list] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
