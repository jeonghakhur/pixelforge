export interface TokenContext {
  primaryColor: string;
  primaryColorRgb: string;
  borderRadius: string;
  borderRadiusSm: string;
  borderRadiusLg: string;
  fontFamily: string;
  baseFontSize: string;
  spacer: string;
}

export const DEFAULT_TOKEN_CONTEXT: TokenContext = {
  primaryColor: '#3b82f6',
  primaryColorRgb: '59, 130, 246',
  borderRadius: '8px',
  borderRadiusSm: '6px',
  borderRadiusLg: '12px',
  fontFamily: "'Pretendard', -apple-system, system-ui, sans-serif",
  baseFontSize: '16px',
  spacer: '16px',
};

export interface GeneratedComponent {
  id: string;
  name: string;
  category: 'action' | 'form' | 'navigation' | 'feedback';
  tsx: string;
  scss: string;
  description: string;
}
