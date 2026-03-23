'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import {
  loginSchema,
  registerSchema,
  changePasswordSchema,
  addUserSchema,
  type LoginForm,
  type RegisterForm,
  type ChangePasswordForm,
  type AddUserForm,
} from '@/lib/auth/schema';

// ────────────────────────────────────
// 유틸
// ────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

export async function getUserCount(): Promise<number> {
  const result = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .limit(1);
  return result.length;
}

// ────────────────────────────────────
// register — 최초 admin 계정 생성
// ────────────────────────────────────

export async function register(data: RegisterForm): Promise<{ error?: string }> {
  const parsed = registerSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  const count = await getUserCount();
  if (count > 0) {
    return { error: '이미 계정이 존재합니다. 로그인해주세요.' };
  }

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, parsed.data.email))
    .limit(1);
  if (existing.length > 0) {
    return { error: '이미 사용 중인 이메일입니다.' };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await db.insert(schema.users).values({
    id: generateId(),
    email: parsed.data.email,
    passwordHash,
    role: 'admin',
  });

  const session = await getSession();
  const user = (
    await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, parsed.data.email))
      .limit(1)
  )[0];

  if (!user) return { error: '계정 생성에 실패했습니다.' };

  session.userId = user.id;
  session.email = user.email;
  session.role = user.role;
  session.isLoggedIn = true;
  await session.save();

  return {};
}

// ────────────────────────────────────
// login
// ────────────────────────────────────

export async function login(data: LoginForm): Promise<{ error?: string }> {
  const parsed = loginSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  const users = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, parsed.data.email))
    .limit(1);

  const user = users[0];

  // 존재 여부와 비밀번호 오류를 동일 메시지로 처리 (이메일 존재 여부 노출 방지)
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
  }

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.role = user.role;
  session.isLoggedIn = true;
  await session.save();

  return {};
}

// ────────────────────────────────────
// logout
// ────────────────────────────────────

export async function logout(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect('/login');
}

// ────────────────────────────────────
// changePassword — 본인 비밀번호 변경
// ────────────────────────────────────

export async function changePassword(data: ChangePasswordForm): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return { error: '로그인이 필요합니다.' };
  }

  const parsed = changePasswordSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  const users = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);

  const user = users[0];
  if (!user) return { error: '사용자를 찾을 수 없습니다.' };

  const isValid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!isValid) {
    return { error: '현재 비밀번호가 올바르지 않습니다.' };
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db
    .update(schema.users)
    .set({ passwordHash: newHash })
    .where(eq(schema.users.id, session.userId));

  return {};
}

// ────────────────────────────────────
// addUser — 사용자 추가 (admin 전용)
// ────────────────────────────────────

export async function addUser(data: AddUserForm): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== 'admin') {
    return { error: '관리자 권한이 필요합니다.' };
  }

  const parsed = addUserSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, parsed.data.email))
    .limit(1);

  if (existing.length > 0) {
    return { error: '이미 사용 중인 이메일입니다.' };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await db.insert(schema.users).values({
    id: generateId(),
    email: parsed.data.email,
    passwordHash,
    role: 'member',
  });

  return {};
}

// ────────────────────────────────────
// deleteUser — 사용자 삭제 (admin 전용)
// ────────────────────────────────────

export async function deleteUser(userId: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== 'admin') {
    return { error: '관리자 권한이 필요합니다.' };
  }

  if (userId === session.userId) {
    return { error: '자신의 계정은 삭제할 수 없습니다.' };
  }

  await db.delete(schema.users).where(eq(schema.users.id, userId));
  return {};
}

// ────────────────────────────────────
// getCurrentUser — 현재 세션 사용자 정보
// ────────────────────────────────────

export async function getCurrentUser(): Promise<{
  id: string;
  email: string;
  role: 'admin' | 'member';
} | null> {
  const session = await getSession();
  if (!session.isLoggedIn) return null;
  return { id: session.userId, email: session.email, role: session.role };
}

// ────────────────────────────────────
// getUsers — 사용자 목록 (admin 전용)
// ────────────────────────────────────

export async function getUsers(): Promise<
  Array<{ id: string; email: string; role: string; createdAt: Date }>
> {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== 'admin') return [];

  return db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users);
}
