import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@community-bot/auth";
import DashboardSidebar from "./components/dashboard-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-[calc(100svh-60px)]">
      <DashboardSidebar session={session} />
      <main className="flex-1 p-6 lg:p-8">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
