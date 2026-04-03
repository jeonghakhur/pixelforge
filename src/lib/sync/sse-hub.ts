/**
 * SSE 구독자 허브 — globalThis 싱글턴
 *
 * Next.js App Router는 route 파일을 별도 번들로 컴파일하므로
 * 모듈 레벨 변수는 route 간 공유되지 않는다.
 * globalThis를 사용해 단일 인스턴스를 보장한다.
 */

declare global {
  // eslint-disable-next-line no-var
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

export function notifySyncUpdated() {
  const msg = new TextEncoder().encode('data: sync\n\n');
  for (const ctrl of [...globalThis.__sseSubscribers!]) {
    try {
      ctrl.enqueue(msg);
    } catch {
      globalThis.__sseSubscribers!.delete(ctrl);
    }
  }
}
