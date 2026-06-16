import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '../Sidebar/Sidebar';
import { TitleBar } from '../TitleBar/TitleBar';
import { EditorContainer } from '../Editor/EditorContainer';
import { SettingsPanel } from '../Settings/SettingsPanel';
import { QuickOpen } from '../QuickOpen/QuickOpen';
import { useEditorStore } from '../../stores';
import { useAutoSave, useTheme, useFileChangeDetection, useSplitShortcuts } from '../../hooks';
import { ChevronLeft, ChevronRight, Focus, X } from 'lucide-react';

export const Layout: React.FC = () => {
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);

  const focusMode = useEditorStore((state) => state.focusMode);
  const toggleFocusMode = useEditorStore((state) => state.toggleFocusMode);

  useAutoSave();
  useTheme();
  useFileChangeDetection();
  useSplitShortcuts();

  // Ctrl+P / Cmd+P 快速打开
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      setQuickOpenOpen(true);
    }
    // Ctrl+Shift+F 切换专注模式
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      toggleFocusMode();
    }
    // ESC 退出专注模式
    if (e.key === 'Escape' && focusMode) {
      e.preventDefault();
      toggleFocusMode();
    }
  }, [focusMode, toggleFocusMode]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSidebarResize = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX;
      const newWidth = Math.max(180, Math.min(400, startWidth + diff));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--editor-bg)] text-[var(--editor-text)]">
      {/* Sidebar - 专注模式下隐藏 */}
      <div
        className={`flex-shrink-0 relative transition-all duration-[var(--transition-normal)] ${focusMode ? 'hidden' : ''}`}
        style={{ width: isSidebarCollapsed ? 0 : sidebarWidth }}
      >
        {!isSidebarCollapsed && <Sidebar />}

        {/* Resize handle */}
        {!isSidebarCollapsed && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize group"
            onMouseDown={handleSidebarResize}
          >
            <div className="w-px h-full bg-[var(--editor-border)] group-hover:bg-[var(--accent-500)] transition-colors" />
          </div>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* TitleBar - 专注模式下隐藏 */}
        <div className={`transition-all duration-[var(--transition-normal)] ${focusMode ? 'hidden' : ''}`}>
          <TitleBar />
        </div>

        {/* Editor area */}
        <div className="flex-1 overflow-hidden">
          <EditorContainer />
        </div>

        {/* Status bar - 专注模式下隐藏 */}
        <div className={`transition-all duration-[var(--transition-normal)] ${focusMode ? 'hidden' : ''}`}>
          <StatusBar />
        </div>
      </div>

      {/* Toggle sidebar button - 专注模式下隐藏 */}
      {!focusMode && (
        <button
          className={`
            absolute top-1/2 transform -translate-y-1/2 z-10
            w-6 h-12 flex items-center justify-center
            bg-[var(--sidebar-surface)] border border-[var(--sidebar-border)]
            rounded-r-lg shadow-sm
            text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)]
            hover:bg-[var(--sidebar-hover)]
            transition-all duration-[var(--transition-fast)]
            group
          `}
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          style={{ left: isSidebarCollapsed ? 0 : sidebarWidth - 1 }}
        >
          {isSidebarCollapsed ? (
            <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          ) : (
            <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
          )}
        </button>
      )}

      {/* 专注模式退出按钮 */}
      {focusMode && (
        <div className="fixed top-4 right-4 z-[100] animate-fade-in">
          <button
            onClick={toggleFocusMode}
            className="flex items-center gap-2 px-4 py-2 rounded-lg
              bg-[var(--editor-surface)] border border-[var(--editor-border)]
              text-[var(--editor-text-secondary)] hover:text-[var(--editor-text)]
              hover:bg-[var(--sidebar-hover)] hover:border-[var(--accent-500)]
              transition-all duration-[var(--transition-fast)]
              shadow-lg backdrop-blur-sm"
            title="退出专注模式 (ESC)"
          >
            <X size={16} />
            <span className="text-sm">退出专注模式</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--editor-code-bg)] rounded border border-[var(--editor-border)]">
              ESC
            </kbd>
          </button>
        </div>
      )}

      {/* 专注模式指示器 - 左下角 */}
      {focusMode && (
        <div className="fixed bottom-4 left-4 z-[100] animate-fade-in">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full
            bg-[var(--accent-500)]/10 border border-[var(--accent-500)]/20
            text-[var(--accent-500)] text-xs">
            <Focus size={14} />
            <span>专注模式</span>
          </div>
        </div>
      )}

      {/* Quick Open */}
      <QuickOpen isOpen={quickOpenOpen} onClose={() => setQuickOpenOpen(false)} />

      {/* Settings panel */}
      <SettingsPanel />
    </div>
  );
};

