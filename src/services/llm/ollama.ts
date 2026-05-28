import {
  LLMProviderAdapter,
  ChatMessage,
  LLMConfig,
  LLMResponse,
  StreamCallbacks,
  DEFAULT_BASE_URLS,
} from './types';

export class OllamaProvider implements LLMProviderAdapter {
  private getBaseUrl(config: LLMConfig): string {
    return config.baseUrl || DEFAULT_BASE_URLS.ollama;
  }

  async chat(messages: ChatMessage[], config: LLMConfig): Promise<LLMResponse> {
    const baseUrl = this.getBaseUrl(config);
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: false,
        options: {
          temperature: config.temperature ?? 0.7,
          num_predict: config.maxTokens ?? 4096,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    return {
      content: data.message.content,
      usage: data.eval_count
        ? {
            promptTokens: data.prompt_eval_count || 0,
            completionTokens: data.eval_count || 0,
            totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
          }
        : undefined,
    };
  }

  async chatStream(
    messages: ChatMessage[],
    config: LLMConfig,
    callbacks: StreamCallbacks,
  ): Promise<void> {
    const baseUrl = this.getBaseUrl(config);
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: true,
        options: {
          temperature: config.temperature ?? 0.7,
          num_predict: config.maxTokens ?? 4096,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} - ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              fullText += parsed.message.content;
              callbacks.onToken(parsed.message.content);
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
      callbacks.onComplete(fullText);
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async listModels(config: LLMConfig): Promise<string[]> {
    const baseUrl = this.getBaseUrl(config);
    try {
      const response = await fetch(`${baseUrl}/api/tags`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.models?.map((m: { name: string }) => m.name) || [];
    } catch {
      return [];
    }
  }

  async getEmbedding(text: string, config: LLMConfig): Promise<number[]> {
    const baseUrl = this.getBaseUrl(config);
    const response = await fetch(`${baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama Embedding API error: ${response.status}`);
    }

    const data = await response.json();
    return data.embedding;
  }
}
