import type { Metadata } from 'next';
import { cookies } from 'next/headers';
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('pixelforge-theme')?.value;
  // 'light' / 'dark'만 명시적으로 세팅. 'system' 또는 미설정 시 속성 미부여 → CSS media query가 처리.
  const dataTheme = themeCookie === 'light' || themeCookie === 'dark' ? themeCookie : undefined;

  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={geistMono.variable}
      data-theme={dataTheme}
    >
      <body>
        <IconProvider>{children}</IconProvider>
      </body>
    </html>
  );
}
