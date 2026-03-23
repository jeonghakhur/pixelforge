import { getIronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  userId: string;
  email: string;
  role: 'admin' | 'member';
  isLoggedIn: boolean;
}

const secret = process.env.SESSION_SECRET ?? 'pixelforge-dev-secret-key-32chars!!';

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
