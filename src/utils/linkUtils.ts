import { isTauriCached } from './platform';

export function isLocalMdFile(path: string): boolean {
  if (!path) return false;

  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('ftp://') ||
    path.startsWith('mailto:')
  ) {
    return false;
  }

  const lowerPath = path.toLowerCase();
  return lowerPath.endsWith('.md') || lowerPath.endsWith('.markdown');
}

export function isExternalLink(path: string): boolean {
  if (!path) return false;
  return path.startsWith('http://') || path.startsWith('https://') || path.startsWith('ftp://');
}

export function resolveDocPath(
  linkPath: string,
  currentDocPath: string,
  rootPath?: string,
): string {
  if (!linkPath) return '';

  let cleanPath = linkPath.replace(/^file:\/\//, '');

  // 如果是绝对路径（以/开头），表示从项目根目录开始
  if (cleanPath.startsWith('/')) {
    const relativePath = cleanPath.substring(1);

    // 如果提供了rootPath（Tauri环境的绝对根路径），拼接返回
    if (rootPath) {
      const sep = rootPath.includes('\\') ? '\\' : '/';
      return rootPath + sep + relativePath.replace(/\//g, sep);
    }

    // 否则返回相对路径
    return relativePath;
  }

  // 获取当前文档所在的目录
  let currentDir = '';
  if (currentDocPath) {
    const docPath = currentDocPath.replace(/^file:\/\//, '');
    const lastSlash = Math.max(docPath.lastIndexOf('/'), docPath.lastIndexOf('\\'));
    if (lastSlash > 0) {
      currentDir = docPath.substring(0, lastSlash);
    }
  }

  // 统一使用/作为分隔符
  cleanPath = cleanPath.replace(/\\/g, '/');
  currentDir = currentDir.replace(/\\/g, '/');

  // 处理 ./ 和 ../
  if (cleanPath.startsWith('./')) {
    cleanPath = cleanPath.substring(2);
  }

  while (cleanPath.startsWith('../')) {
    if (currentDir) {
      const lastSlash = currentDir.lastIndexOf('/');
      if (lastSlash > 0) {
        currentDir = currentDir.substring(0, lastSlash);
      } else {
        currentDir = '';
      }
    }
    cleanPath = cleanPath.substring(3);
  }

  if (currentDir) {
    return currentDir + '/' + cleanPath;
  }

  return cleanPath;
}

export async function readMdFileContent(
  filePath: string,
): Promise<{ content: string; error?: string }> {
  try {
    if (isTauriCached()) {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const content = await readTextFile(filePath);
      return { content };
    } else {
      const { useFileStore } = await import('../stores/fileStore');
      const { rootHandle, dirHandles } = useFileStore.getState();

      if (!rootHandle || typeof rootHandle !== 'object') {
        return { content: '', error: '未打开文件夹' };
      }

      const normalizedPath = filePath.replace(/\\/g, '/');
      const pathParts = normalizedPath.split('/').filter((p) => p);

      let currentDir: FileSystemDirectoryHandle = rootHandle;

      for (let i = 0; i < pathParts.length - 1; i++) {
        const dirName = pathParts[i];
        try {
          currentDir = await currentDir.getDirectoryHandle(dirName);
        } catch {
          const cachedDir = dirHandles.get(pathParts.slice(0, i + 1).join('/'));
          if (cachedDir && typeof cachedDir === 'object') {
            currentDir = cachedDir;
          } else {
            return { content: '', error: `目录不存在: ${dirName}` };
          }
        }
      }

      const fileName = pathParts[pathParts.length - 1];
      const fileHandle = await currentDir.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const content = await file.text();

      return { content };
    }
  } catch (err) {
    return { content: '', error: `读取失败: ${err}` };
  }
}

export function getFileName(path: string): string {
  if (!path) return '';
  const cleanPath = path.replace(/^file:\/\//, '');
  const lastSlash = Math.max(cleanPath.lastIndexOf('/'), cleanPath.lastIndexOf('\\'));
  const fileName = lastSlash >= 0 ? cleanPath.substring(lastSlash + 1) : cleanPath;
  return fileName;
}

export function getFileDisplayName(path: string): string {
  const fileName = getFileName(path);
  return fileName.replace(/\.(md|markdown)$/i, '');
}

export function normalizePath(path: string): string {
  if (!path) return '';
  return path.replace(/\\/g, '/');
}
