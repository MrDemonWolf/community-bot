"use client";

import { LoadingState } from "@/components/loading-state";

import { ArrowUpRight, MessageCircle, Radio, Settings2 } from "lucide-react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { COMMAND_DEFINITIONS } from "@community-bot/core/commands";
import { canAccess } from "@community-bot/core/permissions";
import { PageHeading, StatusBadge } from "@/components/dashboard-ui";
import { trpc, queryClient } from "@/utils/trpc";
import { navigationFor } from "@/components/navigation";

export default function Dashboard() {
  const accessQuery = useQuery(trpc.access.me.queryOptions());
  const query = useQuery(trpc.settings.get.queryOptions(undefined, { refetchInterval: 5000 }));
  const control = useMutation(trpc.settings.control.mutationOptions({
    onSuccess: async () => { await queryClient.invalidateQueries(); },
  }));
  const settings = query.data;
  if ((query.isPending || accessQuery.isPending) && !query.error && !accessQuery.error) return <LoadingState label="Loading your workspace…" />;
  if (query.error || !settings || accessQuery.error || !accessQuery.data) return <p className="notice error" role="alert">
    Your workspace could not be loaded. <button className="button" onClick={() => { void query.refetch(); void accessQuery.refetch(); }}>Try again</button>
  </p>;
  const access = accessQuery.data;
  const hasDiscord = canAccess(access, "dashboard:view", "discord");
  const hasTwitch = canAccess(access, "dashboard:view", "twitch");
  const hasSettings = access.owner || canAccess(access, "presence:manage", "discord");
  const setupNeeded = access.owner && !settings.discordConfigured && !(settings.bot.connected && settings.broadcaster.connected);
  const manageCommands = canAccess(access, "features:manage", "twitch") || canAccess(access, "features:manage", "discord");
  const tools = navigationFor(access, settings.publicPageEnabled).filter((item) => ["features", "rewards", "staff"].includes(item.id));

  return <>
    <PageHeading title="Overview"
      description={`${settings.botName}'s connections and community tools.`}
      actions={<>
        {hasSettings && <Link className="button" href="/dashboard/settings"><Settings2 size={16} /> Settings</Link>}
        {settings.publicPageEnabled && <Link className="button" href="/channel" target="_blank">Public page <ArrowUpRight size={15} /></Link>}
      </>} />
    {control.error && <p role="alert" className="notice error">{control.error.message}</p>}
    {control.isSuccess && <p role="status" className="notice">Request saved. The service status below will confirm the change.</p>}
    <section className="connections" aria-labelledby="connections-title">
      <header className="connections-heading"><h2 id="connections-title">Connections</h2><p>Bot status refreshes every 5 seconds.</p></header>
      {(["discord", "twitch"] as const).filter((service) => canAccess(access, "dashboard:view", service)).map((service) => {
        const runtime = settings.runtimes.find((item) => item.service === service);
        const configured = service === "discord" ? settings.discordConfigured : settings.broadcaster.connected && settings.bot.connected;
        const enabled = service === "discord" ? settings.discordEnabled : settings.twitchEnabled;
        const state = runtime ? runtime.stale ? "No recent update" : runtime.state.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase()) : "Waiting for bot";
        const connected = !runtime?.stale && (runtime?.state === "connected" || runtime?.state === "muted");
        const connect = canAccess(access, "bot:connect", service);
        const mute = service === "twitch" && canAccess(access, "bot:mute", "twitch");
        const setupHint = service === "discord" ? "Add your Discord application to connect this bot." : "Connect your creator and bot accounts to enable Twitch chat.";
        const Icon = service === "discord" ? MessageCircle : Radio;
        return <section className="connection-card" key={service} aria-label={service === "discord" ? "Discord connection" : "Twitch connection"}>
          <div className="connection-summary">
            <span className="service-icon"><Icon size={20} aria-hidden="true" /></span>
            <div className="connection-identity">
              <div className="connection-title"><h3>{service === "discord" ? "Discord" : "Twitch"}</h3><StatusBadge good={connected}>{state}</StatusBadge></div>
              <p>{runtime?.identity || (configured ? "Waiting for bot identity" : "Not configured")}{service === "twitch" && settings.channelName && <> · #{settings.channelName}</>}</p>
            </div>
          </div>
          <div className="connection-body">
            <p className="service-detail">{!configured
              ? access.owner ? setupHint : "The creator needs to finish connecting this service."
              : runtime?.stale ? "This bot hasn't sent a recent update. Its connection cannot be confirmed."
                : runtime?.detail || (enabled ? "Connection requested. Waiting for the bot to confirm." : "Credentials are ready. Choose Join to request a connection.")}</p>
            {configured && <p className="connection-desired">Requested: {enabled ? "connected" : "paused"}{service === "twitch" && settings.twitchMuted ? " · Replies muted" : ""}{service === "discord" && !enabled ? " · Bot stays in your server" : ""}</p>}
            {service === "twitch" && runtime && !runtime.stale && <StreamDetails metadata={runtime.metadata} />}
            <p className="connection-freshness">{runtime?.heartbeatAt ? <>Last update <time dateTime={runtime.heartbeatAt}>{new Date(runtime.heartbeatAt).toLocaleTimeString()}</time>{runtime.stale ? " · Out of date" : ""}</> : "No bot update received yet"}</p>
          </div>
          <div className="actions connection-actions">
            {!configured && access.owner ? <Link className="button primary" href={`/dashboard/settings#${service}-connection`}>Set up {service === "discord" ? "Discord" : "Twitch"}</Link> : <>
              {connect && <>
                <button className="button primary" disabled={!configured || control.isPending || enabled}
                  onClick={() => control.mutate({ service, action: "join" })}>Join</button>
                <button className="button" disabled={!enabled || control.isPending}
                  onClick={() => control.mutate({ service, action: "leave" })}>Leave</button>
              </>}
              {mute && <button className="button" disabled={!configured || control.isPending}
                onClick={() => control.mutate({ service, action: settings.twitchMuted ? "unmute" : "mute" })}>
                {settings.twitchMuted ? "Unmute replies" : "Mute replies"}
              </button>}
            </>}
            {!connect && !mute && <span className="subtle">View only</span>}
          </div>
        </section>;
      })}
    </section>
    {setupNeeded && <aside className="setup-attention" aria-label="Connection setup">
      <p><strong>New here?</strong> Guided setup walks through your workspace and bot connections.</p>
      <Link href="/setup" className="button">Continue setup →</Link>
    </aside>}
    {tools.length > 0 && <nav className="workspace-tools" aria-label="Workspace tools">
      {tools.map(({ id, href, label, icon: Icon }) => <Link href={href} key={id} className="workspace-tool"><Icon size={17} aria-hidden="true" /><span>{label}</span><ArrowUpRight size={14} aria-hidden="true" /></Link>)}
    </nav>}
    <details className="command-reference">
      <summary><span>Useful commands</span><span className="subtle">Command reference</span></summary>
      <div className="command-reference-content">
      <p>{hasTwitch && `Twitch uses ${settings.commandPrefix}. `}{hasDiscord && "Discord uses /. "}
        {manageCommands ? <>Enable uptime commands in <Link href="/dashboard/features">Features</Link>.</> : "Ask a workspace admin to configure commands."}</p>
      <table className="command-list"><thead><tr><th scope="col">Command</th><th scope="col">What it does</th></tr></thead>
        <tbody>{COMMAND_DEFINITIONS.map(({ name, description }) => <tr key={name}>
          <td><div className="flex flex-wrap gap-2">{hasTwitch && <code>{settings.commandPrefix}{name}</code>}{hasDiscord && <code>/{name}</code>}</div></td><td>{description}</td>
        </tr>)}</tbody>
      </table>
      </div>
    </details>
  </>;
}

function StreamDetails({ metadata }: { metadata: unknown }) {
  if (!metadata || typeof metadata !== "object") return null;
  const stream = metadata as Record<string, unknown>;
  if (stream.live !== true && stream.live !== false) return null;
  return <div className="connection-stream">
    <StatusBadge good={stream.live}>{stream.live ? "Stream is live" : "Stream is offline"}</StatusBadge>
    {stream.live && <div>
      {typeof stream.title === "string" && <p className="stream-title">{stream.title}</p>}
      <p className="subtle mb-0">{typeof stream.category === "string" ? stream.category : "No category"}
        {typeof stream.viewers === "number" && Number.isFinite(stream.viewers) ? ` · ${stream.viewers.toLocaleString()} viewers` : ""}</p>
    </div>}
  </div>;
}
