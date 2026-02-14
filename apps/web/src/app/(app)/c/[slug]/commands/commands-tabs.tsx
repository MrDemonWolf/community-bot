"use client";

import { useState } from "react";
import type { DefaultCommandMeta } from "@community-bot/db/defaultCommands";

interface CustomCommand {
  name: string;
  response: string;
  accessLevel: string;
  aliases: string[];
}

export default function CommandsTabs({
  customCommands,
  defaultCommands,
}: {
  customCommands: CustomCommand[];
  defaultCommands: DefaultCommandMeta[];
}) {
  const [activeTab, setActiveTab] = useState<"custom" | "default">("custom");

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-white/5">
        <button
          onClick={() => setActiveTab("custom")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "custom"
              ? "bg-white text-gray-900 shadow-sm dark:bg-white/10 dark:text-white"
              : "text-gray-500 hover:text-gray-700 dark:text-white/40 dark:hover:text-white/60"
          }`}
        >
          Custom
          <span className="ml-1.5 rounded bg-gray-200/80 px-1.5 py-0.5 text-xs dark:bg-white/10">
            {customCommands.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("default")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "default"
              ? "bg-white text-gray-900 shadow-sm dark:bg-white/10 dark:text-white"
              : "text-gray-500 hover:text-gray-700 dark:text-white/40 dark:hover:text-white/60"
          }`}
        >
          Default
          <span className="ml-1.5 rounded bg-gray-200/80 px-1.5 py-0.5 text-xs dark:bg-white/10">
            {defaultCommands.length}
          </span>
        </button>
      </div>

      {/* Custom commands tab */}
      {activeTab === "custom" && (
        <>
          {customCommands.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0d1f42]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/5">
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-white/40">
                      Command
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-white/40">
                      Response
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-white/40">
                      Access
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {customCommands.map((cmd) => (
                    <tr key={cmd.name}>
                      <td className="px-4 py-3 font-mono text-sm text-[#00ACED]">
                        !{cmd.name}
                        {cmd.aliases.length > 0 && (
                          <span className="ml-2 text-xs text-gray-400 dark:text-white/30">
                            {cmd.aliases.map((a) => `!${a}`).join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-white/60">
                        {cmd.response}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 dark:text-white/40">
                        {cmd.accessLevel
                          .split("_")
                          .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
                          .join(" ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-white/10 dark:bg-[#0d1f42]">
              <p className="text-gray-400 dark:text-white/40">
                No custom commands available.
              </p>
            </div>
          )}
        </>
      )}

      {/* Default commands tab */}
      {activeTab === "default" && (
        <>
          {defaultCommands.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0d1f42]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/5">
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-white/40">
                      Command
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-white/40">
                      Description
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-white/40">
                      Access
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {defaultCommands.map((cmd) => (
                    <tr key={cmd.name}>
                      <td className="px-4 py-3 font-mono text-sm text-[#9146FF]">
                        !{cmd.name}
                        {cmd.aliases.length > 0 && (
                          <span className="ml-2 text-xs text-gray-400 dark:text-white/30">
                            {cmd.aliases.map((a) => `!${a}`).join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-white/60">
                        {cmd.description}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 dark:text-white/40">
                        {cmd.accessLevel
                          .split("_")
                          .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
                          .join(" ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-white/10 dark:bg-[#0d1f42]">
              <p className="text-gray-400 dark:text-white/40">
                No default commands are enabled.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
