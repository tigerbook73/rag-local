import "dotenv/config";
import { Worker } from "bullmq";

const connection = {
  host: new URL(process.env["REDIS_URL"] ?? "redis://localhost:6379").hostname,
  port: Number(new URL(process.env["REDIS_URL"] ?? "redis://localhost:6379").port || 6379),
};

const worker = new Worker(
  "embedding",
  (job) => {
    console.log(`[worker] received job ${job.name} (${job.id}) — not yet implemented`);
    return Promise.resolve();
  },
  { connection, concurrency: Number(process.env["WORKER_CONCURRENCY"] ?? 2) },
);

worker.on("completed", (job) => console.log(`[worker] job ${job.id} completed`));
worker.on("failed", (job, err) => console.error(`[worker] job ${job?.id} failed`, err));

console.log("[worker] listening on queue: embedding");
