import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { checkForUpdate, getAppVersion } from '../utils/updateChecker';

interface UpdateState {
  hasUpdate: boolean;
  latestVersion: string;
  releaseNotes: string;
  downloadUrl: string;
  publishedAt: string;
  lastCheckTime: number;
  checking: boolean;
  checkedVersion: string;

  checkForUpdate: () => Promise<void>;
  clearUpdate: () => void;
}

export const useUpdateStore = create<UpdateState>()(
  persist(
    (set, get) => ({
      hasUpdate: false,
      latestVersion: '',
      releaseNotes: '',
      downloadUrl: '',
      publishedAt: '',
      lastCheckTime: 0,
      checking: false,
      checkedVersion: '',

      checkForUpdate: async () => {
        const { checking, checkedVersion } = get();
        const currentVersion = getAppVersion();

        const versionChanged = checkedVersion && checkedVersion !== currentVersion;

        if (checking) {
          return;
        }

        if (versionChanged) {
          const { clearUpdateCache } = await import('../utils/updateChecker');
          clearUpdateCache();
        }

        set({ checking: true });

        try {
          const info = await checkForUpdate();
          set({
            hasUpdate: !!info,
            latestVersion: info?.latestVersion || '',
            releaseNotes: info?.releaseNotes || '',
            downloadUrl: info?.downloadUrl || '',
            publishedAt: info?.publishedAt || '',
            lastCheckTime: Date.now(),
            checking: false,
            checkedVersion: currentVersion,
          });
        } catch (error) {
          console.error('Update check failed:', error);
          set({ checking: false });
        }
      },

      clearUpdate: () => {
        set({ hasUpdate: false });
      },
    }),
    {
      name: 'update-storage',
    }
  )
);

if (typeof window !== 'undefined') {
  (window as any).useUpdateStore = useUpdateStore;
}
