export { useFileStore } from './fileStore';
export type { TreeNode } from './fileStore';
export { useEditorStore, getSavedContent } from './editorStore';
export type { DocumentState, EditorMode, PreviewMode } from './editorStore';
export { useSettingsStore } from './settingsStore';
export { useUpdateStore } from './updateStore';
export { useSplitStore } from './splitStore';
export type { Pane, PaneLeaf, PaneSplit, SplitDirection, TabSplitState } from './splitStore';
export { useRecentFilesStore } from './recentFilesStore';
export type { RecentFile } from './recentFilesStore';

let internalDragData: string | null = null;

export const setInternalDragData = (data: string | null) => {
  internalDragData = data;
};

export const getInternalDragData = () => {
  const data = internalDragData;
  internalDragData = null;
  return data;
};

export const peekInternalDragData = () => internalDragData;

export const clearInternalDragData = () => {
  internalDragData = null;
};
