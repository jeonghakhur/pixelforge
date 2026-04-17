import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';
type Section = 'home' | 'tokens' | 'components' | 'icons' | 'screens' | 'diff' | 'images' | 'settings' | 'admin';

const STORAGE_KEY = 'pixelforge-theme';

const DEFAULT_TABS: Record<Section, string> = {
  home: '',
  tokens: 'color',
  components: 'list',
  icons: '',
  screens: '',
  diff: '',
  images: '',
  settings: 'general',
  admin: '',
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

/**
 * Theme cookie 저장.
 * 서버 컴포넌트(layout)에서 SSR 시점에 읽어 `<html data-theme>` 직접 세팅 → FOUC 방지.
 * 'system'은 cookie 삭제 → CSS @media (prefers-color-scheme)이 처리.
 */
function persistThemeCookie(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const maxAge = 60 * 60 * 24 * 365; // 1년
  if (theme === 'system') {
    document.cookie = `${STORAGE_KEY}=; path=/; max-age=0; SameSite=Lax`;
  } else {
    document.cookie = `${STORAGE_KEY}=${theme}; path=/; max-age=${maxAge}; SameSite=Lax`;
  }
}

// Sync notification
interface SyncAlert {
  type: 'tokens' | 'component';
  name?: string;
  rawName?: string;
  count?: number;
  version?: number;
  action?: 'create' | 'update';
}

type DriftSeverity = 'none' | 'warning' | 'critical';

interface DriftCounts {
  newInFigma: number;
  removedFromFigma: number;
  valueChanged: number;
  total: number;
}

interface UIState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  activeSection: Section;
  activeTab: string;
  tokenRevision: number;
  componentRevision: number;
  preloadUrl: string | null;
  // Sync alert
  syncAlert: SyncAlert | null;
  // Drift detection
  driftSeverity: DriftSeverity;
  driftCounts: DriftCounts;
  lastDriftCheck: string | null;
  setTheme: (theme: Theme) => void;
  initTheme: () => void;
  setSection: (section: Section) => void;
  setTab: (tab: string) => void;
  invalidateTokens: () => void;
  invalidateComponents: () => void;
  setSyncAlert: (alert: SyncAlert | null) => void;
  setPreloadUrl: (url: string | null) => void;
  setDrift: (counts: DriftCounts, checkedAt: string) => void;
  clearDrift: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  theme: 'system',
  resolvedTheme: 'dark',
  activeSection: 'home',
  activeTab: '',
  tokenRevision: 0,
  componentRevision: 0,
  preloadUrl: null,
  syncAlert: null,
  driftSeverity: 'none',
  driftCounts: { newInFigma: 0, removedFromFigma: 0, valueChanged: 0, total: 0 },
  lastDriftCheck: null,

  setTheme: (theme) => {
    const resolved = resolveTheme(theme);
    applyTheme(resolved);
    persistThemeCookie(theme);
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

    // localStorage → cookie 동기화 (SSR이 다음 요청부터 cookie를 읽어 FOUC 방지)
    persistThemeCookie(stored);

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

  invalidateTokens: () => set((s) => ({ tokenRevision: s.tokenRevision + 1 })),
  invalidateComponents: () => set((s) => ({ componentRevision: s.componentRevision + 1 })),
  setSyncAlert: (alert) => set({ syncAlert: alert }),
  setPreloadUrl: (url) => set({ preloadUrl: url }),

  setDrift: (counts, checkedAt) => {
    const severity: DriftSeverity =
      counts.total === 0 ? 'none' :
      counts.removedFromFigma > 0 || counts.valueChanged > 3 ? 'critical' : 'warning';
    set({ driftCounts: counts, driftSeverity: severity, lastDriftCheck: checkedAt });
  },
  clearDrift: () => set({
    driftSeverity: 'none',
    driftCounts: { newInFigma: 0, removedFromFigma: 0, valueChanged: 0, total: 0 },
    lastDriftCheck: null,
  }),
}));
