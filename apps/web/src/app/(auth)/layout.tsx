export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative h-svh overflow-hidden bg-gradient-to-br from-brand-accent via-background to-background">
      {/* Ambient glow orbs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-brand-main/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-brand-twitch/10 blur-3xl" />
      <div className="relative h-full">{children}</div>
    </div>
  );
}
