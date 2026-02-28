import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@community-bot/auth";
import { prisma } from "@community-bot/db";
import { isSetupComplete } from "@/lib/setup";
import DashboardHeader from "@/components/dashboard-header";
import DashboardSidebar from "./components/dashboard-sidebar";
import { ShieldAlert } from "lucide-react";

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

  // Guard: check if the user is banned
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { banned: true, banReason: true },
  });

  if (user?.banned) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">
            Account Suspended
          </h1>
          <p className="mb-4 text-muted-foreground">
            Your account has been suspended and you cannot access the dashboard.
          </p>
          {user.banReason && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Reason:</span>{" "}
                {user.banReason}
              </p>
            </div>
          )}
        </div>
      </div>
    );
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
