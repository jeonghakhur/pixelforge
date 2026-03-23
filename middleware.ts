import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import type { SessionData } from '@/lib/auth/session';
import { SESSION_OPTIONS } from '@/lib/auth/session';

const PUBLIC_PATHS = ['/login', '/register', '/viewer'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, SESSION_OPTIONS);

  if (isPublic && session.isLoggedIn) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (!isPublic && !session.isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
