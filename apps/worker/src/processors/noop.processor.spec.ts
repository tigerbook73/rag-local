/**
 * @test-file   BullMQ Noop Processor
 * @description integration test for BullMQ job enqueue and processing
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY): Shengtian Liao @ [1]
 */
import { Queue, QueueEvents, Worker } from "bullmq";

const connection = { host: "localhost", port: 6379 };

/**
 * @test-suite  BullMQ noop job
 * @target      BullMQ queue enqueue and worker consumption
 * @strategy    integration, real Redis required
 * @cases
 *   - [PASS] returns { done: true } when a noop job is enqueued
 */
describe("BullMQ noop job", () => {
  let queue: Queue;
  let queueEvents: QueueEvents;
  let worker: Worker;

  beforeAll(() => {
    queue = new Queue("noop-test", { connection });
    queueEvents = new QueueEvents("noop-test", { connection });
    worker = new Worker(
      "noop-test",
      (job) => {
        return Promise.resolve({ done: true, id: job.id });
      },
      { connection },
    );
  });

  afterAll(async () => {
    await worker.close();
    await queueEvents.close();
    await queue.obliterate({ force: true });
    await queue.close();
  });

  it("returns { done: true } when a noop job is enqueued", async () => {
    const job = await queue.add("noop", { test: true });
    const result = await job.waitUntilFinished(queueEvents);
    expect(result).toMatchObject({ done: true });
  }, 10000);
});
