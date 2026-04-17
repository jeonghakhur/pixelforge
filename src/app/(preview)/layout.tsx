/**
 * Preview 라우트 전용 root layout
 * 앱 globals.scss를 로드하지 않고 tokens.css만 사용 → 완전 격리된 컴포넌트 프리뷰 환경.
 */
import { getGeneratorConfig } from '@/lib/actions/generator-config';

export const metadata = {
  title: 'Component Preview',
}

function tokensCssUrl(configPath: string): string {
  const stripped = configPath.replace(/^public\//, '');
  return `/${stripped}`;
}

export default async function PreviewRootLayout({ children }: { children: React.ReactNode }) {
  const { tokensCssPath } = await getGeneratorConfig();
  const cssHref = tokensCssUrl(tokensCssPath);
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" href={cssHref} />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          html, body {
            margin: 0;
            padding: 0;
            min-height: 100vh;
            background: transparent;
            font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
          }
          body {
            display: flex;
            align-items: center;
            justify-content: center;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
