# Design: db — 공통 파이프라인 + UI/UX 재설계

## 0. 현재 UI 문제 진단

### 현재 메인 페이지 구조 (문제)

```
[메인 페이지]
  ├── Step 1: Figma URL 입력  ← 실제 4순위인데 최상단 메인
  │     └── "또는"
  │           └── JSON 붙여넣기  ← 2·3순위가 묻힘
  └── Step 2: 토큰 타입 선택

[토큰 세부 페이지]
  ├── 헤더 (마지막 추출 시각)
  ├── 토큰 그리드
  ├── JSON Import (collapsed, 구석에 위치)
  └── 디자인 비교 (스크린샷 있을 때만)
```

### 방향성과의 괴리

| 항목 | 현재 | 목표 |
|------|------|------|
| 1순위 플러그인 | 메인 페이지 없음 | 연결 상태 + 마지막 sync 최상단 |
| 2순위 JSON 파일 | URL 아래 부가 옵션 | 명확한 진입점 |
| 3순위 JSON 붙여넣기 | JSON 파일과 혼재 | 분리된 탭/토글 |
| 4순위 Figma URL | 최상단 메인 입력 | 고급/수동 섹션으로 강등 |

---

## 1. 공통 파이프라인 아키텍처

어떤 방식으로 토큰이 들어와도 동일한 후처리 파이프라인을 통과한다.

```
┌─────────────────────────────────────────────────────────────┐
│                    Token Ingestion Layer                     │
│                                                              │
│  1순위: Plugin Sync          POST /api/sync/tokens           │
│  2순위: JSON File Upload     Server Action (importFromJson)  │
│  3순위: JSON Paste           Server Action (importFromJson)  │
│  4순위: Figma URL            Server Action (extractTokens)   │
└──────────────────────┬──────────────────────────────────────┘
                       │ raw data (각 방식별 포맷 다름)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               Token Normalization Layer (신규)               │
│                                                              │
│  normalizeToTokenRows(source, rawData)                       │
│    → NormalizedToken[] { type, name, value, mode, ... }      │
│                                                              │
│  - Plugin payload → parseVariablesPayload()                  │
│  - JSON import    → parsePluginJson() (기존 재사용)           │
│  - Figma URL      → extractFromVariables() (기존 재사용)      │
└──────────────────────┬──────────────────────────────────────┘
                       │ NormalizedToken[]
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               Token Processing Pipeline (신규)               │
│                                                              │
│  Step 1: upsertTokens(projectId, tokens)                     │
│            → DELETE source='variables' 기존 토큰             │
│            → INSERT 새 토큰                                  │
│                                                              │
│  Step 2: computeDiff(prevSnapshot, newTokens)                │
│            → { added[], removed[], changed[], changedTypes[] }│
│                                                              │
│  Step 3: createSnapshot(projectId, tokens, diff)             │
│            → token_snapshots INSERT                          │
│            → tokenCounts = { color: N, spacing: N, ... }     │
│                                                              │
│  Step 4: regenerateCSS(projectId)                            │
│            → design-tokens/tokens.css 갱신                   │
│                                                              │
│  Step 5: triggerScreenshots(projectId, changedTypes)  [async]│
│            → captureTokenPageScreenshot(type) × N            │
│            → captureFigmaFrame(type, key, nodeId) × N        │
└──────────────────────┬──────────────────────────────────────┘
                       │ PipelineResult
                       ▼
                { version, diff, tokenCounts, screenshotQueued }
```

### 파이프라인 함수 시그니처

```typescript
// src/lib/tokens/pipeline.ts  (신규)

export interface PipelineResult {
  version: number;
  tokenCounts: Record<string, number>;
  diff: {
    added: string[];
    removed: string[];
    changed: { name: string; from: string; to: string }[];
    changedTypes: string[];  // 스크린샷 트리거용
  };
  screenshotQueued: boolean;
}

export async function runTokenPipeline(
  projectId: string,
  normalizedTokens: NormalizedToken[],
  options: {
    source: 'plugin' | 'json-import' | 'figma-url';
    figmaKey?: string;    // 스크린샷 캡처용
    figmaVersion?: string;
  }
): Promise<PipelineResult>
```

---

## 2. 메인 페이지 UI/UX 재설계

### 2.1 새 레이아웃 구조

```
[메인 페이지]
├── 플러그인 연결 상태 카드  ← 1순위 (항상 최상단)
│     ├── 연결됨: "마지막 sync 3분 전 · 색상 42개 변경" + [재sync 요청]
│     └── 미연결: "플러그인 설정 안내" + [설정 바로가기]
│
├── 토큰 현황 (토큰 있을 때)
│     └── 타입별 카드 그리드 (color N개, typography N개, ...)
│
└── 토큰 가져오기 (토큰 없거나 수동 업데이트 원할 때)
      ├── [탭: JSON 파일]   ← 2순위
      ├── [탭: JSON 붙여넣기] ← 3순위
      └── [접힌 고급 옵션: Figma URL 직접 호출] ← 4순위
```

