# Design: manual-token-sync — 메인 페이지 토큰 수동 가져오기

> Plan: `docs/01-plan/features/manual-token-sync.plan.md`

---

## 1. 아키텍처 레이어

```
┌─────────────────────────────────────────────────────────┐
│  Presentation (React Client Component)                  │
│  src/app/(ide)/TokenDashboard.tsx                       │
│    - isImportOpen: boolean  (모달 열림/닫힘)             │
│    - Top Bar "Import Tokens" 버튼                        │
│    - ImportModal 오버레이 (조건부 렌더링)                 │
│         └── TokenImportTabs  ← 재사용, 수정 없음         │
└─────────────────┬───────────────────────────────────────┘
                  │ onImportSuccess
                  ▼
          모달 닫기 + router.refresh()
                  │
┌─────────────────▼───────────────────────────────────────┐
│  Application (Server Action — 변경 없음)                  │
│  src/lib/actions/import-json.ts                         │
│    importFromJsonAction()  ← TokenImportTabs 내부 호출   │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 파일 목록

| 파일 | 변경 | 설명 |
|------|------|------|
| `src/app/(ide)/TokenDashboard.tsx` | 수정 | 버튼 + 모달 상태 + 모달 JSX |
| `src/app/(ide)/TokenDashboard.module.scss` | 수정 | 모달 오버레이/컨테이너 스타일 |

**변경 없음**: `TokenImportTabs`, `importFromJsonAction`, `page.tsx`, `tokens.ts`

**롤백 필요**: 이전 Figma API 방식 코드 제거
- `tokens.ts`: `getActiveProjectHasFigmaUrl`, `extractAllTokensAction`, `ExtractAllResult` 제거
- `page.tsx`: `hasFigmaUrl` 페칭 제거
- `TokenDashboard.tsx`: `extractAllTokensAction` import 제거, `handleExtract` 제거, `hasFigmaUrl` prop 제거, 에러 배너 제거

---

## 3. `TokenDashboard.tsx` 변경 상세

### 3-1. 제거 항목 (이전 Figma API 방식)

```typescript
// 제거
import { extractAllTokensAction } from '@/lib/actions/tokens';
type ExtractState = 'idle' | 'loading' | 'success' | 'error';
const [extractState, setExtractState] = useState<ExtractState>('idle');
const [errorMsg, setErrorMsg] = useState<string | null>(null);
const handleExtract = () => { ... };
// Props: hasFigmaUrl: boolean
// JSX: extractState === 'error' 에러 배너
// JSX: syncBtn with extractState 조건들
```

### 3-2. 추가 항목

```typescript
// import 추가
import TokenImportTabs from '@/components/common/TokenImportTabs';

// 상태
const [isImportOpen, setIsImportOpen] = useState(false);

// ESC 키 닫기
useEffect(() => {
  if (!isImportOpen) return;
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setIsImportOpen(false);
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [isImportOpen]);
```

### 3-3. Props 인터페이스 — 원상 복원

```typescript
interface Props {
  summary: TokenSummary;
  tokenMenu: TokenMenuEntry[];
  histories: HistoryEntry[];
  tokenVersion: number | null;
  lastSyncedAt: string | null;
  // hasFigmaUrl 제거
}
```

### 3-4. Top Bar 버튼

```tsx
<div className={styles.topBarRight}>
  <button
    type="button"
    className={styles.syncBtn}
    onClick={() => setIsImportOpen(true)}
  >
    <Icon icon="solar:import-linear" width={14} height={14} />
    Import Tokens
  </button>
</div>
```

### 3-5. 모달 JSX (캔버스 최하단)

```tsx
{isImportOpen && (
  <div
    className={styles.modalOverlay}
    onClick={() => setIsImportOpen(false)}
    role="dialog"
    aria-modal="true"
    aria-label="토큰 가져오기"
  >
    <div
      className={styles.modalContainer}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={styles.modalHeader}>
        <span className={styles.modalTitle}>Import Tokens</span>
        <button
          type="button"
          className={styles.modalClose}
          onClick={() => setIsImportOpen(false)}
          aria-label="닫기"
        >
          <Icon icon="solar:close-linear" width={16} height={16} />
        </button>
      </div>
      <TokenImportTabs
        onImportSuccess={() => {
          setIsImportOpen(false);
          router.refresh();
        }}
      />
    </div>
  </div>
)}
```

---

## 4. SCSS 추가 (`TokenDashboard.module.scss`)

```scss
.modalOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modalContainer {
  background: var(--bg-elevated);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  width: 520px;
  max-width: calc(100vw - 48px);
  max-height: calc(100vh - 96px);
  overflow-y: auto;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
}

.modalHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--glass-border);
}

.modalTitle {
  font-size: 14px;
  font-weight: $font-weight-semibold;
  color: var(--text-primary);
}

.modalClose {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: $transition-fast;

  &:hover { color: var(--text-primary); background: rgba(255, 255, 255, 0.06); }
}
```

---

## 5. 롤백 대상 (이전 구현 정리)

| 파일 | 제거할 코드 |
|------|------------|
| `tokens.ts` | `getActiveProjectHasFigmaUrl`, `extractAllTokensAction`, `ExtractAllResult` |
| `page.tsx` | `getActiveProjectHasFigmaUrl` import, `hasFigmaUrl` 페칭, prop 전달 |
| `TokenDashboard.tsx` | `extractAllTokensAction` import, `ExtractState` 타입, `extractState`/`errorMsg` state, `handleExtract`, `hasFigmaUrl` prop, 에러 배너 JSX |
| `TokenDashboard.module.scss` | `.errorBanner`, `.errorClose` |

---

## 6. 구현 순서

| # | 파일 | 작업 |
|---|------|------|
| 1 | `tokens.ts` | 이전 Figma API 함수 3개 제거 |
| 2 | `page.tsx` | `hasFigmaUrl` 관련 코드 제거 |
| 3 | `TokenDashboard.tsx` | 이전 코드 제거 → 새 버튼 + 모달 추가 |
| 4 | `TokenDashboard.module.scss` | 에러 배너 제거 → 모달 스타일 추가 |

---

## 7. 성공 기준

- [ ] Top Bar 우측에 "Import Tokens" 버튼이 항상 표시된다 (disabled 없음)
- [ ] 버튼 클릭 시 JSON 임포트 모달이 열린다
- [ ] 모달 내에서 파일 업로드 탭과 붙여넣기 탭이 동작한다
- [ ] 임포트 성공 시 모달이 닫히고 Audit Log와 통계 카드가 갱신된다
- [ ] 모달 배경 클릭 또는 ESC 키로 모달이 닫힌다
- [ ] `npm run build` + `npm run lint` 통과
