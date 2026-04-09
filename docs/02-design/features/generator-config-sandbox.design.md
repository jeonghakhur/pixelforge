# Design: Generator Config 설정화 + Sandbox 범용화

> Plan 참조: `docs/01-plan/features/generator-config-sandbox.plan.md`

---

## 1. 아키텍처 개요

### 1-1. Before → After

```
Before:
  css-var-mapper.ts   ← SEMANTIC_MAP 하드코딩 9개
  css-generator.ts    ← COLOR_ABBREV 2개, paletteKeywords 3개, styleTypePassthrough 3개
  ComponentGuideClient ← ButtonSandbox (button 전용)

After:
  appSettings DB      ← 4개 설정 키 (JSON)
  generator-config.ts ← DB에서 로드 + 캐시
  css-var-mapper.ts   ← getSemanticMap() 호출
  css-generator.ts    ← getColorAbbrev(), getStyleTypePassthrough(), getPaletteKeywords() 호출
  Settings/generator  ← 설정 편집 UI
  ComponentSandbox    ← 모든 컴포넌트 지원
```

### 1-2. 영향 범위

| 파일 | 변경 유형 |
|------|----------|
| `src/lib/actions/generator-config.ts` | 신규 |
| `src/lib/component-generator/css-var-mapper.ts` | 수정 (하드코딩 → DB 연동) |
| `src/lib/tokens/css-generator.ts` | 수정 (하드코딩 → DB 연동) |
| `src/app/(ide)/settings/page.tsx` | 수정 (generator 탭 추가) |
| `src/app/(ide)/settings/page.module.scss` | 수정 (generator 탭 스타일) |
| `src/app/(ide)/components/[name]/ComponentGuideClient.tsx` | 수정 (sandbox 범용화) |

---

## 2. DB 설계

기존 `appSettings` 테이블 활용 (스키마 변경 없음):

```typescript
// 이미 존재 — src/lib/db/schema.ts:218
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
```

### 2-1. 설정 키 정의

| key | value 타입 | 기본값 | 용도 |
|-----|-----------|-------|------|
| `generator.semanticMap` | `Record<string, string>` JSON | 현재 SEMANTIC_MAP 9개 | Figma primitive → 프로젝트 시맨틱 토큰 매핑 |
| `generator.colorAbbrev` | `Record<string, string>` JSON | `{"background":"bg","foreground":"fg"}` | 색상 그룹 약어 |
| `generator.styleTypePassthrough` | `string[]` JSON | `["shadow","gradient","blur"]` | Figma 이름 직접 사용 타입 |
| `generator.paletteKeywords` | `string[]` JSON | `["white","black","transparent"]` | Primitive 판별 키워드 |

---

## 3. Server Actions

### 3-1. `src/lib/actions/generator-config.ts`

```typescript
'use server';

import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// ── 타입 ──
export interface GeneratorConfig {
  semanticMap: Record<string, string>;
  colorAbbrev: Record<string, string>;
  styleTypePassthrough: string[];
  paletteKeywords: string[];
}

// ── 기본값 ──
const DEFAULTS: GeneratorConfig = {
  semanticMap: {
    'colors-gray-white': 'bg-elevated',
    'colors-gray-50': 'bg-surface',
    'colors-gray-100': 'glass-bg',
    'colors-gray-200': 'glass-border',
    'colors-gray-950': 'bg-body',
    'colors-gray-900': 'text-primary',
    'colors-gray-700': 'text-secondary',
    'colors-gray-500': 'text-muted',
    'colors-gray-300': 'border-color',
  },
  colorAbbrev: { background: 'bg', foreground: 'fg' },
  styleTypePassthrough: ['shadow', 'gradient', 'blur'],
  paletteKeywords: ['white', 'black', 'transparent'],
};

const CONFIG_KEYS: (keyof GeneratorConfig)[] = [
  'semanticMap', 'colorAbbrev', 'styleTypePassthrough', 'paletteKeywords',
];

// ── 조회 (개별) ──
export async function getGeneratorConfigValue<K extends keyof GeneratorConfig>(
  key: K,
): Promise<GeneratorConfig[K]> {
  const row = db.select().from(appSettings)
    .where(eq(appSettings.key, `generator.${key}`)).get();
  if (!row) return DEFAULTS[key];
  try { return JSON.parse(row.value); }
  catch { return DEFAULTS[key]; }
}

// ── 조회 (전체) ──
export async function getGeneratorConfig(): Promise<GeneratorConfig> {
  const config = { ...DEFAULTS };
  for (const key of CONFIG_KEYS) {
    config[key] = await getGeneratorConfigValue(key) as never;
  }
  return config;
}

// ── 저장 ──
export async function saveGeneratorConfigValue(
  key: keyof GeneratorConfig,
  value: unknown,
): Promise<{ error?: string }> {
  const dbKey = `generator.${key}`;
  const json = JSON.stringify(value);
  const existing = db.select().from(appSettings)
    .where(eq(appSettings.key, dbKey)).get();
  if (existing) {
    db.update(appSettings).set({ value: json })
      .where(eq(appSettings.key, dbKey)).run();
  } else {
    db.insert(appSettings).values({ key: dbKey, value: json }).run();
  }
  // 캐시 무효화
  invalidateGeneratorConfigCache();
  return {};
}

// ── 캐시 (동기 접근용) ──
let _cache: GeneratorConfig | null = null;

export function getGeneratorConfigSync(): GeneratorConfig {
  if (_cache) return _cache;
  const config = { ...DEFAULTS };
  for (const key of CONFIG_KEYS) {
    const row = db.select().from(appSettings)
      .where(eq(appSettings.key, `generator.${key}`)).get();
    if (row) {
      try { config[key] = JSON.parse(row.value) as never; }
      catch { /* use default */ }
    }
  }
  _cache = config;
  return config;
}

export function invalidateGeneratorConfigCache(): void {
  _cache = null;
}
```

