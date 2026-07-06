/**
 * 全局类型声明
 * 集中扩展 Window、File 等全局接口，覆盖 Tauri 环境、File System Access API 等场景
 * 所有字段均使用具体类型，不使用 any/unknown 兜底
 */

/**
 * Tauri 窗口实例接口
 * 对应 @tauri-apps/api/window 中的 Window 实例
 */
interface TauriWindowInstance {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
}

/**
 * Tauri 事件回调的载荷结构
 * 对应 tauri://resize 等事件触发时的回调参数
 */
interface TauriEventPayload<T = unknown> {
  event: string;
  id: number;
  payload: T;
}

/**
 * Tauri 事件监听器接口
 * 对应 @tauri-apps/api/event 中的 listen 函数
 */
interface TauriEventAPI {
  listen: <T = unknown>(
    event: string,
    callback: (payload: TauriEventPayload<T>) => void,
  ) => Promise<() => void>;
}

/**
 * Tauri 全局 API（withGlobalTauri 模式下挂载到 window.__TAURI__）
 */
interface TauriAPI {
  window?: {
    getCurrentWindow: () => TauriWindowInstance;
  };
  event?: TauriEventAPI;
}

/**
 * Tauri 内部对象
 * 本项目仅通过 `'__TAURI_INTERNALS__' in window` 检测存在性，不访问具体字段
 * 使用 brand 模式表达"不透明类型"，避免泄漏内部结构
 */
interface TauriInternals {
  readonly __tauriInternalsBrand: unique symbol;
}

declare global {
  interface Window {
    /** Tauri 应用就绪标志，由 waitForTauri 设置 */
    __TAURI_READY__: boolean;
    /** Tauri 全局 API（withGlobalTauri 模式下挂载） */
    __TAURI__?: TauriAPI;
    /** Tauri 内部对象（仅用于存在性检测，不访问具体字段） */
    __TAURI_INTERNALS__?: TauriInternals;
    /** File System Access API：显示目录选择器 */
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
    /** File System Access API：显示保存文件选择器 */
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
    /** 调试用：挂载 updateStore 到 window */
    useUpdateStore?: typeof import('../stores/updateStore').useUpdateStore;
  }

  /**
   * 扩展 File 接口
   * Tauri 环境下拖放或文件选择返回的 File 对象会附加 path 字段
   * 浏览器环境下该字段不存在
   */
  interface File {
    /** Tauri 环境下附加的文件系统绝对路径，浏览器环境下不存在 */
    path?: string;
  }

  /**
   * 扩展 FileSystemDirectoryHandle 接口
   * TypeScript 5.4 的 lib.dom.d.ts 未声明异步迭代器方法（values/keys/entries），
   * 但浏览器实现已支持。这里补充声明，避免使用 as any 绕过类型检查。
   */
  interface FileSystemDirectoryHandle {
    values(): AsyncIterableIterator<FileSystemHandle>;
    keys(): AsyncIterableIterator<string>;
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    [Symbol.asyncIterator](): AsyncIterableIterator<FileSystemHandle>;
  }
}

export {};
