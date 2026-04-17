'use client'

import { useEffect, useMemo, useState, createElement } from 'react'
import dynamic from 'next/dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// 아이콘 라이브러리 import
//
// [Iconify] Solar 등 외부 아이콘 세트
//   - 사용 패턴: "solar:star-bold", "mdi:home" 등 "컬렉션:아이콘명" 형식
//   - IconProvider.tsx에서 addCollection(solar)로 미리 등록해두기 때문에
//     API 호출 없이 즉시 SVG 렌더링 가능
import { Icon as IconifyIcon } from '@iconify/react'

// [프로젝트 아이콘] src/components/icon/Icon.tsx 의 커스텀 SVG 컴포넌트들
//   - 사용 패턴: "icon:star", "icon:bell" 등 "icon:아이콘명" 형식
//   - IconName 타입은 Icon.tsx에 정의된 유효한 아이콘 이름 목록
//
// ⚠️  아이콘 파일 경로가 바뀌면 아래 import 경로만 수정하면 됩니다.
//     (Icon, IconName 두 가지를 같은 파일에서 export하고 있습니다)
import { Icon as ProjectIcon, type IconName } from '@/components/icon/Icon'
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  componentName: string
  importPath: string
  initialProps: Record<string, unknown>
  initialChildren: string
  initialTheme: 'light' | 'dark'
}

