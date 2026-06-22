export const SETTINGS_KEYS = {
  LLM_PROVIDER: "llm_provider",
  CHUNKING_STRATEGY: "chunking_strategy",
  CHUNK_SIZE: "chunk_size",
  CHUNK_OVERLAP: "chunk_overlap",
  HYDE_ENABLED: "hyde_enabled",
  RERANKING_ENABLED: "reranking_enabled",
  TOP_K: "top_k",
  RERANK_TOP_K: "rerank_top_k",
  ONLINE_EVALUATION_ENABLED: "online_evaluation_enabled",
  CONVERSATION_HISTORY_WINDOW: "conversation_history_window",
  SYSTEM_PROMPT: "system_prompt",
  RETRIEVAL_MODE: "retrieval_mode",
} as const;

export const SETTINGS_DEFAULTS: Record<string, string> = {
  [SETTINGS_KEYS.LLM_PROVIDER]: "deepseek",
  [SETTINGS_KEYS.CHUNKING_STRATEGY]: "fixed",
  [SETTINGS_KEYS.CHUNK_SIZE]: "512",
  [SETTINGS_KEYS.CHUNK_OVERLAP]: "50",
  [SETTINGS_KEYS.HYDE_ENABLED]: "false",
  [SETTINGS_KEYS.RERANKING_ENABLED]: "false",
  [SETTINGS_KEYS.TOP_K]: "5",
  [SETTINGS_KEYS.RERANK_TOP_K]: "3",
  [SETTINGS_KEYS.ONLINE_EVALUATION_ENABLED]: "false",
  [SETTINGS_KEYS.CONVERSATION_HISTORY_WINDOW]: "0",
  [SETTINGS_KEYS.RETRIEVAL_MODE]: "dense",
};
