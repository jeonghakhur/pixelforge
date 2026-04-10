'use client'

import { useEffect, useMemo, useState, createElement } from 'react'
import dynamic from 'next/dynamic'
import { Icon } from '@iconify/react'

interface Props {
  componentName: string
  importPath: string
  initialProps: Record<string, unknown>
  initialChildren: string
  initialTheme: 'light' | 'dark'
}

export default function PreviewClient({ componentName, importPath, initialProps, initialChildren, initialTheme }: Props) {
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

  // 부모(sandbox)에서 postMessage로 props/theme 전달 받음 → iframe 리로드 없이 re-render
  const [props, setProps] = useState(initialProps)
  const [children, setChildren] = useState(initialChildren)
  // node props: string → React element 변환 (iconify 패턴이면 <Icon />, 아니면 <span>)
  const [nodeResolvedProps, setNodeResolvedProps] = useState<Record<string, unknown>>({})

  // 초기 테마 적용
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', initialTheme)
  }, [initialTheme])

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type !== 'preview-props') return
      if (e.data.props) setProps(e.data.props as Record<string, unknown>)
      if (typeof e.data.children === 'string') setChildren(e.data.children)
      if (e.data.theme === 'light' || e.data.theme === 'dark') {
        document.documentElement.setAttribute('data-theme', e.data.theme)
      }
      if (e.data.nodeProps) {
        const resolved: Record<string, unknown> = {}
        for (const [key, val] of Object.entries(e.data.nodeProps as Record<string, string>)) {
          const trimmed = val.trim()
          if (!trimmed) {
            resolved[key] = undefined
          } else if (/^[\w-]+:[\w-]+$/.test(trimmed)) {
            // iconify 형식 (예: solar:star-bold)
            resolved[key] = createElement(Icon, { icon: trimmed, width: 20, height: 20 })
          } else {
            resolved[key] = createElement('span', null, trimmed)
          }
        }
        setNodeResolvedProps(resolved)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return <Component {...props} {...nodeResolvedProps}>{children}</Component>
}
