import { TwitchCommand } from "../types/command.js";
import { db, eq, and, sql } from "@community-bot/db";
import { botChannels, twitchCounters } from "@community-bot/db";

function stripHash(channel: string): string {
  return channel.startsWith("#") ? channel.slice(1) : channel;
}

async function getBotChannelId(channel: string): Promise<string | null> {
  const username = stripHash(channel).toLowerCase();
  const botChannel = await db.query.botChannels.findFirst({
    where: eq(botChannels.twitchUsername, username),
  });
  return botChannel?.id ?? null;
}

export const counter: TwitchCommand = {
  name: "counter",
  description: "Manage named counters.",
  async execute(client, channel, user, args, msg) {
    if (!msg.userInfo.isMod && !msg.userInfo.isBroadcaster) {
      return;
    }

    const botChannelId = await getBotChannelId(channel);
    if (!botChannelId) {
      await client.say(channel, `@${user}, bot channel not configured.`);
      return;
    }

    const name = args[0]?.toLowerCase();
    if (!name) {
      await client.say(channel, `@${user}, usage: !counter <name> [+|-|set <value>|create|delete]`);
      return;
    }

    const action = args[1]?.toLowerCase();

    // !counter <name> create
    if (action === "create") {
      try {
        await db.insert(twitchCounters).values({ name, botChannelId });
        await client.say(channel, `@${user}, counter "${name}" created (value: 0).`);
      } catch (err: any) {
        if (err?.code === "23505") {
          await client.say(channel, `@${user}, counter "${name}" already exists.`);
        } else {
          throw err;
        }
      }
      return;
    }

    // !counter <name> delete
    if (action === "delete") {
      const deleted = await db
        .delete(twitchCounters)
        .where(
          and(
            eq(twitchCounters.name, name),
            eq(twitchCounters.botChannelId, botChannelId)
          )
        )
        .returning();
      if (deleted.length === 0) {
        await client.say(channel, `@${user}, counter "${name}" not found.`);
      } else {
        await client.say(channel, `@${user}, counter "${name}" deleted.`);
      }
      return;
    }

    // All other actions require the counter to exist
    const existing = await db.query.twitchCounters.findFirst({
      where: and(
        eq(twitchCounters.name, name),
        eq(twitchCounters.botChannelId, botChannelId)
      ),
    });

    if (!existing) {
      await client.say(channel, `@${user}, counter "${name}" does not exist. Use !counter ${name} create`);
      return;
    }

    // !counter <name> + / increment
    if (action === "+" || action === "increment") {
      const [updated] = await db
        .update(twitchCounters)
        .set({ value: sql`${twitchCounters.value} + 1` })
        .where(eq(twitchCounters.id, existing.id))
        .returning();
      await client.say(channel, `${name}: ${updated.value}`);
      return;
    }

    // !counter <name> - / decrement
    if (action === "-" || action === "decrement") {
      const [updated] = await db
        .update(twitchCounters)
        .set({ value: sql`${twitchCounters.value} - 1` })
        .where(eq(twitchCounters.id, existing.id))
        .returning();
      await client.say(channel, `${name}: ${updated.value}`);
      return;
    }

    // !counter <name> set <value>
    if (action === "set") {
      const val = parseInt(args[2], 10);
      if (isNaN(val)) {
        await client.say(channel, `@${user}, usage: !counter ${name} set <number>`);
        return;
      }
      const [updated] = await db
        .update(twitchCounters)
        .set({ value: val })
        .where(eq(twitchCounters.id, existing.id))
        .returning();
      await client.say(channel, `${name}: ${updated.value}`);
      return;
    }

    // !counter <name> — show value
    await client.say(channel, `${name}: ${existing.value}`);
  },
};
