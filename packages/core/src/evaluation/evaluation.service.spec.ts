/**
 * @test-file   EvaluationService
 * @description unit tests for LLM-as-judge evaluation: parallel calls, score clamping, parse-error fallback
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EvaluationService } from "./evaluation.service.js";
import type { LLMService } from "../llm/llm.service.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeLlmService(chatFn: () => Promise<string>): LLMService {
  return {
    getProvider: vi.fn().mockReturnValue({ chat: chatFn, stream: vi.fn() }),
  } as unknown as LLMService;
}

const SAMPLE_INPUT = {
  question: "What is RAG?",
  answer: "RAG stands for Retrieval-Augmented Generation.",
  retrievedChunks: [
    {
      chunkId: "c1",
      documentId: "d1",
      documentName: "doc.txt",
      content: "RAG stands for Retrieval-Augmented Generation.",
      similarityScore: 0.9,
    },
  ],
};

// ── tests ─────────────────────────────────────────────────────────────────────

/**
 * @test-suite  EvaluationService.evaluate — happy path
 * @target      returns all three metrics with correct values
 * @strategy    unit, LLMService mocked to return valid JSON
 * @cases
 *   - [PASS] returns three metrics covering faithfulness, answer_relevancy, context_precision
 *   - [PASS] passes reason string from LLM response
 *   - [PASS] clamps score above 1 to 1.00
 *   - [PASS] clamps score below 0 to 0.00
 */
describe("EvaluationService.evaluate — happy path", () => {
  let svc: EvaluationService;

  beforeEach(() => {
    const chat = vi
      .fn<() => Promise<string>>()
      .mockResolvedValue('{"score": 0.85, "reason": "looks good"}');
    svc = new EvaluationService(makeLlmService(() => chat()));
  });

  it("returns three metrics covering faithfulness, answer_relevancy, context_precision", async () => {
    const results = await svc.evaluate(SAMPLE_INPUT);
    const metrics = results.map((r) => r.metric);
    expect(metrics).toContain("faithfulness");
    expect(metrics).toContain("answer_relevancy");
    expect(metrics).toContain("context_precision");
    expect(results).toHaveLength(3);
  });

  it("passes reason string from LLM response", async () => {
    const results = await svc.evaluate(SAMPLE_INPUT);
    expect(results.every((r) => r.reason === "looks good")).toBe(true);
  });

  it("clamps score above 1 to 1.00", async () => {
    const chat = vi
      .fn<() => Promise<string>>()
      .mockResolvedValue('{"score": 1.5, "reason": "great"}');
    svc = new EvaluationService(makeLlmService(() => chat()));
    const results = await svc.evaluate(SAMPLE_INPUT);
    expect(results.every((r) => r.score <= 1)).toBe(true);
  });

  it("clamps score below 0 to 0.00", async () => {
    const chat = vi
      .fn<() => Promise<string>>()
      .mockResolvedValue('{"score": -0.2, "reason": "bad"}');
    svc = new EvaluationService(makeLlmService(() => chat()));
    const results = await svc.evaluate(SAMPLE_INPUT);
    expect(results.every((r) => r.score >= 0)).toBe(true);
  });
});

/**
 * @test-suite  EvaluationService.evaluate — JSON parse failure
 * @target      degrades gracefully when LLM returns non-JSON or malformed JSON
 * @strategy    unit, LLMService mocked to return invalid responses
 * @cases
 *   - [PASS] returns score=0 when LLM returns plain text with no JSON
 *   - [PASS] reason starts with 'parse error:' when JSON is absent
 *   - [PASS] returns score=0 and parse error reason when LLM throws
 */
describe("EvaluationService.evaluate — parse error fallback", () => {
  it("returns score=0 when LLM returns plain text with no JSON", async () => {
    const chat = vi.fn<() => Promise<string>>().mockResolvedValue("I cannot evaluate this.");
    const svc = new EvaluationService(makeLlmService(() => chat()));
    const results = await svc.evaluate(SAMPLE_INPUT);
    expect(results.every((r) => r.score === 0)).toBe(true);
  });

  it("reason starts with 'parse error:' when JSON is absent", async () => {
    const chat = vi.fn<() => Promise<string>>().mockResolvedValue("not json");
    const svc = new EvaluationService(makeLlmService(() => chat()));
    const results = await svc.evaluate(SAMPLE_INPUT);
    expect(results.every((r) => r.reason.startsWith("parse error:"))).toBe(true);
  });

  it("returns score=0 and parse error reason when LLM throws", async () => {
    const chat = vi.fn<() => Promise<string>>().mockRejectedValue(new Error("network timeout"));
    const svc = new EvaluationService(makeLlmService(() => chat()));
    const results = await svc.evaluate(SAMPLE_INPUT);
    expect(results.every((r) => r.score === 0)).toBe(true);
    expect(results.every((r) => r.reason.includes("network timeout"))).toBe(true);
  });
});

/**
 * @test-suite  EvaluationService.evaluate — JSON embedded in prose
 * @target      extracts JSON object even when surrounded by extra text
 * @strategy    unit, LLMService mocked to return JSON wrapped in markdown
 * @cases
 *   - [PASS] parses score from JSON block surrounded by prose
 */
describe("EvaluationService.evaluate — JSON embedded in prose", () => {
  it("parses score from JSON block surrounded by prose", async () => {
    const chat = vi
      .fn<() => Promise<string>>()
      .mockResolvedValue('Sure! Here is the evaluation:\n{"score": 0.75, "reason": "ok"}\nDone.');
    const svc = new EvaluationService(makeLlmService(() => chat()));
    const results = await svc.evaluate(SAMPLE_INPUT);
    expect(results.every((r) => r.score === 0.75)).toBe(true);
  });
});
