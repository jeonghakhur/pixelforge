import fs from 'fs';
import path from 'path';
import { ICON_OUTPUT_DEFAULT } from '@/lib/constants/icons';

export interface IconInput {
  name: string;
  svg: string;
  pascal?: string;    // JSON이 제공하는 PascalCase 컴포넌트명
  variants?: string[]; // ["type-default"], ["type-gray"], ...
}

// ─── 이름 변환 ────────────────────────────────────────────────────────────────

export function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (c: string) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');
}

export function toComponentName(figmaName: string): string {
  let name = figmaName.trim();
  if (name.includes('=')) {
    const firstProp = name.split(',')[0];
    name = firstProp.split('=')[1]?.trim() ?? name;
  }
  const segment = name.split('/').pop() ?? name;
  return toPascalCase(segment);
}

function resolvedComponentName(icon: IconInput): string {
  if (icon.pascal) return toPascalCase(icon.pascal);
  return toComponentName(icon.name);
}

function normalizeVariant(v: string): string {
  return v.replace(/^type-/, '');
}

function toKebabCase(pascal: string): string {
  return pascal.replace(/([A-Z])/g, (m, c, i) => (i === 0 ? c.toLowerCase() : '-' + c.toLowerCase()));
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

function cssPropToJsx(prop: string): string {
  return prop.trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function styleStringToJsx(css: string): string {
  const entries = css.split(';').map((s) => s.trim()).filter(Boolean).map((pair) => {
    const colon = pair.indexOf(':');
    if (colon === -1) return null;
    const prop = cssPropToJsx(pair.slice(0, colon));
    const value = pair.slice(colon + 1).trim();
    return `${prop}: '${value.replace(/'/g, "\\'")}'`;
  }).filter(Boolean);
  return `{ ${entries.join(', ')} }`;
}

function convertAttrs(svgContent: string): string {
  let result = svgContent;
  for (const [html, jsx] of Object.entries(ATTR_MAP)) {
    result = result.replace(new RegExp(`\\b${html}=`, 'g'), `${jsx}=`);
  }
  result = result.replace(/xlink:href=/g, 'href=');
  result = result.replace(/\s+xml:space="[^"]*"/g, '');
  result = result.replace(/\s+xmlns:xlink="[^"]*"/g, '');
  result = result.replace(/\bstyle="([^"]*)"/g, (_, css: string) => `style={${styleStringToJsx(css)}}`);
  return result;
}

// ─── uid 치환 — mask/gradient id 충돌 방지 ───────────────────────────────────

function hasDefinedIds(inner: string): boolean {
  return /\bid="[^"]+"/i.test(inner);
}

// convertAttrs 실행 후 호출 — id 선언과 url(#...) 참조를 uid 기반으로 변환
function applyUid(inner: string): string {
  // id="foo" → id={`${uid}-foo`}
  inner = inner.replace(/\bid="([^"]+)"/g, (_, id) => `id={\`\${uid}-${id}\`}`);

  // attr="...url(#foo)..." → attr={`...url(#${uid}-foo)...`}
  // style={{ ... }} 처럼 이미 JSX 표현식인 속성은 건드리지 않도록 " 로 감싸진 것만 처리
  inner = inner.replace(/(\w+)="([^"]*url\(#([^)]+)\)[^"]*)"/g, (_, attr, value) => {
    const newValue = value.replace(/url\(#([^)]+)\)/g, (_m: string, refId: string) => `url(#\${uid}-${refId})`);
    return `${attr}={\`${newValue}\`}`;
  });

  return inner;
}

// ─── SVG Sanitize ─────────────────────────────────────────────────────────────

