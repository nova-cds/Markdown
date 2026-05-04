import React, { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { useTheme } from './hooks';
import { waitForTauri } from './utils/platform';

function App() {
  const [isReady, setIsReady] = useState(false);
  const [tauriDetected, setTauriDetected] = useState<boolean | null>(null);
  
  useTheme();
  
  useEffect(() => {
    const init = async () => {
      console.log('[App] 开始初始化...');
      
      const detected = await waitForTauri();
      setTauriDetected(detected);
      
      console.log('[App] Tauri 环境检测完成:', detected);
      console.log('[App] window.__TAURI__:', typeof window !== 'undefined' && '__TAURI__' in window);
      console.log('[App] window.__TAURI_INTERNALS__:', typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
      
      // 显示检测结果（调试用）
      alert(`[调试信息] Tauri 环境检测: ${detected}\n\n__TAURI__: ${typeof window !== 'undefined' && '__TAURI__' in window}\n__TAURI_INTERNALS__: ${typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window}\n\n如果检测为 false，请将此截图发给我。`);
      
      (window as any).__TAURI_READY__ = true;
      
      setIsReady(true);
      console.log('[App] 初始化完成');
    };
    
    init();
  }, []);
  
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