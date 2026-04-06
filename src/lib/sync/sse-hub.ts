/**
 * SSE 구독자 허브 — globalThis 싱글턴
 *
 * Next.js App Router는 route 파일을 별도 번들로 컴파일하므로
 * 모듈 레벨 변수는 route 간 공유되지 않는다.
 * globalThis를 사용해 단일 인스턴스를 보장한다.
 */

export interface SyncEvent {
  /** 동기화 대상 타입 */
  type: 'tokens' | 'component';
  /** 변경 여부 */
  changed: boolean;
  /** 컴포넌트 이름 (component 타입일 때) */
  name?: string;
  /** 토큰 개수 (tokens 타입일 때) */
  count?: number;
  /** DB 버전 */
  version?: number;
  /** 생성/업데이트 구분 */
  action?: 'create' | 'update';
}

declare global {
  var __sseSubscribers: Set<ReadableStreamDefaultController> | undefined;
}

if (!globalThis.__sseSubscribers) {
  globalThis.__sseSubscribers = new Set();
}

export function addSseSubscriber(ctrl: ReadableStreamDefaultController) {
  globalThis.__sseSubscribers!.add(ctrl);
}

export function removeSseSubscriber(ctrl: ReadableStreamDefaultController) {
  globalThis.__sseSubscribers!.delete(ctrl);
}

export function notifySyncUpdated(event: SyncEvent) {
  const payload = `event: sync\ndata: ${JSON.stringify(event)}\n\n`;
  const msg = new TextEncoder().encode(payload);
  for (const ctrl of [...globalThis.__sseSubscribers!]) {
    try {
      ctrl.enqueue(msg);
    } catch {
      globalThis.__sseSubscribers!.delete(ctrl);
    }
  }
}
