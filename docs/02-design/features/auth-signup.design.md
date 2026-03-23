# Design: 인증 기능 (auth-signup)

> Plan 참조: `docs/01-plan/features/auth-signup.plan.md`

---

## 1. DB 스키마 설계

### 1.1 users 테이블 추가

`src/lib/db/schema.ts` — Drizzle 스키마 추가

```typescript
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'member'] }).notNull().default('member'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
```

`src/lib/db/index.ts` — `initTables()` 내 SQL 추가

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'member')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

---

## 2. 세션 설계

### 2.1 `src/lib/auth/session.ts`

```typescript
import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  userId: string;
  email: string;
  role: 'admin' | 'member';
  isLoggedIn: boolean;
}

export const SESSION_OPTIONS: SessionOptions = {
  password: process.env.SESSION_SECRET!, // 32자 이상 필수
  cookieName: 'pixelforge_session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7일
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), SESSION_OPTIONS);
}
```

### 2.2 환경변수

`.env.local` 추가 필요:
```
SESSION_SECRET=your-32-character-or-longer-secret-key
```

---

## 3. Zod 스키마 설계

### 3.1 `src/lib/auth/schema.ts`

```typescript
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, '이메일을 입력해주세요').email('올바른 이메일 형식이 아닙니다'),
  password: z.string().min(1, '비밀번호를 입력해주세요').min(8, '비밀번호는 8자 이상이어야 합니다'),
});

export const registerSchema = z.object({
  email: z.string().min(1, '이메일을 입력해주세요').email('올바른 이메일 형식이 아닙니다'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
  passwordConfirm: z.string().min(1, '비밀번호 확인을 입력해주세요'),
}).refine((d) => d.password === d.passwordConfirm, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['passwordConfirm'],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '현재 비밀번호를 입력해주세요'),
  newPassword: z.string().min(8, '새 비밀번호는 8자 이상이어야 합니다'),
  newPasswordConfirm: z.string().min(1, '비밀번호 확인을 입력해주세요'),
}).refine((d) => d.newPassword === d.newPasswordConfirm, {
  message: '새 비밀번호가 일치하지 않습니다',
  path: ['newPasswordConfirm'],
});

export const addUserSchema = z.object({
  email: z.string().min(1, '이메일을 입력해주세요').email('올바른 이메일 형식이 아닙니다'),
  password: z.string().min(8, '초기 비밀번호는 8자 이상이어야 합니다'),
});

export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;
export type ChangePasswordForm = z.infer<typeof changePasswordSchema>;
export type AddUserForm = z.infer<typeof addUserSchema>;
```

---

## 4. Server Actions 설계

### 4.1 `src/lib/actions/auth.ts`

#### `register` — 최초 admin 계정 생성

```typescript
export async function register(data: RegisterForm): Promise<{ error?: string }> {
  // 1. zod 검증
  // 2. users 테이블에 레코드 있으면 에러 (최초 1회만 허용)
  // 3. bcrypt.hash(password, 12)
  // 4. DB INSERT (role: 'admin')
  // 5. 세션 발급 후 리턴
}
```

#### `login` — 로그인

```typescript
export async function login(data: LoginForm): Promise<{ error?: string }> {
  // 1. zod 검증
  // 2. DB에서 email로 user 조회
  // 3. user 없거나 bcrypt.compare 실패 → "이메일 또는 비밀번호가 올바르지 않습니다"
  //    (두 경우 동일 메시지 — 이메일 존재 여부 노출 방지)
  // 4. 세션 발급
}
```

#### `logout` — 로그아웃

```typescript
export async function logout(): Promise<void> {
  // session.destroy() 후 /login 리다이렉트
}
```

#### `changePassword` — 비밀번호 변경 (본인)

```typescript
export async function changePassword(data: ChangePasswordForm): Promise<{ error?: string }> {
  // 1. 세션 확인 (미인증 시 에러)
  // 2. zod 검증
  // 3. 현재 비밀번호 bcrypt.compare 검증
  // 4. 새 비밀번호 bcrypt.hash 후 UPDATE
}
```

#### `addUser` — 사용자 추가 (admin 전용)

```typescript
export async function addUser(data: AddUserForm): Promise<{ error?: string }> {
  // 1. 세션 확인 + role === 'admin' 검증
  // 2. zod 검증
  // 3. 이메일 중복 체크
  // 4. bcrypt.hash 후 INSERT (role: 'member')
}
```

#### `deleteUser` — 사용자 삭제 (admin 전용)

```typescript
export async function deleteUser(userId: string): Promise<{ error?: string }> {
  // 1. 세션 확인 + role === 'admin' 검증
  // 2. 자기 자신 삭제 불가
  // 3. DB DELETE
}
```

#### `getUsers` — 사용자 목록 조회 (admin 전용, Server Component용)

```typescript
export async function getUsers(): Promise<User[]> {
  // 세션 확인 + admin 검증 후 SELECT
}
```

---

## 5. 미들웨어 설계

### 5.1 `middleware.ts` (프로젝트 루트)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { SessionData, SESSION_OPTIONS } from '@/lib/auth/session';

