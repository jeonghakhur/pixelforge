export const dynamic = 'force-dynamic';

import { addSseSubscriber, removeSseSubscriber } from '@/lib/sync/sse-hub';

// GET /api/sync/events — SSE 스트림
export async function GET() {
  const encoder = new TextEncoder();
  let ctrl: ReadableStreamDefaultController;
  let timer: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(c) {
      ctrl = c;
      addSseSubscriber(c);

      // 25초마다 keep-alive ping (프록시 타임아웃 방지)
      timer = setInterval(() => {
        try {
          c.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(timer);
          removeSseSubscriber(c);
        }
      }, 25_000);
    },
    cancel() {
      clearInterval(timer);
      removeSseSubscriber(ctrl);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
