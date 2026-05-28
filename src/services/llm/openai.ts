import {
  LLMProviderAdapter,
  ChatMessage,
  LLMConfig,
  LLMResponse,
  StreamCallbacks,
  DEFAULT_BASE_URLS,
} from './types';

export class OpenAIProvider implements LLMProviderAdapter {
  private getBaseUrl(config: LLMConfig): string {
    return config.baseUrl || DEFAULT_BASE_URLS.openai;
  }

  async chat(messages: ChatMessage[], config: LLMConfig): Promise<LLMResponse> {
    const baseUrl = this.getBaseUrl(config);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 4096,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error: ${response.status} - ${(errorData as Record<string, Record<string, string>>).error?.message || response.statusText}`,
      );
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
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
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 4096,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error: ${response.status} - ${(errorData as Record<string, Record<string, string>>).error?.message || response.statusText}`,
      );
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
        const lines = chunk.split('\n').filter((line) => line.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              callbacks.onToken(content);
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
      const response = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.data
        .filter(
          (m: { id: string }) =>
            m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3'),
        )
        .map((m: { id: string }) => m.id)
        .sort();
    } catch {
      return [];
    }
  }

  async getEmbedding(text: string, config: LLMConfig): Promise<number[]> {
    const baseUrl = this.getBaseUrl(config);
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI Embedding API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }
}
