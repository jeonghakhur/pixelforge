/**
 * 플러그인 페이로드 정규화
 *
 * 플러그인이 COMPONENT_SET 대신 개별 변형 인스턴스(COMPONENT)를 보내는 경우:
 *   - name: "size=xlarge, state=disabled, block=true" (nodeName)
 *   - texts.title: "Button" (실제 이름)
 *   - radixProps: { color: "gray", size: "xlarge" } (일부 누락)
 *
 * 정규화 결과:
 *   - name: "Button" (texts.title 우선)
 *   - radixProps: { variant: "Default", size: "xlarge", state: "disabled", block: "true" }
 */

import type { PluginComponentPayload } from './types';

// ── Figma color → Button variant 매핑 ───────────────────────────────
const COLOR_TO_VARIANT: Record<string, string> = {
  gray:    'Default',
  blue:    'Primary',
  accent:  'Primary',
  green:   'Primary',
  red:     'Outline',
  ghost:   'Invisible',
  outline: 'Outline',
};

// ── 헬퍼 ────────────────────────────────────────────────────────────

/**
 * nodeName 파싱: "size=xlarge, state=disabled, block=true"
 * → { size: "xlarge", state: "disabled", block: "true" }
 */
function parseVariantProps(nodeName: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!nodeName.includes('=')) return result;

  for (const part of nodeName.split(',')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim().toLowerCase();
    const val = part.slice(eqIdx + 1).trim();
    if (key && val) result[key] = val;
  }
  return result;
}

/**
 * 문자열 → PascalCase (컴포넌트 이름 정규화)
 * "my button" → "MyButton", "Button" → "Button"
 */
function toPascalCase(str: string): string {
  return str
    .replace(/[_\-\s]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (c: string) => c.toUpperCase());
}

/**
 * 컴포넌트 이름 추출
 * 슬래시 있으면 마지막 세그먼트, 없으면 그대로 PascalCase.
 *   "Buttons/Button" → "Button"
 *   "Components/UI/Toggle Button" → "ToggleButton"
 *   "Primary" → "Primary"
 *   "form-input" → "FormInput"
 */
function extractComponentName(str: string): string {
  const segment = str.includes('/') ? str.split('/').pop()! : str;
  return toPascalCase(segment);
}

// ── 메인 정규화 함수 ─────────────────────────────────────────────────

export function normalizePluginPayload(
  raw: Record<string, unknown>,
): PluginComponentPayload {
  const rawName = typeof raw.name === 'string' ? raw.name : '';
  const texts = raw.texts as { title?: string; all?: string[] } | undefined;
  const meta = raw.meta as { nodeName?: string } | undefined;
  const nodeName = meta?.nodeName ?? rawName;

  // ── 1. 실제 컴포넌트 이름 추출 ──────────────────────────────────
  // 세 가지 경우 모두 texts.title 우선 사용:
  //   a) rawName에 '=' 포함 ("size=xlarge, state=rest, ...")
  //   b) meta.nodeName에 '=' 포함 (플러그인이 PascalCase로 변환한 경우도 커버)
  //   c) variantOptions 존재 (COMPONENT_SET 출처라는 확실한 신호)
  const isVariantInstance =
    rawName.includes('=') ||
    nodeName.includes('=') ||
    raw.variantOptions != null;

  const realName = isVariantInstance
    ? extractComponentName(texts?.title?.trim() || texts?.all?.[0]?.trim() || rawName)
    : extractComponentName(rawName);

  // ── 2. nodeName에서 변형 속성 추출 ──────────────────────────────
  const variantProps = parseVariantProps(nodeName);

  // ── 3. radixProps 정규화 ─────────────────────────────────────────
  const originalProps = (raw.radixProps as Record<string, string>) ?? {};
  const normalizedProps: Record<string, string> = { ...originalProps };

  // color → variant 매핑 (variant가 없을 때만)
  if (normalizedProps.color && !normalizedProps.variant) {
    const mapped = COLOR_TO_VARIANT[normalizedProps.color.toLowerCase()];
    normalizedProps.variant = mapped ?? 'Default';
    delete normalizedProps.color;
  }

  // nodeName의 변형 속성으로 보강
  if (variantProps.size)    normalizedProps.size    = variantProps.size;
  if (variantProps.state)   normalizedProps.state   = variantProps.state;
  if (variantProps.block)   normalizedProps.block   = variantProps.block;
  if (variantProps.variant) normalizedProps.variant = variantProps.variant;

  return {
    ...(raw as Omit<PluginComponentPayload, 'name' | 'radixProps'>),
    name:       realName,
    radixProps: normalizedProps,
  } as PluginComponentPayload;
}
