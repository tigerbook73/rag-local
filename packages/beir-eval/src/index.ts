import { Command } from "commander";
import { cmdImport } from "./commands/import.js";
import { cmdEmbed } from "./commands/embed.js";
import { cmdEval } from "./commands/eval.js";
import { cmdInject } from "./commands/inject.js";
import { cmdEject } from "./commands/eject.js";
import { cmdList } from "./commands/list.js";

const DEFAULT_MODEL = "bge-m3";
const DEFAULT_STRATEGY = "fixed" as const;
const DEFAULT_CHUNK_SIZE = 512;
const DEFAULT_CHUNK_OVERLAP = 50;

const program = new Command()
  .name("beir-eval")
  .description("BEIR offline retrieval evaluation CLI");

program
  .command("list")
  .description("List all available BEIR datasets from HuggingFace")
  .action(async () => {
    await cmdList();
  });

program
  .command("import")
  .description("Download BEIR dataset from HuggingFace")
  .requiredOption("--dataset <name>", "BEIR dataset name (e.g. nfcorpus)")
  .action(async (opts: { dataset: string }) => {
    await cmdImport(opts.dataset);
  });

program
  .command("embed")
  .description("Chunk corpus docs and generate embeddings")
  .requiredOption("--dataset <name>", "BEIR dataset name")
  .option("--model <name>", "Embedding model identifier", DEFAULT_MODEL)
  .option("--strategy <s>", "Chunking strategy: fixed | semantic", DEFAULT_STRATEGY)
  .option("--chunk-size <n>", "Chunk size in characters", String(DEFAULT_CHUNK_SIZE))
  .option("--chunk-overlap <n>", "Chunk overlap in characters", String(DEFAULT_CHUNK_OVERLAP))
  .option("--batch-size <n>", "Embedding batch size", "32")
  .action(
    async (opts: {
      dataset: string;
      model: string;
      strategy: string;
      chunkSize: string;
      chunkOverlap: string;
      batchSize: string;
    }) => {
      await cmdEmbed({
        dataset: opts.dataset,
        model: opts.model,
        strategy: opts.strategy as "fixed" | "semantic",
        chunkSize: parseInt(opts.chunkSize, 10),
        chunkOverlap: parseInt(opts.chunkOverlap, 10),
        batchSize: parseInt(opts.batchSize, 10),
      });
    },
  );

program
  .command("eval")
  .description("Run retrieval evaluation and save results")
  .requiredOption("--dataset <name>", "BEIR dataset name")
  .option("--model <name>", "Embedding model identifier", DEFAULT_MODEL)
  .option("--strategy <s>", "Chunking strategy: fixed | semantic", DEFAULT_STRATEGY)
  .option("--chunk-size <n>", "Chunk size in characters", String(DEFAULT_CHUNK_SIZE))
  .option("--chunk-overlap <n>", "Chunk overlap in characters", String(DEFAULT_CHUNK_OVERLAP))
  .option("--sample <n>", "Number of queries to sample", "100")
  .action(
    async (opts: {
      dataset: string;
      model: string;
      strategy: string;
      chunkSize: string;
      chunkOverlap: string;
      sample: string;
    }) => {
      await cmdEval({
        dataset: opts.dataset,
        model: opts.model,
        strategy: opts.strategy as "fixed" | "semantic",
        chunkSize: parseInt(opts.chunkSize, 10),
        chunkOverlap: parseInt(opts.chunkOverlap, 10),
        sample: parseInt(opts.sample, 10),
      });
    },
  );

program
  .command("inject")
  .description("Copy BEIR corpus into production documents/chunks tables")
  .requiredOption("--dataset <name>", "BEIR dataset name")
  .option("--model <name>", "Embedding model identifier", DEFAULT_MODEL)
  .option("--strategy <s>", "Chunking strategy: fixed | semantic", DEFAULT_STRATEGY)
  .option("--chunk-size <n>", "Chunk size in characters", String(DEFAULT_CHUNK_SIZE))
  .option("--chunk-overlap <n>", "Chunk overlap in characters", String(DEFAULT_CHUNK_OVERLAP))
  .action(
    async (opts: {
      dataset: string;
      model: string;
      strategy: string;
      chunkSize: string;
      chunkOverlap: string;
    }) => {
      await cmdInject({
        dataset: opts.dataset,
        model: opts.model,
        strategy: opts.strategy as "fixed" | "semantic",
        chunkSize: parseInt(opts.chunkSize, 10),
        chunkOverlap: parseInt(opts.chunkOverlap, 10),
      });
    },
  );

program
  .command("eject")
  .description("Remove injected BEIR documents from production tables")
  .requiredOption("--dataset <name>", "BEIR dataset name")
  .action(async (opts: { dataset: string }) => {
    await cmdEject(opts.dataset);
  });

if (process.argv.length <= 2) {
  program.help(); // exits 0
} else {
  program.parse(process.argv);
}