### 3-2. 동기 접근이 필요한 이유

`css-var-mapper.ts`의 `mapCssValue()`와 `css-generator.ts`의 `toVarName()`은 **동기 함수**입니다. Server Action은 async지만, 이 함수들은 컴포넌트 생성 파이프라인 내부에서 동기적으로 호출됩니다. 따라서 `getGeneratorConfigSync()`로 캐시에서 동기 접근합니다.

---

## 4. css-var-mapper.ts 수정

### 4-1. SEMANTIC_MAP → DB 연동

```typescript
// Before:
const SEMANTIC_MAP: Record<string, string> = { /* 하드코딩 */ };

// After:
import { getGeneratorConfigSync } from '@/lib/actions/generator-config';

function getSemanticMap(): Record<string, string> {
  return getGeneratorConfigSync().semanticMap;
}

export function mapCssValue(value: string): string {
  return value.replace(/var\(--([^)]+)\)/g, (_, varName: string) => {
    const semanticMap = getSemanticMap();
    if (semanticMap[varName]) {
      return `var(--${semanticMap[varName]})`;
    }
    // ... 나머지 동일
  });
}
```

---

## 5. css-generator.ts 수정

### 5-1. COLOR_ABBREV → DB 연동

```typescript
// Before:
const COLOR_ABBREV: Record<string, string> = { background: 'bg', foreground: 'fg' };

// After:
import { getGeneratorConfigSync } from '@/lib/actions/generator-config';

function getColorAbbrev(): Record<string, string> {
  return getGeneratorConfigSync().colorAbbrev;
}
```

`deduplicateColorSlug()`과 `colorSlugToVarName()`에서 `COLOR_ABBREV` → `getColorAbbrev()` 호출로 변경.

### 5-2. styleTypePassthrough → DB 연동

```typescript
// Before:
if (prefix === 'shadow' || prefix === 'gradient' || prefix === 'blur') {

// After:
const passthrough = getGeneratorConfigSync().styleTypePassthrough;
if (passthrough.includes(prefix)) {
```

### 5-3. paletteKeywords → DB 연동

```typescript
// Before:
const isPalette = /^\d+$/.test(lastPart) || ['white', 'black', 'transparent'].includes(lastPart);

// After:
const keywords = getGeneratorConfigSync().paletteKeywords;
const isPalette = /^\d+$/.test(lastPart) || keywords.includes(lastPart);
```

---

## 6. Settings UI — Generator 탭

### 6-1. 탭 추가

```typescript
// settings/page.tsx
type SettingsTab = 'general' | 'account' | 'team' | 'figma' | 'generator';

// 탭 아이콘: solar:settings-minimalistic-linear
```

### 6-2. UI 구성

기존 Settings 패턴(Card + formGroup)을 따름:

```
┌─ Generator Settings ───────────────────────────────┐
│                                                     │
│ ── Semantic Map ──────────────────────────────────  │
│ Figma primitive 색상을 프로젝트 시맨틱 토큰으로 변환  │
│                                                     │
│ ┌──────────────────┬──────────────────┬───┐         │
│ │ Figma Variable   │ Project Token    │   │         │
│ ├──────────────────┼──────────────────┼───┤         │
│ │ colors-gray-900  │ text-primary     │ x │         │
│ │ colors-gray-700  │ text-secondary   │ x │         │
│ │ [input]          │ [input]          │ + │         │
│ └──────────────────┴──────────────────┴───┘         │
│                                          [Save]     │
│                                                     │
│ ── Color Abbreviations ───────────────────────────  │
│ 색상 그룹 이름의 약어 매핑 (slug 중복 제거용)        │
│                                                     │
│ ┌──────────────────┬──────────────────┬───┐         │
│ │ Full Name        │ Abbreviation     │   │         │
│ ├──────────────────┼──────────────────┼───┤         │
│ │ background       │ bg               │ x │         │
│ │ foreground       │ fg               │ x │         │
│ │ [input]          │ [input]          │ + │         │
│ └──────────────────┴──────────────────┴───┘         │
│                                          [Save]     │
│                                                     │
│ ── Style Type (Direct Name) ──────────────────────  │
│ Figma 변수명을 그대로 CSS 변수명으로 사용할 타입      │
│                                                     │
│ [x] shadow  [x] gradient  [x] blur  [+ Add]        │
│                                          [Save]     │
│                                                     │
│ ── Palette Keywords ──────────────────────────────  │
│ Primitive 색상 판별 키워드 (숫자 외 추가)            │
│                                                     │
│ [white] [black] [transparent] [+ Add]               │
│                                          [Save]     │
└─────────────────────────────────────────────────────┘
```

