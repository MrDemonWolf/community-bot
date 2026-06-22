import "./load-env";

import { getSettings, updateSettings } from "@community-bot/db/settings";
import { decodeToken, encodeToken } from "@community-bot/db/twitch";
import { env } from "@community-bot/env/server";
import { RefreshingAuthProvider } from "@twurple/auth";
import { ChatClient } from "@twurple/chat";

const log = (...a: unknown[]) => console.log("[worker]", ...a);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
    log("TWITCH_CLIENT_ID/SECRET not set — register the Twitch app and restart. Idle.");
    return;
  }

  // Wait until the wizard has connected the wolfaid bot account + set a channel.
  let settings = await getSettings();
  while (!settings.botTokenEnc || !settings.botUserId || !settings.channelName) {
    log("waiting for bot connection + channel (finish the setup wizard)…");
    await sleep(10_000);
    settings = await getSettings();
  }

  const authProvider = new RefreshingAuthProvider({
    clientId: env.TWITCH_CLIENT_ID,
    clientSecret: env.TWITCH_CLIENT_SECRET,
  });

  // Persist refreshed bot tokens back to the settings row.
  authProvider.onRefresh(async (_userId, newToken) => {
    await updateSettings({ botTokenEnc: encodeToken(newToken) });
    log("bot token refreshed");
  });

  await authProvider.addUser(settings.botUserId, decodeToken(settings.botTokenEnc), ["chat"]);

  const channel = settings.channelName;
  const prefix = settings.commandPrefix;
  const chat = new ChatClient({ authProvider, channels: [channel] });

  chat.onConnect(() => log(`connected to #${channel} as ${settings.botLogin}`));
  chat.onDisconnect((manual, reason) => log("disconnected", { manual, reason: reason?.message }));

  chat.onMessage(async (chan, user, text) => {
    if (!text.startsWith(prefix)) return;
    const cmd = text.slice(prefix.length).split(/\s+/)[0]?.toLowerCase();
    // ponytail: hardcoded test command only. M1.1 command engine plugs in here
    // (DB lookup keyed on cmd, with the M1.2 variable parser + M1.3 perms/cooldowns).
    if (cmd === "ping") {
      await chat.say(chan, `@${user} pong 🐺`);
    }
  });

  await chat.connect();
  log("chat worker running");
}

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
