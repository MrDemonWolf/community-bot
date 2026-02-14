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
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Commands
      </h1>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-white/5">
        <button
          onClick={() => setActiveTab("custom")}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "custom"
              ? "bg-white text-gray-900 shadow-sm dark:bg-[#0d1f42] dark:text-white"
              : "text-gray-500 hover:text-gray-700 dark:text-white/40 dark:hover:text-white/60"
          }`}
        >
          Custom Commands
          <span
            className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-medium ${
              activeTab === "custom"
                ? "bg-[#9146FF]/10 text-[#9146FF] dark:bg-[#9146FF]/20 dark:text-[#b380ff]"
                : "bg-gray-200 text-gray-500 dark:bg-white/10 dark:text-white/40"
            }`}
          >
            {customCount}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("default")}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "default"
              ? "bg-white text-gray-900 shadow-sm dark:bg-[#0d1f42] dark:text-white"
              : "text-gray-500 hover:text-gray-700 dark:text-white/40 dark:hover:text-white/60"
          }`}
        >
          Default Commands
          <span
            className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-medium ${
              activeTab === "default"
                ? "bg-[#9146FF]/10 text-[#9146FF] dark:bg-[#9146FF]/20 dark:text-[#b380ff]"
                : "bg-gray-200 text-gray-500 dark:bg-white/10 dark:text-white/40"
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
