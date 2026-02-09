import { auth } from "@community-bot/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import Header from "@/components/header";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/sign-in");
  }

  return (
    <div className="grid min-h-svh grid-rows-[auto_1fr]">
      <Header />
      {children}
    </div>
  );
}
