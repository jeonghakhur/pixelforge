// @page Component Guide — 컴포넌트 상세
import { notFound } from 'next/navigation';
import { getComponentByName } from '@/lib/actions/components';
import ComponentGuideClient from './ComponentGuideClient';

interface ComponentPageProps {
  params: Promise<{ name: string }>;
}

// DB에 없을 경우 보여줄 정적 메타데이터
const STATIC_META: Record<string, { displayName: string; description: string; category: string }> = {
  button:        { displayName: 'Button',       description: '클릭 가능한 버튼 컴포넌트. variant, size, loading, icon을 지원합니다.',          category: 'action'     },
  badge:         { displayName: 'Badge',        description: '상태를 표시하는 인라인 배지. 7가지 variant를 지원합니다.',                       category: 'action'     },
  card:          { displayName: 'Card',         description: 'Double-Bezel 아키텍처 카드 컨테이너.',                                          category: 'action'     },
  chip:          { displayName: 'Chip',         description: '태그/필터 칩. active, removable을 지원합니다.',                                  category: 'action'     },
  spinner:       { displayName: 'Spinner',      description: '로딩 스피너. sm, md, lg 크기를 지원합니다.',                                    category: 'feedback'   },
  modal:         { displayName: 'Modal',        description: 'Portal 기반 모달. 포커스 관리, ESC 닫기, body 스크롤 차단을 내장합니다.',         category: 'feedback'   },
  toast:         { displayName: 'Toast',        description: '자동 닫기 알림 (기본 3초). 4가지 variant를 지원합니다.',                        category: 'feedback'   },
  'form-group':  { displayName: 'FormGroup',    description: 'label + input + error 래퍼. aria-invalid, aria-describedby를 자동 처리합니다.', category: 'form'       },
  'form-select': { displayName: 'FormSelect',   description: '커스텀 스타일 셀렉트 박스.',                                                    category: 'form'       },
  'form-check':  { displayName: 'FormCheck',    description: '체크박스/라디오 입력 컴포넌트.',                                                category: 'form'       },
  'form-textarea': { displayName: 'FormTextarea', description: '텍스트 영역 입력 컴포넌트.',                                                  category: 'form'       },
  nav:           { displayName: 'Nav',          description: '탭 방식 네비게이션 컴포넌트.',                                                  category: 'navigation' },
  pagination:    { displayName: 'Pagination',   description: '페이지 탐색 컴포넌트.',                                                         category: 'navigation' },
  dropdown:      { displayName: 'Dropdown',     description: '클릭 기반 드롭다운 메뉴. 외부 클릭 시 자동으로 닫힙니다.',                      category: 'navigation' },
};

export default async function ComponentPage({ params }: ComponentPageProps) {
  const { name } = await params;

  if (!STATIC_META[name]) notFound();

  const meta = STATIC_META[name];
  const dbRow = await getComponentByName(name);

  return (
    <ComponentGuideClient
      name={name}
      displayName={meta.displayName}
      description={meta.description}
      category={meta.category}
      tsx={dbRow?.tsx ?? null}
      scss={dbRow?.scss ?? null}
      isGenerated={!!dbRow}
    />
  );
}
