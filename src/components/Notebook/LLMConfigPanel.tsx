import React, { useState } from 'react';
import { useNotebookStore } from '../../stores/notebookStore';
import { DEFAULT_MODELS, DEFAULT_BASE_URLS, LLMProvider } from '../../services/llm';
import { listModels } from '../../services/llm';
import { Eye, EyeOff, RefreshCw, Loader2 } from 'lucide-react';

interface LLMConfigPanelProps {
  onClose: () => void;
}

export const LLMConfigPanel: React.FC<LLMConfigPanelProps> = ({ onClose }) => {
  const provider = useNotebookStore((s) => s.provider);
  const apiKey = useNotebookStore((s) => s.apiKey);
  const model = useNotebookStore((s) => s.model);
  const baseUrl = useNotebookStore((s) => s.baseUrl);
  const temperature = useNotebookStore((s) => s.temperature);
  const maxTokens = useNotebookStore((s) => s.maxTokens);
  const setProvider = useNotebookStore((s) => s.setProvider);
  const setApiKey = useNotebookStore((s) => s.setApiKey);
  const setModel = useNotebookStore((s) => s.setModel);
  const setBaseUrl = useNotebookStore((s) => s.setBaseUrl);
  const setTemperature = useNotebookStore((s) => s.setTemperature);
  const setMaxTokens = useNotebookStore((s) => s.setMaxTokens);

  const [showKey, setShowKey] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setProvider(e.target.value as LLMProvider);
  };

  const handleFetchModels = async () => {
    setFetchingModels(true);
    try {
      const config = { provider, apiKey, model, baseUrl };
      const models = await listModels(config);
      if (models.length > 0) {
        setAvailableModels(models);
      }
    } catch {
      // ignore
    }
    setFetchingModels(false);
  };

  const modelOptions = availableModels.length > 0 ? availableModels : DEFAULT_MODELS[provider];

  const inputClass =
    'w-full px-2.5 py-1.5 text-xs bg-[var(--editor-surface)] border border-[var(--editor-border)] rounded-md text-[var(--editor-text)] focus:outline-none focus:border-[var(--accent-500)] transition-colors';
  const labelClass = 'block text-[11px] font-medium text-[var(--editor-text-secondary)] mb-1';

  return (
    <div className="p-3 space-y-3 max-h-[400px] overflow-y-auto">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--editor-text)]">LLM 配置</span>
      </div>

      {/* Provider */}
      <div>
        <label className={labelClass}>模型提供商</label>
        <select value={provider} onChange={handleProviderChange} className={inputClass}>
          <option value="openai">OpenAI</option>
          <option value="claude">Claude (Anthropic)</option>
          <option value="ollama">Ollama (本地)</option>
        </select>
      </div>

      {/* API Key */}
      {provider !== 'ollama' && (
        <div>
          <label className={labelClass}>API Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`输入 ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API Key`}
              className={`${inputClass} pr-8`}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-[var(--editor-text-muted)] hover:text-[var(--editor-text)]"
            >
              {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>
      )}

      {/* Base URL */}
      <div>
        <label className={labelClass}>API 地址</label>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={DEFAULT_BASE_URLS[provider]}
          className={inputClass}
        />
        <p className="text-[10px] text-[var(--editor-text-muted)] mt-0.5">
          {provider === 'ollama' ? '默认: http://localhost:11434' : '可自定义代理地址'}
        </p>
      </div>

      {/* Model */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] font-medium text-[var(--editor-text-secondary)]">
            模型
          </label>
          <button
            onClick={handleFetchModels}
            disabled={fetchingModels}
            className="flex items-center gap-1 text-[10px] text-[var(--accent-500)] hover:text-[var(--accent-600)] disabled:opacity-50"
          >
            {fetchingModels ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <RefreshCw size={10} />
            )}
            刷新列表
          </button>
        </div>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className={inputClass}
        >
          {modelOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* Temperature */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] font-medium text-[var(--editor-text-secondary)]">
            温度
          </label>
          <span className="text-[10px] text-[var(--editor-text-muted)]">{temperature}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-[var(--editor-border)] rounded-full appearance-none cursor-pointer accent-[var(--accent-500)]"
        />
        <div className="flex justify-between text-[10px] text-[var(--editor-text-muted)] mt-0.5">
          <span>精确</span>
          <span>创意</span>
        </div>
      </div>

      {/* Max tokens */}
      <div>
        <label className={labelClass}>最大输出长度</label>
        <input
          type="number"
          value={maxTokens}
          onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)}
          min={256}
          max={128000}
          step={256}
          className={inputClass}
        />
      </div>
    </div>
  );
};
