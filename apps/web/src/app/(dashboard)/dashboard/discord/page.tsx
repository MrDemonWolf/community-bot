import { headers } from "next/headers";
import { auth } from "@community-bot/auth";
import { env } from "@community-bot/env/server";
import { PageHeader } from "@/components/page-header";
import DiscordSettings from "./discord-settings";

export const dynamic = "force-dynamic";

export default async function DiscordPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  return (
    <div>
      <PageHeader title="Discord Settings" platforms={["discord"]} />
      <DiscordSettings discordAppId={env.DISCORD_APPLICATION_ID} />
    </div>
  );
}
