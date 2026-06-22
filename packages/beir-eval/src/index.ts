import { Command } from "commander";
import { cmdImport } from "./commands/import.js";
import { cmdEmbed } from "./commands/embed.js";
import { cmdEval, type RetrievalMode } from "./commands/eval.js";
import { cmdInject } from "./commands/inject.js";
import { cmdEject } from "./commands/eject.js";
import { cmdList } from "./commands/list.js";
import { cmdStatus } from "./commands/status.js";
import { cmdBackup } from "./commands/backup.js";
import { cmdRestore } from "./commands/restore.js";
import { cmdClean } from "./commands/clean.js";
import { cmdBench } from "./commands/bench.js";

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
  .command("status")
  .description("Show corpus / chunk / embedding completion status per dataset")
  .option("--dataset <name>", "Filter to a specific BEIR dataset")
  .action(async (opts: { dataset?: string }) => {
    await cmdStatus(opts.dataset);
  });

program
  .command("backup")
  .description("Export corpus, chunks and embeddings to JSONL files (no eval data)")
  .requiredOption("--dataset <name>", "BEIR dataset name")
  .option("--output <dir>", "Output directory", "./beir-backup")
  .action(async (opts: { dataset: string; output: string }) => {
    await cmdBackup(opts);
  });

program
  .command("restore")
  .description("Import corpus, chunks and embeddings from a backup directory")
  .requiredOption("--dataset <name>", "BEIR dataset name")
  .option("--input <dir>", "Input directory", "./beir-backup")
  .action(async (opts: { dataset: string; input: string }) => {
    await cmdRestore(opts);
  });

program
  .command("clean")
  .description("Delete all BEIR data for a dataset (corpus, chunks, embeddings, eval runs)")
  .requiredOption("--dataset <name>", "BEIR dataset name")
  .action(async (opts: { dataset: string }) => {
    await cmdClean(opts.dataset);
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
  .option("--batch-size <n>", "Embedding batch size", "5")
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
  .option("--retrieval <mode>", "Retrieval mode: dense | bm25 | hybrid", "dense")
  .option("--rrf-k <n>", "RRF k parameter for hybrid fusion", "60")
  .action(
    async (opts: {
      dataset: string;
      model: string;
      strategy: string;
      chunkSize: string;
      chunkOverlap: string;
      retrieval: string;
      rrfK: string;
    }) => {
      const retrieval = opts.retrieval as RetrievalMode;
      if (!["dense", "bm25", "hybrid"].includes(retrieval)) {
        console.error(`[eval] invalid --retrieval value: ${retrieval}. Use dense | bm25 | hybrid`);
        process.exit(1);
      }
      await cmdEval({
        dataset: opts.dataset,
        model: opts.model,
        strategy: opts.strategy as "fixed" | "semantic",
        chunkSize: parseInt(opts.chunkSize, 10),
        chunkOverlap: parseInt(opts.chunkOverlap, 10),
        retrieval,
        rrfK: parseInt(opts.rrfK, 10),
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
  .command("bench")
  .description("Benchmark embedding sidecar to find the optimal batch size")
  .option("--batch-sizes <list>", "Comma-separated batch sizes to test", "30,60,90,120,180,240,300")
  .option("--sample-size <n>", "Number of sample chunks to embed per round", "256")
  .option("--chunk-size <n>", "Character length of each sample chunk", "512")
  .option("--rounds <n>", "Rounds per batch size (averaged)", "2")
  .action(
    async (opts: { batchSizes: string; sampleSize: string; chunkSize: string; rounds: string }) => {
      await cmdBench({
        batchSizes: opts.batchSizes.split(",").map(Number),
        sampleSize: parseInt(opts.sampleSize, 10),
        chunkSize: parseInt(opts.chunkSize, 10),
        rounds: parseInt(opts.rounds, 10),
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

// pnpm forwards args via '--' separator; strip it so commander sees subcommands correctly
const argv =
  process.argv[2] === "--"
    ? [process.argv[0]!, process.argv[1]!, ...process.argv.slice(3)]
    : process.argv;

if (argv.length <= 2) {
  program.help(); // exits 0
} else {
  program.parse(argv);
}
