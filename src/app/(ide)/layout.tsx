import { getCurrentUser } from '@/lib/actions/auth';
import AppShell from '../AppShell';

export default async function IDELayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const userRole = user?.role ?? 'member';
  return <AppShell userRole={userRole}>{children}</AppShell>;
}
