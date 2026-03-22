import type { Metadata } from 'next';
import '@/styles/globals.scss';
import AppShell from './AppShell';

export const metadata: Metadata = {
  title: 'PixelForge',
  description: 'Figma 디자인 → Bootstrap 기반 코드 자동 생성',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