function sanitize(svg: string): string {
  svg = svg.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  svg = svg.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  svg = svg.replace(/\s+on\w+="[^"]*"/gi, '');
  svg = svg.replace(/\s+on\w+='[^']*'/gi, '');
  svg = svg.replace(/href="javascript:[^"]*"/gi, 'href="#"');
  svg = svg.replace(/href='javascript:[^']*'/gi, "href='#'");
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
  const colorMatches = [...svg.matchAll(/\b(?:fill|stroke)="([^"]+)"/gi)];
  const uniqueColors = new Set(
    colorMatches.map((m) => m[1].toLowerCase()).filter((v) => !isSkipValue(v)),
  );
  if (uniqueColors.size !== 1) return svg;
  return svg
    .replace(/\bfill="([^"]+)"/gi, (_, v: string) => isSkipValue(v) ? `fill="${v}"` : 'fill="currentColor"')
    .replace(/\bstroke="([^"]+)"/gi, (_, v: string) => isSkipValue(v) ? `stroke="${v}"` : 'stroke="currentColor"');
}

// ─── SVG 파싱 ─────────────────────────────────────────────────────────────────

function extractViewBox(svg: string): string {
  return svg.match(/viewBox="([^"]+)"/i)?.[1] ?? '0 0 24 24';
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
  return svg.replace(/^<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '').trim();
}

function prepareSvgParts(svg: string): { viewBox: string; width: number; height: number; inner: string; needsUid: boolean } {
  let s = sanitize(svg);
  s = toCurrentColor(s);
  const viewBox = extractViewBox(s);
  const { width, height } = extractDimensions(s);
  let inner = extractInner(s);
  inner = convertAttrs(inner);
  const needsUid = hasDefinedIds(inner);
  if (needsUid) inner = applyUid(inner);
  return { viewBox, width, height, inner, needsUid };
}

// ─── 단일 컴포넌트 빌더 ──────────────────────────────────────────────────────

