import { OpenAIProvider } from './openai';
import { ClaudeProvider } from './claude';
import { OllamaProvider } from './ollama';
import {
  LLMProviderAdapter,
  LLMConfig,
  ChatMessage,
  LLMResponse,
  StreamCallbacks,
  LLMProvider,
} from './types';

export type {
  LLMConfig,
  ChatMessage,
  LLMResponse,
  StreamCallbacks,
  LLMProvider,
  LLMProviderAdapter,
};
export { DEFAULT_MODELS, DEFAULT_BASE_URLS } from './types';

const providers: Record<LLMProvider, LLMProviderAdapter> = {
  openai: new OpenAIProvider(),
  claude: new ClaudeProvider(),
  ollama: new OllamaProvider(),
};

export function getProvider(provider: LLMProvider): LLMProviderAdapter {
  return providers[provider];
}

export async function chat(messages: ChatMessage[], config: LLMConfig): Promise<LLMResponse> {
  const provider = getProvider(config.provider);
  return provider.chat(messages, config);
}

export async function chatStream(
  messages: ChatMessage[],
  config: LLMConfig,
  callbacks: StreamCallbacks,
): Promise<void> {
  const provider = getProvider(config.provider);
  return provider.chatStream(messages, config, callbacks);
}

export async function listModels(config: LLMConfig): Promise<string[]> {
  const provider = getProvider(config.provider);
  return provider.listModels(config);
}

export async function getEmbedding(text: string, config: LLMConfig): Promise<number[]> {
  if (config.provider === 'openai') {
    return (providers.openai as OpenAIProvider).getEmbedding(text, config);
  }
  if (config.provider === 'ollama') {
    return (providers.ollama as OllamaProvider).getEmbedding(text, config);
  }
  // For Claude, use a simple TF-IDF-like approach as fallback
  return simpleEmbedding(text);
}

function simpleEmbedding(text: string): number[] {
  const words = text.toLowerCase().split(/\s+/);
  const dim = 128;
  const vec = new Array(dim).fill(0);
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash * 31 + word.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % dim;
    vec[idx] += 1;
  }
  const magnitude = Math.sqrt(vec.reduce((sum: number, v: number) => sum + v * v, 0)) || 1;
  return vec.map((v: number) => v / magnitude);
}
