import React, { useState, useRef, useEffect } from 'react';
import { useNotebookStore } from '../../stores/notebookStore';
import { Send, Square, Trash2, BookOpen } from 'lucide-react';

export const ChatPanel: React.FC = () => {
  const messages = useNotebookStore((s) => s.messages);
  const isStreaming = useNotebookStore((s) => s.isStreaming);
  const streamingContent = useNotebookStore((s) => s.streamingContent);
  const sendMessage = useNotebookStore((s) => s.sendMessage);
  const clearMessages = useNotebookStore((s) => s.clearMessages);
  const stopStreaming = useNotebookStore((s) => s.stopStreaming);
  const sources = useNotebookStore((s) => s.sources);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const content = input.trim();
    setInput('');
    await sendMessage(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderMarkdown = (content: string) => {
    // Simple markdown rendering for chat messages
    let html = content
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="chat-code-block"><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/### (.+)/g, '<h4 class="chat-heading">$1</h4>')
      .replace(/## (.+)/g, '<h3 class="chat-heading">$1</h3>')
      .replace(/# (.+)/g, '<h2 class="chat-heading">$1</h2>')
      .replace(/\[来源 (\d+)(?:: [^\]]+)?\]/g, '<span class="chat-citation">[来源 $1]</span>')
      .replace(/\n/g, '<br/>');
    return html;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--editor-border)]">
        <div className="flex items-center gap-1.5 text-xs text-[var(--editor-text-muted)]">
          <BookOpen size={12} />
          <span>{sources.length} 个来源</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="p-1 rounded hover:bg-[var(--sidebar-hover)] text-[var(--editor-text-muted)] hover:text-[var(--error-500)] transition-colors"
            title="清除对话"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-500)]/10 flex items-center justify-center mb-3">
              <BookOpen size={20} className="text-[var(--accent-500)]" />
            </div>
            <p className="text-sm text-[var(--editor-text-secondary)] mb-1">
              AI 知识助手
            </p>
            <p className="text-xs text-[var(--editor-text-muted)] max-w-[200px]">
              基于你的知识来源文档回答问题，支持引用溯源
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[var(--accent-500)] text-white rounded-br-sm'
                  : 'bg-[var(--editor-surface)] text-[var(--editor-text)] border border-[var(--editor-border)] rounded-bl-sm'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div
                  className="chat-message-content"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                />
              ) : (
                <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
              )}

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-[var(--editor-border)]/50">
                  <p className="text-[10px] font-medium text-[var(--editor-text-muted)] mb-1.5 uppercase tracking-wider">
                    引用来源
                  </p>
                  <div className="space-y-1">
                    {msg.citations.map((cite, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-1.5 text-[11px] text-[var(--editor-text-muted)] bg-[var(--editor-bg)] rounded-md p-1.5"
                      >
                        <span className="text-[var(--accent-500)] font-medium shrink-0">
                          [{i + 1}]
                        </span>
                        <span className="truncate">{cite.sourceName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Streaming message */}
        {isStreaming && streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-xl rounded-bl-sm px-3.5 py-2.5 text-sm leading-relaxed bg-[var(--editor-surface)] text-[var(--editor-text)] border border-[var(--editor-border)]">
              <div
                className="chat-message-content"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingContent) }}
              />
              <span className="inline-block w-1.5 h-4 bg-[var(--accent-500)] animate-pulse ml-0.5 align-middle" />
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isStreaming && !streamingContent && (
          <div className="flex justify-start">
            <div className="rounded-xl rounded-bl-sm px-3.5 py-2.5 bg-[var(--editor-surface)] border border-[var(--editor-border)]">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-[var(--accent-500)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-[var(--accent-500)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-[var(--accent-500)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-3 border-t border-[var(--editor-border)]">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={sources.length > 0 ? '基于知识库提问...' : '请先添加知识来源...'}
            rows={1}
            className="flex-1 px-3 py-2 text-sm bg-[var(--editor-surface)] border border-[var(--editor-border)] rounded-lg text-[var(--editor-text)] focus:outline-none focus:border-[var(--accent-500)] resize-none max-h-24 overflow-y-auto"
            style={{ minHeight: '36px' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 96) + 'px';
            }}
          />
          {isStreaming ? (
            <button
              onClick={stopStreaming}
              className="shrink-0 p-2 rounded-lg bg-[var(--error-500)] text-white hover:bg-[var(--error-600)] transition-colors"
              title="停止生成"
            >
              <Square size={16} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="shrink-0 p-2 rounded-lg bg-[var(--accent-500)] text-white hover:bg-[var(--accent-600)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="发送 (Enter)"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
