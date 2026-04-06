import type { PluginComponentPayload, EngineResult } from './types';
import { generateButton } from './generators/button';

type GeneratorFn = (payload: PluginComponentPayload) => ReturnType<typeof generateButton>;

const GENERATORS: Record<string, GeneratorFn> = {
  button: generateButton,
};

/**
 * detectedType 보정: 플러그인이 layout으로 감지했지만 이름에 Button이 포함된 경우
 * button 제너레이터로 라우팅한다.
 */
function resolveDetectedType(payload: PluginComponentPayload): string {
  const { detectedType, name } = payload;
  if (detectedType === 'layout' && /button/i.test(name)) {
    return 'button';
  }
  return detectedType;
}

/**
 * 플러그인 payload → TSX + CSS Module 생성
 *
 * detectedType 기준으로 제너레이터를 선택한다.
 * 지원하지 않는 타입은 warnings에 기록하고 success: false 반환.
 * 생성 중 발견된 경고(토큰 미매핑, 누락 state 등)는 warnings에 포함된다.
 */
export function runComponentEngine(payload: PluginComponentPayload): EngineResult {
  const resolvedType = resolveDetectedType(payload);
  const { name } = payload;

  const generator = GENERATORS[resolvedType];

  if (!generator) {
    return {
      success: false,
      output: null,
      warnings: [],
      resolvedType,
      error: `'${name}': detectedType '${resolvedType}'는 아직 지원하지 않습니다. (지원: ${Object.keys(GENERATORS).join(', ')})`,
    };
  }

  try {
    const output = generator(payload);
    const warnings = output.warnings.map(w => `[${w.code}] ${w.message}${w.value ? ` (${w.value})` : ''}`);
    return { success: true, output, warnings, resolvedType };
  } catch (err) {
    return {
      success: false,
      output: null,
      warnings: [],
      resolvedType,
      error: `'${name}' 생성 중 오류: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
