/**
 * @test-file   EmbeddingService
 * @description unit tests for embed() and embedBatch() with mocked fetch
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmbeddingService } from "./embedding.service.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env["EMBEDDING_SERVICE_URL"];
});

function makeJsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    statusText: ok ? "OK" : "Internal Server Error",
    json: () => Promise.resolve(body),
  });
}

/**
 * @test-suite  EmbeddingService — embed()
 * @target      single text embedding via POST /embed
 * @strategy    unit, global fetch mocked
 * @cases
 *   - [FAIL] throws "not initialized" error when init() has not been called
 *   - [PASS] returns embedding array when HTTP response is ok
 *   - [FAIL] throws error with status code when HTTP response is not ok
 */
describe("EmbeddingService — embed()", () => {
  it('throws "not initialized" error when init() has not been called', async () => {
    const service = new EmbeddingService();
    await expect(service.embed("hello")).rejects.toThrow("not initialized");
  });

  it("returns embedding array when HTTP response is ok", async () => {
    const embedding = [0.1, 0.2, 0.3];
    mockFetch.mockReturnValue(makeJsonResponse({ embedding }));

    const service = new EmbeddingService();
    service.init();
    const result = await service.embed("hello");
    expect(result).toEqual(embedding);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/embed"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws error with status code when HTTP response is not ok", async () => {
    mockFetch.mockReturnValue(makeJsonResponse({}, false, 503));

    const service = new EmbeddingService();
    service.init();
    await expect(service.embed("hello")).rejects.toThrow("503");
  });
});

/**
 * @test-suite  EmbeddingService — embedBatch()
 * @target      batch text embedding via single POST /embed/batch
 * @strategy    unit, global fetch mocked
 * @cases
 *   - [FAIL] throws "not initialized" error when init() has not been called
 *   - [PASS] returns embeddings array when HTTP response is ok
 *   - [FAIL] throws error with status code when HTTP response is not ok
 */
describe("EmbeddingService — embedBatch()", () => {
  it('throws "not initialized" error when init() has not been called', async () => {
    const service = new EmbeddingService();
    await expect(service.embedBatch(["a", "b"])).rejects.toThrow("not initialized");
  });

  it("returns embeddings array when HTTP response is ok", async () => {
    const embeddings = [
      [0.1, 0.2],
      [0.3, 0.4],
    ];
    mockFetch.mockReturnValue(makeJsonResponse({ embeddings }));

    const service = new EmbeddingService();
    service.init();
    const result = await service.embedBatch(["text1", "text2"]);
    expect(result).toEqual(embeddings);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/embed/batch"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws error with status code when HTTP response is not ok", async () => {
    mockFetch.mockReturnValue(makeJsonResponse({}, false, 422));

    const service = new EmbeddingService();
    service.init();
    await expect(service.embedBatch(["a"])).rejects.toThrow("422");
  });
});
