import { ZodError } from "zod";
import type { TRPCDefaultErrorShape } from "@trpc/server";

const labels: Record<string, string> = {
  botName: "Bot display name", commandPrefix: "Command prefix", publicDescription: "Public channel description",
  publicPageEnabled: "Public channel page", clientId: "Twitch client ID", clientSecret: "Twitch client secret",
  applicationId: "Discord application ID", guildId: "Discord server ID", token: "Discord bot token",
  status: "Discord status", activityType: "Discord activity", activityText: "Activity text", activityUrl: "Streaming URL",
};

export function inputErrorMessage(cause: unknown): string | null {
  if (!(cause instanceof ZodError)) return null;
  const issue = cause.issues[0];
  if (!issue) return "Check the form and try again.";
  const field = String(issue.path[0] ?? "");
  const label = Object.hasOwn(labels, field) ? labels[field] : undefined;
  const message = issue.code === "invalid_type" || issue.code === "invalid_value"
    ? "Choose or enter a valid value." : issue.message;
  return label ? `${label}: ${message}` : message;
}

export function formatInputError(shape: TRPCDefaultErrorShape, cause: unknown): TRPCDefaultErrorShape {
  const message = inputErrorMessage(cause);
  if (!message) return shape;
  const { stack: _stack, ...data } = shape.data;
  return { ...shape, message, data };
}
