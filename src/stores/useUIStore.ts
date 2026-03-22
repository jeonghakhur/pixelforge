import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'pixelforge-theme';

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
  sidebarOpen: boolean;
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: Theme) => void;
  initTheme: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: false,
  theme: 'system',
  resolvedTheme: 'dark',

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setTheme: (theme) => {
    const resolved = resolveTheme(theme);
    applyTheme(resolved);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage 접근 불가 시 무시
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
      // localStorage 접근 불가 시 기본값 사용
    }

    const resolved = resolveTheme(stored);
    applyTheme(resolved);
    set({ theme: stored, resolvedTheme: resolved });

    // 시스템 테마 변경 감지
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
}));
