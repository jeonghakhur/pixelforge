# Playwright 테스트 가이드 — PixelForge

## 개요

PixelForge는 Next.js App Router 기반 풀스택 앱으로, iron-session 인증이 필요한 보호된 라우트를 테스트한다.

## 설정

### playwright.config.ts

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 15000,
  use: {
    baseURL: 'http://localhost:3777',
    headless: true,
  },
  workers: 1,  // 순차 실행 (DB 상태 의존)
});
```

### 실행 명령어

```bash
npm run test              # 전체 테스트
npx playwright test tests/screens/admin.spec.ts  # 단일 파일
npx playwright test --ui  # UI 모드
```

### 개발 서버 시작

```bash
PORT=3777 npm run dev     # 테스트용 포트로 실행
```

## 테스트 파일 구조

```
tests/
├── screens/
│   ├── (ide).spec.ts              # IDE 대시보드
│   ├── admin.spec.ts              # 관리자 페이지
│   ├── components-name.spec.ts    # 컴포넌트 상세
│   ├── components-new.spec.ts     # 컴포넌트 생성
│   ├── diff.spec.ts               # 토큰 diff 뷰어
│   ├── screens.spec.ts            # 화면 검수 목록
│   ├── screens-view.spec.ts       # 화면 상세
│   ├── settings.spec.ts           # 설정
│   └── viewer.spec.ts             # 뷰어 (퍼블릭)
├── auth.test.ts                   # 인증 로직
└── tokens/
    └── token-verification.spec.ts # 토큰 검증
```

## 인증 처리

PixelForge는 iron-session 기반 세션 인증을 사용한다. 보호된 라우트 테스트 시 로그인 절차가 필요하다.

### 로그인 헬퍼

```typescript
// tests/helpers/auth.ts
import { Page } from '@playwright/test';

export async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'admin@test.com');
  await page.fill('input[name="password"]', 'testpassword');
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}
```

### 인증 필요 테스트 패턴

```typescript
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers/auth';

test.describe('토큰 페이지', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('색상 토큰 목록이 표시된다', async ({ page }) => {
    await page.goto('/tokens/color');
    await expect(page.locator('[data-testid="color-grid"]')).toBeVisible();
  });
});
```

### 퍼블릭 라우트 테스트

```typescript
test('뷰어 페이지는 로그인 없이 접근 가능하다', async ({ page }) => {
  await page.goto('/viewer');
  await expect(page).not.toHaveURL('/login');
});
```

## 테스트 시나리오

### 1. 인증 플로우

```typescript
test.describe('인증', () => {
  test('최초 사용자 등록 후 로그인', async ({ page }) => {
    await page.goto('/register');
    await page.fill('input[name="email"]', 'new@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="confirmPassword"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('미인증 시 로그인 페이지로 리다이렉트', async ({ page }) => {
    await page.goto('/tokens/color');
    await expect(page).toHaveURL('/login');
  });
});
```

### 2. 토큰 관리

```typescript
test.describe('토큰 추출', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('토큰 타입별 페이지 전환', async ({ page }) => {
    const types = ['color', 'typography', 'spacing', 'radius'];
    for (const type of types) {
      await page.goto(`/tokens/${type}`);
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('CSS 프리뷰 모달 열기', async ({ page }) => {
    await page.goto('/tokens/color');
    // CSS 프리뷰 버튼 클릭
    await page.click('[data-testid="css-preview-btn"]');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });
});
```

### 3. 컴포넌트 생성

```typescript
test.describe('컴포넌트', () => {
  test('새 컴포넌트 생성 페이지 접근', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/components/new');
    await expect(page.locator('main')).toBeVisible();
  });

  test('컴포넌트 가이드 페이지 표시', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/components/button');
    await expect(page.locator('main')).toBeVisible();
  });
});
```

### 4. 화면 검수

```typescript
test.describe('화면 검수', () => {
  test('화면 목록 테이블 렌더링', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/screens');
    await expect(page.locator('table')).toBeVisible();
  });

  test('화면 상태 변경', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/screens');
    // 상태 드롭다운에서 변경
  });
});
```

## 검증 체크리스트

### UI 레이아웃

- [ ] IDE 레이아웃: ActivityBar + Sidebar + TabBar + StatusBar 렌더링
- [ ] 반응형: 모바일 뷰포트에서 레이아웃 유지
- [ ] 다크/라이트 테마 전환 동작

### 인터랙션

- [ ] 모든 모달: ESC로 닫기
- [ ] 모든 폼: 제출 후 에러/성공 피드백
- [ ] 토큰 타입 탭 전환
- [ ] 사이드바 메뉴 네비게이션

### 접근성

- [ ] Tab 키로 모든 인터랙티브 요소 접근
- [ ] 모달 포커스 트랩 동작
- [ ] 폼 에러 메시지 `role="alert"` 포함
- [ ] 이미지에 `alt` 텍스트

## 리포트

### 리포트 생성

```bash
npx playwright test --reporter=html
npx playwright show-report
```

### 리포트 저장 규칙

1. HTML 리포트는 `playwright-report/`에 자동 생성
2. `.gitignore`에 `playwright-report/`, `test-results/` 포함
3. CI에서 리포트를 아티팩트로 저장
4. 실패 시 스크린샷 자동 첨부

### npm scripts

```json
{
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "test:report": "playwright show-report"
  }
}
```
