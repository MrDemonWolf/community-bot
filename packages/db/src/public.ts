import { getSettings } from "./settings";
import { getRuntimes } from "./runtime";
import { getFeatureConfigs } from "./features";
import { featureEnabled } from "@community-bot/core/features";
import { commandList } from "@community-bot/core/commands";
export { commandList } from "@community-bot/core/commands";

export async function getPublicChannel() {
  const s = await getSettings();
  if (!s.publicPageEnabled) return null;
  const runtimes = await getRuntimes();
  const features = await getFeatureConfigs();
  const state = (service: string) => {
    const row = runtimes.find((r) => r.service === service);
    return row && !row.stale ? row.state : "offline";
  };
  const twitch = runtimes.find((r) => r.service === "twitch");
  const stream = twitch && !twitch.stale ? twitch.metadata : {};
  return {
    botName: s.botName,
    channelName: s.channelName,
    description: s.publicDescription,
    commands: featureEnabled("uptime", features, "twitch") ? commandList(s.commandPrefix) : [],
    discord: { state: state("discord") },
    twitch: {
      state: state("twitch"),
      live: typeof stream.live === "boolean" ? stream.live : null,
      title: typeof stream.title === "string" ? stream.title : null,
      category: typeof stream.category === "string" ? stream.category : null,
      viewers: typeof stream.viewers === "number" ? stream.viewers : null,
      streamStartedAt:
        typeof stream.streamStartedAt === "string"
          ? stream.streamStartedAt
          : null,
    },
  };
}
