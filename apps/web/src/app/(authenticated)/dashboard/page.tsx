import { auth } from "@community-bot/auth";
import { headers } from "next/headers";

import DashboardContent from "./dashboard-content";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return <DashboardContent userName={session?.user?.name ?? "User"} />;
}
