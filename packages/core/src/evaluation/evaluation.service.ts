import type { LLMService } from "../llm/llm.service.js";
import type { RetrievedChunk } from "../types/retrieval.js";

export interface EvaluationInput {
  question: string;
  answer: string;
  retrievedChunks: RetrievedChunk[];
}

export interface MetricResult {
  metric: "faithfulness" | "answer_relevancy" | "context_precision";
  score: number;
  reason: string;
}

type ScoreJson = { score: number; reason: string };

function buildContextText(chunks: RetrievedChunk[]): string {
  return chunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n");
}

const JUDGE_SYSTEM =
  'You are an expert RAG evaluation judge. Reply with valid JSON only: {"score": <0.00 to 1.00>, "reason": "<one sentence>"}';

export class EvaluationService {
  constructor(private readonly llmService: LLMService) {}

  /** Evaluate all three metrics in parallel. Parse failures degrade to score=0. */
  async evaluate(input: EvaluationInput): Promise<MetricResult[]> {
    const [f, ar, cp] = await Promise.all([
      this.evaluateFaithfulness(input),
      this.evaluateAnswerRelevancy(input),
      this.evaluateContextPrecision(input),
    ]);
    return [f, ar, cp];
  }

  private async evaluateFaithfulness(input: EvaluationInput): Promise<MetricResult> {
    const context = buildContextText(input.retrievedChunks);
    const userPrompt = `Context:\n${context}\n\nAnswer:\n${input.answer}\n\nScore faithfulness: does the answer contain only information from the context, with no hallucinations?`;
    return this.judge("faithfulness", userPrompt);
  }

  private async evaluateAnswerRelevancy(input: EvaluationInput): Promise<MetricResult> {
    const userPrompt = `Question:\n${input.question}\n\nAnswer:\n${input.answer}\n\nScore answer relevancy: does the answer directly address the question?`;
    return this.judge("answer_relevancy", userPrompt);
  }

  private async evaluateContextPrecision(input: EvaluationInput): Promise<MetricResult> {
    const context = buildContextText(input.retrievedChunks);
    const userPrompt = `Question:\n${input.question}\n\nRetrieved context:\n${context}\n\nScore context precision: what fraction of the retrieved passages are relevant to the question?`;
    return this.judge("context_precision", userPrompt);
  }

  private async judge(metric: MetricResult["metric"], userPrompt: string): Promise<MetricResult> {
    try {
      const provider = this.llmService.getProvider({ provider: this.resolveProvider() });
      const raw = await provider.chat([
        { role: "system", content: JUDGE_SYSTEM },
        { role: "user", content: userPrompt },
      ]);

      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("no JSON in response");

      const parsed = JSON.parse(match[0]) as ScoreJson;
      const score = Math.min(1, Math.max(0, Number(parsed.score)));
      return { metric, score: Math.round(score * 100) / 100, reason: String(parsed.reason ?? "") };
    } catch (err) {
      return { metric, score: 0, reason: `parse error: ${String(err)}` };
    }
  }

  private resolveProvider(): "openai" | "deepseek" {
    const key = process.env["DEEPSEEK_API_KEY"];
    return key ? "deepseek" : "openai";
  }
}
