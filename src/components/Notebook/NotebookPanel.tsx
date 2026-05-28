import React from 'react';
import { useNotebookStore } from '../../stores/notebookStore';
import { SourcesPanel } from './SourcesPanel';
import { ChatPanel } from './ChatPanel';
import { GeneratePanel } from './GeneratePanel';
import { LLMConfigPanel } from './LLMConfigPanel';
import {
  BookOpen,
  MessageSquare,
  Wand2,
  Settings,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const NotebookPanel: React.FC = () => {
  const isOpen = useNotebookStore((s) => s.isOpen);
  const setIsOpen = useNotebookStore((s) => s.setIsOpen);
  const activeTab = useNotebookStore((s) => s.activeTab);
  const setActiveTab = useNotebookStore((s) => s.setActiveTab);
  const [showConfig, setShowConfig] = React.useState(false);
  const [panelWidth, setPanelWidth] = React.useState(360);

  const handleResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = startX - e.clientX;
      const newWidth = Math.max(300, Math.min(600, startWidth + diff));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const tabs = [
    { id: 'sources' as const, label: '来源', icon: <BookOpen size={15} /> },
    { id: 'chat' as const, label: '问答', icon: <MessageSquare size={15} /> },
    { id: 'generate' as const, label: '生成', icon: <Wand2 size={15} /> },
  ];

  return (
    <>
      {/* Toggle button - always visible */}
      <button
        className={`
          absolute top-1/2 transform -translate-y-1/2 z-10
          w-6 h-12 flex items-center justify-center
          bg-[var(--sidebar-surface)] border border-[var(--sidebar-border)]
          rounded-l-lg shadow-sm
          text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)]
          hover:bg-[var(--sidebar-hover)]
          transition-all duration-[var(--transition-fast)]
          group
        `}
        onClick={() => setIsOpen(!isOpen)}
        style={{ right: isOpen ? panelWidth - 1 : 0 }}
        title={isOpen ? '关闭 AI 笔记本' : '打开 AI 笔记本'}
      >
        {isOpen ? (
          <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        ) : (
          <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
        )}
      </button>

      {/* Panel */}
      <div
        className="flex-shrink-0 relative transition-all duration-[var(--transition-normal)] h-full border-l border-[var(--editor-border)] bg-[var(--editor-bg)]"
        style={{ width: isOpen ? panelWidth : 0, overflow: isOpen ? 'visible' : 'hidden' }}
      >
        {isOpen && (
          <>
            {/* Resize handle */}
            <div
              className="absolute top-0 left-0 w-1 h-full cursor-col-resize group z-10"
              onMouseDown={handleResize}
            >
              <div className="w-px h-full bg-transparent group-hover:bg-[var(--accent-500)] transition-colors" />
            </div>

            <div className="flex flex-col h-full" style={{ width: panelWidth }}>
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--editor-border)]">
                <div className="flex items-center gap-1.5">
                  <BookOpen size={14} className="text-[var(--accent-500)]" />
                  <span className="text-xs font-semibold text-[var(--editor-text)]">
                    AI 笔记本
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setShowConfig(!showConfig)}
                    className={`p-1.5 rounded-md transition-colors ${
                      showConfig
                        ? 'bg-[var(--accent-500)]/10 text-[var(--accent-500)]'
                        : 'hover:bg-[var(--sidebar-hover)] text-[var(--editor-text-muted)] hover:text-[var(--editor-text)]'
                    }`}
                    title="LLM 设置"
                  >
                    <Settings size={14} />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-md hover:bg-[var(--sidebar-hover)] text-[var(--editor-text-muted)] hover:text-[var(--editor-text)] transition-colors"
                    title="关闭面板"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Config panel (overlay) */}
              {showConfig && (
                <div className="border-b border-[var(--editor-border)]">
                  <LLMConfigPanel onClose={() => setShowConfig(false)} />
                </div>
              )}

              {/* Tab bar */}
              <div className="flex border-b border-[var(--editor-border)]">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors relative ${
                      activeTab === tab.id
                        ? 'text-[var(--accent-500)]'
                        : 'text-[var(--editor-text-muted)] hover:text-[var(--editor-text)]'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                    {activeTab === tab.id && (
                      <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--accent-500)] rounded-full" />
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-hidden">
                {activeTab === 'sources' && <SourcesPanel />}
                {activeTab === 'chat' && <ChatPanel />}
                {activeTab === 'generate' && <GeneratePanel />}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};
