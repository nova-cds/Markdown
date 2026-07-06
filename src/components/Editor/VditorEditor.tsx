import React, { useRef, useEffect, useState, useCallback } from 'react';
import Vditor from 'vditor';
import type { ExtendedVditor } from '../../types/vditor';
import 'vditor/dist/index.css';
import './vditor-styles.css';
import '../../styles/embed.css';
import {
  useEditorStore,
  useFileStore,
  useSettingsStore,
  EditorMode,
  PreviewMode,
} from '../../stores';
import { useSaveToFile, useSaveAsFile } from '../../hooks/useAutoSave';
import { isTauriCached } from '../../utils/platform';
import {
  isLocalMdFile,
  resolveDocPath,
  readMdFileContent,
  normalizePath as _normalizePath,
  getFileName as _getFileName,
} from '../../utils/linkUtils';
import {
  shouldRenderEmbed as _shouldRenderEmbed,
  processEmbedsInMarkdown as _processEmbedsInMarkdown,
  EmbedContext as _EmbedContext,
} from '../../utils/embedUtils';
import EmojiPicker from './EmojiPicker';
import ReplaceDialog from './ReplaceDialog';
import {
  VDITOR_CDN,
  countPlainText,
  handleLocalImage,
  processLocalImages,
} from './vditor-utils';
import { TOOLBAR_CONFIG, EMOJI_DATA } from './vditor-toolbar';
import { useImagePaste } from '../../hooks/useImagePaste';
import { processEmbeds } from '../../utils/embedProcessor';

interface VditorEditorProps {
  path: string;
  isInPane?: boolean;
}

