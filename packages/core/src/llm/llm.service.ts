import OpenAI from "openai";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMConfig {
  provider: "openai" | "deepseek";
  model: string;
  baseUrl?: string;
  apiKey: string;
}

export class LLMService {
  private client!: OpenAI;
  private model!: string;

  init(config: LLMConfig): void {
    this.model = config.model;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  /** Non-streaming call — used for HyDE and LLM-as-judge evaluation */
  async chat(messages: LLMMessage[]): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages,
    });
    return res.choices[0]?.message.content ?? "";
  }

  /** Streaming call — used for chat answers */
  async *stream(messages: LLMMessage[]): AsyncGenerator<string> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages,
      stream: true,
    });
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  }

  reinitialize(config: LLMConfig): void {
    this.init(config);
  }
}
