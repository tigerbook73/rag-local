import OpenAI from "openai";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMConfig {
  provider: "openai" | "deepseek";
}

export interface LLMProvider {
  /** Non-streaming call — used for HyDE and LLM-as-judge evaluation */
  chat(messages: LLMMessage[]): Promise<string>;
  /** Streaming call — used for chat answers */
  stream(messages: LLMMessage[]): AsyncGenerator<string>;
}

const PROVIDER_SETTINGS: Record<
  "openai" | "deepseek",
  { model: string; baseUrl?: string; envKey: string }
> = {
  deepseek: {
    model: "deepseek-chat",
    baseUrl: "https://api.deepseek.com",
    envKey: "DEEPSEEK_API_KEY",
  },
  openai: { model: "gpt-4o", envKey: "OPENAI_API_KEY" },
};

export class LLMService {
  private readonly cache = new Map<string, LLMProvider>();

  getProvider(config: LLMConfig): LLMProvider {
    const cached = this.cache.get(config.provider);
    if (cached) return cached;
    const { model, baseUrl, envKey } = PROVIDER_SETTINGS[config.provider];
    const apiKey = process.env[envKey];
    if (!apiKey) {
      throw new Error(`Missing env var for LLM provider "${config.provider}" — set ${envKey}`);
    }

    const client = new OpenAI({ apiKey, baseURL: baseUrl });

    const provider: LLMProvider = {
      async chat(messages: LLMMessage[]): Promise<string> {
        const res = await client.chat.completions.create({ model, messages });
        return res.choices[0]?.message.content ?? "";
      },
      async *stream(messages: LLMMessage[]): AsyncGenerator<string> {
        const stream = await client.chat.completions.create({ model, messages, stream: true });
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) yield content;
        }
      },
    };

    this.cache.set(config.provider, provider);
    return provider;
  }
}
