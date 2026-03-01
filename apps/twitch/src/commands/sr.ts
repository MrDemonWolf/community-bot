import { TwitchCommand } from "../types/command.js";
import * as srm from "../services/songRequestManager.js";
import { lookupVideo, isYouTubeEnabled, formatDuration } from "../services/youtubeService.js";
import type { YouTubeVideoInfo } from "../services/youtubeService.js";

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
        .map((e) => {
          const duration = e.youtubeDuration ? ` [${formatDuration(e.youtubeDuration)}]` : "";
          return `${e.position}. ${e.title}${duration} (${e.requestedBy})`;
        })
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
      const duration = current.youtubeDuration ? ` [${formatDuration(current.youtubeDuration)}]` : "";
      const link = current.youtubeVideoId ? ` | https://youtu.be/${current.youtubeVideoId}` : "";
      await client.say(channel, `Now playing: ${current.title}${duration} (requested by ${current.requestedBy})${link}`);
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
      let message = `@${user}, skipped: ${skipped.title} (requested by ${skipped.requestedBy})`;
      if (skipped.autoPlaySong) {
        message += ` | Now playing from playlist: ${skipped.autoPlaySong.title}`;
      }
      await client.say(channel, message);
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

    // --- !sr playlist [list|<name>] ---
    if (sub === "playlist") {
      const playlistSub = args[1]?.toLowerCase();

      if (!playlistSub || playlistSub === "list") {
        const playlists = await srm.listPlaylists(channel);
        if (playlists.length === 0) {
          await client.say(channel, `@${user}, no playlists available. Create one from the dashboard.`);
          return;
        }
        const names = playlists.map((p) => p.name).join(", ");
        await client.say(channel, `Available playlists: ${names}`);
        return;
      }

      // Activate a playlist (mod only)
      if (!isMod) {
        await client.say(channel, `@${user}, only moderators can activate playlists.`);
        return;
      }

      const playlistName = args.slice(1).join(" ");
      const activated = await srm.activatePlaylist(channel, playlistName);
      if (activated) {
        await client.say(channel, `@${user}, playlist "${playlistName}" activated with auto-play enabled.`);
      } else {
        await client.say(channel, `@${user}, playlist "${playlistName}" not found.`);
      }
      return;
    }

    // --- !sr <title> — request a song ---
    if (!sub) {
      await client.say(
        channel,
        `@${user}, usage: !sr <song title> | list | current | skip | remove | clear | playlist`
      );
      return;
    }

    const title = args.join(" ");

    // Look up YouTube metadata if available
    let displayTitle = title;
    let youtubeInfo: YouTubeVideoInfo | undefined = undefined;
    if (isYouTubeEnabled()) {
      const info = await lookupVideo(title);
      if (info) {
        youtubeInfo = info;
        displayTitle = info.title;
      }
    }

    const result = await srm.addRequest(channel, displayTitle, user, msg, youtubeInfo);
    if (result.ok) {
      const duration = youtubeInfo ? ` [${formatDuration(youtubeInfo.duration)}]` : "";
      await client.say(channel, `@${user}, "${displayTitle}"${duration} added to the queue at position ${result.position}.`);
    } else {
      await client.say(channel, `@${user}, ${result.reason}`);
    }
  },
};