function buildSingleComponent(
  componentName: string,
  kebabName: string,
  viewBox: string,
  width: number,
  height: number,
  inner: string,
  needsUid: boolean,
): string {
  const uidImport = needsUid ? `import { useId } from "react";\n` : '';
  const uidDecl = needsUid ? `\n  const uid = useId();` : '';

  if (needsUid) {
    // useId가 필요하면 함수 본문 형태
    return `${uidImport}import type { SVGProps } from "react";

interface Icon${componentName}Props extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string;
}

export const Icon${componentName} = ({ size, color, className, ...props }: Icon${componentName}Props) => {${uidDecl}
  return (
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
};
`;
  }

  return `import type { SVGProps } from "react";

interface Icon${componentName}Props extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: "default";
  color?: string;
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

// ─── Variant 통합 컴포넌트 빌더 ──────────────────────────────────────────────

interface VariantSvgPart {
  variantName: string; // "default" | "gray" | "solid" | ...
  viewBox: string;
  width: number;
  height: number;
  inner: string;
}

function buildVariantComponent(
  componentName: string,
  kebabName: string,
  variantParts: VariantSvgPart[],
  needsUid: boolean,
): string {
  const variantNames = variantParts.map((v) => v.variantName);
  const defaultVariant = variantNames.includes('default') ? 'default' : variantNames[0];
  const nonDefaultVariants = variantParts.filter((v) => v.variantName !== defaultVariant);
  const defaultPart = variantParts.find((v) => v.variantName === defaultVariant) ?? variantParts[0];

  const uidImport = needsUid ? `import { useId } from "react";\n` : '';
  const uidDecl = needsUid ? `\n  const uid = useId();` : '';

  const variantType = variantNames.map((v) => `"${v}"`).join(' | ');

  function svgBlock(part: VariantSvgPart, indent: string): string {
    return `(
${indent}  <svg
${indent}    width={${part.width}}
${indent}    height={${part.height}}
${indent}    className={["icon-${kebabName}", className].filter(Boolean).join(" ")}
${indent}    style={color ? { color } : undefined}
${indent}    {...props}
${indent}    viewBox="${part.viewBox}"
${indent}    fill="none"
${indent}    xmlns="http://www.w3.org/2000/svg"
${indent}  >
${indent}    ${part.inner}
${indent}  </svg>
${indent})`;
  }

  const branches = nonDefaultVariants
    .map((v) => `  if (variant === "${v.variantName}") return ${svgBlock(v, '  ')};`)
    .join('\n\n');

  return `${uidImport}import type { SVGProps } from "react";

type Icon${componentName}Variant = ${variantType};

interface Icon${componentName}Props extends Omit<SVGProps<SVGSVGElement>, "color"> {
  variant?: Icon${componentName}Variant;
  color?: string;
}

export const Icon${componentName} = ({
  variant = "${defaultVariant}",
  color,
  className,
  ...props
}: Icon${componentName}Props) => {${uidDecl}
${branches}

  return ${svgBlock(defaultPart, '  ')};
};
`;
}

// ─── 메인 생성 함수 ───────────────────────────────────────────────────────────

function resolveOutputDir(outputPath?: string): string {
  const base = outputPath ?? ICON_OUTPUT_DEFAULT;
  return path.isAbsolute(base) ? base : path.join(process.cwd(), base);
}

export function generateIconFiles(icons: IconInput[], outputPath?: string): void {
  const rootDir = resolveOutputDir(outputPath);
  fs.mkdirSync(rootDir, { recursive: true });

  if (fs.existsSync(rootDir)) {
    for (const entry of fs.readdirSync(rootDir)) {
      if (entry.startsWith('Icon')) {
        fs.rmSync(path.join(rootDir, entry), { recursive: true, force: true });
      }
    }
  }

  fs.writeFileSync(
    path.join(rootDir, 'index.ts'),
    '// Auto-generated — do not edit manually\nexport {};\n',
    'utf-8',
  );

  // pascal 기준으로 그룹핑
  const groups = new Map<string, IconInput[]>();
  for (const icon of icons) {
    const key = resolvedComponentName(icon);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(icon);
  }

  const generated: string[] = [];

  for (const [componentName, group] of groups) {
    const kebabName = toKebabCase(componentName);

    // variant 통합 가능 여부: 2개 이상 & 모든 멤버가 variants 1개 & 고유한 variant명
    const normalizedVariantNames = group.map((g) =>
      g.variants && g.variants.length === 1 ? normalizeVariant(g.variants[0]) : null,
    );
    const allUnique = new Set(normalizedVariantNames.filter(Boolean)).size === group.length;
    const isVariantGroup = group.length >= 2 && normalizedVariantNames.every((v) => v !== null) && allUnique;

    if (isVariantGroup) {
      // ── Variant 통합 컴포넌트 ──
      const variantParts: VariantSvgPart[] = [];
      let needsUid = false;

      for (const icon of group) {
        const variantName = normalizeVariant(icon.variants![0]!!);
        const { viewBox, width, height, inner, needsUid: iconNeedsUid } = prepareSvgParts(icon.svg);
        if (iconNeedsUid) needsUid = true;
        variantParts.push({ variantName, viewBox, width, height, inner });
      }

      const tsx = buildVariantComponent(componentName, kebabName, variantParts, needsUid);
      writeIconFiles(rootDir, componentName, tsx);
      generated.push(componentName);
    } else {
      // ── 단일 컴포넌트 (기존 방식, 이름 충돌 시 suffix) ──
      const nameCount = new Map<string, number>();
      for (const icon of group) {
        const base = componentName;
        const count = nameCount.get(base) ?? 0;
        nameCount.set(base, count + 1);
        const finalName = count === 0 ? base : `${base}${count + 1}`;
        const finalKebab = toKebabCase(finalName);

        const { viewBox, width, height, inner, needsUid } = prepareSvgParts(icon.svg);
        const tsx = buildSingleComponent(finalName, finalKebab, viewBox, width, height, inner, needsUid);
        writeIconFiles(rootDir, finalName, tsx);
        generated.push(finalName);
      }
    }
  }

  updateBarrel(rootDir, generated);
}

function writeIconFiles(rootDir: string, componentName: string, tsx: string): void {
  const iconDir = path.join(rootDir, `Icon${componentName}`);
  fs.mkdirSync(iconDir, { recursive: true });
  fs.writeFileSync(path.join(iconDir, `Icon${componentName}.tsx`), tsx, 'utf-8');
  fs.writeFileSync(
    path.join(iconDir, 'index.ts'),
    `export { Icon${componentName} } from './Icon${componentName}';\n`,
    'utf-8',
  );
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
