import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  chatStream,
  LLMConfig,
  LLMProvider,
  DEFAULT_MODELS,
  DEFAULT_BASE_URLS,
  ChatMessage,
} from '../services/llm';
import {
  DocumentChunk,
  SearchResult,
  chunkDocument,
  embedChunks,
  searchChunks,
  buildRAGPrompt,
  buildGenerationPrompt,
} from '../services/llm/rag';

export interface KnowledgeSource {
  id: string;
  name: string;
  type: 'markdown' | 'text' | 'url';
  content: string;
  addedAt: number;
  chunks?: DocumentChunk[];
}

export interface NotebookMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: {
    sourceId: string;
    sourceName: string;
    content: string;
    startLine: number;
    endLine: number;
  }[];
  timestamp: number;
}

export type GenerationType = 'summary' | 'faq' | 'outline' | 'study-guide' | 'timeline';

interface NotebookState {
  // Panel state
  isOpen: boolean;
  activeTab: 'sources' | 'chat' | 'generate';

  // LLM config
  provider: LLMProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;

  // Knowledge sources
  sources: KnowledgeSource[];

  // Chat
  messages: NotebookMessage[];
  isStreaming: boolean;
  streamingContent: string;

  // Generation
  generatedContent: string;
  isGenerating: boolean;
  generationType: GenerationType | null;

  // Actions - Panel
  setIsOpen: (open: boolean) => void;
  togglePanel: () => void;
  setActiveTab: (tab: 'sources' | 'chat' | 'generate') => void;

  // Actions - LLM config
  setProvider: (provider: LLMProvider) => void;
  setApiKey: (key: string) => void;
  setModel: (model: string) => void;
  setBaseUrl: (url: string) => void;
  setTemperature: (temp: number) => void;
  setMaxTokens: (tokens: number) => void;
  getLLMConfig: () => LLMConfig;

  // Actions - Sources
  addSource: (name: string, content: string, type: 'markdown' | 'text' | 'url') => void;
  removeSource: (id: string) => void;
  addCurrentDocument: (path: string, content: string) => void;
  indexSources: () => Promise<void>;

  // Actions - Chat
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  stopStreaming: () => void;

  // Actions - Generation
  generateContent: (type: GenerationType) => Promise<void>;
  clearGeneratedContent: () => void;
  insertGeneratedContent: () => string;
}

let abortController: AbortController | null = null;

