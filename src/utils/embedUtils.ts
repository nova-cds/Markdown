import {
  isLocalMdFile,
  resolveDocPath,
  readMdFileContent,
  getFileDisplayName,
  normalizePath,
  getFileName,
} from './linkUtils';

export interface EmbedSettings {
  maxDepth: number;
  maxCount: number;
}

export interface EmbedContext {
  renderStack: string[];
  currentDepth: number;
  embedCount: number;
  rootDocPath: string;
  settings: EmbedSettings;
}

export function parseEmbedLinkText(linkText: string): { isEmbed: boolean; displayText: string } {
  if (!linkText) {
    return { isEmbed: false, displayText: '' };
  }

  const text = linkText.trim();

  // 新语法：[[xxx]] 或 [[] 表示嵌入文档
  // 匹配 [[xxx]] 或 [[]
  if (text.startsWith('[[') && text.endsWith(']')) {
    // 检查是否是 [[xxx]] 格式（至少4个字符：[[和]]）
    if (text.length >= 4 && text.endsWith(']]')) {
      // [[xxx]] 格式，提取中间内容
      const inner = text.slice(2, -2).trim();
      return { isEmbed: true, displayText: inner };
    } else if (text === '[[]') {
      // [[] 格式，显示文件名
      return { isEmbed: true, displayText: '' };
    }
  }

  return { isEmbed: false, displayText: '' };
}

export function shouldRenderEmbed(linkText: string, linkPath: string): boolean {
  const { isEmbed } = parseEmbedLinkText(linkText);

  if (!isEmbed) {
    return false;
  }

  return isLocalMdFile(linkPath);
}

export function checkCircularReference(mdPath: string, renderStack: string[]): boolean {
  const normalizedPath = normalizePath(mdPath);
  return renderStack.some((p) => normalizePath(p) === normalizedPath);
}

export function createEmbedContainer(
  mdPath: string,
  content: string,
  displayText?: string,
  isError: boolean = false,
): string {
  const title = displayText || getFileDisplayName(mdPath);
  const errorClass = isError ? 'embed-container--error' : '';

  return `<div class="embed-container ${errorClass}" data-embed-path="${mdPath}">
    <div class="embed-header">
      <span class="embed-icon">📄</span>
      <span class="embed-title">${title}</span>
      <a class="embed-link" href="${mdPath}" title="打开文档">打开</a>
    </div>
    <div class="embed-content">${content}</div>
  </div>`;
}

export function createEmbedLoading(mdPath: string): string {
  const displayName = getFileDisplayName(mdPath);
  return `<div class="embed-container embed-container--loading" data-embed-path="${mdPath}">
    <div class="embed-header">
      <span class="embed-icon">📄</span>
      <span class="embed-title">${displayName}</span>
    </div>
    <div class="embed-loading">
      <span class="embed-loading-spinner"></span>
      <span>加载中...</span>
    </div>
  </div>`;
}

export function createEmbedWarning(message: string, mdPath?: string): string {
  const displayName = mdPath ? getFileDisplayName(mdPath) : '';
  return `<div class="embed-container embed-container--warning">
    <div class="embed-warning">
      <span class="embed-warning-icon">⚠️</span>
      <span class="embed-warning-message">${message}</span>
      ${mdPath ? `<a class="embed-link" href="${mdPath}" title="打开文档">打开文档</a>` : ''}
    </div>
  </div>`;
}

export async function renderEmbedContent(mdPath: string, context: EmbedContext): Promise<string> {
  const { renderStack, currentDepth, embedCount, settings } = context;

  if (checkCircularReference(mdPath, renderStack)) {
    return createEmbedWarning(`检测到循环引用: ${getFileDisplayName(mdPath)}`, mdPath);
  }

  if (currentDepth >= settings.maxDepth) {
    return createEmbedWarning(`嵌套深度超过限制 (最大${settings.maxDepth}层)`, mdPath);
  }

  if (embedCount >= settings.maxCount) {
    return createEmbedWarning(`嵌入文档数量超过限制 (最大${settings.maxCount}个)`);
  }

  const result = await readMdFileContent(mdPath);

  if (result.error || !result.content) {
    return createEmbedWarning(result.error || '文件不存在', mdPath);
  }

  return result.content;
}

export async function processEmbedsInMarkdown(
  content: string,
  context: EmbedContext,
): Promise<string> {
  // 新语法：[[xxx]](doc.md) 或 [[](doc.md)
  const embedRegex = /\[\[([^\]]*?)\]\]\(([^)]+)\)/gi;
  let processedContent = content;
  let currentEmbedCount = context.embedCount;

  const matches = [...content.matchAll(embedRegex)];

  for (const match of matches) {
    if (currentEmbedCount >= context.settings.maxCount) {
      processedContent = processedContent.replace(
        match[0],
        createEmbedWarning(`嵌入文档数量超过限制 (最大${context.settings.maxCount}个)`),
      );
      continue;
    }

    const displayText = match[1]?.trim() || '';
    const linkPath = match[2];

    if (!isLocalMdFile(linkPath)) {
      continue;
    }

    const resolvedPath = resolveDocPath(linkPath, context.rootDocPath);

    if (checkCircularReference(resolvedPath, context.renderStack)) {
      processedContent = processedContent.replace(
        match[0],
        createEmbedWarning(`检测到循环引用`, resolvedPath),
      );
      continue;
    }

    if (context.currentDepth >= context.settings.maxDepth) {
      processedContent = processedContent.replace(
        match[0],
        createEmbedWarning(`嵌套深度超过限制`, resolvedPath),
      );
      continue;
    }

    const embedContent = await renderEmbedContent(resolvedPath, {
      ...context,
      renderStack: [...context.renderStack, resolvedPath],
      currentDepth: context.currentDepth + 1,
      embedCount: currentEmbedCount + 1,
    });

    if (embedContent && !embedContent.includes('embed-container--warning')) {
      const nestedContent = await processEmbedsInMarkdown(embedContent, {
        ...context,
        renderStack: [...context.renderStack, resolvedPath],
        currentDepth: context.currentDepth + 1,
        embedCount: currentEmbedCount + 1,
        rootDocPath: resolvedPath,
      });

      processedContent = processedContent.replace(
        match[0],
        createEmbedContainer(resolvedPath, nestedContent, displayText),
      );
    } else {
      processedContent = processedContent.replace(match[0], embedContent);
    }

    currentEmbedCount++;
  }

  return processedContent;
}

export function setupEmbedLazyLoading(container: HTMLElement): void {
  const embedContainers = container.querySelectorAll(
    '.embed-container:not(.embed-container--loading)',
  );

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const embedEl = entry.target as HTMLElement;
            embedEl.classList.add('embed-visible');
            observer.unobserve(embedEl);
          }
        });
      },
      {
        rootMargin: '100px',
        threshold: 0.1,
      },
    );

    embedContainers.forEach((el) => observer.observe(el));
  } else {
    embedContainers.forEach((el) => el.classList.add('embed-visible'));
  }
}
