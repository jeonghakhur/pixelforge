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

export function buildTokenContext(
  tokens: Array<{ type: string; value: string; name: string }>,
): TokenContext {
  const ctx: TokenContext = { ...DEFAULT_TOKEN_CONTEXT };

  for (const token of tokens) {
    try {
      if (token.type === 'color') {
        const parsed = JSON.parse(token.value) as { hex?: string; rgba?: { r: number; g: number; b: number } };
        const name = token.name.toLowerCase();
        // primary 색상 우선 탐색
        if (name.includes('primary') || name.includes('accent') || name.includes('brand')) {
          if (parsed.hex) {
            ctx.primaryColor = parsed.hex;
            if (parsed.rgba) {
              ctx.primaryColorRgb = `${parsed.rgba.r}, ${parsed.rgba.g}, ${parsed.rgba.b}`;
            }
          }
        }
      }

      if (token.type === 'radius') {
        const parsed = JSON.parse(token.value) as { value?: number };
        if (parsed.value !== undefined) {
          const name = token.name.toLowerCase();
          if (name.includes('sm') || name.includes('small')) {
            ctx.borderRadiusSm = `${parsed.value}px`;
          } else if (name.includes('lg') || name.includes('large')) {
            ctx.borderRadiusLg = `${parsed.value}px`;
          } else {
            ctx.borderRadius = `${parsed.value}px`;
          }
        }
      }

      if (token.type === 'typography') {
        const parsed = JSON.parse(token.value) as { fontFamily?: string; fontSize?: number };
        const name = token.name.toLowerCase();
        if (name.includes('base') || name.includes('body')) {
          if (parsed.fontFamily) ctx.fontFamily = `'${parsed.fontFamily}', -apple-system, system-ui, sans-serif`;
          if (parsed.fontSize) ctx.baseFontSize = `${parsed.fontSize}px`;
        }
      }

      if (token.type === 'spacing') {
        const parsed = JSON.parse(token.value) as { paddingTop?: number; gap?: number };
        const name = token.name.toLowerCase();
        if (name.includes('base') || name.includes('spacer')) {
          const val = parsed.gap ?? parsed.paddingTop;
          if (val) ctx.spacer = `${val}px`;
        }
      }
    } catch {
      // invalid JSON token — skip
    }
  }

  return ctx;
}
