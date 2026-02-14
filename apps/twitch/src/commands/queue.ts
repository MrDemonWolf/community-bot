import { TwitchCommand } from "../types/command.js";
import { QueueStatus } from "@community-bot/db";
import * as qm from "../services/queueManager.js";

export const queue: TwitchCommand = {
  name: "queue",
  description: "Manage and participate in the viewer queue.",
  async execute(client, channel, user, args, msg) {
    const sub = args[0]?.toLowerCase();
    const isMod = msg.userInfo.isMod || msg.userInfo.isBroadcaster;

    // --- Viewer subcommands ---

    if (sub === "join") {
      const result = await qm.join(msg.userInfo.userId, user);
      if (result.ok) {
        await client.say(channel, `@${user}, you joined the queue at position ${result.position}.`);
      } else {
        await client.say(channel, `@${user}, ${result.reason}`);
      }
      return;
    }

    if (sub === "leave") {
      const left = await qm.leave(msg.userInfo.userId);
      if (left) {
        await client.say(channel, `@${user}, you have been removed from the queue.`);
      } else {
        await client.say(channel, `@${user}, you are not in the queue.`);
      }
      return;
    }

    if (sub === "position") {
      const pos = await qm.getPosition(msg.userInfo.userId);
      if (pos !== null) {
        await client.say(channel, `@${user}, you are at position ${pos} in the queue.`);
      } else {
        await client.say(channel, `@${user}, you are not in the queue.`);
      }
      return;
    }

    if (sub === "list") {
      const entries = await qm.listEntries();
      if (entries.length === 0) {
        await client.say(channel, `@${user}, the queue is empty.`);
        return;
      }
      const display = entries
        .slice(0, 10)
        .map((e) => `${e.position}. ${e.twitchUsername}`)
        .join(", ");
      const suffix = entries.length > 10 ? ` (and ${entries.length - 10} more)` : "";
      await client.say(channel, `Queue: ${display}${suffix}`);
      return;
    }

    // --- Mod/broadcaster subcommands ---

    if (!isMod) {
      await client.say(channel, `@${user}, usage: !queue join | leave | position | list`);
      return;
    }

    if (sub === "open") {
      await qm.setQueueStatus(QueueStatus.OPEN);
      await client.say(channel, `@${user}, the queue is now open!`);
      return;
    }

    if (sub === "close") {
      await qm.setQueueStatus(QueueStatus.CLOSED);
      await client.say(channel, `@${user}, the queue is now closed.`);
      return;
    }

    if (sub === "pause") {
      await qm.setQueueStatus(QueueStatus.PAUSED);
      await client.say(channel, `@${user}, the queue is now paused.`);
      return;
    }

    if (sub === "unpause") {
      await qm.setQueueStatus(QueueStatus.OPEN);
      await client.say(channel, `@${user}, the queue has been unpaused and is now open!`);
      return;
    }

    if (sub === "pick") {
      const mode = args[1]?.toLowerCase() ?? "next";
      const picked = await qm.pick(mode);
      if (picked) {
        await client.say(channel, `@${user}, picked: ${picked.twitchUsername} (was position ${picked.position})`);
      } else {
        await client.say(channel, `@${user}, no one to pick from the queue.`);
      }
      return;
    }

    if (sub === "remove") {
      const target = args[1];
      if (!target) {
        await client.say(channel, `@${user}, usage: !queue remove <username>`);
        return;
      }
      const removed = await qm.remove(target.replace(/^@/, ""));
      if (removed) {
        await client.say(channel, `@${user}, removed ${target} from the queue.`);
      } else {
        await client.say(channel, `@${user}, ${target} is not in the queue.`);
      }
      return;
    }

    if (sub === "clear") {
      await qm.clear();
      await client.say(channel, `@${user}, the queue has been cleared.`);
      return;
    }

    await client.say(
      channel,
      `@${user}, usage: !queue open | close | pause | unpause | pick [random|username] | remove <user> | clear | join | leave | position | list`
    );
  },
};
