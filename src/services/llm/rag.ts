import { getEmbedding } from './index';
import { LLMConfig } from './types';

export interface DocumentChunk {
  id: string;
  sourceId: string;
  sourceName: string;
  content: string;
  startLine: number;
  endLine: number;
  embedding?: number[];
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
}

export interface Citation {
  sourceId: string;
  sourceName: string;
  content: string;
  startLine: number;
  endLine: number;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export function chunkDocument(
  content: string,
  sourceId: string,
  sourceName: string,
  chunkSize: number = 500,
  overlap: number = 50,
): DocumentChunk[] {
  const lines = content.split('\n');
  const chunks: DocumentChunk[] = [];
  let currentChunk = '';
  let chunkStartLine = 0;
  let lineIndex = 0;
  let chunkIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeading = /^#{1,6}\s/.test(line);

    if (isHeading && currentChunk.length > 100) {
      chunks.push({
        id: `${sourceId}-chunk-${chunkIndex++}`,
        sourceId,
        sourceName,
        content: currentChunk.trim(),
        startLine: chunkStartLine,
        endLine: i - 1,
      });
      // Keep some overlap
      const overlapLines = currentChunk.split('\n').slice(-Math.ceil(overlap / 20));
      currentChunk = overlapLines.join('\n') + '\n' + line + '\n';
      chunkStartLine = Math.max(0, i - overlapLines.length);
    } else if (currentChunk.length >= chunkSize) {
      chunks.push({
        id: `${sourceId}-chunk-${chunkIndex++}`,
        sourceId,
        sourceName,
        content: currentChunk.trim(),
        startLine: chunkStartLine,
        endLine: i - 1,
      });
      const overlapLines = currentChunk.split('\n').slice(-Math.ceil(overlap / 20));
      currentChunk = overlapLines.join('\n') + '\n' + line + '\n';
      chunkStartLine = Math.max(0, i - overlapLines.length);
    } else {
      currentChunk += line + '\n';
    }
    lineIndex = i;
  }

  if (currentChunk.trim()) {
    chunks.push({
      id: `${sourceId}-chunk-${chunkIndex}`,
      sourceId,
      sourceName,
      content: currentChunk.trim(),
      startLine: chunkStartLine,
      endLine: lineIndex,
    });
  }

  return chunks;
}

export async function embedChunks(
  chunks: DocumentChunk[],
  config: LLMConfig,
): Promise<DocumentChunk[]> {
  const embeddedChunks: DocumentChunk[] = [];
  for (const chunk of chunks) {
    try {
      const embedding = await getEmbedding(chunk.content, config);
      embeddedChunks.push({ ...chunk, embedding });
    } catch {
      // Use simple embedding as fallback
      embeddedChunks.push({ ...chunk, embedding: simpleLocalEmbedding(chunk.content) });
    }
  }
  return embeddedChunks;
}

function simpleLocalEmbedding(text: string): number[] {
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

export async function searchChunks(
  query: string,
  chunks: DocumentChunk[],
  config: LLMConfig,
  topK: number = 5,
): Promise<SearchResult[]> {
  let queryEmbedding: number[];
  try {
    queryEmbedding = await getEmbedding(query, config);
  } catch {
    queryEmbedding = simpleLocalEmbedding(query);
  }

  const results: SearchResult[] = chunks
    .filter((chunk) => chunk.embedding)
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding!),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return results;
}

export function buildRAGPrompt(
  query: string,
  searchResults: SearchResult[],
  task?: string,
): string {
  const contextParts = searchResults.map((result, index) => {
    return `[来源 ${index + 1}: ${result.chunk.sourceName}]\n${result.chunk.content}`;
  });

  const context = contextParts.join('\n\n---\n\n');

  const taskInstruction = task
    ? `\n\n任务要求: ${task}`
    : '';

  return `你是一个智能知识助手。请基于以下参考资料回答用户的问题。

规则：
1. 仅基于提供的参考资料回答，如果资料中没有相关信息请明确说明
2. 在回答中使用 [来源 N] 标注引用来源
3. 回答要准确、简洁、有条理
4. 使用 Markdown 格式组织回答${taskInstruction}

参考资料：
${context}

用户问题：${query}`;
}

export function buildGenerationPrompt(
  type: 'summary' | 'faq' | 'outline' | 'study-guide' | 'timeline',
  searchResults: SearchResult[],
): string {
  const contextParts = searchResults.map((result, index) => {
    return `[来源 ${index + 1}: ${result.chunk.sourceName}]\n${result.chunk.content}`;
  });

  const context = contextParts.join('\n\n---\n\n');

  const instructions: Record<string, string> = {
    summary: `请对以下参考资料生成一份综合摘要。要求：
1. 涵盖所有来源的关键信息
2. 按主题组织，使用标题分层
3. 标注信息来源 [来源 N]
4. 使用 Markdown 格式`,

    faq: `请基于以下参考资料生成一份 FAQ（常见问题解答）。要求：
1. 提取 5-15 个最重要的问题
2. 每个问题给出简洁准确的回答
3. 标注信息来源 [来源 N]
4. 使用 Markdown 格式，问题用 ### 标题`,

    outline: `请基于以下参考资料生成一份结构化大纲。要求：
1. 提取主要主题和子主题
2. 使用多级列表组织
3. 每个要点简洁明了
4. 标注关键内容来源 [来源 N]
5. 使用 Markdown 格式`,

    'study-guide': `请基于以下参考资料生成一份学习指南。要求：
1. 列出核心概念和定义
2. 整理关键知识点
3. 提供学习建议和重点提示
4. 标注信息来源 [来源 N]
5. 使用 Markdown 格式，用标题和列表组织`,

    timeline: `请基于以下参考资料生成一份时间线。要求：
1. 提取所有时间相关的事件
2. 按时间顺序排列
3. 每个事件包含日期、事件描述
4. 标注信息来源 [来源 N]
5. 使用 Markdown 表格或列表格式`,
  };

  return `${instructions[type]}

参考资料：
${context}`;
}
