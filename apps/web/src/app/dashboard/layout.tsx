import { auth } from "@community-bot/auth";
import { getSettings } from "@community-bot/db/settings";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import AppShell from "@/components/app-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const settings = await getSettings();
  if (!settings.setupComplete) redirect("/setup");

  return (
    <AppShell userName={session.user.name} botName={settings.botName}>
      {children}
    </AppShell>
  );
}
