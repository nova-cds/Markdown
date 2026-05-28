export type LLMProvider = 'openai' | 'claude' | 'ollama';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

export interface LLMProviderAdapter {
  chat(messages: ChatMessage[], config: LLMConfig): Promise<LLMResponse>;
  chatStream(
    messages: ChatMessage[],
    config: LLMConfig,
    callbacks: StreamCallbacks,
  ): Promise<void>;
  listModels(config: LLMConfig): Promise<string[]>;
}

export interface EmbeddingResponse {
  embedding: number[];
}

export const DEFAULT_MODELS: Record<LLMProvider, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  claude: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
  ollama: ['llama3', 'llama3:8b', 'mistral', 'codellama', 'gemma2'],
};

export const DEFAULT_BASE_URLS: Record<LLMProvider, string> = {
  openai: 'https://api.openai.com/v1',
  claude: 'https://api.anthropic.com',
  ollama: 'http://localhost:11434',
};
