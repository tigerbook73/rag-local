/**
 * @test-file   Settings API
 * @description e2e tests for GET /settings and PATCH /settings (requires API running)
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */
import { test, expect } from "@playwright/test";

const API_BASE = "http://localhost:3001/api/v1";

/**
 * @test-suite  GET /settings
 * @target      settings response contains all expected AppSettings fields
 * @strategy    e2e, API request, no browser UI
 * @cases
 *   - [PASS] returns 200 with all required AppSettings fields when fetching settings
 */
test.describe("GET /settings", () => {
  test("returns 200 with all required AppSettings fields when fetching settings", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/settings`);
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body).toMatchObject({
      llmProvider: expect.stringMatching(/^(openai|deepseek)$/),
      llmModel: expect.any(String),
      chunkingStrategy: expect.stringMatching(/^(fixed|semantic)$/),
      chunkSize: expect.any(Number),
      chunkOverlap: expect.any(Number),
      hydeEnabled: expect.any(Boolean),
      rerankingEnabled: expect.any(Boolean),
      topK: expect.any(Number),
      onlineEvaluationEnabled: expect.any(Boolean),
      conversationHistoryWindow: expect.any(Number),
    });
  });
});

/**
 * @test-suite  PATCH /settings
 * @target      settings update persists changed values
 * @strategy    e2e, API request, reads before and after patch
 * @cases
 *   - [PASS] returns updated topK value when patching topK setting
 *   - [PASS] returns requiresReindex: true when patching chunkSize to a new value
 */
test.describe("PATCH /settings", () => {
  test("returns updated topK value when patching topK setting", async ({ request }) => {
    const before = await (await request.get(`${API_BASE}/settings`)).json();
    const newTopK = before.topK === 5 ? 8 : 5;

    const patch = await request.patch(`${API_BASE}/settings`, { data: { topK: newTopK } });
    expect(patch.status()).toBe(200);
    const body = await patch.json();
    expect(body.topK).toBe(newTopK);

    // Restore original value to avoid polluting state for other tests
    await request.patch(`${API_BASE}/settings`, { data: { topK: before.topK } });
  });

  test("returns requiresReindex: true when patching chunkSize to a new value", async ({
    request,
  }) => {
    const before = await (await request.get(`${API_BASE}/settings`)).json();
    const newChunkSize = before.chunkSize === 512 ? 1024 : 512;

    const patch = await request.patch(`${API_BASE}/settings`, {
      data: { chunkSize: newChunkSize },
    });
    expect(patch.status()).toBe(200);
    const body = await patch.json();
    expect(body.requiresReindex).toBe(true);

    // Restore
    await request.patch(`${API_BASE}/settings`, { data: { chunkSize: before.chunkSize } });
  });
});
