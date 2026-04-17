import fs from 'fs';
import path from 'path';
import { ICON_OUTPUT_DEFAULT } from '@/lib/constants/icons';

export interface IconInput {
  name: string;
  svg: string;
}

// ─── 이름 변환 ────────────────────────────────────────────────────────────────

export function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (c: string) => c.toUpperCase());
}

/**
 * Figma 컴포넌트 이름 → PascalCase 컴포넌트명
 * "icon/arrow-left"             → "ArrowLeft"
 * "Icon=Default, Name=close"    → "Close"
 * "ic_home"                     → "IcHome"
 */
export function toComponentName(figmaName: string): string {
  let name = figmaName.trim();

  // "Key=Value, Key=Value" 형태 → 첫 번째 값 사용
  if (name.includes('=')) {
    const firstProp = name.split(',')[0];
    name = firstProp.split('=')[1]?.trim() ?? name;
  }

  // 마지막 '/' 세그먼트 사용
  const segment = name.split('/').pop() ?? name;

  return toPascalCase(segment);
}

// ─── SVG 속성 변환 ────────────────────────────────────────────────────────────

const ATTR_MAP: Record<string, string> = {
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset',
  'stroke-miterlimit': 'strokeMiterlimit',
  'stroke-opacity': 'strokeOpacity',
  'fill-opacity': 'fillOpacity',
  'clip-path': 'clipPath',
  'stop-color': 'stopColor',
  'stop-opacity': 'stopOpacity',
  'text-anchor': 'textAnchor',
  'dominant-baseline': 'dominantBaseline',
  'font-size': 'fontSize',
  'font-weight': 'fontWeight',
  'font-family': 'fontFamily',
  'letter-spacing': 'letterSpacing',
  'word-spacing': 'wordSpacing',
  'marker-end': 'markerEnd',
  'marker-start': 'markerStart',
  'marker-mid': 'markerMid',
  'shape-rendering': 'shapeRendering',
  'image-rendering': 'imageRendering',
  'color-interpolation': 'colorInterpolation',
  'color-interpolation-filters': 'colorInterpolationFilters',
  'flood-color': 'floodColor',
  'flood-opacity': 'floodOpacity',
  'lighting-color': 'lightingColor',
  'paint-order': 'paintOrder',
  'vector-effect': 'vectorEffect',
  'class': 'className',
};

function convertAttrs(svgContent: string): string {
  let result = svgContent;
  for (const [html, jsx] of Object.entries(ATTR_MAP)) {
    result = result.replace(new RegExp(`\\b${html}=`, 'g'), `${jsx}=`);
  }
  // xlink:href → href (SVG 2 표준)
  result = result.replace(/xlink:href=/g, 'href=');
  // xml:space 제거
  result = result.replace(/\s+xml:space="[^"]*"/g, '');
  // xmlns:xlink 제거
  result = result.replace(/\s+xmlns:xlink="[^"]*"/g, '');
  return result;
}

// ─── SVG Sanitize ─────────────────────────────────────────────────────────────

function sanitize(svg: string): string {
  // <script> 태그 제거
  svg = svg.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // <style> 태그 제거 (단색 아이콘이므로 안전)
  svg = svg.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  // on* 이벤트 핸들러 제거
  svg = svg.replace(/\s+on\w+="[^"]*"/gi, '');
  svg = svg.replace(/\s+on\w+='[^']*'/gi, '');
  // javascript: URI 제거
  svg = svg.replace(/href="javascript:[^"]*"/gi, 'href="#"');
  svg = svg.replace(/href='javascript:[^']*'/gi, "href='#'");
  // 외부 <use> href 제거 (http/https 참조)
  svg = svg.replace(/(<use\b[^>]*)\s+href="https?:\/\/[^"]*"/gi, '$1');
  svg = svg.replace(/(<use\b[^>]*)\s+href='https?:\/\/[^']*'/gi, '$1');
  return svg;
}

// ─── currentColor 변환 ────────────────────────────────────────────────────────

const SKIP_VALUES = new Set(['none', 'inherit', 'currentcolor', 'transparent']);

function isSkipValue(v: string): boolean {
  return SKIP_VALUES.has(v.toLowerCase()) || v.toLowerCase().startsWith('url(');
}

function toCurrentColor(svg: string): string {
  // fill + stroke 에서 유의미한 색상값 수집
  const colorMatches = [
    ...svg.matchAll(/\b(?:fill|stroke)="([^"]+)"/gi),
  ];
  const uniqueColors = new Set(
    colorMatches
      .map((m) => m[1].toLowerCase())
      .filter((v) => !isSkipValue(v)),
  );

  // 단색 (1종) 일 때만 전환
  if (uniqueColors.size !== 1) return svg;

  return svg
    .replace(/\bfill="([^"]+)"/gi, (_, v: string) =>
      isSkipValue(v) ? `fill="${v}"` : 'fill="currentColor"',
    )
    .replace(/\bstroke="([^"]+)"/gi, (_, v: string) =>
      isSkipValue(v) ? `stroke="${v}"` : 'stroke="currentColor"',
    );
}

// ─── SVG 파싱 ─────────────────────────────────────────────────────────────────

function extractViewBox(svg: string): string {
  const match = svg.match(/viewBox="([^"]+)"/i);
  return match ? match[1] : '0 0 24 24';
}

