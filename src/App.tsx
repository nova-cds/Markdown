import React, { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { useTheme } from './hooks';
import { waitForTauri, isTauriCached } from './utils/platform';
import { useEditorStore, useUpdateStore } from './stores';

function App() {
  const [isReady, setIsReady] = useState(false);
  const checkForUpdate = useUpdateStore((state) => state.checkForUpdate);
  const openDocument = useEditorStore((state) => state.openDocument);

  useTheme();
  
  useEffect(() => {
    const init = async () => {
      await waitForTauri();
      (window as any).__TAURI_READY__ = true;
      setIsReady(true);
    };
    
    init();
  }, []);
  
  useEffect(() => {
    const handleGlobalDrop = async (e: DragEvent) => {
      const target = e.target as HTMLElement;
      
      if (target.closest('.pane-leaf')) {
        return;
      }
      
      e.preventDefault();
      e.stopPropagation();
      
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      
      const { openDocument } = useEditorStore.getState();
      
      for (const file of Array.from(files)) {
        if (file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.name.endsWith('.txt')) {
          const content = await file.text();
          const filePath = (file as any).path || file.name;
          openDocument(`file://${filePath}`, content, false);
        }
      }
    };
    
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    
    document.addEventListener('drop', handleGlobalDrop);
    document.addEventListener('dragover', handleDragOver);

    return () => {
      document.removeEventListener('drop', handleGlobalDrop);
      document.removeEventListener('dragover', handleDragOver);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdate();
    }, 5000);

    const interval = setInterval(() => {
      checkForUpdate();
    }, 4 * 60 * 60 * 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [checkForUpdate]);

  useEffect(() => {
    if (!isReady || !isTauriCached()) return;
    
    let unlisten: (() => void) | null = null;
    
    const setupFileOpenListener = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const { readTextFile } = await import('@tauri-apps/plugin-fs');
        
        unlisten = await listen<string>('file-open', async (event) => {
          const filePath = event.payload;
          try {
            const content = await readTextFile(filePath);
            const fileName = filePath.split(/[/\\]/).pop() || 'untitled.md';
            const { openDocument } = useEditorStore.getState();
            openDocument(`file://${filePath}`, content, false);
          } catch (err) {
            console.error('打开文件失败:', err);
          }
        });
      } catch (err) {
        console.error('设置文件打开监听失败:', err);
      }
    };
    
    setupFileOpenListener();
    
    return () => {
      if (unlisten) unlisten();
    };
  }, [isReady]);

  if (!isReady) {
    return (
      <div style={{ 
        padding: 20, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        height: '100vh',
        fontSize: 14,
        color: '#666'
      }}>
        正在初始化...
      </div>
    );
  }
  
  return <Layout />;
}

export default App;
