'use client';

import { useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import ActivityBar, { type Section } from '@/components/layout/ActivityBar';
import Sidebar from '@/components/layout/Sidebar';
import TabBar from '@/components/layout/TabBar';
import StatusBar from '@/components/layout/StatusBar';
import { useUIStore } from '@/stores/useUIStore';
import { getSyncStatus } from '@/lib/actions/sync-status';

function sectionFromPath(pathname: string): Section {
  if (pathname.startsWith('/tokens')) return 'tokens';
  if (pathname.startsWith('/components')) return 'components';
  if (pathname.startsWith('/screens')) return 'screens';
  if (pathname.startsWith('/diff')) return 'diff';
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname.startsWith('/admin')) return 'admin';
  return 'home';
}

function tabFromPath(pathname: string, section: Section): string {
  if (section === 'tokens') {
    const match = pathname.match(/^\/tokens\/(\w+)/);
    return match ? match[1] : 'color';
  }
  if (section === 'components') {
    if (pathname === '/components/new') return 'new';
    return 'list';
  }
  if (section === 'settings') {
    const match = pathname.match(/^\/settings\/?(\w*)/);
    return match && match[1] ? match[1] : 'general';
  }
  return '';
}

export default function AppShell({ children, userRole }: { children: React.ReactNode; userRole: 'admin' | 'member' }) {
  const router = useRouter();
  const pathname = usePathname();
  const initTheme = useUIStore((s) => s.initTheme);
  const activeSection = useUIStore((s) => s.activeSection);
  const activeTab = useUIStore((s) => s.activeTab);
  const setSection = useUIStore((s) => s.setSection);
  const setTab = useUIStore((s) => s.setTab);
  const tokenRevision = useUIStore((s) => s.tokenRevision);
  const invalidateTokens = useUIStore((s) => s.invalidateTokens);
  const lastSyncVersionRef = useRef(0);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  // 플러그인 sync 감지: 5초마다 polling → 버전 바뀌면 자동 갱신
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const status = await getSyncStatus();
        const latest = status.flatMap((p) => p.syncs.filter((s) => s.type === 'tokens'))
          .reduce((max, s) => Math.max(max, s.version), 0);
        if (mounted && latest > 0) {
          if (lastSyncVersionRef.current > 0 && latest > lastSyncVersionRef.current) {
            invalidateTokens();
          }
          lastSyncVersionRef.current = latest;
        }
      } catch {}
    };
    poll();
    const timer = setInterval(poll, 5000);
    return () => { mounted = false; clearInterval(timer); };
  }, [invalidateTokens]);

  // tokenRevision 변경 시 토큰 페이지 서버 컴포넌트 갱신
  useEffect(() => {
    if (tokenRevision > 0 && pathname.startsWith('/tokens/')) {
      router.refresh();
    }
  }, [tokenRevision, pathname, router]);

  // Sync store from URL on pathname change
  useEffect(() => {
    const section = sectionFromPath(pathname);
    const tab = tabFromPath(pathname, section);
    setSection(section);
    if (tab) setTab(tab);
  }, [pathname, setSection, setTab]);

  const handleSectionChange = useCallback((section: Section) => {
    setSection(section);
    switch (section) {
      case 'home':
        router.push('/');
        break;
      case 'tokens':
        router.push('/tokens/color');
        break;
      case 'components':
        router.push('/components/new');
        break;
      case 'screens':
        router.push('/screens');
        break;
      case 'diff':
        router.push('/diff');
        break;
      case 'settings':
        router.push('/settings');
        break;
      case 'admin':
        router.push('/admin');
        break;
    }
  }, [router, setSection]);

  const handleTabChange = useCallback((tabId: string) => {
    setTab(tabId);
    if (activeSection === 'components') {
      if (tabId === 'new') {
        router.push('/components/new');
      } else {
        router.push('/components/new');
      }
    }
  }, [router, activeSection, setTab]);

  return (
    <div className="ide-layout">
      <div className="ide-body">
        <ActivityBar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          userRole={userRole}
        />
        <Sidebar activeSection={activeSection} />
        <div className="ide-content">
          <TabBar
            section={activeSection}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
          <main className="ide-main">
            {children}
          </main>
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
