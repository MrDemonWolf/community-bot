import { auth } from "@community-bot/auth";
import { headers } from "next/headers";

import Dashboard from "./dashboard";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  return <Dashboard userName={session?.user.name ?? "there"} />;
}
