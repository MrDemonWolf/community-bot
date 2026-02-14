import { TwitchCommand } from "../types/command.js";
import { helixFetch } from "../services/helixClient.js";

function formatDuration(from: Date, to: Date): string {
  let years = to.getFullYear() - from.getFullYear();
  let months = to.getMonth() - from.getMonth();
  let days = to.getDate() - from.getDate();
  let hours = to.getHours() - from.getHours();

  if (hours < 0) {
    hours += 24;
    days--;
  }
  if (days < 0) {
    months--;
    const prevMonth = new Date(to.getFullYear(), to.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years !== 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} month${months !== 1 ? "s" : ""}`);
  if (days > 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);

  return parts.length > 0 ? parts.join(" ") : "less than an hour";
}

export const accountage: TwitchCommand = {
  name: "accountage",
  description: "Check how old a Twitch account is.",
  async execute(client, channel, user, args) {
    const target = args[0] ?? user;
    const login = target.replace(/^@/, "").toLowerCase();

    try {
      const data = await helixFetch<{ display_name: string; created_at: string }>("users", { login });
      const users = data?.data;

      if (!users || users.length === 0) {
        await client.say(channel, `@${user}, user "${login}" not found.`);
        return;
      }

      const createdAt = new Date(users[0].created_at);
      const duration = formatDuration(createdAt, new Date());

      await client.say(
        channel,
        `@${user}, ${users[0].display_name} was created ${duration} ago`
      );
    } catch {
      await client.say(
        channel,
        `@${user}, failed to look up account age.`
      );
    }
  },
};
