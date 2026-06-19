import { fetchBeirDatasets } from "../libs/hf-client.js";

export async function cmdList(): Promise<void> {
  console.log("[list] fetching available BEIR datasets from HuggingFace...");
  const datasets = await fetchBeirDatasets();
  console.log(`\nFound ${datasets.length} datasets:\n`);
  for (const name of datasets) {
    console.log(`  ${name}`);
  }
}
