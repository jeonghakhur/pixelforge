/**
 * 토큰 타입별 기본 메타데이터
 *
 * - token_type_configs 테이블에 신규 type을 INSERT할 때 사용
 * - 알 수 없는 type은 generic 기본값을 반환
 * - sectionPattern 등 Figma 스캔 관련 로직은 포함하지 않음
 */

export interface TypeMeta {
  label: string;
  icon: string;
}

export const TYPE_DEFAULTS: Record<string, TypeMeta> = {
  color:      { label: 'Colors',     icon: 'solar:pallete-linear' },
  spacing:    { label: 'Spacing',    icon: 'solar:ruler-linear' },
  radius:     { label: 'Radius',     icon: 'solar:crop-linear' },
  typography: { label: 'Typography', icon: 'solar:text-field-linear' },
  size:       { label: 'Size',       icon: 'solar:scaling-linear' },
  resolution: { label: 'Resolution', icon: 'solar:monitor-linear' },
  float:      { label: 'Float',      icon: 'solar:calculator-linear' },
  string:     { label: 'String',     icon: 'solar:text-linear' },
  boolean:    { label: 'Boolean',    icon: 'solar:check-square-linear' },
};

/** 알 수 없는 type이면 type명을 capitalize한 generic 기본값을 반환 */
export function getTypeDefault(type: string): TypeMeta {
  return (
    TYPE_DEFAULTS[type] ?? {
      label: type.charAt(0).toUpperCase() + type.slice(1),
      icon: 'solar:layers-minimalistic-linear',
    }
  );
}
