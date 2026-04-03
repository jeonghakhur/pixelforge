# Design: Component Generator 시스템

_플러그인에서 받은 Figma 노드 정보를 React 컴포넌트로 자동 생성_

---

## 📌 Overview

| 항목 | 내용 |
|------|------|
| Feature | component-generator |
| Goal | Figma 컴포넌트 → React JSX 자동 생성 |
| Core Value | "누가 해도 같은 컴포넌트" 자동화 |
| Owner | PixelForge App Backend |

---

## 🎯 Goals

1. **자동화**: Figma 노드 정보만으로 React 코드 생성
2. **일관성**: 규칙 기반 생성 → 누가 해도 같은 결과
3. **확장성**: 새로운 컴포넌트 타입 추가 용이
4. **검증**: 생성 전 Figma Variables 컨벤션 검증

---

## 📐 Data Structure

### 1️⃣ ComponentNode (플러그인 → 앱)

```typescript
// 플러그인이 보낼 데이터 구조
interface ComponentNode {
  // 식별자
  id: string;                    // Figma node ID
  name: string;                  // 컴포넌트명 (예: "Button")
  type: 'component' | 'frame' | 'group' | 'shape' | 'text';
  
  // 구조
  parent?: ComponentNode;        // 부모 노드
  children?: ComponentNode[];    // 자식 노드들
  
  // 메타데이터
  isMainComponent: boolean;      // Figma 메인 컴포넌트 여부
  mainComponentId?: string;      // 링크된 메인 컴포넌트 ID
  
  // 속성 (Figma에서 추출)
  variant?: {
    [key: string]: string;       // 예: { size: 'lg', variant: 'primary' }
  };
  
  // 스타일 정보
  styles: {
    fills: StyleFill[];          // 배경색, 선 색상 등
    strokes: StyleStroke[];      // 테두리
    typography?: TypographyStyle; // 텍스트 스타일
    spacing?: SpacingStyle;       // 여백
    radius?: RadiusStyle;         // 모서리 반경
  };
  
  // 내용
  content?: {
    text?: string;               // 텍스트 내용
    placeholder?: string;        // 입력 필드 placeholder
  };
  
  // 추출 메타데이터
  extractedAt: string;           // ISO 8601
  source: {
    figmaFileKey: string;
    figmaFileId: string;
  };
}

interface StyleFill {
  type: 'solid' | 'gradient' | 'image';
  value: string;                 // Color token 예: 'color/primary/default'
  opacity?: number;              // 0-1
}

interface TypographyStyle {
  fontFamily: string;            // 토큰 예: 'font-family/sans'
  fontSize: string;              // 토큰 예: 'typography/sans/regular/md'
  fontWeight: string;
  lineHeight: string;            // 토큰 예: 'line-height/normal'
}
```

### 2️⃣ GeneratedComponent (앱이 생성)

```typescript
interface GeneratedComponent {
  // 메타데이터
  id: string;                    // UUID
  projectId: string;             // PixelForge 프로젝트
  name: string;                  // Button, Dialog 등
  type: 'button' | 'input' | 'dialog' | 'card' | ...;
  
  // 생성된 코드
  code: {
    jsx: string;                 // 생성된 React JSX
    props: PropDefinition[];      // Props 인터페이스
    imports: string[];           // 필요한 import들
  };
  
  // 분석 정보
  analysis: {
    tokensUsed: string[];        // 사용된 토큰 리스트
    dependencies: string[];      // 의존 컴포넌트
    accessibility: {
      ariaLabels: string[];
      keyboardSupport: boolean;
      wcagLevel: 'A' | 'AA' | 'AAA';
    };
  };
  
  // 버전 관리
  version: number;               // 1, 2, 3, ...
  hash: string;                  // 노드 정보 SHA-256
  
  // 타임스탬프
  createdAt: string;
  updatedAt: string;
}

interface PropDefinition {
  name: string;
  type: string;                  // 'string' | 'boolean' | ...
  required: boolean;
  default?: any;
  description?: string;
  enum?: string[];               // variant 값들
}
```

---

## 🏗️ Architecture

### 디렉토리 구조

```
app/src/lib/component-generator/
├── index.ts                    # 메인 엔진 진입점
├── types.ts                    # 타입 정의 (ComponentNode, GeneratedComponent)
├── engine.ts                   # 생성 로직 메인
├── validators/
│   ├── figma-convention.ts     # Figma Variables 컨벤션 검증
│   └── accessibility.ts        # A11y 검증
├── generators/
│   ├── button.ts               # Button 생성 규칙
│   ├── input.ts                # Input 생성 규칙
│   ├── dialog.ts               # Dialog 생성 규칙
│   ├── card.ts                 # Card 생성 규칙
│   └── factory.ts              # 타입별 제너레이터 선택
├── utils/
│   ├── token-mapper.ts         # Figma token → CSS variable
│   ├── code-formatter.ts       # 코드 포매팅
│   └── props-extractor.ts      # Props 자동 추출
└── templates/                  # JSX 템플릿
    ├── button.template.tsx
    ├── input.template.tsx
    └── ...
```