function extractDimensions(svg: string): { width: number; height: number } {
  const w = svg.match(/\bwidth="(\d+(?:\.\d+)?)"/i);
  const h = svg.match(/\bheight="(\d+(?:\.\d+)?)"/i);
  return {
    width: w ? Math.round(parseFloat(w[1])) : 24,
    height: h ? Math.round(parseFloat(h[1])) : 24,
  };
}

function extractInner(svg: string): string {
  return svg
    .replace(/^<svg[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '')
    .trim();
}

// ─── 컴포넌트 코드 생성 ──────────────────────────────────────────────────────

function buildComponentCode(componentName: string, kebabName: string, viewBox: string, width: number, height: number, inner: string): string {
  return `import type { SVGProps } from "react";

interface Icon${componentName}Props extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string; // CSS color 값 — style.color 로 적용됨 (fill="currentColor" 상속)
}

export const Icon${componentName} = ({ size, color, className, ...props }: Icon${componentName}Props) => (
  <svg
    width={${width}}
    height={${height}}
    className={["icon-${kebabName}", size && "size-" + size, className].filter(Boolean).join(" ")}
    style={color ? { color } : undefined}
    {...props}
    viewBox="${viewBox}"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    ${inner}
  </svg>
);
`;
}

// ─── 메인 생성 함수 ───────────────────────────────────────────────────────────

function toKebabCase(pascal: string): string {
  return pascal
    .replace(/([A-Z])/g, (m, c, i) => (i === 0 ? c.toLowerCase() : '-' + c.toLowerCase()));
}

function resolveOutputDir(outputPath?: string): string {
  const base = outputPath ?? ICON_OUTPUT_DEFAULT;
  return path.isAbsolute(base) ? base : path.join(process.cwd(), base);
}

export function generateIconFiles(icons: IconInput[], outputPath?: string): void {
  const rootDir = resolveOutputDir(outputPath);

  // 루트 디렉터리 보장 — index.ts 는 항상 살아있어야 HMR 오류가 없음
  fs.mkdirSync(rootDir, { recursive: true });

  // 기존 Icon* 하위 폴더만 삭제 (index.ts 는 건드리지 않음)
  if (fs.existsSync(rootDir)) {
    for (const entry of fs.readdirSync(rootDir)) {
      if (entry.startsWith('Icon')) {
        fs.rmSync(path.join(rootDir, entry), { recursive: true, force: true });
      }
    }
  }

  // 빈 barrel 먼저 기록 — 파일 생성 전 잠깐이라도 유효한 모듈이어야 함
  fs.writeFileSync(
    path.join(rootDir, 'index.ts'),
    '// Auto-generated — do not edit manually\nexport {};\n',
    'utf-8',
  );

  const generated: string[] = [];
  const nameCount = new Map<string, number>();

  for (const icon of icons) {
    const base = toComponentName(icon.name);

    // 충돌 처리 — suffix 번호 부여
    const count = nameCount.get(base) ?? 0;
    nameCount.set(base, count + 1);
    const componentName = count === 0 ? base : `${base}${count + 1}`;

    const kebabName = toKebabCase(componentName);

    let svg = sanitize(icon.svg);
    svg = toCurrentColor(svg);

    const viewBox = extractViewBox(svg);
    const { width, height } = extractDimensions(svg);
    let inner = extractInner(svg);
    inner = convertAttrs(inner);

    const tsx = buildComponentCode(componentName, kebabName, viewBox, width, height, inner);

    const iconDir = path.join(rootDir, `Icon${componentName}`);
    fs.mkdirSync(iconDir, { recursive: true });
    fs.writeFileSync(path.join(iconDir, `Icon${componentName}.tsx`), tsx, 'utf-8');
    fs.writeFileSync(
      path.join(iconDir, 'index.ts'),
      `export { Icon${componentName} } from './Icon${componentName}';\n`,
      'utf-8',
    );

    generated.push(componentName);
  }

  updateBarrel(rootDir, generated);
}

function updateBarrel(rootDir: string, names: string[]): void {
  const lines = [
    '// Auto-generated — do not edit manually',
    ...names.sort().map((n) => `export { Icon${n} } from './Icon${n}';`),
    '',
  ];
  fs.writeFileSync(path.join(rootDir, 'index.ts'), lines.join('\n'), 'utf-8');
}

export function removeIconFile(componentName: string, outputPath?: string): void {
  const rootDir = resolveOutputDir(outputPath);
  const iconDir = path.join(rootDir, `Icon${componentName}`);
  if (fs.existsSync(iconDir)) {
    fs.rmSync(iconDir, { recursive: true, force: true });
  }
}

export function rebuildBarrelFromDisk(outputPath?: string): void {
  const rootDir = resolveOutputDir(outputPath);
  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true });
    fs.writeFileSync(path.join(rootDir, 'index.ts'), '// Auto-generated — do not edit manually\nexport {};\n', 'utf-8');
    return;
  }
  const names = fs.readdirSync(rootDir)
    .filter((d) => d.startsWith('Icon') && fs.statSync(path.join(rootDir, d)).isDirectory())
    .map((d) => d.slice('Icon'.length));
  updateBarrel(rootDir, names);
}
