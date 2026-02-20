import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@community-bot/auth";
import { isSetupComplete } from "@/lib/setup";
import DashboardHeader from "@/components/dashboard-header";
import DashboardSidebar from "./components/dashboard-sidebar";

// Disable static rendering — the layout depends on session state and
// setup status, which must be checked on every request.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Guard: redirect to landing page if setup wizard hasn't been completed.
  // This prevents access to the dashboard before the broadcaster is set.
  if (!(await isSetupComplete())) {
    redirect("/");
  }

  // Guard: require an authenticated session for all dashboard routes.
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex h-svh flex-col">
      <DashboardHeader session={session} />
      <div className="flex flex-1 overflow-hidden">
        <DashboardSidebar session={session} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
