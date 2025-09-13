export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-gray-100">{/* Sidebar */}</aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
