# Design: Component Generator 시스템

_플러그인에서 받은 Figma 노드 정보를 React 컴포넌트로 자동 생성_

---

## 📌 Overview

| 항목 | 내용 |
|------|------|
| Feature | component-generator |
| Goal | Figma 플러그인이 추출한 COMPONENT_SET 노드 → 완전한 React TSX 생성 |
| Core Value | 모든 variant 조합을 커버하는 "즉시 사용 가능한" 컴포넌트 자동화 |
| Owner | PixelForge App Backend |
| Updated | 2026-04-03 (실제 플러그인 출력 기반으로 재설계) |

---

## 🎯 Goals

1. **완전한 variant 커버**: 플러그인이 제공하는 모든 variant 조합 스타일 반영
2. **상태 처리**: state(rest/hover/press/disabled) → CSS pseudo-class / data-attribute
3. **block 레이아웃**: block=true → `width: 100%`, block=false → inline-flex
4. **자식 요소 매핑**: childStyles(아이콘, 텍스트) → 각 자식 컴포넌트 스타일 적용
5. **토큰 역매핑**: 플러그인의 hex 값 → 프로젝트 CSS 변수(설계 토큰)로 치환

---

## 📐 Data Structure

### 1️⃣ 플러그인이 전송하는 실제 구조

> 기준 파일: `SizeXlargeStateRestBlockTrue.node.json`

```typescript
// 플러그인 → 앱으로 전송되는 최상위 구조
interface PluginNodePayload {
  meta: NodeMeta;
  data: ComponentData;
}

interface NodeMeta {
  nodeId: string;           // "501:1588"
  nodeName: string;         // "size=xlarge, state=rest, block=true"
  nodeType: 'COMPONENT' | 'COMPONENT_SET' | 'FRAME' | 'GROUP';
  masterId: string | null;
  masterName: string | null;
  figmaFileId: string;
}

interface ComponentData {
  name: string;             // "Primary" — COMPONENT_SET 이름
  meta: NodeMeta;

  // 선택된 특정 variant의 flat CSS 스타일
  styles: CSSStyleMap;

  // 플러그인이 미리 생성한 코드 (참고용, 최종 생성 코드와 다름)
  html: string;
  htmlClass: string;
  htmlCss: string;
  jsx: string;              // 단일 variant 기준 JSX (상태 없음)

  detectedType: string;     // "button" | "input" | "dialog" | "card" | ...

  texts: {
    title: string;          // "Button"
    description: string;
    actions: string[];
    all: string[];
  };

  // 자식 요소별 스타일 (키: Figma 레이어 이름)
  childStyles: Record<string, CSSStyleMap>;
  // 예: { "search": {}, "Button": { "background-color": "var(--colors-gray-white)" }, "arrow-right": {} }

  // Radix UI props 제안 (참고용)
  radixProps: Record<string, string>;
  // 예: { "color": "blue", "size": "xlarge" }

  // variant 차원별 가능한 값 목록
  variantOptions: Record<string, string[]>;
  // 예: { "size": ["xlarge","large","medium","small","xsmall"], "state": ["rest","hover","press","disabled"], "block": ["false","true"] }

  // 모든 variant 조합의 스타일 (size × state × block)
  variants: VariantData[];

  // 원본 Figma API 노드 데이터
  fullNode: FigmaFullNode;
}

// flat CSS 스타일 맵 (플러그인이 케밥-케이스로 전달)
interface CSSStyleMap {
  'background-color'?: string;  // hex 값: "#188fff" (토큰 미바인딩 시)
  'border-radius'?: string;     // "8px"
  'display'?: string;           // "flex"
  'gap'?: string;               // "8px"
  'padding'?: string;           // "16px 24px 16px 24px"
  'opacity'?: string;           // "0.6" (disabled 상태)
  'width'?: string;             // "240px"
  'height'?: string;            // "56px"
  [key: string]: string | undefined;
}

// 하나의 variant 조합 데이터
interface VariantData {
  properties: Record<string, string>;
  // 예: { "size": "xlarge", "state": "rest", "block": "true" }
  styles: CSSStyleMap;
  childStyles: Record<string, CSSStyleMap>;
}
```

### 2️⃣ 실제 variant 데이터 분석 (Button 예시)

**size별 레이아웃 규칙**
| size | padding | gap | border-radius | 특이사항 |
|------|---------|-----|---------------|---------|
| xsmall | 6px 8px | 4px | 4px | — |
| small | 6px 12px | 4px | 4px | — |
| medium | 10px 16px | 4px | 4px | — |
| large | 12px 20px | 8px | 8px | — |
| xlarge | 16px 24px | 8px | 8px | 기준 variant |

