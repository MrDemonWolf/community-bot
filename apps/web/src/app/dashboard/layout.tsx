import { auth } from "@community-bot/auth";
import { resolveAccess } from "@community-bot/api/access";
import { canAccess } from "@community-bot/core/permissions";
import { getSettings } from "@community-bot/db/settings";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AppShell from "@/components/app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.emailVerified) redirect("/login");
  const access = await resolveAccess(session.user);
  if (!canAccess(access, "dashboard:view")) redirect("/access");
  const settings = await getSettings();
  return (
    <AppShell userName={session.user.name} botName={settings.botName} access={access} publicPageEnabled={settings.publicPageEnabled}>
      {children}
    </AppShell>
  );
}
