import { headers } from "next/headers";
import { auth } from "@community-bot/auth";
import { env } from "@community-bot/env/server";
import DiscordSettings from "./discord-settings";
import { PlatformBadges } from "@/components/platform-badges";

export const dynamic = "force-dynamic";

export default async function DiscordPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  return (
    <div>
      <h1 className="mb-6 flex items-center gap-3 font-heading text-2xl font-bold text-foreground">
        Discord Settings <PlatformBadges platforms={["discord"]} />
      </h1>
      <DiscordSettings discordAppId={env.DISCORD_APPLICATION_ID} />
    </div>
  );
}