**state별 색상 규칙**
| state | background-color | 텍스트 opacity |
|-------|-----------------|--------------|
| rest | #188fff | 1 |
| hover | #1e81f0 | 1 |
| press | #205dca | 1 |
| disabled | #5fb1ff | 0.6 |

**block 규칙**
| block | 효과 |
|-------|------|
| true | `width: 100%` (full-width) |
| false | 내용에 맞게 줄어듦 (inline-flex) |

### 3️⃣ 생성될 컴포넌트 구조

```typescript
interface GeneratedComponent {
  id: string;               // UUID
  projectId: string;
  name: string;             // "Button"
  detectedType: string;     // "button"

  // 생성된 TSX 코드
  code: {
    tsx: string;            // 전체 컴포넌트 소스
    propsInterface: string; // Props 인터페이스만 분리
    imports: string[];
  };

  // variant 메타
  variantOptions: Record<string, string[]>;

  // 분석 결과
  analysis: {
    tokensUsed: string[];         // 매핑된 CSS 변수 목록
    unmappedColors: string[];     // 토큰 미매핑 hex 값
    childElements: ChildElement[];
  };

  version: number;
  hash: string;             // 노드 정보 SHA-256
  createdAt: string;
  updatedAt: string;
}

interface ChildElement {
  figmaName: string;        // "search", "Button", "arrow-right"
  type: 'icon' | 'text' | 'group';
  defaultVisible: boolean;
  propName: string;         // React prop으로 노출될 이름: "icon", "children", "trailingIcon"
}
```

---

## 🏗️ Architecture

### 디렉토리 구조

```
src/lib/component-generator/
├── index.ts                      # 메인 엔진 진입점
├── types.ts                      # PluginNodePayload, GeneratedComponent 등
├── engine.ts                     # 생성 파이프라인 오케스트레이터
├── parsers/
│   ├── variant-parser.ts         # variantOptions + variants 배열 파싱
│   ├── child-parser.ts           # childStyles → ChildElement 추출
│   └── style-normalizer.ts       # CSSStyleMap → 앱 CSS 변수 치환
├── generators/
│   ├── factory.ts                # detectedType → 해당 Generator 선택
│   ├── button.ts                 # Button 생성 규칙 (size/state/block 처리)
│   ├── input.ts
│   ├── dialog.ts
│   └── base.ts                   # 공통 생성 유틸
├── mappers/
│   └── token-mapper.ts           # hex → CSS 변수 역매핑 테이블
├── validators/
│   ├── convention.ts             # 컨벤션 검증 (이름, 구조)
│   └── completeness.ts           # 필수 필드 존재 여부
└── utils/
    ├── code-formatter.ts
    └── hash.ts
```

### 생성 파이프라인

```
1. 플러그인 → POST /api/sync/components
   { nodes: PluginNodePayload[] }

2. 파싱 단계
   ├─ variant-parser: variantOptions + variants → VariantMatrix
   ├─ child-parser: childStyles → ChildElement[]
   └─ style-normalizer: hex → var(--*) 역매핑

3. 검증 단계
   ├─ convention: 이름 규칙 (PascalCase)
   └─ completeness: 필수 variant 조합 존재 여부

4. 생성 단계
   ├─ factory.ts: detectedType → 해당 Generator
   ├─ Props 인터페이스 생성 (variantOptions 기반)
   ├─ variant 스타일 맵 생성 (모든 조합)
   ├─ 자식 요소 렌더링 로직 생성
   └─ JSX 조합

5. 저장
   ├─ components 테이블 insert/update
   ├─ component_versions 이력
   └─ hash 중복 체크

6. 응답
   { components: GeneratedComponent[], warnings: [] }
```

---

## 🔌 API Design

### POST /api/sync/components

**Request**
```json
{
  "projectId": "proj_xxx",
  "nodes": [
    {
      "meta": {
        "nodeId": "501:1588",
        "nodeName": "size=xlarge, state=rest, block=true",
        "nodeType": "COMPONENT",
        "masterId": null,
        "masterName": null,
        "figmaFileId": "fileKey123"
      },
      "data": {
        "name": "Primary",
        "detectedType": "button",
        "styles": {
          "background-color": "#188fff",
          "border-radius": "8px",
          "padding": "16px 24px 16px 24px",
          "gap": "8px"
        },
        "childStyles": {
          "Button": { "background-color": "var(--colors-gray-white)" },
          "search": {},
          "arrow-right": {}
        },
        "variantOptions": {
          "size": ["xlarge", "large", "medium", "small", "xsmall"],
          "state": ["rest", "hover", "press", "disabled"],
          "block": ["false", "true"]
        },
        "variants": [ /* ... 40개 조합 ... */ ],
        "texts": { "title": "Button", "description": "", "actions": [], "all": ["Button"] }
      }
    }
  ]
}
```

