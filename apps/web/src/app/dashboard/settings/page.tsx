import { auth } from "@community-bot/auth";
import { resolveAccess } from "@community-bot/api/access";
import { canAccess } from "@community-bot/core/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Settings from "./settings";

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.emailVerified) redirect("/login");
  const access = await resolveAccess(session.user);
  if (!access.owner && !canAccess(access, "presence:manage", "discord")) redirect("/dashboard");
  return <Settings />;
}
