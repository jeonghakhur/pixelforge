'use client';

import { useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import ActivityBar, { type Section } from '@/components/layout/ActivityBar';
import TabBar from '@/components/layout/TabBar';
import StatusBar from '@/components/layout/StatusBar';
import { useUIStore } from '@/stores/useUIStore';

function sectionFromPath(pathname: string): Section {
  if (pathname.startsWith('/tokens')) return 'tokens';
  if (pathname.startsWith('/components')) return 'components';
  if (pathname.startsWith('/settings')) return 'settings';
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
  return '';
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const initTheme = useUIStore((s) => s.initTheme);
  const activeSection = useUIStore((s) => s.activeSection);
  const activeTab = useUIStore((s) => s.activeTab);
  const setSection = useUIStore((s) => s.setSection);
  const setTab = useUIStore((s) => s.setTab);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

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
      case 'settings':
        router.push('/settings');
        break;
    }
  }, [router, setSection]);

  const handleTabChange = useCallback((tabId: string) => {
    setTab(tabId);
    if (activeSection === 'tokens') {
      router.push(`/tokens/${tabId}`);
    } else if (activeSection === 'components') {
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
        />
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
