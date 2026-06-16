import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, FileText, X, Clock } from 'lucide-react';
import { useEditorStore, useRecentFilesStore } from '../../stores';
import { useFileStore } from '../../stores/fileStore';

interface QuickOpenProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  path: string;
  name: string;
  type: 'tab' | 'recent' | 'file';
  matchScore: number;
}

export const QuickOpen: React.FC<QuickOpenProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  
  const tabs = useEditorStore((state) => state.tabs);
  const openDocument = useEditorStore((state) => state.openDocument);
  const recentFiles = useRecentFilesStore((state) => state.recentFiles);
  const fileTree = useFileStore((state) => state.fileTree);
  
  // 收集所有可打开的文件
  const allFiles = useMemo(() => {
    const results: SearchResult[] = [];
    const addedPaths = new Set<string>();
    
    // 1. 当前打开的标签页（最高优先级）
    tabs.forEach(path => {
      const name = path.split(/[\\/]/).pop() || path;
      results.push({
        path,
        name,
        type: 'tab',
        matchScore: 100,
      });
      addedPaths.add(path);
    });
    
    // 2. 最近打开的文件
    recentFiles.forEach(file => {
      if (!addedPaths.has(file.path)) {
        const name = file.path.split(/[\\/]/).pop() || file.name;
        results.push({
          path: file.path,
          name,
          type: 'recent',
          matchScore: 50,
        });
        addedPaths.add(file.path);
      }
    });
    
    // 3. 文件树中的文件
    const collectFiles = (nodes: any[]) => {
      nodes.forEach(node => {
        if (node.isDir && node.children) {
          collectFiles(node.children);
        } else if (!node.isDir && !addedPaths.has(node.path)) {
          results.push({
            path: node.path,
            name: node.name,
            type: 'file',
            matchScore: 0,
          });
          addedPaths.add(node.path);
        }
      });
    };
    collectFiles(fileTree);
    
    return results;
  }, [tabs, recentFiles, fileTree]);
  
  // 根据搜索词过滤和排序
  const filteredResults = useMemo(() => {
    if (!query.trim()) {
      return allFiles.slice(0, 50);
    }
    
    const lowerQuery = query.toLowerCase();
    const scored = allFiles.map(file => {
      const lowerName = file.name.toLowerCase();
      const lowerPath = file.path.toLowerCase();
      let score = file.matchScore;
      
      // 精确匹配文件名
      if (lowerName === lowerQuery) {
        score += 1000;
      } else if (lowerName.startsWith(lowerQuery)) {
        score += 500;
      } else if (lowerName.includes(lowerQuery)) {
        score += 300;
      } else if (lowerPath.includes(lowerQuery)) {
        score += 100;
      }
      
      return { ...file, matchScore: score };
    }).filter(file => file.matchScore > 0);
    
    return scored.sort((a, b) => b.matchScore - a.matchScore).slice(0, 50);
  }, [allFiles, query]);
  
  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);
  
  // 自动聚焦输入框
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);
  
  // 键盘导航
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredResults[selectedIndex]) {
          handleSelect(filteredResults[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [isOpen, filteredResults, selectedIndex, onClose]);
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  // 滚动选中项到可视区域
  useEffect(() => {
    const selectedEl = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);
  
  const handleSelect = async (result: SearchResult) => {
    // 如果是标签页，直接激活
    if (result.type === 'tab') {
      const { setActiveDocument } = useEditorStore.getState();
      setActiveDocument(result.path);
    } else {
      // 否则尝试打开文件
      try {
        let content = '';
        
        // 尝试读取文件内容
        if (result.path.startsWith('file://')) {
          const { readTextFile } = await import('@tauri-apps/plugin-fs');
          const filePath = result.path.replace('file://', '');
          content = await readTextFile(filePath);
        } else {
          // 浏览器环境，尝试通过 File System Access API
          const { fileHandles } = useFileStore.getState();
          const handle = fileHandles.get(result.path);
          if (handle) {
            const file = await handle.getFile();
            content = await file.text();
          }
        }
        
        openDocument(result.path, content, false);
      } catch (err) {
        console.error('打开文件失败:', err);
        // 即使读取失败也尝试打开，可能内容会在其他地方加载
        openDocument(result.path, '', false);
      }
    }
    
    onClose();
  };
  
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'tab':
        return <FileText size={16} className="text-[var(--accent-500)]" />;
      case 'recent':
        return <Clock size={16} className="text-[var(--editor-text-muted)]" />;
      default:
        return <FileText size={16} className="text-[var(--editor-text-secondary)]" />;
    }
  };
  
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'tab':
        return '已打开';
      case 'recent':
        return '最近';
      default:
        return '文件';
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      {/* 搜索面板 */}
      <div className="relative w-[600px] max-w-[90vw] bg-[var(--editor-bg)] rounded-xl shadow-2xl border border-[var(--editor-border)] overflow-hidden animate-scale-in">
        {/* 搜索输入框 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--editor-border)]">
          <Search size={20} className="text-[var(--editor-text-muted)] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索文件... (支持文件名和路径)"
            className="flex-1 bg-transparent text-[var(--editor-text)] placeholder-[var(--editor-text-muted)] outline-none text-sm"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded hover:bg-[var(--sidebar-hover)] text-[var(--editor-text-muted)] transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--editor-code-bg)] text-[var(--editor-text-muted)] rounded border border-[var(--editor-border)] flex-shrink-0">
            ESC
          </kbd>
        </div>
        
        {/* 结果列表 */}
        <div 
          ref={listRef}
          className="max-h-[400px] overflow-y-auto"
        >
          {filteredResults.length === 0 ? (
            <div className="px-4 py-8 text-center text-[var(--editor-text-muted)] text-sm">
              {query ? '未找到匹配的文件' : '开始输入以搜索文件'}
            </div>
          ) : (
            <div className="py-2">
              {filteredResults.map((result, index) => (
                <button
                  key={result.path}
                  data-index={index}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-2.5 text-left
                    transition-colors duration-[var(--transition-fast)]
                    ${index === selectedIndex 
                      ? 'bg-[var(--accent-500)]/10 text-[var(--editor-text)]' 
                      : 'text-[var(--editor-text-secondary)] hover:bg-[var(--sidebar-hover)]'
                    }
                  `}
                >
                  {getTypeIcon(result.type)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {highlightMatch(result.name, query)}
                    </div>
                    <div className="text-xs text-[var(--editor-text-muted)] truncate mt-0.5">
                      {result.path}
                    </div>
                  </div>
                  <span className={`
                    text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0
                    ${result.type === 'tab' 
                      ? 'bg-[var(--accent-500)]/10 text-[var(--accent-500)]' 
                      : 'bg-[var(--editor-code-bg)] text-[var(--editor-text-muted)]'
                    }
                  `}>
                    {getTypeLabel(result.type)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* 底部提示 */}
        <div className="px-4 py-2 border-t border-[var(--editor-border)] bg-[var(--editor-surface)] text-[10px] text-[var(--editor-text-muted)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>↑↓ 选择</span>
            <span>↵ 打开</span>
          </div>
          <span>{filteredResults.length} 个结果</span>
        </div>
      </div>
    </div>
  );
};

// 高亮匹配文本
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let index = lowerText.indexOf(lowerQuery);
  
  while (index !== -1) {
    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }
    parts.push(
      <span key={index} className="text-[var(--accent-500)] font-semibold bg-[var(--accent-500)]/10 rounded px-0.5">
        {text.slice(index, index + query.length)}
      </span>
    );
    lastIndex = index + query.length;
    index = lowerText.indexOf(lowerQuery, lastIndex);
  }
  
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts;
}

export default QuickOpen;
