import { generateButton } from './templates/button';
import { generateBadge } from './templates/badge';
import { generateCard } from './templates/card';
import { generateChip } from './templates/chip';
import { generateSpinner } from './templates/spinner';
import { generateModal } from './templates/modal';
import { generateToast } from './templates/toast';
import { generateFormGroup } from './templates/form-group';
import { generateFormSelect } from './templates/form-select';
import { generateFormCheck } from './templates/form-check';
import { generateFormTextarea } from './templates/form-textarea';
import { generateNav } from './templates/nav';
import { generatePagination } from './templates/pagination';
import { generateDropdown } from './templates/dropdown';
import { DEFAULT_TOKEN_CONTEXT, type TokenContext, type GeneratedComponent } from './types';

export type { TokenContext, GeneratedComponent };
export { DEFAULT_TOKEN_CONTEXT };

type GeneratorFn = (ctx: TokenContext) => GeneratedComponent;

const GENERATORS: Record<string, GeneratorFn> = {
  button:        generateButton,
  badge:         generateBadge,
  card:          generateCard,
  chip:          generateChip,
  spinner:       generateSpinner,
  modal:         generateModal,
  toast:         generateToast,
  'form-group':  generateFormGroup,
  'form-select': generateFormSelect,
  'form-check':  generateFormCheck,
  'form-textarea': generateFormTextarea,
  nav:           generateNav,
  pagination:    generatePagination,
  dropdown:      generateDropdown,
};

export function generateComponent(id: string, ctx: TokenContext): GeneratedComponent | null {
  const fn = GENERATORS[id];
  return fn ? fn(ctx) : null;
}

export function generateComponents(ids: string[], ctx: TokenContext): GeneratedComponent[] {
  return ids.flatMap((id) => {
    const result = generateComponent(id, ctx);
    return result ? [result] : [];
  });
}

/** fontFamily 값 새니타이징: 싱글쿼트 이스케이프 + 구조 파괴 방지 */
function sanitizeFontFamily(raw: string): string {
  return raw.replace(/'/g, '').replace(/[;{}\\]/g, '').replace(/\/\*/g, '');
}

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

export function buildTokenContext(
  tokens: Array<{ type: string; value: string; name: string }>,
): TokenContext {
  const ctx: TokenContext = { ...DEFAULT_TOKEN_CONTEXT };

  for (const token of tokens) {
    try {
      if (token.type === 'color') {
        const parsed = JSON.parse(token.value) as { hex?: string; rgba?: { r: number; g: number; b: number } };
        const name = token.name.toLowerCase();
        if (name.includes('primary') || name.includes('accent') || name.includes('brand')) {
          if (parsed.hex && HEX_RE.test(parsed.hex)) {
            ctx.primaryColor = parsed.hex;
            if (parsed.rgba) {
              const { r, g, b } = parsed.rgba;
              if ([r, g, b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255)) {
                ctx.primaryColorRgb = `${r}, ${g}, ${b}`;
              }
            }
          }
        }
      }

      if (token.type === 'radius') {
        const parsed = JSON.parse(token.value) as { value?: number };
        if (typeof parsed.value === 'number' && Number.isFinite(parsed.value) && parsed.value >= 0) {
          const name = token.name.toLowerCase();
          const px = `${parsed.value}px`;
          if (name.includes('sm') || name.includes('small')) {
            ctx.borderRadiusSm = px;
          } else if (name.includes('lg') || name.includes('large')) {
            ctx.borderRadiusLg = px;
          } else {
            ctx.borderRadius = px;
          }
        }
      }

      if (token.type === 'typography') {
        const parsed = JSON.parse(token.value) as { fontFamily?: string; fontSize?: number };
        const name = token.name.toLowerCase();
        if (name.includes('base') || name.includes('body')) {
          if (parsed.fontFamily) {
            const safe = sanitizeFontFamily(parsed.fontFamily);
            ctx.fontFamily = `'${safe}', -apple-system, system-ui, sans-serif`;
          }
          if (typeof parsed.fontSize === 'number' && Number.isFinite(parsed.fontSize) && parsed.fontSize > 0) {
            ctx.baseFontSize = `${parsed.fontSize}px`;
          }
        }
      }

      if (token.type === 'spacing') {
        const parsed = JSON.parse(token.value) as { paddingTop?: number; gap?: number };
        const name = token.name.toLowerCase();
        if (name.includes('base') || name.includes('spacer')) {
          const val = parsed.gap ?? parsed.paddingTop;
          if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
            ctx.spacer = `${val}px`;
          }
        }
      }
    } catch {
      // invalid JSON token — skip
    }
  }

  return ctx;
}
