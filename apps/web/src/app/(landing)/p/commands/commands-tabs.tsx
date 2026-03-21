"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import type { DefaultCommandMeta } from "@community-bot/db/defaultCommands";

interface CustomCommand {
  name: string;
  response: string;
  accessLevel: string;
  aliases: string[];
  cooldown: number;
}

function formatAccessLevel(level: string) {
  return level
    .split("_")
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
}

function accessLevelBadgeColor(level: string) {
  const l = level.toLowerCase();
  if (l === "everyone") return "bg-green-500/10 text-green-600 dark:text-green-400";
  if (l.includes("subscriber") || l.includes("sub")) return "bg-brand-twitch/10 text-brand-twitch";
  if (l.includes("mod")) return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
  if (l.includes("vip")) return "bg-pink-500/10 text-pink-600 dark:text-pink-400";
  if (l.includes("broadcaster") || l.includes("owner")) return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return "bg-surface-raised text-muted-foreground";
}

function formatCooldown(seconds: number) {
  if (seconds <= 0) return "None";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function CommandCard({
  name,
  aliases,
  text,
  accessLevel,
  cooldown,
}: {
  name: string;
  aliases: string[];
  text: string;
  accessLevel: string;
  cooldown?: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-main/20">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <span className="font-mono text-sm font-semibold text-brand-main">
            !{name}
          </span>
          {aliases.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground/60">
              {aliases.map((a) => `!${a}`).join(", ")}
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${accessLevelBadgeColor(accessLevel)}`}>
          {formatAccessLevel(accessLevel)}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
      {cooldown !== undefined && cooldown > 0 && (
        <p className="mt-2 text-xs text-muted-foreground/50">
          Cooldown: {formatCooldown(cooldown)}
        </p>
      )}
    </div>
  );
}

export default function CommandsTabs({
  customCommands,
  defaultCommands,
}: {
  customCommands: CustomCommand[];
  defaultCommands: DefaultCommandMeta[];
}) {
  const [activeTab, setActiveTab] = useState<"custom" | "default">("custom");
  const [search, setSearch] = useState("");

  const filteredCustom = useMemo(() => {
    if (!search.trim()) return customCommands;
    const q = search.toLowerCase().replace(/^!/, "");
    return customCommands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(q) ||
        cmd.response.toLowerCase().includes(q) ||
        cmd.aliases.some((a) => a.toLowerCase().includes(q))
    );
  }, [customCommands, search]);

  const filteredDefault = useMemo(() => {
    if (!search.trim()) return defaultCommands;
    const q = search.toLowerCase().replace(/^!/, "");
    return defaultCommands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.aliases.some((a) => a.toLowerCase().includes(q))
    );
  }, [defaultCommands, search]);

  const activeList = activeTab === "custom" ? filteredCustom : filteredDefault;

  return (
    <div className="flex flex-col gap-4">
      {/* Search + Tab bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button
            onClick={() => setActiveTab("custom")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "custom"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Custom
            <span className="ml-1.5 rounded-full bg-surface-overlay px-1.5 py-0.5 text-xs">
              {customCommands.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("default")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "default"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Default
            <span className="ml-1.5 rounded-full bg-surface-overlay px-1.5 py-0.5 text-xs">
              {defaultCommands.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Search commands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-brand-main/50 focus:outline-none focus:ring-1 focus:ring-brand-main/30 sm:w-64"
          />
        </div>
      </div>

      {/* Content */}
      {activeList.length > 0 ? (
        <>
          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {activeTab === "custom"
              ? filteredCustom.map((cmd) => (
                  <CommandCard
                    key={cmd.name}
                    name={cmd.name}
                    aliases={cmd.aliases}
                    text={cmd.response}
                    accessLevel={cmd.accessLevel}
                    cooldown={cmd.cooldown}
                  />
                ))
              : filteredDefault.map((cmd) => (
                  <CommandCard
                    key={cmd.name}
                    name={cmd.name}
                    aliases={cmd.aliases}
                    text={cmd.description}
                    accessLevel={cmd.accessLevel}
                  />
                ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Command
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {activeTab === "custom" ? "Response" : "Description"}
                  </th>
                  {activeTab === "custom" && (
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Cooldown
                    </th>
                  )}
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Access Level
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeTab === "custom"
                  ? filteredCustom.map((cmd) => (
                      <tr
                        key={cmd.name}
                        className="transition-colors hover:bg-surface-raised/50"
                      >
                        <td className="px-5 py-3.5 align-top">
                          <span className="font-mono text-sm font-semibold text-brand-main">
                            !{cmd.name}
                          </span>
                          {cmd.aliases.length > 0 && (
                            <p className="mt-0.5 text-xs text-muted-foreground/50">
                              {cmd.aliases.map((a) => `!${a}`).join(", ")}
                            </p>
                          )}
                        </td>
                        <td className="max-w-xs px-5 py-3.5 text-sm leading-relaxed text-muted-foreground">
                          <span className="line-clamp-2">{cmd.response}</span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-muted-foreground/70">
                          {formatCooldown(cmd.cooldown)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${accessLevelBadgeColor(cmd.accessLevel)}`}>
                            {formatAccessLevel(cmd.accessLevel)}
                          </span>
                        </td>
                      </tr>
                    ))
                  : filteredDefault.map((cmd) => (
                      <tr
                        key={cmd.name}
                        className="transition-colors hover:bg-surface-raised/50"
                      >
                        <td className="px-5 py-3.5 align-top">
                          <span className="font-mono text-sm font-semibold text-brand-main">
                            !{cmd.name}
                          </span>
                          {cmd.aliases.length > 0 && (
                            <p className="mt-0.5 text-xs text-muted-foreground/50">
                              {cmd.aliases.map((a) => `!${a}`).join(", ")}
                            </p>
                          )}
                        </td>
                        <td className="max-w-xs px-5 py-3.5 text-sm leading-relaxed text-muted-foreground">
                          <span className="line-clamp-2">{cmd.description}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${accessLevelBadgeColor(cmd.accessLevel)}`}>
                            {formatAccessLevel(cmd.accessLevel)}
                          </span>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">
            {search.trim()
              ? `No commands matching "${search}"`
              : activeTab === "custom"
                ? "No custom commands available."
                : "No default commands are enabled."}
          </p>
        </div>
      )}
    </div>
  );
}
