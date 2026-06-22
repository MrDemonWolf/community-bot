import { auth } from "@community-bot/auth";
import { getSettings } from "@community-bot/db/settings";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import Dashboard from "./dashboard";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const settings = await getSettings();
  if (!settings.setupComplete) redirect("/setup");

  return <Dashboard />;
}
