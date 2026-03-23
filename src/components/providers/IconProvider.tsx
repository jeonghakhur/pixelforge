'use client';

import { addCollection } from '@iconify/react';
import solar from '@iconify-json/solar/icons.json';

// Solar 아이콘 셋을 클라이언트 모듈 로드 시점에 동기 등록
// → Icon 컴포넌트가 API 요청 없이 즉시 SVG를 렌더링
addCollection(solar as Parameters<typeof addCollection>[0]);

export default function IconProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
