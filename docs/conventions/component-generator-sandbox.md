# 컴포넌트 생성기 — Sandbox 호환 TSX 출력 규칙

생성기가 만드는 `tsx` 문자열은 DB에 저장되고, `ComponentGuideClient.tsx`의
`parseSandboxProps(tsx)`가 런타임에 파싱해 Property 패널 컨트롤을 자동 생성한다.

파서가 정확히 파싱하려면 생성 TSX가 아래 규칙을 모두 따라야 한다.

---

## 1. union type prop (드롭다운 컨트롤)

### 요구 사항

1. **`export type` 선언에 세미콜론 필수**
2. **인터페이스 프로퍼티에 세미콜론 필수**
3. **인터페이스의 타입명이 export type 이름과 일치해야 함**

```tsx
// ✅ 올바른 패턴
export type AvatarImageShape = 'square' | 'circle';   // ← 세미콜론 필수
export type AvatarImageSize = 'sm' | 'md' | 'lg';     // ← 세미콜론 필수

export interface AvatarImageProps ... {
  shape?: AvatarImageShape;   // ← 세미콜론 필수, 타입명 일치
  size?: AvatarImageSize;     // ← 세미콜론 필수, 타입명 일치
}

// ❌ 파싱 실패 패턴
export type AvatarImageShape = 'square' | 'circle'    // 세미콜론 없음 → 다음 ;까지 전부 포함
shape?: 'square' | 'circle'                           // inline union → 타입명 매핑 불가
shape?: AvatarImageShape                              // 인터페이스 세미콜론 없음 → 매핑 실패
```

### 파서 동작

```
export type XxxShape = 'a' | 'b';  →  typeDecls['XxxShape'] = ['a', 'b']
shape?: XxxShape;                  →  unionMap['shape'] = ['a', 'b']
→ 드롭다운 컨트롤 생성
```

---

## 2. string prop (텍스트 입력 컨트롤)

### 요구 사항

1. **인터페이스 프로퍼티에 세미콜론 필수**
2. **타입이 정확히 `string`이어야 함** (리터럴 유니온 아님)
3. **destructuring 기본값 없이 선언** (기본값 있으면 boolean/union 분기가 우선)

```tsx
// ✅ 올바른 패턴
export interface AvatarImageProps ... {
  src?: string;           // ← 세미콜론 필수
  displayName?: string;   // ← 세미콜론 필수
  jobTitle?: string;      // ← 세미콜론 필수
}

// destructuring에서는 기본값 없이
({ src, displayName, jobTitle, shape = 'square', ... }, ref) => { ... }

// ❌ 파싱 실패 패턴
src?: string              // 세미콜론 없음 → 파싱 안 됨
src?: 'default'           // 리터럴 → string으로 인식 안 됨
```

### 파서 동작

```
인터페이스에서 (\w+)\??\s*:\s*string;  →  StringPropDef 생성
→ 텍스트 입력 컨트롤 생성
```

---

## 3. boolean prop (토글 컨트롤)

### 요구 사항

1. **destructuring에서 기본값이 정확히 `true` 또는 `false`**
2. **인터페이스에 `boolean` 타입 선언 필요**

```tsx
// ✅ 올바른 패턴
export interface XxxProps ... {
  iconOnly?: boolean;
}

({ iconOnly = false, ... }, ref) => { ... }
//           ^^^^^ 'false' 또는 'true' 문자열 비교
```

---

## 4. node prop (ReactNode 입력)

```tsx
// ✅ 올바른 패턴
export interface XxxProps ... {
  iconLeading?: ReactNode;   // ← 세미콜론 필수
}
```

---

## 5. 자동 제외 목록

파서가 항상 건너뛰는 prop: `disabled`, `children`, `className`, `type`

---

## 6. Sandbox 컨트롤 생성 흐름

```
generateXxx() → tsx 문자열 → DB 저장
                                ↓
ComponentGuideClient 마운트
  ↓
parseSandboxProps(tsx)
  ├─ parseAllUnionTypes()    → export type 선언 수집
  ├─ parseDestructuredProps() → 기본값 있는 prop 목록
  ├─ (인터페이스에서) string  → StringPropDef
  ├─ (인터페이스에서) ReactNode → NodePropDef
  └─ SandboxPropDef[] 반환
         ↓
  unionProps  → 드롭다운 select
  boolProps   → 체크박스
  nodeProps   → ReactNode 입력 (미구현 시 무시)
  stringProps → 텍스트 input
```

---

## 7. 생성기 체크리스트

새 생성기를 만들 때 아래 항목을 반드시 확인:

- [ ] `export type XxxProp = 'a' | 'b';` — 세미콜론 포함
- [ ] 인터페이스 모든 프로퍼티 — 세미콜론 포함 (`prop?: Type;`)
- [ ] string prop은 인터페이스에 `prop?: string;` 형식으로 선언
- [ ] boolean prop은 destructuring 기본값으로 `prop = false` / `prop = true`
- [ ] HTML 표준 속성과 이름 충돌 확인 (`name`, `role`, `type`, `id` 등 — 충돌 시 rename)
- [ ] `Omit<React.HTMLAttributes<...>, '충돌prop'>` 적용
- [ ] 생성 후 브라우저에서 Property 패널 컨트롤 노출 확인

---

## 8. 알려진 HTML attribute 충돌 prop 이름

| 피해야 할 이름 | HTML 의미 | 권장 대안 |
|--------------|-----------|-----------|
| `name` | input/form name | `displayName`, `label` |
| `role` | ARIA role | `jobTitle`, `subtitle`, `caption` |
| `type` | input type / button type | `variant`, `kind` |
| `id` | DOM id | 사용 자제 |
| `style` | inline style | 생성기에서 금지 |

---

## 참고 파일

- 파서 구현: `src/app/(main)/(ide)/components/[name]/ComponentGuideClient.tsx` — `parseSandboxProps()`
- 기존 생성기 참고: `src/lib/component-generator/generators/avatar/index.ts`
