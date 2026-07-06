import { isTauriCached } from '../../utils/platform';
import { useFileStore } from '../../stores';

// 本地化 Vditor CDN 路径
export const VDITOR_CDN = './vditor';

// debounce 工具函数
// 使用 interface 上的调用签名作为约束，借助 bivariance 兼容任意函数签名，
// 同时通过 Parameters<T> 保留原函数的参数类型。
interface AnyFunction {
  (...args: never[]): void;
}
export function debounce<T extends AnyFunction>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

// 计算纯文本字数（去除 markdown 语法标记）
export function countPlainText(md: string): number {
  if (!md) return 0;

  let text = md;

  // 移除代码块
  text = text.replace(/```[\s\S]*?```/g, '');

  // 移除行内代码
  text = text.replace(/`[^`]+`/g, '');

  // 移除图片 ![alt](url)
  text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '');

  // 移除链接 [text](url) → text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 移除粗体 **text** 或 __text__
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');

  // 移除斜体 *text* 或 _text_
  text = text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1');
  text = text.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '$1');

  // 移除删除线 ~~text~~
  text = text.replace(/~~([^~]+)~~/g, '$1');

  // 移除高亮 ==text==
  text = text.replace(/==([^=]+)==/g, '$1');

  // 移除上标 ^text^
  text = text.replace(/\^([^^\n]+)\^/g, '$1');

  // 移除下标 ~text~ (单个波浪线，排除删除线)
  text = text.replace(/(?<!~)~([^~\n]+)~(?!~)/g, '$1');

  // 移除标题标记
  text = text.replace(/^#{1,6}\s*/gm, '');

  // 移除列表标记
  text = text.replace(/^[\t ]*[-*+]\s+/gm, '');
  text = text.replace(/^[\t ]*\d+\.\s+/gm, '');

  // 移除引用标记
  text = text.replace(/^>\s*/gm, '');

  // 移除水平线
  text = text.replace(/^[-*_]{3,}$/gm, '');

  // 移除 [toc]
  text = text.replace(/\[toc\]/gi, '');

  // 移除 HTML 标签
  text = text.replace(/<[^>]+>/g, '');

  // 移除多余空白字符
  text = text.replace(/[\n\r]+/g, '');
  text = text.trim();

  return text.length;
}

// 文件转 base64
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 加载本地图片，返回blob URL
export async function loadLocalImage(
  imageSrc: string,
  docPath: string,
): Promise<string | null> {
  // 解析图片路径
  const cleanSrc = imageSrc.replace(/^\.\//, '');

  try {
    if (isTauriCached()) {
      // Tauri 环境：读取文件转为 blob URL
      const { readFile } = await import('@tauri-apps/plugin-fs');

      // 从文档路径提取目录路径
      let docDir = '';
      if (docPath.startsWith('file://')) {
        const fullPath = docPath.replace('file://', '');
        const lastSlash = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));
        if (lastSlash > 0) {
          docDir = fullPath.substring(0, lastSlash);
        }
      }

      const normalizedSrc = cleanSrc.replace(/\//g, '\\');
      const imagePath = `${docDir}\\${normalizedSrc}`;
      const imageData = await readFile(imagePath);
      const blob = new Blob([imageData]);
      const blobUrl = URL.createObjectURL(blob);
      return blobUrl;
    } else {
      // 浏览器环境
      const { rootHandle, dirHandles } = useFileStore.getState();

      if (!rootHandle || typeof rootHandle === 'string') return null;

      // 从文档路径提取目录路径
      let docDirHandle: FileSystemDirectoryHandle = rootHandle;

      if (docPath.startsWith('file://')) {
        const fullPath = docPath.replace('file://', '');
        const lastSlash = fullPath.lastIndexOf('/');
        if (lastSlash > 0) {
          const dirPath = fullPath.substring(0, lastSlash);
          const foundHandle = dirHandles.get(dirPath);
          if (foundHandle && typeof foundHandle === 'object') {
            docDirHandle = foundHandle;
          }
        }
      }

      const parts = cleanSrc.split('/');

      // 遍历路径找到图片文件
      let currentDir = docDirHandle;
      for (let i = 0; i < parts.length - 1; i++) {
        currentDir = await currentDir.getDirectoryHandle(parts[i]);
      }

      const fileName = parts[parts.length - 1];
      const fileHandle = await currentDir.getFileHandle(fileName);
      const file = await fileHandle.getFile();

      // 创建blob URL
      const blobUrl = URL.createObjectURL(file);
      return blobUrl;
    }
  } catch (_err) {
    return null;
  }
}

// 处理单个图片元素
export function handleLocalImage(img: HTMLImageElement, docPath: string) {
  const src = img.getAttribute('src');
  if (!src) return;

  // 只处理相对路径的本地图片
  if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('blob:')) return;

  // 标记为正在处理，避免重复处理
  if (img.dataset.loading === 'true') return;
  img.dataset.loading = 'true';

  loadLocalImage(src, docPath).then((blobUrl) => {
    if (blobUrl) {
      img.src = blobUrl;
    }
    img.dataset.loading = 'false';
  });
}

// 处理容器中的所有本地图片
export function processLocalImages(container: HTMLElement, docPath: string) {
  const imgs = container.querySelectorAll('img');
  imgs.forEach((img) => handleLocalImage(img, docPath));
}

let tableTipTimeout: number | null = null;
let tableTipElement: HTMLDivElement | null = null;
let hasShownTableTip = false;

export function showTableShortcutTip() {
  if (hasShownTableTip) return;
  hasShownTableTip = true;

  if (tableTipElement) {
    tableTipElement.remove();
    tableTipElement = null;
  }
  if (tableTipTimeout) {
    clearTimeout(tableTipTimeout);
  }

  const tip = document.createElement('div');
  tip.className = 'table-shortcut-tip';
  tip.innerHTML = `
    <div class="tip-title">📊 表格操作提示</div>
    <div class="tip-content">
      <div class="tip-item"><kbd>Ctrl</kbd> + <kbd>=</kbd> 添加行</div>
      <div class="tip-item"><kbd>Ctrl</kbd> + <kbd>-</kbd> 删除行</div>
      <div class="tip-item"><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>=</kbd> 添加列</div>
      <div class="tip-item"><kbd>Tab</kbd> 下一单元格</div>
    </div>
    <div class="tip-footer">💡 在表格内按 Enter 会换行，不是新增行</div>
  `;
  tip.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    background: var(--sidebar-bg, #f5f5f5);
    border: 1px solid var(--editor-border, #e0e0e0);
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 13px;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    max-width: 280px;
  `;

  const style = document.createElement('style');
  style.textContent = `
    .table-shortcut-tip .tip-title {
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--editor-text, #333);
    }
    .table-shortcut-tip .tip-item {
      margin: 4px 0;
      color: var(--editor-text-secondary, #666);
    }
    .table-shortcut-tip kbd {
      background: var(--editor-code-bg, #f5f5f5);
      border: 1px solid var(--editor-border, #e0e0e0);
      border-radius: 3px;
      padding: 1px 5px;
      font-family: inherit;
      font-size: 12px;
    }
    .table-shortcut-tip .tip-footer {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--editor-border, #e0e0e0);
      font-size: 12px;
      color: var(--editor-text-secondary, #666);
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(tip);
  tableTipElement = tip;

  tableTipTimeout = window.setTimeout(() => {
    if (tableTipElement) {
      tableTipElement.style.opacity = '0';
      tableTipElement.style.transition = 'opacity 0.3s';
      setTimeout(() => {
        tableTipElement?.remove();
        tableTipElement = null;
      }, 300);
    }
  }, 5000);
}
