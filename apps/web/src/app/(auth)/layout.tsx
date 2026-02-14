export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-svh bg-gradient-to-b from-muted to-background">
      {children}
    </div>
  );
}
