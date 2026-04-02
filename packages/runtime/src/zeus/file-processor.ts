/**
 * Processes file attachments for the Agent SDK.
 * Downloads files from storage URLs, converts to base64,
 * and builds SDK-compatible content blocks.
 *
 * Ported from cc-harness executor.ts buildPrompt().
 */
import { Logger } from '@nestjs/common';
import type { FileAttachment } from '@magically/shared/types';

const logger = new Logger('FileProcessor');

const TEXT_EXTENSIONS = /\.(txt|md|csv|json|xml|yaml|yml|ts|js|py|sh|html|css|tsx|jsx|toml|env|gitignore|dockerfile)$/i;

interface TextContentBlock {
  type: 'text';
  text: string;
}

interface ImageContentBlock {
  type: 'image';
  source: { type: 'base64'; media_type: string; data: string };
}

interface DocumentContentBlock {
  type: 'document';
  source: { type: 'base64'; media_type: 'application/pdf'; data: string };
}

type ContentBlock = TextContentBlock | ImageContentBlock | DocumentContentBlock;

async function downloadToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString('base64');
}

function isTextFile(file: FileAttachment): boolean {
  return file.type.startsWith('text/') || TEXT_EXTENSIONS.test(file.name);
}

async function fileToContentBlock(file: FileAttachment): Promise<ContentBlock> {
  const base64 = await downloadToBase64(file.url);

  if (file.type.startsWith('image/')) {
    return {
      type: 'image',
      source: { type: 'base64', media_type: file.type, data: base64 },
    };
  }

  if (file.type === 'application/pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    };
  }

  if (isTextFile(file)) {
    const text = Buffer.from(base64, 'base64').toString('utf-8');
    return {
      type: 'text',
      text: `--- File: ${file.name} ---\n${text}\n--- End of ${file.name} ---`,
    };
  }

  return {
    type: 'text',
    text: `[Attached file: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(0)}KB) — file type not directly supported for inline viewing]`,
  };
}

/**
 * Build an SDK-compatible prompt that includes file attachments as content blocks.
 * If no files, returns the plain text prompt.
 * If files exist, returns an AsyncIterable yielding a single SDKUserMessage.
 */
export async function buildPromptWithFiles(
  prompt: string,
  files: FileAttachment[],
): Promise<string | AsyncIterable<{ type: 'user'; message: { role: 'user'; content: ContentBlock[] }; parent_tool_use_id: null; session_id: string }>> {
  if (files.length === 0) return prompt;

  const contentBlocks: ContentBlock[] = [{ type: 'text', text: prompt }];

  const fileBlocks = await Promise.all(
    files.map(async (file) => {
      try {
        return await fileToContentBlock(file);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to download file ${file.name}: ${message}`);
        return {
          type: 'text' as const,
          text: `[Failed to load file: ${file.name}]`,
        };
      }
    }),
  );

  contentBlocks.push(...fileBlocks);

  async function* messageStream() {
    yield {
      type: 'user' as const,
      message: { role: 'user' as const, content: contentBlocks },
      parent_tool_use_id: null,
      session_id: '',
    };
  }

  return messageStream();
}