export const VditorEditor = React.memo<VditorEditorProps>(({ path, isInPane }) => {
  const vditorRef = useRef<ExtendedVditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const updateDocument = useEditorStore((state) => state.updateDocument);
  const openDocument = useEditorStore((state) => state.openDocument);
  const setOutlineVisible = useEditorStore((state) => state.setOutlineVisible);
  const setEditorMode = useEditorStore((state) => state.setEditorMode);
  const setScrollPosition = useEditorStore((state) => state.setScrollPosition);
  const setPreviewMode = useEditorStore((state) => state.setPreviewMode);
  const _docState = useEditorStore((state) => state.documents[path]);
  const saveToFile = useSaveToFile();
  const saveAsFile = useSaveAsFile();
  const _embedMaxDepth = useSettingsStore((state) => state.embedMaxDepth);
  const embedMaxCount = useSettingsStore((state) => state.embedMaxCount);
  const editorWidth = useSettingsStore((state) => state.editorWidth);
  const rootHandle = useFileStore((state) => state.rootHandle);
  const isInitializedRef = useRef(false);
  const currentPathRef = useRef<string>('');
  const contentRef = useRef<string>('');
  const [initKey, setInitKey] = useState(0);
  const processedEmbedsRef = useRef<Set<string>>(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const { handleImagePaste } = useImagePaste({ path, containerRef, vditorRef });

  // 字数统计节流 - 使用ref保存debounce函数
  const wordCountDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateWordCountDebounced = useCallback(() => {
    if (wordCountDebounceRef.current) {
      clearTimeout(wordCountDebounceRef.current);
    }
    wordCountDebounceRef.current = setTimeout(() => {
      const md = vditorRef.current?.getValue() || '';
      const plainText = countPlainText(md);
      const store = useEditorStore.getState();
      store.setMarkdownLength(md.length);
      store.setWordCount(plainText);
    }, 300);
  }, []);

  const getRootPath = useCallback(() => {
    if (isTauriCached() && typeof rootHandle === 'string') {
      return rootHandle;
    }
    return undefined;
  }, [rootHandle]);

  const pathRef = useRef(path);
  const openDocumentRef = useRef(openDocument);
  const setOutlineVisibleRef = useRef(setOutlineVisible);
  const setEditorModeRef = useRef(setEditorMode);
  const setScrollPositionRef = useRef(setScrollPosition);
  const setPreviewModeRef = useRef(setPreviewMode);

  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  useEffect(() => {
    openDocumentRef.current = openDocument;
  }, [openDocument]);

  useEffect(() => {
    setOutlineVisibleRef.current = setOutlineVisible;
  }, [setOutlineVisible]);

  useEffect(() => {
    setEditorModeRef.current = setEditorMode;
  }, [setEditorMode]);

  useEffect(() => {
    setScrollPositionRef.current = setScrollPosition;
  }, [setScrollPosition]);

  useEffect(() => {
    setPreviewModeRef.current = setPreviewMode;
  }, [setPreviewMode]);

  // Ctrl+/ 快捷键 - 在IR和SV模式间切换
  useEffect(() => {
    const handleModeSwitch = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        e.stopPropagation();

        const toolbar = containerRef.current?.querySelector('.vditor-toolbar');
        if (!toolbar) return;

        const currentMode = vditorRef.current?.getCurrentMode();
        const targetMode = currentMode === 'ir' ? 'sv' : 'ir';

        // 直接点击工具栏中的模式按钮
        const buttons = toolbar.querySelectorAll('button');
        for (const btn of buttons) {
          const text = btn.textContent?.trim() || '';

          if (
            (targetMode === 'ir' && text.includes('即时渲染')) ||
            (targetMode === 'sv' && text.includes('分屏预览'))
          ) {
            (btn as HTMLElement).click();
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', handleModeSwitch, true);
    return () => window.removeEventListener('keydown', handleModeSwitch, true);
  }, []);

  // Ctrl+H 快捷键 - 打开查找替换弹窗
  useEffect(() => {
    const handleFindReplace = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        e.stopPropagation();
        setShowReplaceDialog(true);
      }
    };

    window.addEventListener('keydown', handleFindReplace, true);
    return () => window.removeEventListener('keydown', handleFindReplace, true);
  }, []);

  // Ctrl+S 快捷键 - 智能保存
  useEffect(() => {
    const handleSave = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        saveToFile();
      }
    };

    window.addEventListener('keydown', handleSave, true);
    return () => window.removeEventListener('keydown', handleSave, true);
  }, [saveToFile]);

  // Ctrl+Shift+S 快捷键 - 强制另存为
  useEffect(() => {
    const handleSaveAs = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        saveAsFile();
      }
    };

    window.addEventListener('keydown', handleSaveAs, true);
    return () => window.removeEventListener('keydown', handleSaveAs, true);
  }, [saveAsFile]);

  // 编辑区拖放文件处理
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleDrop = async (e: DragEvent) => {
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      // 检查是否是MD文件
      const mdFiles = Array.from(files).filter(
        (file) =>
          file.name.endsWith('.md') ||
          file.name.endsWith('.markdown') ||
          file.name.endsWith('.txt'),
      );

      if (mdFiles.length > 0) {
        e.preventDefault();
        e.stopPropagation();

        for (const file of mdFiles) {
          const content = await file.text();
          openDocument(`file://${file.name}`, content, false);
        }
      }
    };

    const handleDragOver = (e: DragEvent) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const hasMdFile = Array.from(files).some(
          (file) =>
            file.name.endsWith('.md') ||
            file.name.endsWith('.markdown') ||
            file.name.endsWith('.txt'),
        );
        if (hasMdFile) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    container.addEventListener('drop', handleDrop, true);
    container.addEventListener('dragover', handleDragOver, true);

    return () => {
      container.removeEventListener('drop', handleDrop, true);
      container.removeEventListener('dragover', handleDragOver, true);
    };
  }, [openDocument]);

  const handleLocalMdLinkClick = useCallback(
    async (href: string): Promise<boolean> => {
      if (!href || !isLocalMdFile(href)) {
        return false;
      }

      const rootPath = getRootPath();
      const resolvedPath = resolveDocPath(href, pathRef.current, rootPath);
      const docPath = `file://${resolvedPath}`;

      try {
        const result = await readMdFileContent(resolvedPath);

        if (result.content !== undefined) {
          openDocumentRef.current(docPath, result.content, false);
          return true;
        } else {
          alert(`无法打开文档: ${result.error || '文件不存在'}`);
        }
      } catch (err) {
        alert(`打开文档失败: ${err}`);
      }

      return false;
    },
    [getRootPath],
  );

  // 监听内容延迟加载（只对未初始化的文档）
  useEffect(() => {
    if (isInitializedRef.current) return;
    if (currentPathRef.current === path && contentRef.current) return;

    const unsubscribe = useEditorStore.subscribe((state) => {
      const doc = state.documents[path];
      if (
        doc?.content &&
        !isInitializedRef.current &&
        currentPathRef.current === path &&
        !contentRef.current
      ) {
        // 内容已加载，触发重新初始化
        setInitKey((k) => k + 1);
      }
    });

    return unsubscribe;
  }, [path]);

  // 监听外部内容变化（文件重新加载）
  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state, prevState) => {
      const doc = state.documents[path];
      const prevDoc = prevState.documents[path];

      if (
        doc &&
        prevDoc &&
        doc.content !== prevDoc.content &&
        !doc.isModified &&
        doc.content !== vditorRef.current?.getValue()
      ) {
        vditorRef.current?.setValue(doc.content);
        contentRef.current = doc.content;
      }
    });

    return unsubscribe;
  }, [path]);

  // 当 path 变化时初始化编辑器
  useEffect(() => {
    if (!containerRef.current) return;

    const documents = useEditorStore.getState().documents;
    const doc = documents[path];
    if (!doc) {
      return;
    }

    if (isInitializedRef.current && currentPathRef.current === path) {
      return;
    }

    if (vditorRef.current) {
      vditorRef.current.destroy();
      vditorRef.current = null;
    }

    currentPathRef.current = path;
    contentRef.current = doc.content || '';
    isInitializedRef.current = false;

    // 获取保存的状态 - 从当前store获取最新状态
    const currentDocState = useEditorStore.getState().documents[path];
    const savedOutlineVisible = isInPane ? false : (currentDocState?.outlineVisible ?? true);
    const savedEditorMode = currentDocState?.editorMode ?? 'ir';
    const savedScrollPosition = currentDocState?.scrollPosition ?? 0;
    const savedPreviewMode = currentDocState?.previewMode ?? 'editor';

    const vditor = new Vditor(containerRef.current, {
      mode: savedEditorMode,
      height: '100%',
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'classic',
      toolbarConfig: {
        pin: true,
      },
      outline: {
        enable: savedOutlineVisible,
        position: 'right',
      },
      cdn: VDITOR_CDN,
      preview: {
        markdown: {
          codeBlockPreview: true,
          mathBlockPreview: true,
          toc: true,
          mark: true,
          sup: true,
          sub: true,
        },
      },
      hint: {
        parse: false,
        emoji: EMOJI_DATA,
      },
      // 工具栏配置
      toolbar: TOOLBAR_CONFIG,
      // 编辑器配置
      cache: {
        enable: false,
      },
      counter: {
        enable: false,
      },
      // 图片上传配置
      upload: {
        handler: handleImagePaste,
      },
      // Tab行为配置：由自定义 handler 处理，这里禁用
      tab: '',
      value: contentRef.current,
      input: (value: string) => {
        updateDocument(path, value);
        updateWordCountDebounced();
      },
      after: () => {
        vditorRef.current = vditor;
        isInitializedRef.current = true;

        const _vditorInternal = vditor.vditor;

        // 设置初始字数统计
        const initialValue = vditor.getValue();
        const store = useEditorStore.getState();
        store.setMarkdownLength(initialValue.length);
        store.setWordCount(countPlainText(initialValue));

        // 手动启用上标和下标功能（等待官方发布 3.11.3）
        try {
          const lute = vditor.vditor?.lute;
          if (lute) {
            lute.SetSup(true);
            lute.SetSub(true);
            // 重新渲染当前内容
            const currentValue = vditor.getValue();
            vditor.setValue(currentValue);
          }
        } catch (e) {
          console.warn('[Lute] 启用上标/下标失败:', e);
        }

        // 处理本地图片加载
        processLocalImages(containerRef.current!, path);

        // 拦截原版emoji按钮点击，使用自定义表情选择器
        const emojiBtn = containerRef.current?.querySelector(
          '.vditor-toolbar button[data-type="emoji"]',
        );
        if (emojiBtn) {
          // 隐藏原版emoji面板
          const style = document.createElement('style');
          style.textContent = '.vditor-emojis { display: none !important; }';
          document.head.appendChild(style);

          // 拦截点击事件
          const handleEmojiClick = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            setShowEmojiPicker(true);
          };
          emojiBtn.addEventListener('click', handleEmojiClick, true);
          vditorRef.current!._emojiClickHandler = handleEmojiClick;
          vditorRef.current!._emojiStyleEl = style;
        }

        // 拦截indent按钮，处理任务列表全选缩进问题
        const indentBtn = containerRef.current?.querySelector(
          '.vditor-toolbar button[data-type="indent"]',
        );
        if (indentBtn) {
          const handleIndentClick = (_e: Event) => {
            // 在缩进执行后，检测并修复任务列表
            setTimeout(() => {
              const vditor = vditorRef.current;
              if (!vditor) return;

              // 获取当前光标位置
              const selection = window.getSelection();
              if (!selection || selection.rangeCount === 0) return;

              const range = selection.getRangeAt(0);
              const container = range.commonAncestorContainer;
              const li =
                container.nodeType === Node.TEXT_NODE
                  ? container.parentElement?.closest('li')
                  : (container as Element).closest('li');

              if (li) {
                // 检查这个li是否包含任务列表的文本格式（[ ] 或 [x]）
                const text = li.textContent || '';
                const hasTaskFormat = /\[([ xX])\]/.test(text);

                if (hasTaskFormat && !li.querySelector('input[type="checkbox"]')) {
                  // 找到li内最后一个文本节点
                  const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT, null);
                  let lastTextNode: Text | null = null;
                  let node;
                  while ((node = walker.nextNode())) {
                    lastTextNode = node as Text;
                  }

                  if (lastTextNode) {
                    // 将光标移动到行尾
                    const newRange = document.createRange();
                    newRange.setStart(lastTextNode, lastTextNode.length);
                    newRange.setEnd(lastTextNode, lastTextNode.length);
                    selection.removeAllRanges();
                    selection.addRange(newRange);

                    // 在行尾插入空格
                    vditor.insertValue(' ');

                    // 延迟删除空格
                    setTimeout(() => {
                      const sel = window.getSelection();
                      if (sel && sel.rangeCount > 0) {
                        const r = sel.getRangeAt(0);
                        // 删除最后一个字符（刚插入的空格）
                        r.setStart(r.startContainer, Math.max(0, r.startOffset - 1));
                        r.deleteContents();
                      }
                    }, 100);
                  }
                }
              }
            }, 100);
          };
          indentBtn.addEventListener('click', handleIndentClick, true);
          vditorRef.current!._indentClickHandler = handleIndentClick;
        }

        // 恢复预览模式
        const currentVditor = vditor;
        setTimeout(() => {
          if (vditorRef.current !== currentVditor) {
            return;
          }
          try {
            if (savedPreviewMode === 'both') {
              vditorRef.current?.setPreviewMode('both');
            } else if (savedPreviewMode === 'preview') {
              const previewBtn = containerRef.current?.querySelector(
                '.vditor-toolbar button[data-type="preview"]',
              ) as HTMLElement;
              if (previewBtn) {
                previewBtn.click();
              }
            }
          } catch (_e) {
            // ignore
          }
        }, 300);

        if (savedScrollPosition > 0) {
          setTimeout(() => {
            // 尝试多种选择器找到滚动容器
            let vditorResetEl: HTMLElement | null = null;
            const selectors = [
              '.vditor-ir .vditor-reset',
              '.vditor-sv .vditor-reset',
              '.vditor-wysiwyg .vditor-reset',
              '.vditor-reset',
            ];
            for (const selector of selectors) {
              const el = containerRef.current?.querySelector(selector) as HTMLElement;
              if (el && el.scrollHeight > el.clientHeight) {
                vditorResetEl = el;
                break;
              }
            }
            if (vditorResetEl) {
              vditorResetEl.scrollTop = savedScrollPosition;
            }
          }, 200);
        }

        // 监听滚动位置变化
        let scrollPositionTimeout: ReturnType<typeof setTimeout>;
        const handleScrollPosition = () => {
          clearTimeout(scrollPositionTimeout);
          scrollPositionTimeout = setTimeout(() => {
            // 查找当前可见的滚动容器
            let currentReset: HTMLElement | null = null;
            const selectors = [
              '.vditor-ir .vditor-reset',
              '.vditor-sv .vditor-reset',
              '.vditor-wysiwyg .vditor-reset',
              '.vditor-reset',
            ];
            for (const selector of selectors) {
              const el = containerRef.current?.querySelector(selector) as HTMLElement;
              if (el && el.offsetParent !== null) {
                currentReset = el;
                break;
              }
            }
            if (currentReset) {
              setScrollPositionRef.current(pathRef.current, currentReset.scrollTop);
            }
          }, 200);
        };

        // 给所有可能的滚动容器添加监听
        const resetElements = containerRef.current?.querySelectorAll('.vditor-reset');
        resetElements?.forEach((el) => {
          el.addEventListener('scroll', handleScrollPosition);
        });
        vditorRef.current!._scrollPositionHandler = handleScrollPosition;

        // 监听大纲显示/隐藏
        const outlineElement = containerRef.current?.querySelector(
          '.vditor-outline',
        ) as HTMLElement;
        if (outlineElement) {
          const outlineObserver = new MutationObserver(() => {
            const isVisible =
              outlineElement.style.display !== 'none' && outlineElement.offsetParent !== null;
            setOutlineVisibleRef.current(pathRef.current, isVisible);
          });
          outlineObserver.observe(outlineElement, {
            attributes: true,
            attributeFilter: ['style', 'class'],
          });
          vditorRef.current!._outlineObserver = outlineObserver;

          // 大纲增强功能：tooltip + 可调整宽度
          const setupOutlineEnhancements = () => {
            const OUTLINE_WIDTH_KEY = 'md-editor-outline-width';
            const MIN_WIDTH = 180;

            const getContentContainer = () => {
              return outlineElement.closest('.vditor-content') as HTMLElement;
            };

            const getMaxWidth = () => {
              const content = getContentContainer();
              if (!content) return 400;
              return Math.floor(content.offsetWidth * 0.5);
            };

            const applyWidth = (width: number) => {
              const maxWidth = getMaxWidth();
              const finalWidth = Math.max(MIN_WIDTH, Math.min(maxWidth, width));
              outlineElement.style.width = `${finalWidth}px`;
              outlineElement.style.flexBasis = `${finalWidth}px`;
            };

            const savedWidth = localStorage.getItem(OUTLINE_WIDTH_KEY);
            if (savedWidth) {
              const width = parseInt(savedWidth, 10);
              if (!isNaN(width)) {
                applyWidth(width);
              }
            }

            const handleOutlineMouseOver = (e: MouseEvent) => {
              const target = (e.target as HTMLElement).closest(
                'li > span > span',
              ) as HTMLElement | null;
              if (target && target.textContent) {
                target.setAttribute('title', target.textContent);
              }
            };
            outlineElement.addEventListener('mouseover', handleOutlineMouseOver);
            vditorRef.current!._outlineMouseOverHandler = handleOutlineMouseOver;
            vditorRef.current!._outlineMouseOverTarget = outlineElement;

            let isDragging = false;
            let startX = 0;
            let startWidth = 0;

            const handleMouseDown = (e: MouseEvent) => {
              if (e.button !== 0) return;
              const rect = outlineElement.getBoundingClientRect();
              const edgeWidth = 6;
              if (e.clientX < rect.left || e.clientX > rect.left + edgeWidth) return;
              if (e.clientY < rect.top || e.clientY > rect.bottom) return;

              isDragging = true;
              startX = e.clientX;
              startWidth = outlineElement.offsetWidth;
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
              outlineElement.classList.add('outline-resizing');
              e.preventDefault();
            };

            const handleMouseMove = (e: MouseEvent) => {
              if (isDragging) {
                const diff = startX - e.clientX;
                const newWidth = startWidth + diff;
                applyWidth(newWidth);
              } else {
                const rect = outlineElement.getBoundingClientRect();
                const edgeWidth = 6;
                if (
                  e.clientX >= rect.left &&
                  e.clientX <= rect.left + edgeWidth &&
                  e.clientY >= rect.top &&
                  e.clientY <= rect.bottom
                ) {
                  outlineElement.style.cursor = 'col-resize';
                } else {
                  outlineElement.style.cursor = '';
                }
              }
            };

            const handleMouseUp = () => {
              if (!isDragging) return;
              isDragging = false;
              document.body.style.cursor = '';
              document.body.style.userSelect = '';
              outlineElement.classList.remove('outline-resizing');
              const currentWidth = outlineElement.offsetWidth;
              localStorage.setItem(OUTLINE_WIDTH_KEY, currentWidth.toString());
            };

            document.addEventListener('mousedown', handleMouseDown);
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            vditorRef.current!._outlineResizeMouseDown = handleMouseDown;
            vditorRef.current!._outlineResizeMouseMove = handleMouseMove;
            vditorRef.current!._outlineResizeMouseUp = handleMouseUp;
          };

          setupOutlineEnhancements();
        }

        // 监听编辑模式切换 - 监听三个编辑区域的display变化
        const checkEditorMode = () => {
          const irElement = containerRef.current?.querySelector('.vditor-ir') as HTMLElement | null;
          const svElement = containerRef.current?.querySelector('.vditor-sv') as HTMLElement | null;
          const wysiwygElement = containerRef.current?.querySelector(
            '.vditor-wysiwyg',
          ) as HTMLElement | null;

          let currentMode: EditorMode = 'ir';
          if (svElement && svElement.style.display !== 'none') {
            currentMode = 'sv';
          } else if (wysiwygElement && wysiwygElement.style.display !== 'none') {
            currentMode = 'wysiwyg';
          } else if (irElement && irElement.style.display !== 'none') {
            currentMode = 'ir';
          }

          setEditorModeRef.current(pathRef.current, currentMode);
        };

        // 监听三个编辑区域的style变化
        const irElement = containerRef.current?.querySelector('.vditor-ir');
        const svElement = containerRef.current?.querySelector('.vditor-sv');
        const wysiwygElement = containerRef.current?.querySelector('.vditor-wysiwyg');

        const modeObserver = new MutationObserver(() => {
          checkEditorMode();
        });

        if (irElement) {
          modeObserver.observe(irElement, {
            attributes: true,
            attributeFilter: ['style', 'class'],
          });
        }
        if (svElement) {
          modeObserver.observe(svElement, {
            attributes: true,
            attributeFilter: ['style', 'class'],
          });
        }
        if (wysiwygElement) {
          modeObserver.observe(wysiwygElement, {
            attributes: true,
            attributeFilter: ['style', 'class'],
          });
        }
        vditorRef.current!._modeObserver = modeObserver;

        // 监听预览模式变化
        const previewElement = containerRef.current?.querySelector(
          '.vditor-preview',
        ) as HTMLElement;
        const irElementForPreview = containerRef.current?.querySelector(
          '.vditor-ir',
        ) as HTMLElement;
        const svElementForPreview = containerRef.current?.querySelector(
          '.vditor-sv',
        ) as HTMLElement;
        const wysiwygElementForPreview = containerRef.current?.querySelector(
          '.vditor-wysiwyg',
        ) as HTMLElement;

        if (previewElement) {
          const previewObserver = new MutationObserver(() => {
            const vditorInternal = vditorRef.current?.vditor;
            const _internalPreviewMode = vditorInternal?.currentPreviewMode;

            // 检测预览区域和编辑器区域的显示状态
            const previewVisible =
              previewElement.style.display !== 'none' && previewElement.offsetParent !== null;

            // 检查编辑器区域是否可见
            const irVisible = irElementForPreview
              ? irElementForPreview.style.display !== 'none' &&
                irElementForPreview.offsetParent !== null
              : false;
            const svVisible = svElementForPreview
              ? svElementForPreview.style.display !== 'none' &&
                svElementForPreview.offsetParent !== null
              : false;
            const wysiwygVisible = wysiwygElementForPreview
              ? wysiwygElementForPreview.style.display !== 'none' &&
                wysiwygElementForPreview.offsetParent !== null
              : false;
            const editorVisible = irVisible || svVisible || wysiwygVisible;

            // 根据显示状态判断模式
            let currentPreviewMode: PreviewMode = 'editor';
            if (previewVisible && editorVisible) {
              currentPreviewMode = 'both';
            } else if (previewVisible && !editorVisible) {
              currentPreviewMode = 'preview';
            }

            setPreviewModeRef.current(pathRef.current, currentPreviewMode);
          });
          previewObserver.observe(previewElement, {
            attributes: true,
            attributeFilter: ['style', 'class'],
          });
          if (irElementForPreview) {
            previewObserver.observe(irElementForPreview, {
              attributes: true,
              attributeFilter: ['style', 'class'],
            });
          }
          if (svElementForPreview) {
            previewObserver.observe(svElementForPreview, {
              attributes: true,
              attributeFilter: ['style', 'class'],
            });
          }
          if (wysiwygElementForPreview) {
            previewObserver.observe(wysiwygElementForPreview, {
              attributes: true,
              attributeFilter: ['style', 'class'],
            });
          }
          vditorRef.current!._previewModeObserver = previewObserver;
        }

        // 链接点击拦截处理 - 绑定到vditor-reset元素
        const handleLinkClick = (e: MouseEvent) => {
          const target = e.target as HTMLElement;

          const link = target.closest('a');
          let href: string | null = null;
          let linkText: string | null = null;

          if (link) {
            href = link.getAttribute('href');
            linkText = link.textContent;
          } else {
            const irLink = target.closest('.vditor-ir__link');
            if (irLink) {
              linkText = irLink.textContent;

              let parent = irLink.parentElement;
              let found = false;

              for (let i = 0; i < 5 && parent && !found; i++) {
                const urlElement = parent.querySelector('.vditor-ir__url') as HTMLElement;
                if (urlElement) {
                  href = urlElement.textContent;
                  found = true;
                  break;
                }

                const bracketElement = parent.querySelector('.vditor-ir__bracket');
                if (bracketElement) {
                  const nextSibling = bracketElement.nextElementSibling;
                  if (nextSibling && nextSibling.classList.contains('vditor-ir__url')) {
                    href = nextSibling.textContent;
                    found = true;
                    break;
                  }
                }

                parent = parent.parentElement;
              }

              if (!href && linkText) {
                const content = vditor.getValue();
                const linkRegex = new RegExp(
                  `\\[${linkText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\(([^)]+)\\)`,
                  'g',
                );
                const matches = [...content.matchAll(linkRegex)];
                if (matches.length > 0) {
                  href = matches[0][1];
                }
              }
            }
          }

          if (!href) {
            return;
          }

          href = href.replace(/[()]/g, '').trim();

          if (
            href.startsWith('http://') ||
            href.startsWith('https://') ||
            href.startsWith('mailto:')
          ) {
            return;
          }

          if (href.startsWith('#')) {
            return;
          }

          if (!isLocalMdFile(href)) {
            return;
          }

          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          const embedContainer = target.closest('.embed-container');
          if (embedContainer) {
            const embedPath = embedContainer.getAttribute('data-embed-path');
            if (embedPath && isLocalMdFile(embedPath)) {
              handleLocalMdLinkClick(embedPath);
              return;
            }
          }

          handleLocalMdLinkClick(href);
        };

        const vditorResetForLink = containerRef.current?.querySelector('.vditor-ir .vditor-reset');
        const vditorPreviewEl = containerRef.current?.querySelector('.vditor-preview');

        if (vditorResetForLink) {
          vditorResetForLink.addEventListener(
            'click',
            handleLinkClick as EventListener,
            true,
          );
        }
        if (vditorPreviewEl) {
          vditorPreviewEl.addEventListener(
            'click',
            handleLinkClick as EventListener,
            true,
          );
        }

        vditorRef.current!._linkClickHandler = handleLinkClick;
        vditorRef.current!._linkClickReset = vditorResetForLink;
        vditorRef.current!._linkClickPreview = vditorPreviewEl;

        // 处理预览模式的嵌入内容
        const currentPath = path;
        const maxEmbedCount = embedMaxCount;
        const currentRootPath = getRootPath();

        setTimeout(() => {
          if (containerRef.current) {
            processEmbeds(containerRef.current, vditor, {
              embedMaxCount: maxEmbedCount,
              currentPath,
              rootPath: currentRootPath,
            });
          }
        }, 300);

        const previewObserver = new MutationObserver(() => {
          if (containerRef.current) {
            processEmbeds(containerRef.current, vditor, {
              embedMaxCount: maxEmbedCount,
              currentPath,
              rootPath: currentRootPath,
            });
          }
        });

        if (containerRef.current) {
          previewObserver.observe(containerRef.current, {
            childList: true,
            subtree: true,
          });
        }
        vditorRef.current!._previewObserver = previewObserver;

        // TOC 目录点击跳转处理（使用事件委托，绑定到容器）
        const handleTocClick = (e: MouseEvent) => {
          const target = e.target as HTMLElement;

          const tocContainer = target.closest('.vditor-toc');
          if (!tocContainer) return;

          const tocItem = target.closest('li');
          if (!tocItem) return;

          const link = tocItem.querySelector('a, span[data-target-id]') as HTMLElement;
          if (!link) return;

          e.preventDefault();
          e.stopPropagation();

          let headingId: string | null = null;
          if (link.tagName === 'A') {
            const href = link.getAttribute('href');
            if (href && href.startsWith('#')) {
              headingId = href.substring(1);
            }
          } else {
            headingId = link.getAttribute('data-target-id');
          }

          if (headingId) {
            const vditorReset = containerRef.current?.querySelector(
              '.vditor-ir .vditor-reset',
            ) as HTMLElement;
            if (!vditorReset) return;

            // 去掉 ir- 前缀
            const cleanHeadingId = headingId.replace(/^ir-/, '');

            let heading = vditorReset.querySelector(`[id="${headingId}"]`) as HTMLElement;

            if (!heading) {
              // 尝试查找匹配的标题
              const headings = vditorReset.querySelectorAll('h1, h2, h3, h4, h5, h6');
              for (const h of headings) {
                const hText = h.textContent?.trim().replace(/^#+\s*/, '');
                if (hText === cleanHeadingId || hText === decodeURIComponent(cleanHeadingId)) {
                  heading = h as HTMLElement;
                  break;
                }
              }
            }

            if (heading) {
              // 大文档使用即时滚动，小文档使用平滑滚动
              const isLargeDoc = vditorReset.scrollHeight > 50000;
              vditorReset.scrollTo({
                top: heading.offsetTop - 20,
                behavior: isLargeDoc ? 'instant' : 'smooth',
              });
            }
          }
        };

        // 绑定到整个编辑器容器（捕获阶段）
        if (containerRef.current) {
          containerRef.current.addEventListener('click', handleTocClick as EventListener, true);
          vditorRef.current!._tocClickHandler = handleTocClick;
          vditorRef.current!._tocClickTarget = containerRef.current;
        }

        // 渲染 Mermaid 图表
        const renderMermaid = () => {
          const mermaidElements = containerRef.current?.querySelectorAll(
            '.vditor-ir pre.vditor-reset .mermaid',
          );
          if (mermaidElements && mermaidElements.length > 0) {
            try {
              const theme = document.documentElement.classList.contains('dark')
                ? 'dark'
                : 'classic';
              Vditor.mermaidRender(containerRef.current!, VDITOR_CDN, theme);
            } catch (e) {
              console.warn('[Mermaid] 渲染失败:', e);
            }
          }
        };

        // 渲染 PlantUML 图表
        const renderPlantUML = () => {
          const plantumlElements = containerRef.current?.querySelectorAll(
            '.vditor-ir pre.vditor-reset .language-plantuml',
          );
          if (plantumlElements && plantumlElements.length > 0) {
            try {
              Vditor.plantumlRender(containerRef.current!, VDITOR_CDN);
            } catch (e) {
              console.warn('[PlantUML] 渲染失败:', e);
            }
          }
        };

        // 初始渲染
        setTimeout(renderMermaid, 100);
        setTimeout(renderPlantUML, 100);

        // 检测光标是否在行首
        const _isAtLineStart = (): boolean => {
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) return false;

          const range = selection.getRangeAt(0);
          const container = range.startContainer;

          // 如果是文本节点，检查偏移量
          if (container.nodeType === Node.TEXT_NODE) {
            const text = container.textContent || '';
            const offset = range.startOffset;

            // 检查光标前的文本是否全是空白或为空
            const textBeforeCursor = text.substring(0, offset);
            if (offset === 0 || /^\s*$/.test(textBeforeCursor)) {
              // 还需要检查是否在行首（父元素是段落开头）
              const parent = container.parentElement;
              if (parent) {
                // 获取光标所在行的文本
                const lineText = parent.textContent || '';
                const cursorPosInLine = offset + (parent.firstChild === container ? 0 : 0);

                // 如果光标前的内容都是空白，则认为在行首
                const beforeCursor = lineText.substring(0, cursorPosInLine);
                if (/^\s*$/.test(beforeCursor) || cursorPosInLine === 0) {
                  return true;
                }
              }
            }
          }

          return false;
        };

        // 记录 Tab 按下时间，用于检测 Tab 触发的代码块
        let lastTabTime = 0;
        let _isTabPressed = false;

        // 在编辑器容器上拦截 Tab 键
        const tabKeydownHandler = (e: KeyboardEvent) => {
          if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);

              // 检查是否在表格内
              const cell = range.startContainer.parentElement?.closest('td, th');
              if (cell) {
                return;
              }

              // 检查是否在列表内 - 匹配 UL/OL/LI 标签
              const listContainer = range.startContainer.parentElement?.closest('ul, ol, li');
              if (listContainer) {
                return;
              }
            }

            // 不在表格或列表内，插入缩进
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            _isTabPressed = true;
            lastTabTime = Date.now();

            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              const textNode = document.createTextNode('　　');
              range.insertNode(textNode);
              range.setStartAfter(textNode);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);

              // 触发 input 事件让 Vditor 知道内容变化了
              containerRef.current
                ?.querySelector('.vditor-reset')
                ?.dispatchEvent(new InputEvent('input', { bubbles: true }));
            }
          }
        };

        containerRef.current?.addEventListener('keydown', tabKeydownHandler, true);
        vditorRef.current!._tabKeydownHandler = tabKeydownHandler;

        // Mermaid 渲染防抖
        let mermaidDebounceTimer: number | null = null;
        const debouncedRenderMermaid = () => {
          if (mermaidDebounceTimer) {
            clearTimeout(mermaidDebounceTimer);
          }
          mermaidDebounceTimer = window.setTimeout(() => {
            const mermaidElements = containerRef.current?.querySelectorAll(
              '.vditor-ir .vditor-reset .mermaid',
            );
            if (mermaidElements && mermaidElements.length > 0) {
              try {
                const theme = document.documentElement.classList.contains('dark')
                  ? 'dark'
                  : 'classic';
                Vditor.mermaidRender(containerRef.current!, VDITOR_CDN, theme);
              } catch (e) {
                console.warn('[Mermaid] 渲染失败:', e);
              }
            }
          }, 300);
        };

        // PlantUML 渲染防抖
        let plantumlDebounceTimer: number | null = null;
        const debouncedRenderPlantUML = () => {
          if (plantumlDebounceTimer) {
            clearTimeout(plantumlDebounceTimer);
          }
          plantumlDebounceTimer = window.setTimeout(() => {
            const plantumlElements = containerRef.current?.querySelectorAll(
              '.vditor-ir .vditor-reset .language-plantuml',
            );
            if (plantumlElements && plantumlElements.length > 0) {
              try {
                Vditor.plantumlRender(containerRef.current!, VDITOR_CDN);
              } catch (e) {
                console.warn('[PlantUML] 渲染失败:', e);
              }
            }
          }, 300);
        };

        // MutationObserver 回调处理函数
        const handleMutationCallback = (mutations: MutationRecord[]) => {
          for (const mutation of mutations) {
            for (const node of Array.from(mutation.addedNodes)) {
              // 处理图片
              if (node instanceof HTMLImageElement) {
                handleLocalImage(node, path);
              } else if (node instanceof HTMLElement) {
                const imgs = node.querySelectorAll('img');
                imgs.forEach((img) => handleLocalImage(img, path));

                // 检测 Mermaid 代码块
                if (node.classList?.contains('mermaid') || node.querySelector?.('.mermaid')) {
                  debouncedRenderMermaid();
                }

                // 检测 PlantUML 代码块
                if (
                  node.classList?.contains('language-plantuml') ||
                  node.querySelector?.('.language-plantuml')
                ) {
                  debouncedRenderPlantUML();
                }

                // 检测是否是 Tab 触发的代码块
                if (
                  node.getAttribute?.('data-type') === 'code-block' ||
                  node.querySelector?.('[data-type="code-block"]')
                ) {
                  const now = Date.now();
                  // 如果在 Tab 按下后 100ms 内插入的代码块，认为是 Tab 触发的
                  if (now - lastTabTime < 100) {
                    node.remove();
                    vditorRef.current?.insertValue('　　');
                  }
                }
              }
            }
          }
        };

        // 监听DOM变化，处理新插入的图片和代码块
        const imageObserver = new MutationObserver(handleMutationCallback);

        imageObserver.observe(containerRef.current!, {
          childList: true,
          subtree: true,
        });

        // 自动滚动逻辑 - 类似 VS Code
        // 关键：滚动元素是 .vditor-reset，不是 .vditor-content
        const vditorResetForScroll = containerRef.current?.querySelector(
          '.vditor-ir .vditor-reset',
        ) as HTMLElement;
        const contentEl = containerRef.current?.querySelector('.vditor-content') as HTMLElement;

        let isUserInput = false;

        const handleScroll = () => {
          if (!vditorResetForScroll || !contentEl || !isUserInput) return;

          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) return;

          const range = selection.getRangeAt(0);
          let cursorRect = range.getBoundingClientRect();

          if (cursorRect.bottom === 0 && range.collapsed) {
            const tempSpan = document.createElement('span');
            tempSpan.textContent = '\u200B';
            range.insertNode(tempSpan);
            cursorRect = tempSpan.getBoundingClientRect();
            tempSpan.remove();
          }

          if (cursorRect.bottom === 0) return;

          const containerRect = contentEl.getBoundingClientRect();
          const currentDistanceFromBottom = containerRect.bottom - cursorRect.bottom;

          const fixedDistanceFromBottom = 120;

          if (currentDistanceFromBottom < fixedDistanceFromBottom) {
            const scrollAmount = fixedDistanceFromBottom - currentDistanceFromBottom;
            vditorResetForScroll.scrollTop += scrollAmount;
          }

          isUserInput = false;
        };

        // 监听键盘事件（用户输入时触发）
        const handleKeyDown = (e: KeyboardEvent) => {
          // 只在用户输入字符时标记
          if (e.key.length === 1 || e.key === 'Enter') {
            isUserInput = true;
            requestAnimationFrame(() => handleScroll());
          }
        };

        if (vditorResetForScroll) {
          vditorResetForScroll.addEventListener('keydown', handleKeyDown as EventListener);
        }

        // 保存引用以便清理
        vditorRef.current!._imageObserver = imageObserver;
        vditorRef.current!._handleKeyDown = handleKeyDown;
        vditorRef.current!._vditorReset = vditorResetForScroll;
      },
    });

    // 在 effect 内复制 ref 当前值到局部变量，cleanup 中使用局部变量避免 ref 已变化的问题
    const container = containerRef.current;
    const processedEmbeds = processedEmbedsRef.current;

    return () => {
      if (vditorRef.current) {
        const imageObserver = vditorRef.current!._imageObserver;
        const handleKeyDown = vditorRef.current!._handleKeyDown;
        const vditorReset = vditorRef.current!._vditorReset;
        const tabKeydownHandler = vditorRef.current!._tabKeydownHandler;
        const tocClickHandler = vditorRef.current!._tocClickHandler;
        const tocClickTarget = vditorRef.current!._tocClickTarget;
        const linkClickHandler = vditorRef.current!._linkClickHandler;
        const linkClickReset = vditorRef.current!._linkClickReset;
        const linkClickPreview = vditorRef.current!._linkClickPreview;
        const previewObserver = vditorRef.current!._previewObserver;
        const outlineObserver = vditorRef.current!._outlineObserver;
        const outlineMouseOverHandler = vditorRef.current!._outlineMouseOverHandler;
        const outlineMouseOverTarget = vditorRef.current!._outlineMouseOverTarget;
        const outlineResizeMouseDown = vditorRef.current!._outlineResizeMouseDown;
        const outlineResizeMouseMove = vditorRef.current!._outlineResizeMouseMove;
        const outlineResizeMouseUp = vditorRef.current!._outlineResizeMouseUp;
        const modeObserver = vditorRef.current!._modeObserver;
        const previewModeObserver = vditorRef.current!._previewModeObserver;

        if (imageObserver) imageObserver.disconnect();
        if (previewObserver) previewObserver.disconnect();
        if (outlineObserver) outlineObserver.disconnect();
        if (outlineMouseOverHandler && outlineMouseOverTarget) {
          outlineMouseOverTarget.removeEventListener('mouseover', outlineMouseOverHandler);
        }
        if (outlineResizeMouseDown) {
          document.removeEventListener('mousedown', outlineResizeMouseDown);
        }
        if (outlineResizeMouseMove) {
          document.removeEventListener('mousemove', outlineResizeMouseMove);
        }
        if (outlineResizeMouseUp) {
          document.removeEventListener('mouseup', outlineResizeMouseUp);
        }
        if (modeObserver) modeObserver.disconnect();
        if (previewModeObserver) previewModeObserver.disconnect();

        // 移除滚动监听
        const scrollPositionHandler = vditorRef.current!._scrollPositionHandler;
        if (scrollPositionHandler) {
          const resetEls = container?.querySelectorAll('.vditor-reset');
          resetEls?.forEach((el) => {
            el.removeEventListener('scroll', scrollPositionHandler);
          });
        }
        if (handleKeyDown && vditorReset) {
          vditorReset.removeEventListener('keydown', handleKeyDown);
        }
        if (tabKeydownHandler && container) {
          container.removeEventListener('keydown', tabKeydownHandler, true);
        }
        if (tocClickHandler && tocClickTarget) {
          tocClickTarget.removeEventListener('click', tocClickHandler, true);
        }
        if (linkClickHandler) {
          if (linkClickReset) {
            linkClickReset.removeEventListener('click', linkClickHandler as EventListener, true);
          }
          if (linkClickPreview) {
            linkClickPreview.removeEventListener('click', linkClickHandler as EventListener, true);
          }
        }
        processedEmbeds.clear();
        vditorRef.current.destroy();
        vditorRef.current = null;
        isInitializedRef.current = false;
        currentPathRef.current = '';
        contentRef.current = '';
      }
    };
    // 依赖项故意省略 embedMaxCount/getRootPath/handleLocalMdLinkClick/isInPane/updateWordCountDebounced：
    // 这些值的变化不应触发 Vditor 重建（重建会丢失光标、滚动位置和未保存内容）。
    // 它们通过 ref 或闭包在 effect 内被读取，确保使用最新值的同时保持 effect 稳定。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, initKey, updateDocument, saveToFile, handleImagePaste]);

  // 监听主题变化
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const isDark = document.documentElement.classList.contains('dark');
          if (vditorRef.current) {
            vditorRef.current.setTheme(isDark ? 'dark' : 'classic');
          }
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`vditor-container editor-width-${editorWidth}`}
      style={{ position: 'relative' }}
    >
      <div ref={containerRef} className="vditor-wrapper" />
      {/* 表情选择器弹窗 */}
      {showEmojiPicker && (
        <EmojiPicker
          onSelect={(emoji) => {
            if (vditorRef.current) {
              vditorRef.current.insertValue(emoji + ' ');
            }
          }}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
      {/* 查找替换弹窗 */}
      {showReplaceDialog && (
        <ReplaceDialog
          isOpen={showReplaceDialog}
          onClose={() => setShowReplaceDialog(false)}
          vditor={vditorRef.current}
        />
      )}
    </div>
  );
});

VditorEditor.displayName = 'VditorEditor';

export default VditorEditor;