export const useNotebookStore = create<NotebookState>()(
  persist(
    (set, get) => ({
      // Panel state
      isOpen: false,
      activeTab: 'sources',

      // LLM config
      provider: 'openai',
      apiKey: '',
      model: DEFAULT_MODELS.openai[0],
      baseUrl: DEFAULT_BASE_URLS.openai,
      temperature: 0.7,
      maxTokens: 4096,

      // Knowledge sources
      sources: [],

      // Chat
      messages: [],
      isStreaming: false,
      streamingContent: '',

      // Generation
      generatedContent: '',
      isGenerating: false,
      generationType: null,

      // Panel actions
      setIsOpen: (open) => set({ isOpen: open }),
      togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),
      setActiveTab: (tab) => set({ activeTab: tab }),

      // LLM config actions
      setProvider: (provider) =>
        set({
          provider,
          model: DEFAULT_MODELS[provider][0],
          baseUrl: DEFAULT_BASE_URLS[provider],
        }),
      setApiKey: (apiKey) => set({ apiKey }),
      setModel: (model) => set({ model }),
      setBaseUrl: (baseUrl) => set({ baseUrl }),
      setTemperature: (temperature) => set({ temperature }),
      setMaxTokens: (maxTokens) => set({ maxTokens }),
      getLLMConfig: () => {
        const { provider, apiKey, model, baseUrl, temperature, maxTokens } = get();
        return { provider, apiKey, model, baseUrl, temperature, maxTokens };
      },

      // Source actions
      addSource: (name, content, type) => {
        const id = `source-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const chunks = chunkDocument(content, id, name);
        set((state) => ({
          sources: [
            ...state.sources,
            { id, name, type, content, addedAt: Date.now(), chunks },
          ],
        }));
      },

      removeSource: (id) => {
        set((state) => ({
          sources: state.sources.filter((s) => s.id !== id),
        }));
      },

      addCurrentDocument: (path, content) => {
        const name = path.split('/').pop()?.split('\\').pop() || path;
        const { sources, addSource } = get();
        const existingIndex = sources.findIndex(
          (s) => s.name === name || s.id.includes(path),
        );
        if (existingIndex >= 0) {
          // Update existing source
          const updated = [...sources];
          const id = updated[existingIndex].id;
          const chunks = chunkDocument(content, id, name);
          updated[existingIndex] = {
            ...updated[existingIndex],
            content,
            chunks,
            addedAt: Date.now(),
          };
          set({ sources: updated });
        } else {
          addSource(name, content, 'markdown');
        }
      },

      indexSources: async () => {
        const { sources, getLLMConfig } = get();
        const config = getLLMConfig();
        const updatedSources = [...sources];

        for (let i = 0; i < updatedSources.length; i++) {
          const source = updatedSources[i];
          if (source.chunks) {
            const hasEmbeddings = source.chunks.some((c) => c.embedding);
            if (!hasEmbeddings) {
              const embeddedChunks = await embedChunks(source.chunks, config);
              updatedSources[i] = { ...source, chunks: embeddedChunks };
            }
          }
        }

        set({ sources: updatedSources });
      },

      // Chat actions
      sendMessage: async (content) => {
        const {
          sources,
          messages,
          getLLMConfig,
          isStreaming,
        } = get();

        if (isStreaming) return;
        if (!content.trim()) return;

        const config = getLLMConfig();
        if (!config.apiKey && config.provider !== 'ollama') {
          const errorMsg: NotebookMessage = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: `请先在设置中配置 ${config.provider.toUpperCase()} 的 API Key。`,
            timestamp: Date.now(),
          };
          set((state) => ({
            messages: [
              ...state.messages,
              { id: `msg-${Date.now() - 1}`, role: 'user', content, timestamp: Date.now() },
              errorMsg,
            ],
          }));
          return;
        }

        // Add user message
        const userMessage: NotebookMessage = {
          id: `msg-${Date.now()}`,
          role: 'user',
          content,
          timestamp: Date.now(),
        };

        set((state) => ({
          messages: [...state.messages, userMessage],
          isStreaming: true,
          streamingContent: '',
        }));

        try {
          // Search for relevant chunks
          const allChunks = sources.flatMap((s) => s.chunks || []);
          let searchResults: SearchResult[] = [];

          if (allChunks.length > 0) {
            searchResults = await searchChunks(content, allChunks, config, 5);
          }

          const systemPrompt = buildRAGPrompt(content, searchResults);
          const chatMessages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
          ];

          // Add recent conversation context (last 10 messages)
          const recentMessages = [...messages, userMessage].slice(-10);
          for (const msg of recentMessages) {
            chatMessages.push({ role: msg.role, content: msg.content });
          }

          abortController = new AbortController();

          await chatStream(chatMessages, config, {
            onToken: (token) => {
              set((state) => ({
                streamingContent: state.streamingContent + token,
              }));
            },
            onComplete: (fullText) => {
              const citations = searchResults.map((r) => ({
                sourceId: r.chunk.sourceId,
                sourceName: r.chunk.sourceName,
                content: r.chunk.content.slice(0, 200),
                startLine: r.chunk.startLine,
                endLine: r.chunk.endLine,
              }));

              const assistantMessage: NotebookMessage = {
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: fullText,
                citations: citations.length > 0 ? citations : undefined,
                timestamp: Date.now(),
              };

              set((state) => ({
                messages: [...state.messages, assistantMessage],
                isStreaming: false,
                streamingContent: '',
              }));
            },
            onError: (error) => {
              const errorMessage: NotebookMessage = {
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: `错误: ${error.message}`,
                timestamp: Date.now(),
              };

              set((state) => ({
                messages: [...state.messages, errorMessage],
                isStreaming: false,
                streamingContent: '',
              }));
            },
          });
        } catch (error) {
          const errorMessage: NotebookMessage = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: `错误: ${error instanceof Error ? error.message : '未知错误'}`,
            timestamp: Date.now(),
          };

          set((state) => ({
            messages: [...state.messages, errorMessage],
            isStreaming: false,
            streamingContent: '',
          }));
        }
      },

      clearMessages: () => set({ messages: [], streamingContent: '' }),

      stopStreaming: () => {
        abortController?.abort();
        abortController = null;
        const { streamingContent } = get();
        if (streamingContent) {
          const msg: NotebookMessage = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: streamingContent + '\n\n*[已停止生成]*',
            timestamp: Date.now(),
          };
          set((state) => ({
            messages: [...state.messages, msg],
            isStreaming: false,
            streamingContent: '',
          }));
        } else {
          set({ isStreaming: false, streamingContent: '' });
        }
      },

      // Generation actions
      generateContent: async (type) => {
        const { sources, getLLMConfig, isGenerating } = get();

        if (isGenerating) return;

        const config = getLLMConfig();
        if (!config.apiKey && config.provider !== 'ollama') {
          set({
            generatedContent: `请先在设置中配置 ${config.provider.toUpperCase()} 的 API Key。`,
            generationType: type,
          });
          return;
        }

        if (sources.length === 0) {
          set({
            generatedContent: '请先添加知识来源文档。',
            generationType: type,
          });
          return;
        }

        set({ isGenerating: true, generatedContent: '', generationType: type });

        try {
          const allChunks = sources.flatMap((s) => s.chunks || []);
          // Get more chunks for generation (up to 15)
          const searchResults: SearchResult[] = allChunks
            .slice(0, 15)
            .map((chunk) => ({ chunk, score: 1 }));

          const systemPrompt = buildGenerationPrompt(type, searchResults);
          const chatMessages: ChatMessage[] = [
            { role: 'system', content: '你是一个专业的知识整理助手。' },
            { role: 'user', content: systemPrompt },
          ];

          await chatStream(chatMessages, config, {
            onToken: (token) => {
              set((state) => ({
                generatedContent: state.generatedContent + token,
              }));
            },
            onComplete: (fullText) => {
              set({ generatedContent: fullText, isGenerating: false });
            },
            onError: (error) => {
              set({
                generatedContent: `生成失败: ${error.message}`,
                isGenerating: false,
              });
            },
          });
        } catch (error) {
          set({
            generatedContent: `生成失败: ${error instanceof Error ? error.message : '未知错误'}`,
            isGenerating: false,
          });
        }
      },

      clearGeneratedContent: () => set({ generatedContent: '', generationType: null }),

      insertGeneratedContent: () => {
        const { generatedContent } = get();
        return generatedContent;
      },
    }),
    {
      name: 'md-editor-notebook',
      partialize: (state) => ({
        provider: state.provider,
        apiKey: state.apiKey,
        model: state.model,
        baseUrl: state.baseUrl,
        temperature: state.temperature,
        maxTokens: state.maxTokens,
        sources: state.sources.map((s) => ({
          ...s,
          chunks: s.chunks?.map((c) => ({ ...c, embedding: undefined })),
        })),
      }),
    },
  ),
);
