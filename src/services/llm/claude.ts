import {
  LLMProviderAdapter,
  ChatMessage,
  LLMConfig,
  LLMResponse,
  StreamCallbacks,
  DEFAULT_BASE_URLS,
} from './types';

export class ClaudeProvider implements LLMProviderAdapter {
  private getBaseUrl(config: LLMConfig): string {
    return config.baseUrl || DEFAULT_BASE_URLS.claude;
  }

  private convertMessages(messages: ChatMessage[]): {
    system?: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
  } {
    let system: string | undefined;
    const converted: { role: 'user' | 'assistant'; content: string }[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system = msg.content;
      } else {
        converted.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
      }
    }

    return { system, messages: converted };
  }

  async chat(messages: ChatMessage[], config: LLMConfig): Promise<LLMResponse> {
    const baseUrl = this.getBaseUrl(config);
    const { system, messages: convertedMessages } = this.convertMessages(messages);

    const body: Record<string, unknown> = {
      model: config.model,
      messages: convertedMessages,
      max_tokens: config.maxTokens ?? 4096,
      temperature: config.temperature ?? 0.7,
    };
    if (system) body.system = system;

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Claude API error: ${response.status} - ${(errorData as Record<string, string>).message || response.statusText}`,
      );
    }

    const data = await response.json();
    const content = data.content
      .filter((c: { type: string }) => c.type === 'text')
      .map((c: { text: string }) => c.text)
      .join('');

    return {
      content,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: data.usage.input_tokens + data.usage.output_tokens,
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
    const { system, messages: convertedMessages } = this.convertMessages(messages);

    const body: Record<string, unknown> = {
      model: config.model,
      messages: convertedMessages,
      max_tokens: config.maxTokens ?? 4096,
      temperature: config.temperature ?? 0.7,
      stream: true,
    };
    if (system) body.system = system;

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Claude API error: ${response.status} - ${(errorData as Record<string, string>).message || response.statusText}`,
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
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullText += parsed.delta.text;
              callbacks.onToken(parsed.delta.text);
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

  async listModels(_config: LLMConfig): Promise<string[]> {
    return [
      'claude-sonnet-4-20250514',
      'claude-haiku-4-20250414',
      'claude-3-5-sonnet-20241022',
      'claude-3-haiku-20240307',
    ];
  }
}
