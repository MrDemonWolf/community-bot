import type { TwitchCommand } from "../types/command.js";
import { getUserAccessLevel, meetsAccessLevel } from "../services/accessControl.js";
import { TwitchAccessLevel } from "@community-bot/db";
import { helixFetch, helixPost, helixPatch } from "../services/helixClient.js";
import { getBroadcasterId } from "../services/broadcasterCache.js";

export const poll: TwitchCommand = {
  name: "poll",
  description: "Create and manage Twitch polls. Usage: !poll create \"Question\" \"Opt1\" \"Opt2\" [duration] | !poll end | !poll results",
  async execute(chatClient, channel, user, args, msg) {
    const userLevel = getUserAccessLevel(msg);
    if (!meetsAccessLevel(userLevel, TwitchAccessLevel.MODERATOR)) return;

    const subCommand = args[0]?.toLowerCase();
    const broadcasterId = getBroadcasterId(channel);
    if (!broadcasterId) {
      chatClient.say(channel, `@${user}, Could not resolve broadcaster ID.`);
      return;
    }

    if (subCommand === "create") {
      // Parse quoted strings from args
      const fullText = args.slice(1).join(" ");
      const quoted = fullText.match(/"([^"]+)"/g);
      if (!quoted || quoted.length < 3) {
        chatClient.say(channel, `@${user}, Usage: !poll create "Question" "Option 1" "Option 2" [duration in seconds]`);
        return;
      }

      const question = quoted[0].replace(/"/g, "");
      const choices = quoted.slice(1).map((q) => ({ title: q.replace(/"/g, "") }));

      // Optional duration (last non-quoted arg or default 60)
      const remaining = fullText.replace(/"[^"]+"/g, "").trim();
      const duration = parseInt(remaining, 10) || 60;

      try {
        await helixPost("polls", {
          broadcaster_id: broadcasterId,
          title: question,
          choices,
          duration: Math.min(Math.max(duration, 15), 1800),
        });
        chatClient.say(channel, `Poll started: ${question}`);
      } catch {
        chatClient.say(channel, `@${user}, Failed to create poll.`);
      }
    } else if (subCommand === "end") {
      try {
        // Get active poll first
        const polls = await helixFetch<{ id: string; status: string }>("polls", {
          broadcaster_id: broadcasterId,
          first: "1",
        });
        const activePoll = polls.data.find((p) => p.status === "ACTIVE");
        if (!activePoll) {
          chatClient.say(channel, `@${user}, No active poll found.`);
          return;
        }
        await helixPatch("polls", {
          broadcaster_id: broadcasterId,
          id: activePoll.id,
          status: "TERMINATED",
        });
        chatClient.say(channel, `Poll ended.`);
      } catch {
        chatClient.say(channel, `@${user}, Failed to end poll.`);
      }
    } else if (subCommand === "results") {
      try {
        const polls = await helixFetch<{
          id: string;
          title: string;
          status: string;
          choices: { title: string; votes: number }[];
        }>("polls", {
          broadcaster_id: broadcasterId,
          first: "1",
        });
        const p = polls.data[0];
        if (!p) {
          chatClient.say(channel, `@${user}, No polls found.`);
          return;
        }
        const results = p.choices
          .map((c) => `${c.title}: ${c.votes}`)
          .join(" | ");
        chatClient.say(channel, `[${p.status}] ${p.title} — ${results}`);
      } catch {
        chatClient.say(channel, `@${user}, Failed to get poll results.`);
      }
    } else {
      chatClient.say(channel, `@${user}, Usage: !poll create|end|results`);
    }
  },
};
