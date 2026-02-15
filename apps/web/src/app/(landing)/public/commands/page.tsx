import { notFound } from "next/navigation";
import prisma from "@community-bot/db";
import { getBroadcasterUserId } from "@/lib/setup";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import {
  User,
  Terminal,
  ArrowLeft,
} from "lucide-react";
import { DEFAULT_COMMANDS } from "@community-bot/db/defaultCommands";
import CommandsTabs from "./commands-tabs";

async function getCommandsData() {
  const broadcasterId = await getBroadcasterUserId();
  if (!broadcasterId) return null;

  const user = await prisma.user.findUnique({
    where: { id: broadcasterId },
  });

  if (!user) return null;

  const botChannel = await prisma.botChannel.findUnique({
    where: { userId: user.id },
    include: { commandOverrides: true },
  });

  const commands = await prisma.twitchChatCommand.findMany({
    where: { hidden: false, enabled: true, botChannelId: botChannel?.id ?? undefined },
    orderBy: { name: "asc" },
  });

  const disabledCommands = new Set(botChannel?.disabledCommands ?? []);
  const overrides = new Map(
    (botChannel?.commandOverrides ?? []).map((o) => [o.commandName, o.accessLevel])
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

  return { user, commands, enabledDefaults };
}

export default async function CommandsPage() {
  const data = await getCommandsData();

  if (!data) return notFound();

  const { user, commands, enabledDefaults } = data;

  const totalCount = commands.length + enabledDefaults.length;

  return (
    <div className="-mt-[1px] flex flex-col">
      {/* Banner */}
      <div className="relative h-32 bg-gradient-to-br from-muted via-background to-muted" />

      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="flex flex-col gap-8 sm:flex-row">
          {/* Sidebar */}
          <div className="-mt-8 flex w-full flex-col gap-6 sm:w-64 sm:shrink-0">
            <div className="flex items-center gap-3">
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name}
                  width={48}
                  height={48}
                  className="rounded-lg border-2 border-background bg-card"
                  unoptimized
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-background bg-card">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <h2 className="font-bold text-foreground">{user.name}</h2>
              </div>
            </div>

            <nav className="flex flex-col gap-1">
              <SidebarLink
                href="/public"
                icon={<User className="h-4 w-4" />}
                label="Profile"
              />
              <SidebarLink
                href="/public/commands"
                icon={<Terminal className="h-4 w-4" />}
                label="Commands"
                active
              />
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex min-w-0 flex-1 flex-col gap-6 pb-16 pt-6">
            <div className="flex items-center gap-3">
              <Link
                href={"/public" as Route}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="text-xl font-bold text-foreground">Chat Commands</h1>
              <span className="rounded-md bg-surface-raised px-2 py-0.5 text-xs text-muted-foreground">
                {totalCount}
              </span>
            </div>

            <CommandsTabs
              customCommands={commands.map((cmd) => ({
                name: cmd.name,
                response: cmd.response,
                accessLevel: cmd.accessLevel,
                aliases: cmd.aliases,
              }))}
              defaultCommands={enabledDefaults}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href as Route}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-surface-raised text-foreground"
          : "text-muted-foreground hover:bg-surface-raised hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