### 2.2 플러그인 연결 상태 카드 (신규)

**연결된 상태 (sync 이력 있음):**
```
┌─────────────────────────────────────────────────┐
│  ● 플러그인 연결됨                               │
│  마지막 sync: 3분 전 · v7                        │
│  변경: 색상 +2 / 타이포 -1 / 간격 수정 3개       │
│                              [sync 현황 보기 →]  │
└─────────────────────────────────────────────────┘
```

**미연결 상태 (sync 이력 없음):**
```
┌─────────────────────────────────────────────────┐
│  ○ 플러그인 미연결                               │
│  Figma 플러그인을 설치하고 API 키를 연결하면     │
│  자동으로 토큰이 동기화됩니다.                   │
│                        [플러그인 설정하기 →]     │
└─────────────────────────────────────────────────┘
```

### 2.3 토큰 가져오기 탭 구조

```tsx
// 탭 구조
<TabGroup>
  <Tab label="JSON 파일" icon="solar:file-text-linear">
    {/* 드래그 앤 드롭 + 파일 선택 버튼 */}
    <DropZone accept=".json" />
  </Tab>
  <Tab label="JSON 붙여넣기" icon="solar:clipboard-text-linear">
    {/* 기존 textarea + 분석 버튼 */}
    <JsonPasteArea />
  </Tab>
</TabGroup>

{/* Figma URL — 항상 접혀 있음, 토글로 펼치기 */}
<details className={styles.advancedSection}>
  <summary>고급: Figma URL 직접 호출</summary>
  <FigmaUrlForm />  {/* 기존 URL 입력 폼 재사용 */}
</details>
```

**현재 vs 변경 비교:**

| 요소 | 현재 | 변경 후 |
|------|------|--------|
| 첫 화면 | Figma URL 입력 폼 | 플러그인 연결 상태 카드 |
| JSON 입력 | URL 아래 "또는" textarea | 탭으로 파일/붙여넣기 분리 |
| Figma URL | 가장 크게 표시 | `<details>` 고급 옵션으로 |
| 토큰 있을 때 | URL 폼 숨고 타입 선택 | 현황 카드 + 가져오기 탭 공존 |

---

## 3. 토큰 세부 페이지 UI/UX 재설계

### 3.1 현재 문제

- 헤더의 "마지막 추출" 시각이 source를 구분 안 함
- 플러그인 sync로 들어온 토큰인지 JSON import인지 불명확
- JsonImportSection이 항상 collapsed되어 있어 접근성 낮음
- 비교 섹션이 스크린샷 없으면 아예 안 보임

### 3.2 헤더 개선

```
[현재]
마지막 추출: 04/01 14:23 · figma.com/...

[변경 후]
┌── 출처 배지 ──────────────────────────────────────┐
│ [플러그인] v7 · 3분 전    또는   [JSON] · 04/01   │
│            또는   [Figma URL] · 04/01              │
└───────────────────────────────────────────────────┘
```

**출처별 배지 색상:**
- 플러그인 sync → 초록 (`#22c55e`)
- JSON import → 파란 (`var(--accent)`)
- Figma URL → 보라 (`#a855f7`)

### 3.3 비교 섹션 개선

**스크린샷 없을 때 (현재: 섹션 자체가 없음):**
```
[변경 후 - 항상 표시]
┌── 디자인 비교 ─────────────────────────────────┐
│                                                  │
│  ┌─ Figma 원본 ─┐    ┌─ PixelForge 렌더링 ─┐   │
│  │  [캡처 없음]  │    │   [캡처 없음]       │   │
│  │  [캡처하기]   │    │   [캡처하기]        │   │
│  └──────────────┘    └────────────────────┘   │
│                                                  │
│  플러그인 sync 시 자동으로 캡처됩니다.            │
└──────────────────────────────────────────────────┘
```

**플러그인 sync 후 (자동 캡처 완료):**
```
┌── 디자인 비교 ────── ● 자동 sync됨 · 3분 전 ──┐
│  ┌─ Figma 원본 ─┐    ┌─ PixelForge 렌더링 ─┐  │
│  │  [이미지]    │    │   [이미지]          │  │
│  └──────────────┘    └────────────────────┘  │
└──────────────────────────────────────────────┘
```

### 3.4 토큰 없을 때 Empty State 개선

```
[현재]
"추출된 토큰이 없습니다."
"Figma URL로 추출하거나 JSON을 직접 가져올 수 있습니다."
+ JsonImportSection

[변경 후]
┌─────────────────────────────────────────┐
│  토큰이 아직 없습니다                    │
│                                          │
│  권장: Figma 플러그인으로 자동 동기화    │
│        [플러그인 설정 →]                 │
│                                          │
│  ── 또는 직접 가져오기 ────────────────  │
│  [JSON 파일 업로드]  [JSON 붙여넣기]     │
└─────────────────────────────────────────┘
```

---

## 4. 파일별 변경 계획

### 신규 파일

