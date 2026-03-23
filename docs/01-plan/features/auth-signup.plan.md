# Plan: 인증 기능 (auth-signup)

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | 이메일/비밀번호 인증 + 비밀번호 변경 + 사용자 초대 |
| 작성일 | 2026-03-23 |
| 단계 | Plan |

### 4-Perspective Value Table

| 관점 | 내용 |
|------|------|
| Problem | 로그인 UI만 있고 실제 인증 로직이 없어 작업 이력이 누구와도 연결되지 않은 상태 |
| Solution | 이메일/비밀번호 자체 인증 + 관리자가 추가 사용자를 초대하는 단순 멀티유저 구조 |
| Function / UX Effect | 로그인 → IDE 진입, 설정에서 비밀번호 변경 및 추가 사용자 관리 가능 |
| Core Value | 프론트 개발자가 팀원과 함께 PixelForge를 사용하며 각자의 작업 이력을 관리 |

---

## 1. 배경 및 문제 정의

### 현재 상태
- `src/app/(auth)/login/page.tsx` — 로그인 UI 존재, `onSubmit`이 그냥 `/`로 리다이렉트 (TODO 주석)
- 로그인 페이지 하단에 `/register` 링크 존재, 해당 페이지 없음
- DB 스키마에 `users` 테이블 없음
- 누구나 URL로 IDE에 직접 접근 가능한 상태

### 사용 맥락
- **대상**: 프론트엔드 개발자 (개인 또는 소규모 팀)
- **목적**: 각자의 작업 이력(token 추출, 컴포넌트 생성) 관리
- **멀티유저**: 관리자가 다른 개발자를 추가해서 함께 사용 가능
- **인증 수준**: 간단한 신원 확인 — 복잡한 권한 체계 불필요

---

## 2. 사용자 모델

### 역할 구분 (단순 2단계)

| 역할 | 설명 | 권한 |
|------|------|------|
| `admin` | 최초 계정 생성자 (1명) | 사용자 추가/삭제, 비밀번호 변경, 모든 기능 사용 |
| `member` | 관리자가 추가한 사용자 | 비밀번호 변경, 모든 기능 사용 (사용자 관리 제외) |

> 복잡한 RBAC 없음. admin은 사용자 관리만 추가로 할 수 있는 수준.

---

## 3. 범위 정의

### In Scope
- [ ] `users` 테이블 추가 (role 컬럼 포함)
- [ ] 초기 계정 생성 페이지 (`/register`) — DB가 비어있을 때만 접근 가능, 자동으로 admin 역할 부여
- [ ] 로그인 Server Action (이메일 + 비밀번호 검증 + 세션 발급)
- [ ] 세션 관리 (`iron-session` 기반 httpOnly 쿠키)
- [ ] 인증 미들웨어 (`middleware.ts`) — 미인증 시 `/login` 리다이렉트
- [ ] 로그아웃
- [ ] **비밀번호 변경** (본인 — 현재 비밀번호 확인 후 변경)
- [ ] **사용자 추가** (admin 전용 — 이메일 + 임시 비밀번호 설정)
- [ ] **사용자 목록/삭제** (admin 전용)

### Out of Scope
- 소셜 로그인
- 비밀번호 찾기 / 이메일 인증 / 초대 메일 발송
- 세분화된 권한 관리 (RBAC)
- 외부 Auth 서비스

---

## 4. 사용자 시나리오

### 시나리오 1: 최초 설치 후 admin 계정 생성
```
1. PixelForge 접속
2. users 테이블이 비어있음 → /register로 리다이렉트
3. 이메일 + 비밀번호 입력 → admin 계정 생성
4. 자동 로그인 → IDE 진입
```

### 시나리오 2: 팀원 추가 (admin)
```
1. 설정 → 사용자 관리 탭
2. "사용자 추가" → 이메일 + 임시 비밀번호 입력
3. 추가된 사용자에게 이메일/임시 비밀번호 공유 (직접 전달)
4. 팀원이 로그인 후 비밀번호 변경
```

### 시나리오 3: 비밀번호 변경 (본인)
```
1. 설정 → 계정 탭
2. 현재 비밀번호 확인 → 새 비밀번호 입력 → 저장
3. 성공 시 토스트 알림
```

### 시나리오 4: 잘못된 비밀번호 로그인
```
1. /login에서 틀린 자격증명 입력
2. "이메일 또는 비밀번호가 올바르지 않습니다" 에러
3. 폼 유지 (비밀번호 필드만 초기화)
```

