/**
 * Radix UI Button 접근성 패턴
 *
 * 참조: https://github.com/radix-ui/primitives/tree/main/packages/react/primitive
 *
 * Radix에서 학습한 핵심 패턴:
 * 1. type="button" 항상 명시 — form submit 의도치 않은 제출 방지
 * 2. aria-disabled vs disabled
 *    - disabled: 이벤트 차단, 포커스 불가 → 스크린 리더가 "사용 불가" 미고지 가능
 *    - aria-disabled + data-disabled: 이벤트 제어는 JS로, 포커스 유지 → 스크린 리더 안내 가능
 *    - Radix는 두 가지를 모두 지원하며, 기본은 aria-disabled 방식 사용
 * 3. data-state: toggle 버튼의 pressed 상태 관리
 * 4. data-variant / data-size: CSS 타겟팅용 (className 충돌 없이)
 * 5. forwardRef: 부모가 DOM ref에 직접 접근 가능
 * 6. asChild (Slot): 렌더 요소를 자식으로 위임 — <Button asChild><a href="/">Link</a></Button>
 */

export interface ButtonA11yConfig {
  /** HTML type 속성 — 기본값 'button' (form submit 방지) */
  type?: 'button' | 'submit' | 'reset'
  /** 비활성화 여부 */
  disabled?: boolean
  /** toggle 버튼 여부 (눌린 상태 추적) */
  isToggle?: boolean
  /** toggle pressed 상태 */
  pressed?: boolean
}

export interface ButtonA11yAttributes {
  type: 'button' | 'submit' | 'reset'
  'aria-disabled'?: true
  'aria-pressed'?: boolean
  'data-disabled'?: ''
  'data-state'?: 'on' | 'off'
}

export function getButtonA11yAttributes(config: ButtonA11yConfig): ButtonA11yAttributes {
  const attrs: ButtonA11yAttributes = {
    type: config.type ?? 'button',
  };

  if (config.disabled) {
    attrs['aria-disabled'] = true;
    attrs['data-disabled'] = '';
  }

  if (config.isToggle) {
    attrs['aria-pressed'] = config.pressed ?? false;
    attrs['data-state'] = config.pressed ? 'on' : 'off';
  }

  return attrs;
}

/**
 * Figma Button variant 정의 (Figma 컴포넌트 variant 이름 그대로 사용)
 */
export const BUTTON_VARIANTS = ['Primary', 'Secondary', 'Default', 'Outline', 'Invisible'] as const;
export type ButtonVariant = typeof BUTTON_VARIANTS[number];

export const BUTTON_SIZES = ['xsmall', 'small', 'medium', 'large', 'xlarge'] as const;
export type ButtonSize = typeof BUTTON_SIZES[number];

export function isValidButtonVariant(v: string): v is ButtonVariant {
  return BUTTON_VARIANTS.includes(v as ButtonVariant);
}

export function isValidButtonSize(s: string): s is ButtonSize {
  return BUTTON_SIZES.includes(s as ButtonSize);
}