const PUBLIC_PATHS = ['/login', '/register', '/viewer'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, SESSION_OPTIONS);

  // 인증된 사용자가 /login, /register 접근 시 IDE로 리다이렉트
  if (isPublic && session.isLoggedIn) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 미인증 사용자가 보호된 경로 접근 시 /login으로 리다이렉트
  if (!isPublic && !session.isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

> **주의**: `/register`는 public이지만 Register 페이지 내부에서 users 레코드 존재 여부를 체크하여,
> 이미 계정이 있으면 `/login`으로 리다이렉트한다. (미들웨어 단에서 하지 않음 — DB 접근 필요)

---

## 6. 화면 설계

### 6.1 Register 페이지 (`/register`) — 신규

**레이아웃**: 기존 Login 페이지와 동일한 디자인 언어 (Double-Bezel 카드, Vantablack 배경)

**UI 구성**:
```
[PixelForge 로고 + 아이콘]
[타이틀: "관리자 계정 만들기"]
[서브텍스트: "처음 실행 시 1회만 생성됩니다"]

[이메일 필드]        solar:letter-linear 아이콘
[비밀번호 필드]      solar:lock-linear 아이콘
[비밀번호 확인]      solar:lock-check-linear 아이콘

[계정 만들기 버튼]   solar:user-plus-linear 아이콘

[하단] "이미 계정이 있으신가요? → 로그인"
```

**상태**:
- 로딩: 버튼 스피너 + disabled
- 에러: 각 필드 하단 인라인 에러
- 서버 에러 (이미 계정 존재): 상단 에러 배너
- 성공: `/` 자동 이동 (세션 발급 후)

**페이지 진입 시 체크**:
```typescript
// Register 페이지 서버 컴포넌트에서
const userCount = await getUserCount(); // SELECT COUNT(*)
if (userCount > 0) redirect('/login');
```

---

### 6.2 Login 페이지 수정 (`/login`) — 기존 수정

변경 사항만:
- `onSubmit` → 실제 `login()` Server Action 호출
- 실패 시 `serverError` 상태에 에러 메시지 표시
- 성공 시 router.push('/') → 세션 쿠키 발급이 Server Action에서 처리

---

### 6.3 Settings 페이지 수정 — 기존 수정

#### 탭 추가: `'account'`

기존: `'general' | 'team' | 'figma'`
변경: `'general' | 'account' | 'team' | 'figma'`

#### Account 탭 (신규) — 비밀번호 변경

```
[계정 정보 카드]
  아이콘: solar:shield-user-linear
  제목: "계정 보안"
  설명: "비밀번호를 변경합니다"

  [현재 비밀번호 필드]
  [새 비밀번호 필드]
  [새 비밀번호 확인 필드]
  [변경 저장 버튼]
```

#### Team 탭 수정 — 실제 데이터 연결 + admin 조건부 렌더링

```
[관리자만 표시]
  사용자 추가: 이메일 + 초기 비밀번호 입력 폼
  → addUser() Server Action 호출

[사용자 목록]
  - 이메일, 역할(admin/member) 표시
  - admin만 삭제 버튼 표시
  - 본인 행은 삭제 버튼 없음
```

---

### 6.4 ActivityBar 수정 — 로그아웃 버튼 추가

`BOTTOM_ITEMS` 아래 또는 별도로:

```
[기존 설정 버튼]
[로그아웃 버튼]  solar:logout-3-linear 아이콘
```

`logout()` Server Action 호출 시 form action 또는 router.push 방식 사용.

---

## 7. 컴포넌트 변경 요약

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `src/lib/db/schema.ts` | 수정 | users 테이블 추가 |
| `src/lib/db/index.ts` | 수정 | initTables() SQL 추가 |
| `src/lib/auth/session.ts` | 신규 | SessionData 타입 + getSession |
| `src/lib/auth/schema.ts` | 신규 | zod 스키마 4종 |
| `src/lib/actions/auth.ts` | 신규 | Server Actions 6종 |
| `middleware.ts` | 신규 | 인증 가드 |
| `src/app/(auth)/register/page.tsx` | 신규 | admin 최초 등록 UI |
| `src/app/(auth)/register/page.module.scss` | 신규 | (login 스타일 재사용 가능) |
| `src/app/(auth)/login/page.tsx` | 수정 | 실제 login() 연결 |
| `src/app/(ide)/settings/page.tsx` | 수정 | account 탭 추가, team 탭 실제 연결 |
| `src/components/layout/ActivityBar.tsx` | 수정 | 로그아웃 버튼 추가 |
| `.env.local` | 수정 | SESSION_SECRET 추가 |

---

## 8. 의존성 설치

```bash
npm install bcryptjs iron-session
npm install -D @types/bcryptjs
```

---

## 9. 엣지 케이스

| 케이스 | 처리 방법 |
|--------|----------|
| `/register` 접근 시 이미 계정 존재 | 서버에서 redirect('/login') |
| 로그인된 상태에서 `/login` 접근 | 미들웨어에서 redirect('/') |
| admin이 자기 자신 삭제 시도 | "자신의 계정은 삭제할 수 없습니다" 에러 |
| member가 사용자 관리 API 직접 호출 | Server Action에서 role 검증 후 에러 반환 |
| SESSION_SECRET 미설정 | 서버 시작 시 환경변수 체크 후 에러 throw |
| users가 0명인데 /login 접근 | 미들웨어 통과, 로그인 실패 → 사용자가 /register로 이동해야 함 (login 페이지 하단 링크) |

---

## 10. 보안 체크리스트

- [ ] bcrypt cost factor 12 사용
- [ ] 로그인 실패 메시지: 이메일/비밀번호 구분 없이 동일한 메시지
- [ ] SESSION_SECRET 32자 이상
- [ ] httpOnly + sameSite 쿠키
- [ ] Server Action은 Next.js CSRF 보호 자동 적용
- [ ] admin 전용 Action에서 세션 role 검증 필수
- [ ] SQL Injection: Drizzle ORM parameterized query로 자동 방지
