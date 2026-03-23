import type {
  FigmaVariablesResponse,
  FigmaVariableValue,
  FigmaVariable,
} from '@/lib/figma/api';
import type { ColorToken, SpacingToken, RadiusToken, TypographyToken } from './extractor';

// ===========================
// 확장 타입
// ===========================
export interface VariableTokenMeta {
  source: 'variables';
  mode: string;
  collectionName: string;
  alias: string | null;
}

export type ColorTokenV = ColorToken & VariableTokenMeta;
export type SpacingTokenV = SpacingToken & VariableTokenMeta;
export type RadiusTokenV = RadiusToken & VariableTokenMeta;
export type TypographyTokenV = TypographyToken & VariableTokenMeta;

export interface ExtractedVariableTokens {
  colors: ColorTokenV[];
  spacing: SpacingTokenV[];
  radius: RadiusTokenV[];
  typography: TypographyTokenV[];
  hasData: boolean;
}

// ===========================
// 유틸리티
// ===========================
function toHex(n: number): string {
  return Math.round(n * 255).toString(16).padStart(2, '0');
}

/**
 * FLOAT Variable을 이름/scopes 기반으로 토큰 타입 추론
 * - Figma scopes 우선 (명시적 의미)
 * - 이름 패턴 폴백
 */
function inferFloatTokenType(
  name: string,
  scopes: string[],
): 'spacing' | 'radius' | 'typography' | null {
  if (scopes.includes('GAP') || scopes.includes('WIDTH_HEIGHT')) return 'spacing';
  if (scopes.includes('CORNER_RADIUS')) return 'radius';
  if (scopes.includes('FONT_SIZE') || scopes.includes('LINE_HEIGHT') || scopes.includes('LETTER_SPACING')) return 'typography';

  const lower = name.toLowerCase();
  if (/spacing|gap|padding|margin/.test(lower)) return 'spacing';
  if (/radius|corner|rounded/.test(lower)) return 'radius';
  if (/font.?size|font.?weight|line.?height|letter.?spacing/.test(lower)) return 'typography';

  return null;
}

function isVariableAlias(value: unknown): value is FigmaVariableValue & { type: 'VARIABLE_ALIAS'; id: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as FigmaVariableValue).type === 'VARIABLE_ALIAS'
  );
}

// ===========================
// 메인 추출 함수
// ===========================
export function extractFromVariables(response: FigmaVariablesResponse): ExtractedVariableTokens {
  const { variableCollections, variables } = response.meta;

  const colors: ColorTokenV[] = [];
  const spacing: SpacingTokenV[] = [];
  const radius: RadiusTokenV[] = [];
  const typography: TypographyTokenV[] = [];

  for (const collection of Object.values(variableCollections)) {
    // 기본 모드(첫 번째)만 사용 — 모드별로 중복 생성 방지
    const defaultMode = collection.modes[0];
    if (!defaultMode) continue;

    for (const varId of collection.variableIds) {
      const variable: FigmaVariable | undefined = variables[varId];
      if (!variable || variable.hiddenFromPublishing) continue;

      const rawValue = variable.valuesByMode[defaultMode.modeId];
      if (rawValue === undefined) continue;

      const aliasId = isVariableAlias(rawValue) ? rawValue.id : null;

      const meta: VariableTokenMeta = {
        source: 'variables',
        mode: defaultMode.name,
        collectionName: collection.name,
        alias: aliasId ?? null,
      };

      if (variable.resolvedType === 'COLOR') {
        // alias는 실제 색상값 없음 → 스킵
        if (aliasId !== null) continue;

        const v = rawValue as FigmaVariableValue;
        if (v.r !== undefined && v.g !== undefined && v.b !== undefined) {
          colors.push({
            name: variable.name,
            hex: `#${toHex(v.r)}${toHex(v.g)}${toHex(v.b)}`,
            rgba: {
              r: Math.round(v.r * 255),
              g: Math.round(v.g * 255),
              b: Math.round(v.b * 255),
              a: v.a ?? 1,
            },
            ...meta,
          });
        }
      } else if (variable.resolvedType === 'FLOAT') {
        if (aliasId !== null) continue;

        const val = rawValue as number;
        const tokenType = inferFloatTokenType(variable.name, variable.scopes);

        if (tokenType === 'spacing') {
          spacing.push({ name: variable.name, gap: val, ...meta });
        } else if (tokenType === 'radius') {
          radius.push({ name: variable.name, value: val, ...meta });
        } else if (tokenType === 'typography') {
          typography.push({
            name: variable.name,
            fontFamily: '',
            fontSize: val,
            fontWeight: 400,
            ...meta,
          });
        }
      }
    }
  }

  return {
    colors,
    spacing,
    radius,
    typography,
    hasData: colors.length + spacing.length + radius.length + typography.length > 0,
  };
}
