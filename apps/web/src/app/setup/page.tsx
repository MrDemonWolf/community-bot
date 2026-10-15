import { auth, isOwner } from "@community-bot/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import SetupWizard from "./setup-wizard";

export default async function SetupPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.emailVerified) redirect("/login");
  if (!isOwner(session.user)) redirect("/access");
  return <SetupWizard />;
}
