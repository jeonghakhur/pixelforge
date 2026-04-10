import { notFound } from 'next/navigation'
import { getComponentByName } from '@/lib/actions/components'
import PreviewClient from './PreviewClient'

interface PreviewPageProps {
  params: Promise<{ name: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function extractFigmaPath(nodePayload: string | null | undefined): string | null {
  if (!nodePayload) return null
  try {
    const data = JSON.parse(nodePayload) as { name?: string }
    return data.name ?? null
  } catch {
    return null
  }
}

/** query string을 컴포넌트 props로 파싱 */
function parseProps(
  searchParams: Record<string, string | string[] | undefined>,
): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'children') continue
    if (typeof value !== 'string') continue
    if (value === 'true') props[key] = true
    else if (value === 'false') props[key] = false
    else props[key] = value
  }
  return props
}

export default async function PreviewPage({ params, searchParams }: PreviewPageProps) {
  const { name } = await params
  const sp = await searchParams

  const row = await getComponentByName(name)
  if (!row) notFound()

  const figmaPath = extractFigmaPath(row.nodePayload)
  const importPath = figmaPath ?? name
  const props = parseProps(sp)
  const children = (sp.children as string | undefined) ?? name

  return (
    <PreviewClient
      componentName={name}
      importPath={importPath}
      initialProps={props}
      initialChildren={children}
    />
  )
}
