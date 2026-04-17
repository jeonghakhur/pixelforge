/**
 * 생성된 컴포넌트를 파일 시스템에 기록한다.
 *
 * 출력 경로: src/generated/components/{ComponentName}/
 *   - {ComponentName}.tsx
 *   - {ComponentName}.module.css
 *   - index.ts (barrel export)
 *
 * 루트 barrel: src/generated/components/index.ts
 *   - 모든 컴포넌트를 re-export
 *
 * 이름 규칙:
 *   "Button"           → Button/Button.tsx
 *   "Buttons/Button"   → Button/Button.tsx (마지막 세그먼트)
 *   "UI/Forms/Input"   → Input/Input.tsx
 */

import fs from 'fs'
import path from 'path'

const DEFAULT_OUTPUT_PATH = path.join(process.cwd(), 'src', 'generated', 'components')

function resolveOutputDir(outputPath?: string): string {
  if (!outputPath) return DEFAULT_OUTPUT_PATH
  return path.isAbsolute(outputPath)
    ? outputPath
    : path.join(process.cwd(), outputPath)
}

/**
 * "Buttons/Button" → dir: .../Buttons/Button, baseName: "Button"
 * "Button"         → dir: .../Button, baseName: "Button"
 * "UI/Forms/Input" → dir: .../UI/Forms/Input, baseName: "Input"
 */
function resolveComponentPath(componentName: string, outputPath?: string): { dir: string; baseName: string; rootDir: string } {
  const segments = componentName.split('/')
  const baseName = segments[segments.length - 1]
  const rootDir = resolveOutputDir(outputPath)
  const dir = path.join(rootDir, ...segments)
  return { dir, baseName, rootDir }
}

export function writeComponentFiles(componentName: string, tsx: string, css: string, outputPath?: string): void {
  try {
    const { dir, baseName, rootDir } = resolveComponentPath(componentName, outputPath)
    fs.mkdirSync(dir, { recursive: true })

    // 컴포넌트 파일
    fs.writeFileSync(path.join(dir, `${baseName}.tsx`), tsx, 'utf-8')
    fs.writeFileSync(path.join(dir, `${baseName}.module.css`), css, 'utf-8')

    // 컴포넌트 barrel export
    const indexContent = `export { default as ${baseName}, type ${baseName}Props } from './${baseName}';\n`
    fs.writeFileSync(path.join(dir, 'index.ts'), indexContent, 'utf-8')

    // 루트 barrel 갱신
    updateRootBarrel(rootDir)
  } catch {
    // 파일 생성 실패는 DB 저장에 영향 주지 않음
  }
}

export function deleteComponentFiles(componentName: string, outputPath?: string): void {
  try {
    const { dir, rootDir } = resolveComponentPath(componentName, outputPath)
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true })
    }
    // 루트 barrel 갱신
    updateRootBarrel(rootDir)
  } catch {
    // 파일 삭제 실패는 DB 삭제에 영향 주지 않음
  }
}

/**
 * src/generated/components/index.ts를 재생성한다.
 * 재귀 탐색하여 index.ts가 있는 모든 컴포넌트 폴더를 re-export.
 *
 * Buttons/Button/index.ts → export * from './Buttons/Button';
 * Input/index.ts           → export * from './Input';
 */
function updateRootBarrel(rootDir: string = DEFAULT_OUTPUT_PATH): void {
  fs.mkdirSync(rootDir, { recursive: true })

  const componentPaths: string[] = []
  function scan(dir: string, rel: string): void {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    // 이 디렉토리에 index.ts가 있고 root가 아니면 컴포넌트 폴더
    if (rel && entries.some(e => e.isFile() && e.name === 'index.ts')) {
      componentPaths.push(rel)
      return // 하위 탐색 불필요
    }
    for (const e of entries) {
      if (e.isDirectory()) scan(path.join(dir, e.name), rel ? `${rel}/${e.name}` : e.name)
    }
  }
  scan(rootDir, '')

  const lines = [
    '// Auto-generated barrel file — do not edit manually',
    ...componentPaths.sort().map(p => `export * from './${p}';`),
    '',
  ]

  fs.writeFileSync(path.join(rootDir, 'index.ts'), lines.join('\n'), 'utf-8')
}
