import HomeSidebar from "@/components/layout/sidebar";

interface Props {
  children: React.ReactNode;
}

export default function HomeLayout({ children }: Props) {
  return (
    <div className="flex h-screen w-screen">
      <HomeSidebar />
      <main className="flex-1 flex flex-col bg-muted overflow-hidden">
        <div className="h-full overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
