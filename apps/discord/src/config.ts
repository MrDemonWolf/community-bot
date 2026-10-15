export interface DiscordConfig {
  token: string;
  applicationId: string;
  guildId: string;
  port: number;
}

export function readConfig(env: NodeJS.ProcessEnv): DiscordConfig {
  const required = [
    "DISCORD_APPLICATION_BOT_TOKEN",
    "DISCORD_APPLICATION_ID",
    "DISCORD_GUILD_ID",
  ] as const;
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }

  const token = env.DISCORD_APPLICATION_BOT_TOKEN!.trim();
  if (/\s/.test(token) || token.startsWith("Bot ")) {
    throw new Error("DISCORD_APPLICATION_BOT_TOKEN must be the raw bot token");
  }
  const applicationId = env.DISCORD_APPLICATION_ID!.trim();
  const guildId = env.DISCORD_GUILD_ID!.trim();
  if (!/^\d{17,20}$/.test(applicationId) || !/^\d{17,20}$/.test(guildId)) {
    throw new Error("DISCORD_APPLICATION_ID and DISCORD_GUILD_ID must be Discord IDs");
  }

  const port = Number(env.PORT ?? "3003");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer from 1 to 65535");
  }
  return { token, applicationId, guildId, port };
}
