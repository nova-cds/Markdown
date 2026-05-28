import React from 'react';
import { useNotebookStore, GenerationType } from '../../stores/notebookStore';
import {
  FileText,
  HelpCircle,
  List,
  BookOpen,
  Clock,
  Loader2,
  Copy,
  Trash2,
  ClipboardPaste,
} from 'lucide-react';

const GENERATION_TYPES: {
  type: GenerationType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    type: 'summary',
    label: '综合摘要',
    description: '从所有来源生成结构化摘要',
    icon: <FileText size={16} />,
  },
  {
    type: 'faq',
    label: 'FAQ 问答',
    description: '提取常见问题和答案',
    icon: <HelpCircle size={16} />,
  },
  {
    type: 'outline',
    label: '结构大纲',
    description: '整理主题结构和要点',
    icon: <List size={16} />,
  },
  {
    type: 'study-guide',
    label: '学习指南',
    description: '生成核心知识点和学习建议',
    icon: <BookOpen size={16} />,
  },
  {
    type: 'timeline',
    label: '时间线',
    description: '按时间排列提取事件',
    icon: <Clock size={16} />,
  },
];

export const GeneratePanel: React.FC = () => {
  const sources = useNotebookStore((s) => s.sources);
  const generatedContent = useNotebookStore((s) => s.generatedContent);
  const isGenerating = useNotebookStore((s) => s.isGenerating);
  const generationType = useNotebookStore((s) => s.generationType);
  const generateContent = useNotebookStore((s) => s.generateContent);
  const clearGeneratedContent = useNotebookStore((s) => s.clearGeneratedContent);

  const handleGenerate = (type: GenerationType) => {
    generateContent(type);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
  };

  const renderMarkdown = (content: string) => {
    let html = content
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="chat-code-block"><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/### (.+)/g, '<h4 class="chat-heading">$1</h4>')
      .replace(/## (.+)/g, '<h3 class="chat-heading">$1</h3>')
      .replace(/# (.+)/g, '<h2 class="chat-heading">$1</h2>')
      .replace(
        /\[来源 (\d+)(?:: [^\]]+)?\]/g,
        '<span class="chat-citation">[来源 $1]</span>',
      )
      .replace(/\n/g, '<br/>');
    return html;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Generation buttons */}
      <div className="p-3 border-b border-[var(--editor-border)]">
        <p className="text-xs font-medium text-[var(--editor-text-secondary)] mb-2.5">
          内容生成工具
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {GENERATION_TYPES.map(({ type, label, description, icon }) => (
            <button
              key={type}
              onClick={() => handleGenerate(type)}
              disabled={isGenerating || sources.length === 0}
              className={`flex items-start gap-2 p-2.5 rounded-lg text-left border transition-colors ${
                generationType === type && (isGenerating || generatedContent)
                  ? 'border-[var(--accent-500)] bg-[var(--accent-500)]/5'
                  : 'border-[var(--editor-border)] hover:bg-[var(--sidebar-hover)]'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <span
                className={`mt-0.5 ${
                  generationType === type ? 'text-[var(--accent-500)]' : 'text-[var(--editor-text-muted)]'
                }`}
              >
                {icon}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--editor-text)] truncate">{label}</p>
                <p className="text-[10px] text-[var(--editor-text-muted)] mt-0.5 line-clamp-2">
                  {description}
                </p>
              </div>
            </button>
          ))}
        </div>
        {sources.length === 0 && (
          <p className="text-[11px] text-[var(--warning-500)] mt-2">
            请先在"来源"标签中添加知识文档
          </p>
        )}
      </div>

      {/* Generated content */}
      <div className="flex-1 overflow-y-auto">
        {isGenerating ? (
          <div className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <Loader2 size={14} className="text-[var(--accent-500)] animate-spin" />
              <span className="text-xs text-[var(--accent-500)] font-medium">
                正在生成
                {generationType &&
                  GENERATION_TYPES.find((t) => t.type === generationType)?.label}
                ...
              </span>
            </div>
            {generatedContent && (
              <div
                className="text-sm text-[var(--editor-text)] leading-relaxed chat-message-content"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(generatedContent) }}
              />
            )}
          </div>
        ) : generatedContent ? (
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[var(--editor-text-secondary)]">
                {generationType &&
                  GENERATION_TYPES.find((t) => t.type === generationType)?.label}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-md hover:bg-[var(--sidebar-hover)] text-[var(--editor-text-muted)] hover:text-[var(--editor-text)] transition-colors"
                  title="复制内容"
                >
                  <Copy size={13} />
                </button>
                <button
                  onClick={clearGeneratedContent}
                  className="p-1.5 rounded-md hover:bg-[var(--sidebar-hover)] text-[var(--editor-text-muted)] hover:text-[var(--error-500)] transition-colors"
                  title="清除"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <div
              className="text-sm text-[var(--editor-text)] leading-relaxed chat-message-content"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(generatedContent) }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <ClipboardPaste size={28} className="text-[var(--editor-text-muted)] mb-3" />
            <p className="text-xs text-[var(--editor-text-muted)]">
              选择生成工具，从知识来源中提取内容
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
