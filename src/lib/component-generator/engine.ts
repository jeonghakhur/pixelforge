import type { PluginComponentPayload, EngineResult } from './types';
import { generateButton } from './generators/button';

type GeneratorFn = (payload: PluginComponentPayload) => ReturnType<typeof generateButton>;

const GENERATORS: Record<string, GeneratorFn> = {
  button: generateButton,
};

/**
 * 플러그인 payload → TSX + SCSS 생성
 *
 * detectedType 기준으로 제너레이터를 선택한다.
 * 지원하지 않는 타입은 warnings에 기록하고 success: false 반환.
 */
export function runComponentEngine(payload: PluginComponentPayload): EngineResult {
  const warnings: string[] = [];
  const { detectedType, name } = payload;

  const generator = GENERATORS[detectedType];

  if (!generator) {
    return {
      success: false,
      output: null,
      warnings,
      error: `'${name}': detectedType '${detectedType}'는 아직 지원하지 않습니다. (지원: ${Object.keys(GENERATORS).join(', ')})`,
    };
  }

  try {
    const output = generator(payload);
    return { success: true, output, warnings };
  } catch (err) {
    return {
      success: false,
      output: null,
      warnings,
      error: `'${name}' 생성 중 오류: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