### 생성 흐름

```
1. 플러그인에서 노드 정보 전송
   POST /api/sync/components
   ← { nodes: ComponentNode[] }

2. 앱 수신 & 검증
   ├─ 컨벤션 검증 (토큰 네이밍)
   ├─ A11y 검증
   └─ 에러 → 클라이언트에 응답

3. 컴포넌트 분석
   ├─ 타입 판단 (Button? Dialog?)
   ├─ Props 추출
   └─ 토큰 참조 추출

4. 코드 생성
   ├─ 해당 Generator 선택
   ├─ Props 기반 코드 생성
   └─ Imports 자동 추가

5. 결과 저장
   ├─ DB에 저장
   ├─ 버전 관리
   └─ 해시 계산 (중복 방지)

6. 클라이언트에 응답
   → { generatedCode, components: [], warnings: [] }
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
      "id": "123:456",
      "name": "Button",
      "type": "component",
      "isMainComponent": true,
      "variant": {
        "size": "lg",
        "variant": "primary"
      },
      "styles": {
        "fills": [
          {
            "type": "solid",
            "value": "color/primary/default"
          }
        ]
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
      "type": "button",
      "code": {
        "jsx": "export function Button({ variant = 'primary', size = 'md', children }) { ... }",
        "props": [
          {
            "name": "variant",
            "type": "'primary' | 'secondary'",
            "required": false,
            "default": "primary"
          }
        ],
        "imports": ["import { Button } from '@/components/base/Button';"]
      },
      "version": 1,
      "hash": "abc123..."
    }
  ],
  "warnings": [
    {
      "nodeId": "789:012",
      "message": "Fill이 token 형식이 아닙니다. 하드코딩된 색상: #0066FF"
    }
  ]
}
```

**Response (검증 실패)**
```json
{
  "success": false,
  "errors": [
    {
      "nodeId": "123:456",
      "type": "convention_error",
      "message": "컴포넌트명이 PascalCase가 아닙니다: 'myButton' → 'MyButton'"
    }
  ]
}
```

---

## 🗄️ Database Schema

### components 테이블

```sql
CREATE TABLE components (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  
  -- 메타데이터
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,           -- button, input, dialog, ...
  description TEXT,
  
  -- 생성된 코드
  jsx_code TEXT NOT NULL,
  props_definition JSONB NOT NULL,
  imports JSONB NOT NULL,
  
  -- 분석
  tokens_used JSONB,                   -- ['color/primary/default', ...]
  dependencies JSONB,                  -- ['BaseButton', ...]
  accessibility_score NUMERIC(3, 2),   -- 0.00 - 1.00
  
  -- 출처
  figma_node_id VARCHAR(255),
  figma_file_key VARCHAR(255),
  figma_extracted_at TIMESTAMP,
  
  -- 버전 관리
  version INTEGER DEFAULT 1,
  hash VARCHAR(64),                    -- SHA-256
  
  -- 타임스탬프
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- 인덱스
  UNIQUE(project_id, name, version),
  INDEX idx_project_type (project_id, type)
);

CREATE TABLE component_versions (
  id UUID PRIMARY KEY,
  component_id UUID NOT NULL REFERENCES components(id),
  version INTEGER NOT NULL,
  jsx_code TEXT NOT NULL,
  props_definition JSONB,
  hash VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(component_id, version)
);
```

---

## 📝 Generator Implementation Pattern

### Button Generator 예시

