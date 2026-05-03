/**
 * 平台检测和文件操作工具
 * 统一处理浏览器和 Tauri 环境的差异
 */

// 检测是否在 Tauri 环境中
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

// 检测是否在浏览器环境且支持 File System Access API
export const isFileSystemAccessSupported = (): boolean => {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
};

/**
 * 文件操作封装
 */
export const fileOps = {
  // 读取文本文件
  async readTextFile(path: string): Promise<string> {
    if (isTauri()) {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      return await readTextFile(path);
    } else {
      // 浏览器环境需要传入 handle
      throw new Error('Browser environment requires file handle');
    }
  },

  // 写入文本文件
  async writeTextFile(path: string, content: string): Promise<void> {
    if (isTauri()) {
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const encoder = new TextEncoder();
      await writeFile(path, encoder.encode(content));
    } else {
      // 浏览器环境需要传入 handle
      throw new Error('Browser environment requires file handle');
    }
  },

  // 创建目录
  async createDir(path: string): Promise<void> {
    if (isTauri()) {
      const { mkdir } = await import('@tauri-apps/plugin-fs');
      await mkdir(path, { recursive: true });
    } else {
      throw new Error('Browser environment requires directory handle');
    }
  },

  // 删除文件
  async removeFile(path: string): Promise<void> {
    if (isTauri()) {
      const { remove } = await import('@tauri-apps/plugin-fs');
      await remove(path);
    } else {
      throw new Error('Browser environment requires directory handle');
    }
  },

  // 重命名文件
  async renameFile(oldPath: string, newPath: string): Promise<void> {
    if (isTauri()) {
      const { rename } = await import('@tauri-apps/plugin-fs');
      await rename(oldPath, newPath);
    } else {
      throw new Error('Browser environment requires directory handle');
    }
  },

  // 读取目录
  async readDir(path: string): Promise<Array<{ name: string; isFile: boolean; isDirectory: boolean }>> {
    if (isTauri()) {
      const { readDir } = await import('@tauri-apps/plugin-fs');
      const entries = await readDir(path);
      return entries.map(entry => ({
        name: entry.name,
        isFile: entry.isFile,
        isDirectory: entry.isDirectory,
      }));
    } else {
      throw new Error('Browser environment requires directory handle');
    }
  },

  // 检查文件是否存在
  async exists(path: string): Promise<boolean> {
    if (isTauri()) {
      const { exists } = await import('@tauri-apps/plugin-fs');
      return await exists(path);
    } else {
      throw new Error('Browser environment requires file handle');
    }
  },
};
