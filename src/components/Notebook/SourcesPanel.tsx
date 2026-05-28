import React, { useState } from 'react';
import { useNotebookStore } from '../../stores/notebookStore';
import { useEditorStore } from '../../stores';
import { Plus, Trash2, FileText, Globe, Type, FilePlus } from 'lucide-react';

export const SourcesPanel: React.FC = () => {
  const sources = useNotebookStore((s) => s.sources);
  const addSource = useNotebookStore((s) => s.addSource);
  const removeSource = useNotebookStore((s) => s.removeSource);
  const addCurrentDocument = useNotebookStore((s) => s.addCurrentDocument);
  const activeDocPath = useEditorStore((s) => s.activeDocPath);
  const documents = useEditorStore((s) => s.documents);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addType, setAddType] = useState<'text' | 'url'>('text');
  const [addName, setAddName] = useState('');
  const [addContent, setAddContent] = useState('');

  const handleAddCurrentDoc = () => {
    if (!activeDocPath) return;
    const doc = documents[activeDocPath];
    if (!doc) return;
    addCurrentDocument(activeDocPath, doc.content);
  };

  const handleAddSource = () => {
    if (!addName.trim() || !addContent.trim()) return;
    addSource(addName.trim(), addContent.trim(), addType);
    setAddName('');
    setAddContent('');
    setShowAddDialog(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'markdown':
        return <FileText size={14} />;
      case 'url':
        return <Globe size={14} />;
      default:
        return <Type size={14} />;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header actions */}
      <div className="flex items-center gap-2 p-3 border-b border-[var(--editor-border)]">
        <button
          onClick={handleAddCurrentDoc}
          disabled={!activeDocPath}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-[var(--accent-500)] text-white hover:bg-[var(--accent-600)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={activeDocPath ? '添加当前文档为知识来源' : '请先打开一个文档'}
        >
          <FilePlus size={14} />
          添加当前文档
        </button>
        <button
          onClick={() => setShowAddDialog(true)}
          className="flex items-center justify-center p-2 rounded-lg hover:bg-[var(--sidebar-hover)] text-[var(--editor-text-secondary)] hover:text-[var(--editor-text)] transition-colors"
          title="添加文本/链接"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Sources list */}
      <div className="flex-1 overflow-y-auto p-2">
        {sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <FileText size={32} className="text-[var(--editor-text-muted)] mb-3" />
            <p className="text-sm text-[var(--editor-text-secondary)] mb-1">暂无知识来源</p>
            <p className="text-xs text-[var(--editor-text-muted)]">
              添加文档作为 AI 的参考资料
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {sources.map((source) => (
              <div
                key={source.id}
                className="group flex items-start gap-2 p-2.5 rounded-lg hover:bg-[var(--sidebar-hover)] transition-colors"
              >
                <span className="mt-0.5 text-[var(--accent-500)]">
                  {getTypeIcon(source.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--editor-text)] truncate">
                    {source.name}
                  </p>
                  <p className="text-xs text-[var(--editor-text-muted)] mt-0.5">
                    {source.chunks?.length || 0} 段 · {formatDate(source.addedAt)}
                  </p>
                </div>
                <button
                  onClick={() => removeSource(source.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--error-500)]/10 text-[var(--editor-text-muted)] hover:text-[var(--error-500)] transition-all"
                  title="移除来源"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Source count */}
      {sources.length > 0 && (
        <div className="px-3 py-2 border-t border-[var(--editor-border)] text-xs text-[var(--editor-text-muted)]">
          共 {sources.length} 个来源，
          {sources.reduce((sum, s) => sum + (s.chunks?.length || 0), 0)} 个文本段落
        </div>
      )}

      {/* Add source dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowAddDialog(false)}
          />
          <div className="relative w-[480px] max-h-[80vh] bg-[var(--editor-bg)] rounded-xl shadow-2xl border border-[var(--editor-border)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--editor-border)]">
              <h3 className="text-sm font-semibold text-[var(--editor-text)]">添加知识来源</h3>
              <button
                onClick={() => setShowAddDialog(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--sidebar-hover)] text-[var(--editor-text-muted)]"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setAddType('text')}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    addType === 'text'
                      ? 'bg-[var(--accent-500)] text-white border-[var(--accent-500)]'
                      : 'border-[var(--editor-border)] text-[var(--editor-text-secondary)] hover:bg-[var(--sidebar-hover)]'
                  }`}
                >
                  文本
                </button>
                <button
                  onClick={() => setAddType('url')}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    addType === 'url'
                      ? 'bg-[var(--accent-500)] text-white border-[var(--accent-500)]'
                      : 'border-[var(--editor-border)] text-[var(--editor-text-secondary)] hover:bg-[var(--sidebar-hover)]'
                  }`}
                >
                  网页链接
                </button>
              </div>
              <div>
                <label className="block text-xs text-[var(--editor-text-secondary)] mb-1.5">
                  名称
                </label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder={addType === 'url' ? '网页标题' : '文档名称'}
                  className="w-full px-3 py-2 text-sm bg-[var(--editor-surface)] border border-[var(--editor-border)] rounded-lg text-[var(--editor-text)] focus:outline-none focus:border-[var(--accent-500)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--editor-text-secondary)] mb-1.5">
                  {addType === 'url' ? '网页内容（粘贴网页文本）' : '文本内容'}
                </label>
                <textarea
                  value={addContent}
                  onChange={(e) => setAddContent(e.target.value)}
                  placeholder={
                    addType === 'url'
                      ? '粘贴网页的文本内容...'
                      : '粘贴或输入文本内容...'
                  }
                  rows={8}
                  className="w-full px-3 py-2 text-sm bg-[var(--editor-surface)] border border-[var(--editor-border)] rounded-lg text-[var(--editor-text)] focus:outline-none focus:border-[var(--accent-500)] resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAddDialog(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--editor-border)] text-[var(--editor-text-secondary)] hover:bg-[var(--sidebar-hover)] transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleAddSource}
                  disabled={!addName.trim() || !addContent.trim()}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-500)] text-white hover:bg-[var(--accent-600)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