export default function PreviewClient({ componentName, importPath, initialProps, initialChildren, initialTheme }: Props) {
  // 생성된 컴포넌트를 동적으로 import
  // - importPath: 컴포넌트 폴더명 (예: "Button")
  // - componentName: 컴포넌트 파일명 (예: "Button")
  // - 컴포넌트가 없으면 빈 컴포넌트로 폴백 (에러 방지)
  const Component = useMemo(() => {
    return dynamic<Record<string, unknown>>(
      () => import(`@/generated/components/${importPath}/${componentName}`).catch(() => {
        const Empty = () => null
        Empty.displayName = 'Empty'
        return { default: Empty as never }
      }),
      { ssr: false },
    )
  }, [componentName, importPath])

  // 부모(PropsEditor/sandbox)에서 postMessage로 props/theme을 전달받아 re-render
  // iframe을 리로드하지 않고 실시간으로 props 반영
  const [props, setProps] = useState(initialProps)
  const [children, setChildren] = useState(initialChildren)

  // ReactNode 타입 props는 문자열로 전달받아 render 시점에 React element로 변환
  // (postMessage는 직렬화된 데이터만 전달 가능하므로 문자열로 주고받음)
  const [nodeStrings, setNodeStrings] = useState<Record<string, string>>({})

  // 초기 테마 적용 (light / dark)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', initialTheme)
  }, [initialTheme])

  // 컨텐츠 높이를 부모 iframe에 전달 (sandbox 자동 리사이즈)
  useEffect(() => {
    const send = () => {
      const h = document.body.scrollHeight
      window.parent?.postMessage({ type: 'preview-height', height: h }, '*')
    }
    // 초기 전송 + 크기 변화 감지
    const ro = new ResizeObserver(send)
    ro.observe(document.body)
    send()
    return () => ro.disconnect()
  }, [props, children, nodeStrings])

  // postMessage 수신 핸들러
  // PropsEditor(부모 창)에서 type: 'preview-props' 메시지를 보낼 때마다 실행
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type !== 'preview-props') return
      if (e.data.props)                      setProps(e.data.props as Record<string, unknown>)
      if (typeof e.data.children === 'string') setChildren(e.data.children)
      if (e.data.theme === 'light' || e.data.theme === 'dark') {
        document.documentElement.setAttribute('data-theme', e.data.theme)
      }
      if (e.data.nodeProps) {
        setNodeStrings(e.data.nodeProps as Record<string, string>)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // ───────────────────────────────────────────────────────────────────────────
  // 문자열 → React element 변환 (ReactNode 타입 props 처리)
  //
  // PropsEditor에서 입력한 텍스트를 아래 우선순위로 변환합니다:
  //
  //  1. "icon:아이콘명"  (예: "icon:star")
  //     → 프로젝트 커스텀 Icon 컴포넌트 (src/components/icon/Icon.tsx)
  //     → width/height 미지정: CSS(.iconSlot)가 크기를 제어하므로 "100%"로 채움
  //
  //  2. "컬렉션:아이콘명"  (예: "solar:star-bold", "mdi:home")
  //     → Iconify 아이콘 (외부 라이브러리)
  //     → 동일하게 width/height="100%"로 설정해 .iconSlot 크기를 따름
  //
  //     ⚠️  크기를 고정값(20px 등)으로 넣으면 data-size prop에 따라 CSS가
  //         변경한 .iconSlot 크기를 무시하게 됩니다. 따라서 "100%"를 사용합니다.
  //
  //  3. "<태그>...</태그>"  (예: "<span>텍스트</span>")
  //     → dangerouslySetInnerHTML로 HTML 렌더링
  //     → ⚠️  JSX/커스텀 컴포넌트는 HTML이 아니므로 여기서 렌더링되지 않음
  //
  //  4. 일반 텍스트  (예: "버튼 라벨")
  //     → <span>으로 감싸서 렌더링
  //
  // ─────────────────────────────────────────
  // 새로운 패턴을 추가하고 싶다면?
  //   if/else 분기를 이 블록 안에 추가하면 됩니다.
  //   예) "emoji:🎉" 패턴을 추가하려면:
  //     const [collection, name] = trimmed.split(':')
  //     if (collection === 'emoji') {
  //       nodeProps[key] = createElement('span', null, name)
  //     }
  // ───────────────────────────────────────────────────────────────────────────
  const nodeProps: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(nodeStrings)) {
    const trimmed = val.trim()
    if (!trimmed) continue

    const colonIdx = trimmed.indexOf(':')
    const isIconPattern = colonIdx > 0 && /^[\w-]+:[\w-]+$/.test(trimmed)

    if (isIconPattern) {
      const collection = trimmed.slice(0, colonIdx)   // 콜론 앞 부분
      const iconName   = trimmed.slice(colonIdx + 1)  // 콜론 뒤 부분

      if (collection === 'icon') {
        // ── 프로젝트 커스텀 아이콘 ──────────────────────────────────────────
        // "icon:star" → <ProjectIcon name="star" />
        //
        // ⚠️  유효하지 않은 이름(IconName 타입에 없는 값)을 입력하면
        //     Icon 컴포넌트가 null을 반환하므로 아무것도 렌더링되지 않습니다.
        nodeProps[key] = createElement(ProjectIcon, {
          name: iconName as IconName,
          // style로 크기 제어: .iconSlot CSS가 width/height를 지정하므로 100%로 채움
          style: { width: '100%', height: '100%', display: 'block' },
        })
      } else {
        // ── Iconify 외부 아이콘 ─────────────────────────────────────────────
        // "solar:star-bold" → <IconifyIcon icon="solar:star-bold" />
        //
        // Iconify Icon 컴포넌트에 width/height prop을 고정값으로 넘기면
        // CSS(.iconSlot)가 data-size별로 조정한 크기를 덮어쓰게 됩니다.
        // "100%"를 사용해 부모(.iconSlot) 크기를 그대로 따르게 합니다.
        nodeProps[key] = createElement(IconifyIcon, {
          icon: trimmed,
          width: '100%',
          height: '100%',
        })
      }
    } else if (trimmed.includes('<')) {
      // ── HTML 문자열 ─────────────────────────────────────────────────────
      // "<span>텍스트</span>" 같은 순수 HTML만 지원
      // JSX 문법(<MyComponent />)은 HTML 파서가 알 수 없는 태그로 처리 → 빈 DOM
      nodeProps[key] = createElement('span', { dangerouslySetInnerHTML: { __html: trimmed } })
    } else {
      // ── 일반 텍스트 ─────────────────────────────────────────────────────
      nodeProps[key] = createElement('span', null, trimmed)
    }
  }

  // children도 HTML 포함 시 dangerouslySetInnerHTML으로 렌더링
  const resolvedChildren = children.trim().includes('<')
    ? createElement('span', { dangerouslySetInnerHTML: { __html: children } })
    : children

  return <Component {...props} {...nodeProps}>{resolvedChildren}</Component>
}