---

## 5. 기술 설계 방향

### 인증 방식
- **자체 인증** — 외부 서비스 없음
- **비밀번호 해싱**: `bcryptjs`
- **세션**: `iron-session` — 서버사이드 암호화 쿠키

### DB 변경
```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'member')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### 파일 구조 (예상)
```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx              -- 기존 (로그인 로직 연결)
│   │   ├── register/                   -- 신규 (최초 admin 계정 생성)
│   │   │   ├── page.tsx
│   │   │   └── page.module.scss
│   │   └── layout.tsx
│   └── (ide)/
│       └── settings/page.tsx           -- 기존 (계정/사용자 관리 섹션 추가)
├── lib/
│   ├── auth/
│   │   ├── session.ts                  -- iron-session 설정, 세션 타입
│   │   └── schema.ts                   -- zod 스키마 (login / register / changePassword / addUser)
│   ├── actions/
│   │   └── auth.ts                     -- login, register, logout, changePassword, addUser, deleteUser
│   └── db/
│       └── schema.ts                   -- users 테이블 추가
└── middleware.ts                       -- 인증 가드
```

### 미들웨어 라우팅 규칙
```
/login, /register  → 미인증 허용 (인증됐으면 / 로 리다이렉트)
/ (IDE 전체)       → 미인증 시 /login 리다이렉트
/viewer            → 공개 (공유 뷰어 목적)
```

### 3-Layer 검증
```
[클라이언트]           [Server Action]              [DB]
zod 스키마             zod 스키마 재사용             UNIQUE (email)
이메일/비밀번호 형식    bcrypt 검증/해싱              NOT NULL, CHECK (role)
react-hook-form        admin 권한 확인 (사용자 관리)  에러 코드 변환
```

---

## 6. 비기능 요구사항

| 항목 | 기준 |
|------|------|
| 비밀번호 규칙 | 8자 이상 |
| 세션 만료 | 7일 |
| 보안 | httpOnly + sameSite 쿠키, Server Action CSRF 자동 처리 |
| 에러 메시지 | 이메일/비밀번호 구분 노출 안 함 |
| 접근성 | WCAG AA — label/aria-invalid/aria-describedby 필수 |
| 스타일 | 기존 로그인 페이지 디자인 언어 동일하게 적용 |

---

## 7. 의존성

| 패키지 | 용도 | 설치 필요 |
|--------|------|----------|
| `bcryptjs` | 비밀번호 해싱 | 필요 |
| `@types/bcryptjs` | TypeScript 타입 | 필요 |
| `iron-session` | 세션 쿠키 | 필요 |

---

## 8. 구현 순서 (Do 단계 체크리스트 초안)

1. 패키지 설치 (`bcryptjs`, `iron-session`)
2. `users` 테이블 — DB 스키마 + `initTables()` 갱신
3. `src/lib/auth/session.ts` — iron-session 설정 + 세션 타입 정의
4. `src/lib/auth/schema.ts` — zod 스키마 (login / register / changePassword / addUser)
5. `src/lib/actions/auth.ts` — login, register, logout, changePassword, addUser, deleteUser
6. `middleware.ts` — 인증 가드
7. `src/app/(auth)/register/page.tsx` — admin 최초 계정 생성 UI
8. `src/app/(auth)/login/page.tsx` — 실제 로그인 로직 연결
9. `src/app/(ide)/settings/page.tsx` — 계정(비밀번호 변경) + 사용자 관리 섹션 추가
10. IDE layout — 로그아웃 버튼 연결

---

## 9. 완료 기준

- [ ] 최초 접속 시 `/register`로 이동, 계정 생성 후 IDE 진입
- [ ] 계정 있는 상태에서 `/register` 접근 시 `/login` 리다이렉트
- [ ] 올바른 자격증명으로 로그인 → IDE 진입
- [ ] 잘못된 비밀번호 → 에러 메시지 (페이지 이동 없음)
- [ ] 미인증 상태에서 IDE 접근 → `/login` 리다이렉트
- [ ] 로그아웃 후 IDE 접근 차단
- [ ] 설정에서 본인 비밀번호 변경 성공
- [ ] admin이 사용자 추가/삭제 가능
- [ ] member는 사용자 관리 메뉴 접근 불가
