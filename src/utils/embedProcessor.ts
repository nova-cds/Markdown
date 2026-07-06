import Vditor from 'vditor';
import type { ExtendedVditor } from '../types/vditor';
import {
  isLocalMdFile,
  resolveDocPath,
  readMdFileContent,
  getFileDisplayName,
} from './linkUtils';
import { createEmbedContainer, createEmbedWarning } from './embedUtils';
import { VDITOR_CDN } from '../components/Editor/vditor-utils';

interface ProcessEmbedsOptions {
  embedMaxCount: number;
  currentPath: string;
  rootPath: string | undefined;
}

// 每个 container 独立的"正在处理"标记，防止 MutationObserver 触发并发
const processingState = new WeakMap<HTMLElement, boolean>();

/**
 * 处理预览模式的嵌入内容
 *
 * 扫描容器中的预览元素，识别 [[xxx]](doc.md) 嵌入语法，
 * 读取目标文件并渲染为嵌入容器。
 *
 * 从 VditorEditor.tsx 的 processEmbedPlaceholders 提取。
 */
export async function processEmbeds(
  container: HTMLElement,
  vditor: ExtendedVditor,
  options: ProcessEmbedsOptions,
): Promise<void> {
  if (processingState.get(container)) return;
  processingState.set(container, true);

  let processedInCurrentBatch = 0; // 当前批次已处理的数量

  try {
    const previewElements = container.querySelectorAll(
      '.vditor-preview, .vditor-sv__preview, .vditor-ir__preview',
    );
    if (!previewElements || previewElements.length === 0) {
      return;
    }

    const mdContent = vditor.getValue();
    const mdEmbedLinks: Array<{ url: string; displayText: string }> = [];

    // 使用新语法的正则：[[xxx]](doc.md) 或 [[](doc.md)
    const linkRegex = /\[\[([^\]]*?)\]\]\(([^)]+)\)/gi;
    let match;
    while ((match = linkRegex.exec(mdContent)) !== null) {
      const displayText = match[1]?.trim() || '';
      const url = match[2];
      if (isLocalMdFile(url)) {
        mdEmbedLinks.push({ url, displayText });
      }
    }

    // 更新已存在的嵌入容器的标题
    for (const previewEl of previewElements) {
      if ((previewEl as HTMLElement).style.display === 'none') continue;

      const embedContainers = previewEl.querySelectorAll('.embed-container');

      for (const embedEl of embedContainers) {
        const embedPath = embedEl.getAttribute('data-embed-path');
        if (!embedPath) continue;

        const linkInfo = mdEmbedLinks.find((l) => {
          const resolved = resolveDocPath(l.url, options.currentPath, options.rootPath).replace(
            /\\/g,
            '/',
          );
          return resolved === embedPath.replace(/\\/g, '/') || l.url === embedPath;
        });

        if (linkInfo) {
          const titleEl = embedEl.querySelector('.embed-title');
          if (titleEl) {
            const newTitle = linkInfo.displayText || getFileDisplayName(embedPath);
            if (titleEl.textContent !== newTitle) {
              titleEl.textContent = newTitle;
            }
          }
        }
      }
    }

    // 收集所有待处理的链接，并立即标记
    const pendingLinks: Array<{
      link: HTMLAnchorElement;
      linkInfo: { url: string; displayText: string };
    }> = [];

    for (const previewEl of previewElements) {
      if ((previewEl as HTMLElement).style.display === 'none') continue;

      const allLinks = Array.from(previewEl.querySelectorAll('a'));

      for (const link of allLinks) {
        if (!link.parentElement) continue;
        if (link._embedProcessed) continue;

        const href = link.getAttribute('href') || '';
        const linkText = link.textContent?.trim() || '';

        // 检查链接文本是否是 [xxx] 格式（嵌入语法）
        if (!linkText.startsWith('[') || !linkText.endsWith(']')) continue;

        const linkInfo = mdEmbedLinks.find((l) => l.url === href);
        if (!linkInfo) continue;

        // 立即标记为已处理
        link._embedProcessed = true;
        pendingLinks.push({ link, linkInfo });
      }
    }

    // 同步顺序处理每个链接
    for (const { link, linkInfo } of pendingLinks) {
      if (!link.parentElement) continue;

      // 检查数量限制
      if (processedInCurrentBatch >= options.embedMaxCount) {
        link.outerHTML = createEmbedWarning(
          `嵌入文档数量超过限制 (最大${options.embedMaxCount}个)`,
        );
        continue;
      }

      const href = link.getAttribute('href') || '';
      const resolvedPath = resolveDocPath(href, options.currentPath, options.rootPath);
      const normalizedResolvedPath = resolvedPath.replace(/\\/g, '/');
      const currentDocFullPath = options.currentPath.replace(/^file:\/\//, '').replace(/\\/g, '/');

      if (
        normalizedResolvedPath === currentDocFullPath ||
        currentDocFullPath.endsWith('/' + normalizedResolvedPath)
      ) {
        link.outerHTML = createEmbedWarning(`检测到循环引用: 不能嵌入自身`, resolvedPath);
        continue;
      }

      // 立即增加计数
      processedInCurrentBatch++;

      const result = await readMdFileContent(resolvedPath);

      if (!link.parentElement) {
        continue;
      }

      if (result.error) {
        link.outerHTML = createEmbedWarning(result.error, resolvedPath);
      } else {
        const tempDiv = document.createElement('div');
        tempDiv.className = 'embed-content vditor-reset';

        await new Promise<void>((resolve) => {
          Vditor.preview(tempDiv, result.content || '', {
            cdn: VDITOR_CDN,
            mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
            markdown: {
              codeBlockPreview: true,
              mathBlockPreview: true,
              toc: false,
              mark: true,
            },
            after: () => resolve(),
          });
          setTimeout(resolve, 500);
        });

        if (!link.parentElement) {
          continue;
        }

        const embedHtml = createEmbedContainer(
          resolvedPath,
          tempDiv.innerHTML,
          linkInfo.displayText,
        );
        link.outerHTML = embedHtml;
      }
    }
  } finally {
    processingState.set(container, false);
  }
}
