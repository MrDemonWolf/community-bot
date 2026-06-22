import { auth } from "@community-bot/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import SetupWizard from "./setup-wizard";

export default async function SetupPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  return <SetupWizard />;
}
