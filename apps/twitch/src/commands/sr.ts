import { TwitchCommand } from "../types/command.js";
import * as srm from "../services/songRequestManager.js";

export const sr: TwitchCommand = {
  name: "sr",
  description: "Song request queue management.",
  async execute(client, channel, user, args, msg) {
    const sub = args[0]?.toLowerCase();
    const isMod = msg.userInfo.isMod || msg.userInfo.isBroadcaster;

    // --- !sr on / !sr off (mod only) ---
    if (sub === "on") {
      if (!isMod) {
        await client.say(channel, `@${user}, only moderators can enable song requests.`);
        return;
      }
      // This is a convenience toggle; real settings are managed from the dashboard.
      await client.say(channel, `@${user}, use the web dashboard to enable/disable song requests.`);
      return;
    }

    if (sub === "off") {
      if (!isMod) {
        await client.say(channel, `@${user}, only moderators can disable song requests.`);
        return;
      }
      await client.say(channel, `@${user}, use the web dashboard to enable/disable song requests.`);
      return;
    }

    // --- !sr list / !sr queue ---
    if (sub === "list" || sub === "queue") {
      const entries = await srm.listRequests(channel);
      if (entries.length === 0) {
        await client.say(channel, `@${user}, the song request queue is empty.`);
        return;
      }
      const total = await srm.getQueueCount(channel);
      const display = entries
        .map((e) => `${e.position}. ${e.title} (${e.requestedBy})`)
        .join(", ");
      const suffix = total > entries.length ? ` (${total} total)` : "";
      await client.say(channel, `Song queue: ${display}${suffix}`);
      return;
    }

    // --- !sr current ---
    if (sub === "current") {
      const current = await srm.currentRequest(channel);
      if (!current) {
        await client.say(channel, `@${user}, no song is currently queued.`);
        return;
      }
      await client.say(channel, `Now playing: ${current.title} (requested by ${current.requestedBy})`);
      return;
    }

    // --- !sr skip (mod only) ---
    if (sub === "skip") {
      if (!isMod) {
        await client.say(channel, `@${user}, only moderators can skip songs.`);
        return;
      }
      const skipped = await srm.skipRequest(channel);
      if (!skipped) {
        await client.say(channel, `@${user}, the song request queue is empty.`);
        return;
      }
      await client.say(channel, `@${user}, skipped: ${skipped.title} (requested by ${skipped.requestedBy})`);
      return;
    }

    // --- !sr remove [position] ---
    if (sub === "remove") {
      const posArg = args[1];

      // Mods can remove any position
      if (isMod && posArg) {
        const pos = parseInt(posArg, 10);
        if (isNaN(pos) || pos < 1) {
          await client.say(channel, `@${user}, usage: !sr remove <position>`);
          return;
        }
        const removed = await srm.removeRequest(channel, pos);
        if (removed) {
          await client.say(channel, `@${user}, removed song at position ${pos}.`);
        } else {
          await client.say(channel, `@${user}, no song found at position ${pos}.`);
        }
        return;
      }

      // Viewers can remove their own requests
      const count = await srm.removeByUser(channel, user);
      if (count > 0) {
        await client.say(channel, `@${user}, removed ${count} of your song request(s).`);
      } else {
        await client.say(channel, `@${user}, you have no songs in the queue.`);
      }
      return;
    }

    // --- !sr clear (mod only) ---
    if (sub === "clear") {
      if (!isMod) {
        await client.say(channel, `@${user}, only moderators can clear the queue.`);
        return;
      }
      await srm.clearRequests(channel);
      await client.say(channel, `@${user}, song request queue cleared.`);
      return;
    }

    // --- !sr <title> — request a song ---
    if (!sub) {
      await client.say(
        channel,
        `@${user}, usage: !sr <song title> | list | current | skip | remove | clear`
      );
      return;
    }

    const title = args.join(" ");
    const result = await srm.addRequest(channel, title, user, msg);
    if (result.ok) {
      await client.say(channel, `@${user}, "${title}" added to the queue at position ${result.position}.`);
    } else {
      await client.say(channel, `@${user}, ${result.reason}`);
    }
  },
};