### 6-3. 상태 관리

```typescript
// 각 섹션별 독립 state + save 버튼
const [semanticMap, setSemanticMap] = useState<Record<string, string>>({});
const [colorAbbrev, setColorAbbrev] = useState<Record<string, string>>({});
const [passthrough, setPassthrough] = useState<string[]>([]);
const [keywords, setKeywords] = useState<string[]>([]);

// useEffect로 초기 로드
useEffect(() => {
  getGeneratorConfig().then(config => {
    setSemanticMap(config.semanticMap);
    setColorAbbrev(config.colorAbbrev);
    setPassthrough(config.styleTypePassthrough);
    setKeywords(config.paletteKeywords);
  });
}, []);
```

### 6-4. 저장 흐름

```
사용자 편집 → [Save] 클릭 → saveGeneratorConfigValue() → DB 업데이트
                                                         → 캐시 무효화
                                                         → Toast 성공 알림
```

---

## 7. Sandbox 범용화

### 7-1. Element 자동 감지

```typescript
// ComponentGuideClient.tsx에 추가
function parseElementType(tsx: string): string {
  // forwardRef<HTMLButtonElement → 'button'
  const match = tsx.match(/forwardRef<HTML(\w+)Element/);
  if (!match) return 'div';
  const tag = match[1].toLowerCase();
  // HTMLDivElement → div, HTMLButtonElement → button, ...
  const TAG_MAP: Record<string, string> = {
    div: 'div', button: 'button', input: 'input',
    anchor: 'a', span: 'span', heading: 'h2',
  };
  return TAG_MAP[tag] ?? 'div';
}
```

### 7-2. ButtonSandbox → ComponentSandbox 리네이밍

변경 사항:
1. 함수명 `ButtonSandbox` → `ComponentSandbox`
2. `element` prop 추가 또는 TSX에서 자동 감지
3. iframe HTML에서 `<button>` → `<${element}>`

```typescript
function ComponentSandbox({ name, css, tsx }: {
  name: string;
  css: string | null;
  tsx: string | null;
}) {
  const element = parseElementType(tsx ?? '');
  // ... (기존 로직 동일)

  // iframe HTML 생성
  const buildIframeHtml = useCallback(() => {
    // ...
    const selfClosing = ['input', 'img', 'hr', 'br'].includes(element);
    const typeAttr = element === 'button' ? ' type="button"' : '';
    const body = selfClosing
      ? `<${element}${typeAttr} class="root" ${attrs} />`
      : `<${element}${typeAttr} class="root" ${attrs}>${childrenText || name}</${element}>`;
    // ...
  }, [/* deps */]);
}
```

### 7-3. detectedType 분기 제거

```typescript
// Before:
{detectedType === 'button' ? (
  <ButtonSandbox name={name} css={css} tsx={tsx} />
) : (
  <div className={styles.sandboxBg}>
    <div className={styles.sandboxCanvas}>
      <p className={styles.sandboxPlaceholder}>...</p>
    </div>
  </div>
)}

// After:
{(css || tsx) ? (
  <ComponentSandbox name={name} css={css} tsx={tsx} />
) : (
  <div className={styles.sandboxBg}>
    <div className={styles.sandboxCanvas}>
      <p className={styles.sandboxPlaceholder}>
        컴포넌트 데이터가 없습니다 — 플러그인에서 데이터를 전송해주세요.
      </p>
    </div>
  </div>
)}
```

---

## 8. 구현 순서

| Phase | 작업 | 파일 | 예상 |
|-------|------|------|------|
| **1** | Server Action: generator-config CRUD + 캐시 | `lib/actions/generator-config.ts` | 신규 |
| **2** | css-var-mapper 설정 연동 | `css-var-mapper.ts` | SEMANTIC_MAP → getSemanticMap() |
| **3** | css-generator 설정 연동 | `css-generator.ts` | COLOR_ABBREV, passthrough, keywords |
| **4** | Settings UI: Generator 탭 | `settings/page.tsx`, `page.module.scss` | 탭 추가 + 4개 섹션 |
| **5** | Sandbox 범용화 | `ComponentGuideClient.tsx` | ButtonSandbox → ComponentSandbox |
| **6** | 빌드 + 검증 | - | npm run build |

---

## 9. 완료 기준

- [ ] `generator-config.ts`에서 4개 키 CRUD + 캐시 동작
- [ ] `css-var-mapper.ts`에서 SEMANTIC_MAP 하드코딩 제거, DB 설정 사용
- [ ] `css-generator.ts`에서 COLOR_ABBREV, passthrough, keywords 하드코딩 제거
- [ ] Settings > Generator 탭에서 4개 설정 편집 + 저장 동작
- [ ] Sandbox가 모든 detectedType에서 렌더링
- [ ] iframe 내부 element가 TSX에서 자동 감지
- [ ] `npm run build` 성공
