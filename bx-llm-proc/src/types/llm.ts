export type LLMProvider = 'openai' | 'ollama' | 'apple' | 'claude';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  model?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
  shortcutName?: string;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  content: string;
  provider: LLMProvider;
  model: string;
  usage?: LLMUsage;
}