**Response (성공)**
```json
{
  "success": true,
  "components": [
    {
      "id": "comp_xxx",
      "name": "Button",
      "detectedType": "button",
      "code": {
        "tsx": "export interface ButtonProps { ... }\nexport function Button(...) { ... }",
        "propsInterface": "export interface ButtonProps { size?: 'xlarge' | 'large' | 'medium' | 'small' | 'xsmall'; state?: 'rest' | 'hover' | 'press' | 'disabled'; block?: boolean; ... }",
        "imports": ["import React from 'react';"]
      },
      "variantOptions": {
        "size": ["xlarge", "large", "medium", "small", "xsmall"],
        "state": ["rest", "hover", "press", "disabled"],
        "block": ["false", "true"]
      },
      "analysis": {
        "tokensUsed": ["--colors-gray-white"],
        "unmappedColors": ["#188fff", "#1e81f0", "#205dca", "#5fb1ff"],
        "childElements": [
          { "figmaName": "search", "type": "icon", "defaultVisible": false, "propName": "leadingIcon" },
          { "figmaName": "Button", "type": "text", "defaultVisible": true, "propName": "children" },
          { "figmaName": "arrow-right", "type": "icon", "defaultVisible": false, "propName": "trailingIcon" }
        ]
      },
      "version": 1,
      "hash": "abc123..."
    }
  ],
  "warnings": [
    {
      "nodeId": "501:1588",
      "type": "unmapped_color",
      "message": "4개 hex 색상이 디자인 토큰과 매핑되지 않았습니다: #188fff, #1e81f0, #205dca, #5fb1ff"
    }
  ]
}
```

---

## 📝 Generator Implementation Pattern

### Button Generator (실제 데이터 기반)

```typescript
// generators/button.ts

export function generateButton(data: ComponentData): string {
  const { variantOptions, variants, childStyles, texts } = data;

  // 1. variant 스타일 맵 구성
  const styleMap = buildStyleMap(variants);

  // 2. 자식 요소 파싱
  const hasLeadingIcon = 'search' in childStyles;
  const hasTrailingIcon = 'arrow-right' in childStyles;
  const textLabel = texts.title || 'Button';

  // 3. Props 인터페이스
  const propsInterface = `
export interface ButtonProps {
  size?: ${variantOptions.size.map(s => `'${s}'`).join(' | ')};
  state?: ${variantOptions.state.map(s => `'${s}'`).join(' | ')};
  block?: boolean;
  children?: React.ReactNode;
  ${hasLeadingIcon ? "leadingIcon?: React.ReactNode;" : ""}
  ${hasTrailingIcon ? "trailingIcon?: React.ReactNode;" : ""}
  onClick?: () => void;
  className?: string;
}`.trim();

  // 4. JSX 생성
  return `
${propsInterface}

