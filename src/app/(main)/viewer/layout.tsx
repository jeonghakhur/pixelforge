export default function ViewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="viewer-layout">
      {children}
    </div>
  );
}
