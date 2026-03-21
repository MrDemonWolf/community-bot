import { notFound } from "next/navigation";
import { db, eq, asc, users, botChannels, twitchChatCommands } from "@community-bot/db";
import { getBroadcasterUserId } from "@/lib/setup";
import Link from "next/link";
import type { Route } from "next";
import type { Metadata } from "next";
import { ArrowLeft, Terminal } from "lucide-react";
import { DEFAULT_COMMANDS } from "@community-bot/db/defaultCommands";
import CommandsTabs from "./commands-tabs";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const broadcasterId = await getBroadcasterUserId();
  if (!broadcasterId) return {};

  const user = await db.query.users.findFirst({
    where: eq(users.id, broadcasterId),
    columns: { name: true },
  });

  if (!user) return {};

  return {
    title: `Commands — ${user.name}`,
    description: `Browse ${user.name}'s chat commands — custom and default bot commands available in chat.`,
  };
}

async function getCommandsData() {
  const broadcasterId = await getBroadcasterUserId();
  if (!broadcasterId) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, broadcasterId),
  });

  if (!user) return null;

  const botChannel = await db.query.botChannels.findFirst({
    where: eq(botChannels.userId, user.id),
    with: { commandOverrides: true },
  });

  const commands = botChannel
    ? await db.query.twitchChatCommands.findMany({
        where: (t, { and: a, eq: e }) =>
          a(e(t.hidden, false), e(t.enabled, true), e(t.botChannelId, botChannel.id)),
        orderBy: asc(twitchChatCommands.name),
      })
    : [];

  const disabledCommands = new Set(botChannel?.disabledCommands ?? []);
  const overrides = new Map(
    (botChannel?.commandOverrides ?? []).map((o) => [
      o.commandName,
      o.accessLevel,
    ])
  );

  const enabledDefaults = DEFAULT_COMMANDS.filter(
    (cmd) => !disabledCommands.has(cmd.name)
  ).map((cmd) => {
    const override = overrides.get(cmd.name);
    if (override) {
      return { ...cmd, accessLevel: override as typeof cmd.accessLevel };
    }
    return cmd;
  });

  return { commands, enabledDefaults };
}

export default async function CommandsPage() {
  const data = await getCommandsData();
  if (!data) return notFound();

  const { commands, enabledDefaults } = data;
  const totalCount = commands.length + enabledDefaults.length;

  return (
    <>
      {/* Header */}
      <div className="animate-fade-in-up">
        <Link
          href={"/p" as Route}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to profile
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-main/10">
            <Terminal className="h-5 w-5 text-brand-main" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-foreground">Chat Commands</h1>
            <p className="text-sm text-muted-foreground">
              {totalCount} command{totalCount !== 1 ? "s" : ""} available
            </p>
          </div>
        </div>
      </div>

      {/* Commands */}
      <div
        className="animate-fade-in-up"
        style={{ animationDelay: "100ms" }}
      >
        <CommandsTabs
          customCommands={commands.map((cmd) => ({
            name: cmd.name,
            response: cmd.response,
            accessLevel: cmd.accessLevel,
            aliases: cmd.aliases,
            cooldown: cmd.globalCooldown,
          }))}
          defaultCommands={enabledDefaults}
        />
      </div>
    </>
  );
}
