// 토큰 인터페이스 공유 타입
// extractor.ts와 개별 추출기가 모두 이 파일을 참조합니다.

export interface ColorToken {
  name: string;
  hex: string;
  rgba: { r: number; g: number; b: number; a: number };
}

export interface TypographyToken {
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight?: number;
  letterSpacing?: number;
}

export interface SpacingToken {
  name: string;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  gap?: number;
}

export interface RadiusToken {
  name: string;
  value: number;
  corners?: number[];
}

export interface ExtractedTokens {
  colors: ColorToken[];
  typography: TypographyToken[];
  spacing: SpacingToken[];
  radius: RadiusToken[];
}
