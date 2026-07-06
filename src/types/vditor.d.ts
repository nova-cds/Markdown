/**
 * Vditor 类型扩展声明
 *
 * 集中扩展 Vditor 实例的自定义挂载属性、IVditor 内部字段以及官方类型未声明
 * 但运行时已支持的配置项（如 IMarkdownConfig 的 sup/sub）。
 * 所有字段均使用具体类型，不使用 any 兜底。
 *
 * 注意：Vditor 包的 dist/types/index.d.ts 是 script 文件（无 import/export），
 * 因此 IVditor / IMarkdownConfig / IOptions 等接口都是【全局】接口，
 * 必须通过 `declare global` 扩展；而 Vditor 类本身在 dist/index.d.ts 模块内，
 * 必须通过 `declare module 'vditor'` 扩展。
 */
import type Vditor from 'vditor';

/**
 * 扩展 Vditor 实例
 * 这些 _xxx 字段是本组件挂载到 Vditor 实例上的自定义回调/引用，
 * 用于在 cleanup 阶段解绑事件、断开 MutationObserver、移除注入样式等。
 */
declare module 'vditor' {
  interface Vditor {
    /** 拦截原版表情按钮点击，改用自定义 EmojiPicker */
    _emojiClickHandler?: (e: Event) => void;
    /** 注入到 document.head 中用于隐藏原版表情面板的 <style> 元素 */
    _emojiStyleEl?: HTMLStyleElement;
    /** 拦截缩进按钮，处理任务列表全选缩进问题 */
    _indentClickHandler?: (e: Event) => void;
    /** 编辑区滚动位置变化处理器（用于持久化滚动位置） */
    _scrollPositionHandler?: (e: Event) => void;
    /** 监听 vditor-outline 显示/隐藏的 MutationObserver */
    _outlineObserver?: MutationObserver;
    /** 大纲元素 mouseover 处理器（用于显示 tooltip） */
    _outlineMouseOverHandler?: (e: MouseEvent) => void;
    /** 大纲 mouseover 监听挂载的元素 */
    _outlineMouseOverTarget?: HTMLElement;
    /** 大纲拖拽调整宽度的 mousedown 处理器 */
    _outlineResizeMouseDown?: (e: MouseEvent) => void;
    /** 大纲拖拽调整宽度的 mousemove 处理器 */
    _outlineResizeMouseMove?: (e: MouseEvent) => void;
    /** 大纲拖拽调整宽度的 mouseup 处理器 */
    _outlineResizeMouseUp?: () => void;
    /** 监听编辑模式（sv/wysiwyg/ir）切换的 MutationObserver */
    _modeObserver?: MutationObserver;
    /** 监听预览模式（both/editor/preview）切换的 MutationObserver */
    _previewModeObserver?: MutationObserver;
    /** 链接点击拦截处理器（点击本地 md 链接跳转而非打开浏览器） */
    _linkClickHandler?: (e: MouseEvent) => void;
    /** 链接点击监听挂载元素（编辑区 .vditor-reset），用于 cleanup 时解绑 */
    _linkClickReset?: Element | null;
    /** 链接点击监听挂载元素（预览区 .vditor-preview），用于 cleanup 时解绑 */
    _linkClickPreview?: Element | null;
    /** 监听嵌入内容（[[xxx]](doc.md)）渲染的 MutationObserver */
    _previewObserver?: MutationObserver;
    /** TOC 目录点击跳转处理器（事件委托） */
    _tocClickHandler?: (e: MouseEvent) => void;
    /** TOC 点击监听挂载的容器元素 */
    _tocClickTarget?: HTMLElement;
    /** Tab 键拦截处理器（在非表格/列表区域插入全角空格） */
    _tabKeydownHandler?: (e: KeyboardEvent) => void;
    /** 图片懒加载 / 本地图片处理的 MutationObserver */
    _imageObserver?: MutationObserver;
    /** 用户输入 keydown 处理器（标记 isUserInput 以触发滚动到光标） */
    _handleKeyDown?: (e: KeyboardEvent) => void;
    /** 滚动监听挂载的 .vditor-reset 元素，用于 cleanup 时解绑 keydown */
    _vditorReset?: HTMLElement | null;
  }
}

declare global {
  /**
   * 扩展 Markdown 配置项
   * 官方 IMarkdownConfig 未声明 sup/sub，但 Lute 已通过 SetSup/SetSub 支持，
   * Vditor 内部会读取这两个字段并调用 Lute 的对应方法。
   */
  interface IMarkdownConfig {
    /** 上标（sup）开关，对应 Lute.SetSup */
    sup?: boolean;
    /** 下标（sub）开关，对应 Lute.SetSub */
    sub?: boolean;
  }

  /**
   * 扩展 IVditor 内部字段
   * currentPreviewMode 在 Vditor 运行时内部存在但官方类型未声明
   */
  interface IVditor {
    /** 当前预览模式（内部字段，用于追踪 'both' | 'editor' 状态） */
    currentPreviewMode?: 'both' | 'editor';
  }

  /**
   * 扩展 HTMLAnchorElement
   * 嵌入语法 [[xxx]](doc.md) 处理过程中，会在已处理的 <a> 元素上打标记，
   * 避免重复处理。该字段仅在 processEmbedPlaceholders 内部使用。
   */
  interface HTMLAnchorElement {
    /** 嵌入处理标记：true 表示该链接已被识别为嵌入并处理过 */
    _embedProcessed?: boolean;
  }
}

export {};
