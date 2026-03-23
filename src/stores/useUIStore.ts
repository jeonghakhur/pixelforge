import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';
type Section = 'home' | 'tokens' | 'components' | 'pages' | 'diff' | 'settings';

const STORAGE_KEY = 'pixelforge-theme';

const DEFAULT_TABS: Record<Section, string> = {
  home: '',
  tokens: 'color',
  components: 'list',
  pages: '',
  diff: '',
  settings: 'general',
};

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = resolved;
}

interface UIState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  activeSection: Section;
  activeTab: string;
  setTheme: (theme: Theme) => void;
  initTheme: () => void;
  setSection: (section: Section) => void;
  setTab: (tab: string) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  theme: 'system',
  resolvedTheme: 'dark',
  activeSection: 'home',
  activeTab: '',

  setTheme: (theme) => {
    const resolved = resolveTheme(theme);
    applyTheme(resolved);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
    set({ theme, resolvedTheme: resolved });
  },

  initTheme: () => {
    let stored: Theme = 'system';
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === 'light' || raw === 'dark' || raw === 'system') {
        stored = raw;
      }
    } catch {
      // ignore
    }

    const resolved = resolveTheme(stored);
    applyTheme(resolved);
    set({ theme: stored, resolvedTheme: resolved });

    if (typeof window !== 'undefined') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => {
        const current = get().theme;
        if (current === 'system') {
          const newResolved = getSystemTheme();
          applyTheme(newResolved);
          set({ resolvedTheme: newResolved });
        }
      };
      mql.addEventListener('change', handler);
    }
  },

  setSection: (section) => {
    const currentTab = get().activeTab;
    const defaultTab = DEFAULT_TABS[section];
    set({
      activeSection: section,
      activeTab: defaultTab || currentTab,
    });
  },

  setTab: (tab) => set({ activeTab: tab }),
}));
