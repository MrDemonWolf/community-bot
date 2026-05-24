import { auth } from "@community-bot/auth";
import { db } from "@community-bot/db";
import { userMeta } from "@community-bot/db/schema/userMeta";
import { env } from "@community-bot/env/server";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

// Phase 0 permission integer: Manage Roles | Send Messages | Read Message History | Use Slash Commands
const PERMS =
  (1n << 28n) | // MANAGE_ROLES
  (1n << 11n) | // SEND_MESSAGES
  (1n << 16n) | // READ_MESSAGE_HISTORY
  (1n << 31n); // USE_APPLICATION_COMMANDS

const discordBotInvite = new Hono();

async function isBroadcaster(headers: Headers): Promise<boolean> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user?.id) return false;
  const rows = await db
    .select({ role: userMeta.role })
    .from(userMeta)
    .where(eq(userMeta.userId, session.user.id))
    .limit(1);
  return rows[0]?.role === "broadcaster";
}

discordBotInvite.get("/", async (c) => {
  if (!(await isBroadcaster(c.req.raw.headers))) {
    return c.json({ error: "broadcaster only" }, 403);
  }
  if (!env.DISCORD_CLIENT_ID) {
    return c.json({ error: "DISCORD_CLIENT_ID not configured" }, 503);
  }
  const guildId = c.req.query("guild_id");
  const url = new URL("https://discord.com/api/oauth2/authorize");
  url.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  url.searchParams.set("scope", "bot applications.commands");
  url.searchParams.set("permissions", PERMS.toString());
  if (guildId) url.searchParams.set("guild_id", guildId);
  url.searchParams.set("disable_guild_select", guildId ? "true" : "false");
  return c.json({ url: url.toString() });
});

export default discordBotInvite;
