import type { Job } from "bullmq";

export function processNoop(job: Job): { done: boolean } {
  console.log(`[noop] processing job ${job.id}`);
  return { done: true };
}