```typescript
// generators/button.ts
interface ButtonGeneratorInput {
  node: ComponentNode;
  variant?: string;
  size?: string;
}

export function generateButton(input: ButtonGeneratorInput): GeneratedComponent {
  const { node, variant = 'primary', size = 'md' } = input;
  
  // 1. Props 추출
  const props = extractProps(node);
  
  // 2. 토큰 매핑
  const colorToken = mapTokenFromFill(node.styles.fills[0]);
  
  // 3. JSX 생성
  const jsx = `
    export interface ButtonProps {
      variant?: 'primary' | 'secondary';
      size?: 'sm' | 'md' | 'lg';
      children: React.ReactNode;
      onClick?: () => void;
      disabled?: boolean;
    }
    
    export function Button({
      variant = 'primary',
      size = 'md',
      children,
      ...props
    }: ButtonProps) {
      const style = BUTTON_VARIANTS[variant];
      const sizeStyle = BUTTON_SIZES[size];
      
      return (
        <button
          style={{
            backgroundColor: \`var(--\${style.bg})\`,
            color: \`var(--\${style.text})\`,
            padding: \`var(--\${sizeStyle.padding})\`,
          }}
          {...props}
        >
          {children}
        </button>
      );
    }
  `;
  
  return {
    id: generateId(),
    name: 'Button',
    type: 'button',
    code: {
      jsx: jsx.trim(),
      props: [
        { name: 'variant', type: "'primary' | 'secondary'", required: false, default: 'primary' },
        { name: 'size', type: "'sm' | 'md' | 'lg'", required: false, default: 'md' },
        { name: 'children', type: 'React.ReactNode', required: true },
      ],
      imports: ['import React from "react";'],
    },
    analysis: {
      tokensUsed: [colorToken],
      dependencies: [],
      accessibility: {
        ariaLabels: [],
        keyboardSupport: true,
        wcagLevel: 'AA',
      },
    },
    version: 1,
    hash: calculateHash(node),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
```

---

## ✅ Validation Rules

### Figma Convention 검증

```typescript
interface ConventionValidation {
  // 컴포넌트명
  componentName: {
    pattern: /^[A-Z][a-zA-Z0-9]*$/, // PascalCase
    message: '컴포넌트명은 PascalCase여야 합니다'
  },
  
  // 토큰 사용
  tokenFormat: {
    pattern: /^[a-z]+(-[a-z]+)*\/[a-z]+(-[a-z]+)*\/?[a-z]+(-[a-z]+)*$/,
    message: '토큰은 kebab-case/형식이어야 합니다: color/primary/default'
  },
  
  // Props 네이밍
  propsNaming: {
    pattern: /^[a-z][a-zA-Z0-9]*$/,  // camelCase
    message: 'Props는 camelCase여야 합니다'
  },
}
```

---

## 📊 Example Flow

### 시나리오: Button 컴포넌트 생성

```
1️⃣ Figma에서 Button 컴포넌트 추출
   - 이름: "Button"
   - Variant: { size: 'lg', variant: 'primary' }
   - Fill: color/primary/default (토큰)
   - Text: "Click me"

2️⃣ 플러그인 → 앱
   POST /api/sync/components
   {
     "nodes": [{
       "name": "Button",
       "variant": { "size": "lg", "variant": "primary" },
       "styles": {
         "fills": [{ "value": "color/primary/default" }]
       }
     }]
   }

3️⃣ 앱 검증
   ✅ 컴포넌트명 PascalCase OK
   ✅ 토큰 형식 OK
   ✅ Variant 형식 OK

4️⃣ 코드 생성
   Factory → Button Generator
   JSX 템플릿 + Props + Tokens
   
   결과:
   ```typescript
   export function Button({ variant = 'primary', size = 'lg', children }) {
     return (
       <button
         style={{
           backgroundColor: 'var(--color/primary/default)',
           padding: 'var(--spacing/md) var(--spacing/lg)',
         }}
       >
         {children}
       </button>
     );
   }
   ```

5️⃣ DB 저장
   components 테이블에 저장
   버전: 1, 해시: abc123...

6️⃣ 클라이언트 응답
   {
     "components": [{
       "id": "comp_xxx",
       "name": "Button",
       "jsx": "...",
       "version": 1
     }]
   }
```

---

## 🚀 Implementation Phases

### Phase 1: 기본 구조 (Week 1)
- [ ] ComponentNode 타입 정의
- [ ] /api/sync/components 엔드포인트
- [ ] Button, Input 제너레이터
- [ ] 기본 검증 로직

### Phase 2: 고급 기능 (Week 2-3)
- [ ] Dialog, Select 제너레이터
- [ ] Props 자동 추출
- [ ] A11y 검증
- [ ] 버전 관리

### Phase 3: 최적화 (Week 4)
- [ ] 캐싱 (중복 방지)
- [ ] 성능 테스트
- [ ] 문서화
- [ ] E2E 테스트

---

## 📋 Acceptance Criteria

- [ ] ComponentNode 구조 정의 및 검증
- [ ] /api/sync/components 동작
- [ ] 5가지 기본 컴포넌트 생성 가능
- [ ] 토큰 자동 매핑
- [ ] Props 자동 추출
- [ ] 에러 핸들링 완벽
- [ ] DB 스키마 구현
- [ ] 테스트 커버리지 80% 이상

---

**작성**: 2026-04-03
**상태**: Draft (설계 검토 중)