const StatusBar: React.FC = () => {
  const activeDocPath = useEditorStore((state) => state.activeDocPath);
  const saveStatus = useEditorStore((state) => state.saveStatus);
  const wordCount = useEditorStore((state) => state.wordCount);
  const markdownLength = useEditorStore((state) => state.markdownLength);
  const toggleFocusMode = useEditorStore((state) => state.toggleFocusMode);
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const checkDark = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const getStatusText = () => {
    switch (saveStatus) {
      case 'saving':
        return '保存中...';
      case 'unsaved':
        return '未保存';
      default:
        return '已保存';
    }
  };

  const getStatusColor = () => {
    switch (saveStatus) {
      case 'saving':
        return 'text-[var(--warning-500)]';
      case 'unsaved':
        return 'text-[var(--error-500)]';
      default:
        return 'text-[var(--success-500)]';
    }
  };

  return (
    <div className="h-6 px-4 flex items-center justify-between text-xs bg-[var(--statusbar-bg)] border-t border-[var(--editor-border)] select-none">
      <div className="flex items-center gap-2 text-[var(--statusbar-text)]">
        <span className="opacity-70">
          {activeDocPath ? activeDocPath.replace('file://', '') : '未打开文件'}
        </span>
      </div>
      <div className="flex items-center gap-4 text-[var(--statusbar-text)]">
        {/* 专注模式按钮 */}
        <button
          onClick={toggleFocusMode}
          className="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
          title="进入专注模式 (Ctrl+Shift+F)"
        >
          <Focus size={12} />
          <span>专注</span>
        </button>

        <span 
          className="cursor-help relative group"
        >
          <span className="opacity-70">{wordCount} 字</span>
          <span 
            className="absolute bottom-full right-0 mb-2 px-3 py-2 text-xs rounded-lg shadow-2xl whitespace-nowrap pointer-events-none z-[100] border font-medium hidden group-hover:block"
            style={{ 
              backgroundColor: isDark ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)',
              color: isDark ? 'rgb(241, 245, 249)' : 'rgb(15, 23, 42)',
              borderColor: isDark ? 'rgb(71, 85, 105)' : 'rgb(148, 163, 184)'
            }}
          >
            <div className="flex justify-between gap-4">
              <span style={{ color: isDark ? 'rgb(148, 163, 184)' : 'rgb(71, 85, 105)' }}>字数</span>
              <span>{wordCount}</span>
            </div>
            <div className="flex justify-between gap-4 mt-1">
              <span style={{ color: isDark ? 'rgb(148, 163, 184)' : 'rgb(71, 85, 105)' }}>Markdown文本</span>
              <span>{markdownLength}</span>
            </div>
          </span>
        </span>
        <span className={`flex items-center gap-1 ${getStatusColor()}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            saveStatus === 'saving' ? 'bg-[var(--warning-500)] animate-pulse' :
            saveStatus === 'unsaved' ? 'bg-[var(--error-500)]' :
            'bg-[var(--success-500)]'
          }`} />
          {getStatusText()}
        </span>
        <span className="opacity-70">Markdown</span>
      </div>
    </div>
  );
};

export default Layout;
