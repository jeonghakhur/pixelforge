'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'

interface Props {
  componentName: string
  importPath: string
  initialProps: Record<string, unknown>
  initialChildren: string
}

export default function PreviewClient({ componentName, importPath, initialProps, initialChildren }: Props) {
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

  // 부모(sandbox)에서 postMessage로 props 전달 받음 → iframe 리로드 없이 re-render
  const [props, setProps] = useState(initialProps)
  const [children, setChildren] = useState(initialChildren)

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type !== 'preview-props') return
      if (e.data.props) setProps(e.data.props as Record<string, unknown>)
      if (typeof e.data.children === 'string') setChildren(e.data.children)
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return <Component {...props}>{children}</Component>
}
