"use client";

import { useState } from "react";
import type { DefaultCommandMeta } from "@community-bot/db/defaultCommands";

interface CustomCommand {
  name: string;
  response: string;
  accessLevel: string;
  aliases: string[];
}

function formatAccessLevel(level: string) {
  return level
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function CommandCard({
  name,
  aliases,
  text,
  accessLevel,
}: {
  name: string;
  aliases: string[];
  text: string;
  accessLevel: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-medium text-brand-main">
          !{name}
        </span>
        <span className="shrink-0 rounded bg-surface-raised px-2 py-0.5 text-xs text-muted-foreground">
          {formatAccessLevel(accessLevel)}
        </span>
      </div>
      {aliases.length > 0 && (
        <p className="mb-2 text-xs text-muted-foreground/70">
          {aliases.map((a) => `!${a}`).join(", ")}
        </p>
      )}
      <p className="text-sm text-muted-foreground">{text}</p>
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

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => setActiveTab("custom")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "custom"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Custom
          <span className="ml-1.5 rounded bg-surface-overlay px-1.5 py-0.5 text-xs">
            {customCommands.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("default")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "default"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Default
          <span className="ml-1.5 rounded bg-surface-overlay px-1.5 py-0.5 text-xs">
            {defaultCommands.length}
          </span>
        </button>
      </div>

      {/* Custom commands tab */}
      {activeTab === "custom" && (
        <>
          {customCommands.length > 0 ? (
            <>
              {/* Mobile cards */}
              <div className="flex flex-col gap-3 sm:hidden">
                {customCommands.map((cmd) => (
                  <CommandCard
                    key={cmd.name}
                    name={cmd.name}
                    aliases={cmd.aliases}
                    text={cmd.response}
                    accessLevel={cmd.accessLevel}
                  />
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-lg border border-border bg-card sm:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Command
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Response
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Access
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {customCommands.map((cmd) => (
                      <tr
                        key={cmd.name}
                        className="transition-colors hover:bg-surface-raised"
                      >
                        <td className="px-4 py-3 font-mono text-sm text-brand-main">
                          !{cmd.name}
                          {cmd.aliases.length > 0 && (
                            <span className="ml-2 text-xs text-muted-foreground/70">
                              {cmd.aliases.map((a) => `!${a}`).join(", ")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {cmd.response}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatAccessLevel(cmd.accessLevel)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">
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
            <>
              {/* Mobile cards */}
              <div className="flex flex-col gap-3 sm:hidden">
                {defaultCommands.map((cmd) => (
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
              <div className="hidden overflow-hidden rounded-lg border border-border bg-card sm:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Command
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Description
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Access
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {defaultCommands.map((cmd) => (
                      <tr
                        key={cmd.name}
                        className="transition-colors hover:bg-surface-raised"
                      >
                        <td className="px-4 py-3 font-mono text-sm text-brand-main">
                          !{cmd.name}
                          {cmd.aliases.length > 0 && (
                            <span className="ml-2 text-xs text-muted-foreground/70">
                              {cmd.aliases.map((a) => `!${a}`).join(", ")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {cmd.description}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatAccessLevel(cmd.accessLevel)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">
                No default commands are enabled.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
