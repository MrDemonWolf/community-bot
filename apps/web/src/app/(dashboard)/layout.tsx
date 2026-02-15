import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@community-bot/auth";
import { isSetupComplete } from "@/lib/setup";
import DashboardHeader from "@/components/dashboard-header";
import DashboardSidebar from "./components/dashboard-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isSetupComplete())) {
    redirect("/");
  }

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
