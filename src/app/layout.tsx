import type { Metadata } from 'next';
import { Geist_Mono } from 'next/font/google';
import '@/styles/globals.scss';
import IconProvider from '@/components/providers/IconProvider';

export const metadata: Metadata = {
  title: 'PixelForge',
  description: 'Figma 디자인 → Bootstrap 기반 코드 자동 생성',
};

const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

const themeInitScript = `
(function(){
  try {
    var t = localStorage.getItem('pixelforge-theme') || 'system';
    var r = t === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : t;
    document.documentElement.dataset.theme = r;
  } catch(e) {
    document.documentElement.dataset.theme = 'dark';
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning className={geistMono.variable}>
      <body>
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <IconProvider>{children}</IconProvider>
      </body>
    </html>
  );
}
