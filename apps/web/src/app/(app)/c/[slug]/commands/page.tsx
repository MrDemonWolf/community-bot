import { notFound } from "next/navigation";
import prisma from "@community-bot/db";
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

async function getCommandsData(slug: string) {
  const user = await prisma.user.findFirst({
    where: { name: { equals: slug, mode: "insensitive" } },
  });

  if (!user) return null;

  // Get bot channel to check disabled commands and access level overrides
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

  // Filter out disabled default commands, apply access level overrides
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

export default async function CommandsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getCommandsData(slug);

  if (!data) return notFound();

  const { user, commands, enabledDefaults } = data;

  const totalCount = commands.length + enabledDefaults.length;

  return (
    <div className="-mt-[1px] flex flex-col">
      {/* Banner */}
      <div className="relative h-32 bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-[#0a1a3a] dark:via-[#091533] dark:to-[#0d1f42]" />

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
                  className="rounded-lg border-2 border-white bg-gray-100 dark:border-[#091533] dark:bg-[#0d1f42]"
                  unoptimized
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-white bg-gray-100 dark:border-[#091533] dark:bg-[#0d1f42]">
                  <User className="h-5 w-5 text-gray-300 dark:text-white/30" />
                </div>
              )}
              <div>
                <h2 className="font-bold text-gray-900 dark:text-white">{user.name}</h2>
              </div>
            </div>

            <nav className="flex flex-col gap-1">
              <SidebarLink
                href={`/c/${slug}`}
                icon={<User className="h-4 w-4" />}
                label="Profile"
              />
              <SidebarLink
                href={`/c/${slug}/commands`}
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
                href={`/c/${slug}` as Route}
                className="text-gray-400 transition-colors hover:text-gray-600 dark:text-white/40 dark:hover:text-white/70"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Chat Commands</h1>
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-white/10 dark:text-white/50">
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
          ? "bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-white"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white/70"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
