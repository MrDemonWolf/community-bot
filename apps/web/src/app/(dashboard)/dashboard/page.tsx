import { headers } from "next/headers";
import { auth } from "@community-bot/auth";
import Dashboard from "./dashboard";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">
        Dashboard
      </h1>
      <Dashboard session={session!} />
    </div>
  );
}
