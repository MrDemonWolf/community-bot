import { helixFetch } from "./helixClient.js";

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years !== 1 ? "s" : ""}`);
  if (months % 12 > 0) parts.push(`${months % 12} month${months % 12 !== 1 ? "s" : ""}`);
  if (days % 30 > 0 && years === 0) parts.push(`${days % 30} day${days % 30 !== 1 ? "s" : ""}`);
  if (parts.length === 0 && hours > 0) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  if (parts.length === 0) parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);

  return parts.slice(0, 2).join(", ");
}

export async function getFollowage(
  broadcasterId: string,
  userId: string
): Promise<string> {
  try {
    const res = await helixFetch<{ followed_at: string }>(
      "channels/followers",
      { broadcaster_id: broadcasterId, user_id: userId }
    );
    const follow = res.data[0];
    if (!follow) return "not following";
    const elapsed = Date.now() - new Date(follow.followed_at).getTime();
    return formatDuration(elapsed);
  } catch {
    return "(followage unavailable)";
  }
}

export async function getAccountAge(userId: string): Promise<string> {
  try {
    const res = await helixFetch<{ created_at: string }>("users", { id: userId });
    const user = res.data[0];
    if (!user) return "(unknown)";
    const elapsed = Date.now() - new Date(user.created_at).getTime();
    return formatDuration(elapsed);
  } catch {
    return "(account age unavailable)";
  }
}

export async function getSubCount(broadcasterId: string): Promise<string> {
  try {
    const res = await helixFetch<unknown>("subscriptions", {
      broadcaster_id: broadcasterId,
    });
    // Helix returns total in the response alongside data
    const raw = res as unknown as { total?: number };
    return String(raw.total ?? res.data.length);
  } catch {
    return "(sub count unavailable)";
  }
}

export async function getTwitchEmotes(broadcasterId: string): Promise<string> {
  try {
    const res = await helixFetch<{ name: string }>("chat/emotes", {
      broadcaster_id: broadcasterId,
    });
    const names = res.data.map((e) => e.name).join(" ");
    return names.length > 400 ? names.slice(0, 400) + "..." : names;
  } catch {
    return "(emotes unavailable)";
  }
}
