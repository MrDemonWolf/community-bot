"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import CommandToggles from "./command-toggles";
import CustomCommandsTab from "./custom-commands-tab";
import { DEFAULT_COMMANDS } from "@community-bot/db/defaultCommands";

type Tab = "custom" | "default";

export default function CommandsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("custom");
  const { data: commands } = useQuery(trpc.chatCommand.list.queryOptions());

  const customCount = commands?.length ?? 0;
  const defaultCount = DEFAULT_COMMANDS.length;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">
        Commands
      </h1>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => setActiveTab("custom")}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "custom"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Custom Commands
          <span
            className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-medium ${
              activeTab === "custom"
                ? "bg-brand-twitch/10 text-brand-twitch"
                : "bg-surface-overlay text-muted-foreground"
            }`}
          >
            {customCount}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("default")}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "default"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Default Commands
          <span
            className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-medium ${
              activeTab === "default"
                ? "bg-brand-twitch/10 text-brand-twitch"
                : "bg-surface-overlay text-muted-foreground"
            }`}
          >
            {defaultCount}
          </span>
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "custom" ? <CustomCommandsTab /> : <CommandToggles />}
    </div>
  );
}
