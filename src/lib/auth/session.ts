import { getIronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  userId: string;
  email: string;
  role: 'admin' | 'member';
  isLoggedIn: boolean;
}

function getSecret(): string {
  const env = process.env.SESSION_SECRET;
  if (env && env.length >= 32) return env;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET 환경변수를 설정하세요. (최소 32자)');
  }
  return 'pf-dev-only-do-not-use-in-prod!!';
}

const secret = getSecret();

export const SESSION_OPTIONS: SessionOptions = {
  password: secret,
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
