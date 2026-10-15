import Rewards from "./rewards";
import { auth } from "@community-bot/auth";
import { resolveAccess } from "@community-bot/api/access";
import { canAccess } from "@community-bot/core/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function RewardsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !canAccess(await resolveAccess(session.user), "redemptions:view", "twitch")) redirect("/dashboard");
  return <Rewards />;
}