| 파일 | 역할 |
|------|------|
| `src/lib/tokens/pipeline.ts` | 공통 후처리 파이프라인 |
| `src/lib/sync/parse-variables.ts` | Plugin payload → NormalizedToken[] |
| `src/lib/sync/compute-diff.ts` | diff + changedTypes 계산 |
| `src/components/common/PluginStatusCard.tsx` | 플러그인 연결 상태 카드 |
| `src/components/common/TokenImportTabs.tsx` | JSON 파일/붙여넣기 탭 |

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/app/(ide)/page.tsx` | 레이아웃 재구성 — 플러그인 카드 최상단, URL 폼 고급으로 |
| `src/app/(ide)/tokens/[type]/page.tsx` | 출처 배지, 비교 섹션 항상 표시 |
| `src/app/(ide)/tokens/[type]/JsonImportSection.tsx` | 파일/붙여넣기 탭 분리 |
| `src/app/api/sync/tokens/route.ts` | 파이프라인 연결 |
| `src/lib/actions/import-json.ts` | 파이프라인 통과하도록 리팩토링 |

---

## 5. 컴포넌트 설계

### PluginStatusCard

```tsx
interface PluginStatusCardProps {
  // getSyncStatus() 결과를 받음
  syncProjects: SyncProjectStatus[];
  // 설정 페이지로 이동
  onSettingsClick: () => void;
}
```

**상태 분기:**
```
syncProjects.length === 0
  → "미연결" UI + 설정 안내

syncProjects.length > 0
  → 최신 sync 프로젝트 기준:
    - 프로젝트명, 버전, 상대 시각
    - 최근 diff 요약 (변경 있을 때)
    - "sync 현황 보기" 링크 → /settings (figma 탭)
```

### TokenImportTabs

```tsx
type ImportTab = 'file' | 'paste';

interface TokenImportTabsProps {
  defaultTab?: ImportTab;
  onImportSuccess?: (result: ImportResult) => void;
}
```

- `file` 탭: `<input type="file">` + drag & drop
- `paste` 탭: 기존 textarea + 분석 버튼
- 두 탭 모두 파싱 성공 시 → `JsonAnalysisPanel` 공통 사용

---

## 6. 데이터 흐름 (설정 → 메인 → 세부)

```
설정 페이지 (figma 탭)
  └─ API 키 생성 → 플러그인에 키 설정

플러그인 (Figma)
  └─ Sync 버튼 → POST /api/sync/tokens
       └─ pipeline.runTokenPipeline()
            ├─ tokens 테이블 갱신
            ├─ token_snapshots 저장
            ├─ tokens.css 재생성
            └─ 스크린샷 백그라운드 캡처

메인 페이지 (ISR or polling)
  └─ getSyncStatus() → PluginStatusCard 갱신
  └─ getTokenSummary() → 타입별 현황 카드

토큰 세부 페이지
  └─ getTokensByType() → 최신 토큰 표시
  └─ getTokenSourceAction() → 출처 배지 + 비교 스크린샷
```

---

## 7. 구현 순서

```
Day 1 — 파이프라인 코어
  1. src/lib/sync/parse-variables.ts
  2. src/lib/sync/compute-diff.ts
  3. src/lib/tokens/pipeline.ts (runTokenPipeline)
  4. src/app/api/sync/tokens/route.ts 연결
  5. curl 검증

Day 2 — 메인 페이지 UI
  6. PluginStatusCard 컴포넌트
  7. TokenImportTabs 컴포넌트 (파일 + 붙여넣기 탭)
  8. page.tsx 레이아웃 재구성
     - 플러그인 카드 최상단
     - 탭 기반 가져오기
     - URL 폼 → <details> 고급 섹션

Day 3 — 세부 페이지 UI
  9. 출처 배지 (plugin / json / figma-url)
  10. 비교 섹션 항상 표시 + 스크린샷 없을 때 empty state
  11. Empty state 개선 (플러그인 우선 안내)

Day 4 — 스크린샷 자동화 + 마무리
  12. 스크린샷 백그라운드 트리거
  13. .env.local NEXT_PUBLIC_BASE_URL=http://localhost:3001 확인
  14. import-json.ts 파이프라인 통과하도록 연결
```

---

## 8. 성공 기준

### 파이프라인
- [ ] Plugin sync → `tokens` 테이블 정규화 저장
- [ ] JSON import → 동일 파이프라인 통과
- [ ] diff 계산 후 `diffSummary` 저장
- [ ] tokens.css 자동 재생성

### 메인 페이지
- [ ] 플러그인 연결 상태 카드가 최상단에 표시
- [ ] 미연결 시 설정 안내 표시
- [ ] 토큰 가져오기: 파일/붙여넣기 탭 분리
- [ ] Figma URL은 `<details>` 고급 섹션으로

### 세부 페이지
- [ ] 출처 배지 (plugin/json/figma) 표시
- [ ] 비교 섹션 항상 표시 (스크린샷 없으면 캡처 안내)
- [ ] 플러그인 sync 후 비교 스크린샷 자동 갱신
- [ ] Empty state에 플러그인 설정 링크 포함
