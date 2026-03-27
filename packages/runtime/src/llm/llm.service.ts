import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { ConfigService } from '../config/config.service';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private client: OpenAI | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): OpenAI {
    if (this.client) return this.client;

    const apiKey = this.config.get('openrouterApiKey');
    if (!apiKey) {
      throw new Error(
        'No LLM API key configured. Set openrouterApiKey in config.',
      );
    }

    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://magically.app',
        'X-Title': 'Magically',
      },
    });

    return this.client;
  }

  /** Invalidate client (e.g. after key update) */
  resetClient() {
    this.client = null;
  }

  /** Return an AI SDK LanguageModel configured for OpenRouter */
  getModel(modelId?: string): LanguageModel {
    const apiKey = this.config.get('openrouterApiKey');
    if (!apiKey) {
      throw new Error('No LLM API key configured. Set openrouterApiKey in config.');
    }
    const provider = createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
      headers: {
        'HTTP-Referer': 'https://magically.app',
        'X-Title': 'Magically',
      },
    });
    // Use .chat() to force the Chat Completions API (/v1/chat/completions).
    // @ai-sdk/openai v3+ defaults to the Responses API (/v1/responses) which
    // OpenRouter does not support.
    return provider.chat(modelId ?? this.getDefaultModel());
  }

  getDefaultModel(): string {
    return this.config.get('defaultModel') ?? 'anthropic/claude-sonnet-4-6';
  }

  async *streamChat(
    messages: ChatMessage[],
    model?: string,
    systemPrompt?: string,
  ): AsyncGenerator<StreamChunk> {
    const client = this.getClient();
    const fullMessages: ChatMessage[] = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const stream = await client.chat.completions.create({
      model: model ?? this.getDefaultModel(),
      messages: fullMessages as OpenAI.Chat.ChatCompletionMessageParam[],
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      const done = chunk.choices[0]?.finish_reason != null;
      if (delta) yield { content: delta, done: false };
      if (done) yield { content: '', done: true };
    }
  }

  async complete(
    messages: ChatMessage[],
    model?: string,
    systemPrompt?: string,
  ): Promise<string> {
    let result = '';
    for await (const chunk of this.streamChat(messages, model, systemPrompt)) {
      result += chunk.content;
    }
    return result;
  }
}
