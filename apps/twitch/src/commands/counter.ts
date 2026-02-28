import { TwitchCommand } from "../types/command.js";
import { Prisma, prisma } from "@community-bot/db";

function stripHash(channel: string): string {
  return channel.startsWith("#") ? channel.slice(1) : channel;
}

async function getBotChannelId(channel: string): Promise<string | null> {
  const username = stripHash(channel).toLowerCase();
  const botChannel = await prisma.botChannel.findFirst({
    where: { twitchUsername: username },
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
        await prisma.twitchCounter.create({
          data: { name, botChannelId },
        });
        await client.say(channel, `@${user}, counter "${name}" created (value: 0).`);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          await client.say(channel, `@${user}, counter "${name}" already exists.`);
        } else {
          throw err;
        }
      }
      return;
    }

    // !counter <name> delete
    if (action === "delete") {
      try {
        await prisma.twitchCounter.delete({
          where: { name_botChannelId: { name, botChannelId } },
        });
        await client.say(channel, `@${user}, counter "${name}" deleted.`);
      } catch {
        await client.say(channel, `@${user}, counter "${name}" not found.`);
      }
      return;
    }

    // All other actions require the counter to exist
    const existing = await prisma.twitchCounter.findUnique({
      where: { name_botChannelId: { name, botChannelId } },
    });

    if (!existing) {
      await client.say(channel, `@${user}, counter "${name}" does not exist. Use !counter ${name} create`);
      return;
    }

    // !counter <name> + / increment
    if (action === "+" || action === "increment") {
      const updated = await prisma.twitchCounter.update({
        where: { id: existing.id },
        data: { value: { increment: 1 } },
      });
      await client.say(channel, `${name}: ${updated.value}`);
      return;
    }

    // !counter <name> - / decrement
    if (action === "-" || action === "decrement") {
      const updated = await prisma.twitchCounter.update({
        where: { id: existing.id },
        data: { value: { decrement: 1 } },
      });
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
      const updated = await prisma.twitchCounter.update({
        where: { id: existing.id },
        data: { value: val },
      });
      await client.say(channel, `${name}: ${updated.value}`);
      return;
    }

    // !counter <name> — show value
    await client.say(channel, `${name}: ${existing.value}`);
  },
};