export function Button({
  size = 'medium',
  block = false,
  children = '${textLabel}',
  ${hasLeadingIcon ? "leadingIcon," : ""}
  ${hasTrailingIcon ? "trailingIcon," : ""}
  onClick,
  className,
  disabled,
  ...props
}: ButtonProps & { disabled?: boolean }) {
  return (
    <button
      style={{
        ...BUTTON_SIZE_STYLES[size],
        ...(block ? { width: '100%' } : {}),
      }}
      data-state={disabled ? 'disabled' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={className}
      {...props}
    >
      ${hasLeadingIcon ? "{leadingIcon && <span className=\"btn-icon btn-icon--lead\">{leadingIcon}</span>}" : ""}
      <span style={{ color: 'var(--colors-gray-white)' }}>{children}</span>
      ${hasTrailingIcon ? "{trailingIcon && <span className=\"btn-icon btn-icon--trail\">{trailingIcon}</span>}" : ""}
    </button>
  );
}

// variant 스타일 상수 (token-mapper가 hex → var(--*) 치환 후 주입)
const BUTTON_SIZE_STYLES = ${JSON.stringify(
    buildSizeStyles(variants),
    null,
    2
  )};
`.trim();
}

// variants 배열에서 size별 대표 스타일(rest 상태) 추출
function buildSizeStyles(variants: VariantData[]): Record<string, object> {
  const sizes: Record<string, object> = {};
  for (const v of variants) {
    if (v.properties.state === 'rest' && v.properties.block === 'false') {
      sizes[v.properties.size] = normalizeCSSMap(v.styles);
    }
  }
  return sizes;
}
```

### token-mapper (hex → CSS 변수 역매핑)

```typescript
// mappers/token-mapper.ts

// 프로젝트 디자인 토큰과 hex 값 매핑 테이블
// tokens.css 또는 DB tokens 테이블에서 동적 로드
const HEX_TO_TOKEN: Record<string, string> = {
  '#188fff': 'var(--color-brand-primary)',
  '#1e81f0': 'var(--color-brand-primary-hover)',
  '#205dca': 'var(--color-brand-primary-press)',
  '#5fb1ff': 'var(--color-brand-primary-disabled)',
  '#ffffff': 'var(--colors-gray-white)',
};

export function mapHexToToken(hex: string): string {
  return HEX_TO_TOKEN[hex.toLowerCase()] ?? hex;
}

export function normalizeCSSMap(styles: CSSStyleMap): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(styles)) {
    if (!value) continue;
    const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = key === 'background-color' ? mapHexToToken(value) : value;
  }
  return result;
}
```

---

## 🗄️ Database Schema

```sql
CREATE TABLE components (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),

  -- 식별
  name TEXT NOT NULL,                    -- "Button"
  detected_type TEXT NOT NULL,           -- "button"
  figma_node_id TEXT,                    -- "501:1588"
  figma_file_id TEXT,

  -- 생성된 코드
  tsx_code TEXT NOT NULL,
  props_interface TEXT NOT NULL,
  imports TEXT NOT NULL,                 -- JSON array

  -- variant 메타
  variant_options TEXT NOT NULL,         -- JSON: { size: [...], state: [...] }

  -- 분석
  tokens_used TEXT,                      -- JSON array
  unmapped_colors TEXT,                  -- JSON array (경고용)
  child_elements TEXT,                   -- JSON array

  -- 버전 관리
  version INTEGER DEFAULT 1,
  hash TEXT,                             -- SHA-256 of fullNode

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  UNIQUE(project_id, name, version)
);

CREATE TABLE component_versions (
  id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES components(id),
  version INTEGER NOT NULL,
  tsx_code TEXT NOT NULL,
  hash TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(component_id, version)
);
```

> **Note**: better-sqlite3 기반이므로 UUID → TEXT, JSONB → TEXT (JSON.stringify), TIMESTAMP → TEXT

---

## ✅ Validation Rules

```typescript
// validators/convention.ts

const RULES = {
  // 컴포넌트 이름: PascalCase
  componentName: /^[A-Z][a-zA-Z0-9]*$/,

  // detectedType 허용 목록
  allowedTypes: ['button', 'input', 'dialog', 'card', 'select', 'checkbox', 'radio', 'badge', 'tag'],

  // 필수 variant 차원 (버튼의 경우)
  button: {
    requiredDimensions: ['size', 'state'],
    requiredStates: ['rest', 'hover', 'press', 'disabled'],
  },
};

// validators/completeness.ts
// 모든 requiredStates가 variants 배열에 존재하는지 확인
export function validateVariantCompleteness(
  detectedType: string,
  variantOptions: Record<string, string[]>
): ValidationResult { ... }
```

---

## 🚀 Implementation Phases

### Phase 1: 파서 + 기본 생성 (우선)
- [ ] `PluginNodePayload` 타입 정의 (실제 JSON 기반)
- [ ] `variant-parser.ts`: variants 배열 → VariantMatrix
- [ ] `child-parser.ts`: childStyles → ChildElement[]
- [ ] `style-normalizer.ts`: CSSStyleMap → camelCase + hex 치환
- [ ] `token-mapper.ts`: hex ↔ CSS 변수 양방향 테이블
- [ ] `button.ts` generator: 40개 variant 커버 TSX 생성
- [ ] POST /api/sync/components 엔드포인트

### Phase 2: 추가 컴포넌트 + 저장
- [ ] Input, Select, Dialog generator
- [ ] DB 스키마 + Drizzle 마이그레이션
- [ ] 버전 관리 + hash 중복 체크
- [ ] 미매핑 컬러 경고 시스템

### Phase 3: UI + 검증
- [ ] 생성 결과 미리보기 (Interactive Sandbox 연동)
- [ ] convention / completeness 검증
- [ ] E2E 테스트

---

## 📋 Acceptance Criteria

- [ ] `PluginNodePayload` 인터페이스가 실제 플러그인 출력과 일치
- [ ] 40개 variant 조합을 모두 커버하는 Button TSX 생성
- [ ] `block=true` → `width: 100%`, `block=false` → auto
- [ ] `state=disabled` → `disabled` prop + opacity 처리
- [ ] 자식 요소(leadingIcon, children, trailingIcon) 선택적 렌더링
- [ ] 미매핑 hex → `warnings` 배열에 포함
- [ ] DB 저장 + 버전 이력
- [ ] 빌드/lint 통과

---

**작성**: 2026-04-03  
**상태**: Revised (실제 플러그인 JSON 출력 기반 재설계)
