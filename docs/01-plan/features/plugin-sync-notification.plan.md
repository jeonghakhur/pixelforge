## Executive Summary

| 관점 | 내용 |
|------|------|
| Problem | 플러그인에서 토큰/컴포넌트를 전송해도 웹 페이지에 아무런 피드백이 없다. 토큰은 5초 폴링으로 지연 감지되고, 컴포넌트는 감지조차 안 된다 |
| Solution | 이미 구현된 SSE 인프라(sse-hub.ts + /api/sync/events)를 sync 엔드포인트에 연결하고, 브라우저에서 EventSource로 수신하여 Toast + 사이드바 갱신 |
| Function UX Effect | 플러그인 전송 → 1초 이내 Toast 알림("토큰 127개 동기화됨", "Button 컴포넌트 생성됨") + 해당 페이지 자동 갱신 |
| Core Value | 5초 폴링 → 즉시 Push 전환. 사용자가 플러그인 작업 결과를 실시간으로 확인 가능 |

---

# Plan: Plugin Sync Notification

> 플러그인 데이터 수신 시 웹 페이지에 실시간 알림 및 자동 갱신

**작성**: 2026-04-06
**상태**: 계획

---

## 1. 현재 상태

### 1-1. 이미 있는 인프라

| 인프라 | 파일 | 상태 |
|--------|------|------|
| SSE Hub (globalThis 싱글턴) | `src/lib/sync/sse-hub.ts` | 구현 완료, **미연결** |
| SSE 스트림 엔드포인트 | `src/app/api/sync/events/route.ts` | 구현 완료, 25초 keep-alive |
| `notifySyncUpdated()` | `sse-hub.ts:26` | 정의됨, **어디서도 호출 안 됨** |
| Toast 컴포넌트 | `src/components/common/Toast.tsx` | 구현 완료, **페이지별 로컬 관리** |
| Zustand UI Store | `src/stores/useUIStore.ts` | `invalidateTokens()` 존재, 컴포넌트 갱신 없음 |
| 5초 폴링 | `src/app/AppShell.tsx:86-105` | 토큰만 감지, 컴포넌트 미감지 |

### 1-2. 문제점

1. **SSE 미연결**: sync 엔드포인트가 `notifySyncUpdated()`를 호출하지 않음
2. **컴포넌트 감지 없음**: 폴링이 토큰만 감지, 컴포넌트 싱크는 페이지 새로고침 전까지 반영 안 됨
3. **Toast가 글로벌이 아님**: 각 페이지가 자체 `useState<ToastItem[]>` 관리 → AppShell 레벨 알림 불가
4. **알림 내용 부족**: `data: sync\n\n`만 전송 → 무엇이 변경됐는지 알 수 없음

---

## 2. 목표

1. **즉시 알림**: 플러그인 전송 → 1초 이내 Toast 표시 (5초 폴링 제거)
2. **타입별 알림**: "토큰 127개 동기화됨" / "Button 컴포넌트 생성됨" 등 구체적 메시지
3. **자동 갱신**: 현재 보고 있는 페이지의 데이터 자동 리프레시
4. **글로벌 Toast**: AppShell 레벨에서 모든 sync 이벤트 알림

---

## 3. 설계 개요

### 3-1. 데이터 흐름

```
플러그인 POST /api/sync/tokens
    ↓
route.ts: DB 저장 → notifySyncUpdated({ type, name, count, version })
    ↓ SSE push (JSON event)
브라우저 EventSource 수신
    ↓
Zustand store 업데이트 → Toast 표시 + router.refresh()
```

### 3-2. SSE 메시지 형식 개선

현재 `data: sync\n\n` → JSON 이벤트로 확장:

```
event: sync
data: {"type":"tokens","count":127,"version":3,"changed":true}

event: sync
data: {"type":"component","name":"Button","version":1,"changed":true,"action":"create"}
```

### 3-3. 변경 대상 파일

| 파일 | 변경 |
|------|------|
| `src/lib/sync/sse-hub.ts` | `notifySyncUpdated()` → JSON payload 전달 |
| `src/app/api/sync/tokens/route.ts` | 성공 시 `notifySyncUpdated()` 호출 |
| `src/app/api/sync/components/route.ts` | 성공 시 `notifySyncUpdated()` 호출 |
| `src/stores/useUIStore.ts` | `syncNotifications` 상태 + `invalidateComponents()` 추가 |
| `src/app/AppShell.tsx` | EventSource 연결 + 글로벌 Toast + 폴링 제거/폴백 |

---

## 4. 구현 계획

### Step 1: SSE Hub 메시지 확장

`sse-hub.ts`의 `notifySyncUpdated()`가 JSON payload를 전달하도록 변경.

### Step 2: Sync 엔드포인트에서 SSE 호출

토큰/컴포넌트 sync route에서 DB 저장 성공 후 `notifySyncUpdated()` 호출.

### Step 3: Zustand Store 확장

- `syncNotifications: SyncNotification[]` 상태 추가
- `addSyncNotification()` / `removeSyncNotification()` 액션
- `invalidateComponents()` 액션 (컴포넌트 갱신용)

### Step 4: AppShell에 EventSource 연결

- `useEffect`에서 `EventSource('/api/sync/events')` 연결
- `onmessage` → Zustand에 알림 추가 + `invalidateTokens()` / `invalidateComponents()`
- 기존 5초 폴링은 SSE 연결 실패 시 폴백으로 유지

### Step 5: 글로벌 Toast 표시

AppShell에서 `syncNotifications`를 구독하여 Toast 렌더링.

---

## 5. 범위 제한

- 토큰, 컴포넌트 sync만 대상 (아이콘, 이미지, 테마는 추후)
- SSE 연결 실패 시 기존 폴링 폴백 유지
- Toast 스타일은 기존 `Toast.tsx` 재사용
