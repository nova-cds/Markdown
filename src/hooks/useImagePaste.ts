import { useCallback } from 'react';
import type { RefObject, MutableRefObject } from 'react';
import type { ExtendedVditor } from '../types/vditor';
import { waitForTauri } from '../utils/platform';
import { useSettingsStore, useFileStore } from '../stores';

interface UseImagePasteOptions {
  path: string;
  containerRef: RefObject<HTMLDivElement>;
  vditorRef: MutableRefObject<ExtendedVditor | null>;
}

/**
 * 图片粘贴保存逻辑 Hook
 *
 * 从 VditorEditor.tsx 提取的 upload.handler 逻辑，
 * 处理 Tauri 和浏览器两种环境的图片保存。
 */
export function useImagePaste(options: UseImagePasteOptions) {
  const { path, containerRef, vditorRef } = options;

  const handleImagePaste = useCallback(
    async (files: File[]): Promise<null> => {
      const tauriDetected = await waitForTauri();
      const imageDirectory = useSettingsStore.getState().imageDirectory || 'img';
      const { rootHandle } = useFileStore.getState();

      let docDir = '';
      if (path.startsWith('file://')) {
        const fullPath = path.replace('file://', '');
        const lastSlash = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));
        if (lastSlash > 0) {
          docDir = fullPath.substring(0, lastSlash);
        }
      }

      if (!docDir) {
        alert('无法确定文档目录，请确保已保存文档。');
        return null;
      }

      if (tauriDetected) {
        try {
          const pathSep = '\\';
          const imgDirPath = `${docDir}${pathSep}${imageDirectory}`;

          const { mkdir, writeFile } = await import('@tauri-apps/plugin-fs');

          try {
            await mkdir(imgDirPath, { recursive: true });
          } catch (_e) {
            // 目录已存在，忽略错误
          }

          for (const file of files) {
            const timestamp = Date.now();
            const safeName = file.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5.]/g, '_');
            const fileName = `${timestamp}_${safeName}`;
            const filePath = `${imgDirPath}${pathSep}${fileName}`;

            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            await writeFile(filePath, uint8Array);

            const relativePath = `${imageDirectory}/${fileName}`;
            const markdown = `![${safeName.replace(/\.[^.]+$/, '')}](${relativePath})\n\n`;
            const vditor = vditorRef.current;
            if (vditor) {
              vditor.insertValue(markdown);

              setTimeout(() => {
                const vditorReset = containerRef.current?.querySelector(
                  '.vditor-ir .vditor-reset',
                ) as HTMLElement;
                if (vditorReset) {
                  vditorReset.focus();

                  const selection = window.getSelection();
                  if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    let cursorRect = range.getBoundingClientRect();

                    if (cursorRect.bottom === 0) {
                      const tempSpan = document.createElement('span');
                      tempSpan.textContent = '\u200B';
                      range.insertNode(tempSpan);
                      cursorRect = tempSpan.getBoundingClientRect();
                      tempSpan.remove();
                    }

                    const containerRect = vditorReset.getBoundingClientRect();
                    const margin = 80;
                    if (cursorRect.bottom > containerRect.bottom - margin) {
                      vditorReset.scrollTop += cursorRect.bottom - containerRect.bottom + margin;
                    }
                  }
                }
              }, 100);
            }
          }

          return null;
        } catch (e) {
          alert(`保存图片失败: ${e}`);
          return null;
        }
      }

      if (!rootHandle || typeof rootHandle === 'string') {
        alert('请先打开文件夹后再粘贴图片。');
        return null;
      }

      try {
        const { dirHandles, refreshFileTree } = useFileStore.getState();
        let docDirHandle: FileSystemDirectoryHandle = rootHandle;

        if (path.startsWith('file://')) {
          const fullPath = path.replace('file://', '');
          const lastSlash = fullPath.lastIndexOf('/');
          if (lastSlash > 0) {
            const dirPath = fullPath.substring(0, lastSlash);
            const foundHandle = dirHandles.get(dirPath);
            if (foundHandle && typeof foundHandle === 'object') {
              docDirHandle = foundHandle;
            }
          }
        }

        const imgDir = await docDirHandle.getDirectoryHandle(imageDirectory, { create: true });

        for (const file of files) {
          const timestamp = Date.now();
          const safeName = file.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5.]/g, '_');
          const fileName = `${timestamp}_${safeName}`;

          const fileHandle = await imgDir.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(file);
          await writable.close();

          const relativePath = `${imageDirectory}/${fileName}`;
          const markdown = `![${safeName.replace(/\.[^.]+$/, '')}](${relativePath})\n\n`;
          const vditor = vditorRef.current;
          if (vditor) {
            vditor.insertValue(markdown);

            setTimeout(() => {
              const vditorReset = containerRef.current?.querySelector(
                '.vditor-ir .vditor-reset',
              ) as HTMLElement;
              if (vditorReset) {
                vditorReset.focus();

                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                  const range = selection.getRangeAt(0);
                  let cursorRect = range.getBoundingClientRect();

                  if (cursorRect.bottom === 0) {
                    const tempSpan = document.createElement('span');
                    tempSpan.textContent = '\u200B';
                    range.insertNode(tempSpan);
                    cursorRect = tempSpan.getBoundingClientRect();
                    tempSpan.remove();
                  }

                  const containerRect = vditorReset.getBoundingClientRect();
                  const margin = 80;
                  if (cursorRect.bottom > containerRect.bottom - margin) {
                    vditorReset.scrollTop += cursorRect.bottom - containerRect.bottom + margin;
                  }
                }
              }
            }, 100);
          }
        }

        refreshFileTree();
        return null;
      } catch (e) {
        alert(`保存图片失败: ${e}`);
        return null;
      }
    },
    [path, containerRef, vditorRef],
  );

  return { handleImagePaste };
}
