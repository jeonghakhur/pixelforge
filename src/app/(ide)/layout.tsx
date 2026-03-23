import AppShell from '../AppShell';

export default function IDELayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
