import Header from "@/components/header";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative min-h-svh">
      <Header />
      <main>{children}</main>
    </div>
  );
}
