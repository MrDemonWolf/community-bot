"use client";

import { LoadingState } from "@/components/loading-state";

import { Activity, ArrowUpRight, MessageCircle, Radio, Settings2 } from "lucide-react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { COMMAND_DEFINITIONS } from "@community-bot/core/commands";
import { canAccess } from "@community-bot/core/permissions";
import { PageHeading, Panel, StatusBadge } from "@/components/dashboard-ui";
import { trpc, queryClient } from "@/utils/trpc";

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

  return <>
    <PageHeading title="Overview"
      description="Discord and Twitch connection status."
      actions={<>
        {hasSettings && <Link className="button" href="/dashboard/settings"><Settings2 size={16} /> Settings</Link>}
        {settings.publicPageEnabled && <Link className="button" href="/channel" target="_blank">Public page <ArrowUpRight size={15} /></Link>}
      </>} />
    {setupNeeded && <div className="next-step">
      <Activity size={24} aria-hidden="true" /><div><h3>Connect your services</h3><p>Start with Discord or Twitch.</p></div>
      <Link href="/setup" className="button primary">Continue setup →</Link>
    </div>}
    {control.error && <p role="alert" className="notice error">{control.error.message}</p>}
    {control.isSuccess && <p role="status" className="notice">Request saved. The service status below will confirm the change.</p>}
    <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
      {(["discord", "twitch"] as const).filter((service) => canAccess(access, "dashboard:view", service)).map((service) => {
        const runtime = settings.runtimes.find((item) => item.service === service);
        const configured = service === "discord" ? settings.discordConfigured : settings.broadcaster.connected && settings.bot.connected;
        const enabled = service === "discord" ? settings.discordEnabled : settings.twitchEnabled;
        const state = runtime ? runtime.stale ? "No recent update" : runtime.state.replaceAll("_", " ") : "Waiting for service";
        const connected = !runtime?.stale && (runtime?.state === "connected" || runtime?.state === "muted");
        const connect = canAccess(access, "bot:connect", service);
        const mute = service === "twitch" && canAccess(access, "bot:mute", "twitch");
        const Icon = service === "discord" ? MessageCircle : Radio;
        return <Panel key={service} aria-label={service === "discord" ? "Discord connection" : "Twitch connection"}>
          <div className="panel-header">
            <div className="service-name"><span className="service-icon"><Icon size={23} aria-hidden="true" /></span><div>
              <h2>{service === "discord" ? "Discord" : "Twitch"}</h2>
              <p>{service === "discord" ? "Server connection" : settings.channelName ? `#${settings.channelName}` : "Channel connection"}</p>
            </div></div>
            <StatusBadge good={connected}>{state}</StatusBadge>
          </div>
          <p className="service-detail">{!configured
            ? access.owner ? "Connect this platform in Settings to get started." : "The creator needs to finish connecting this service."
            : runtime?.stale ? "The service has stopped reporting. Check its deployment logs."
              : runtime?.detail || "Credentials are ready. Start the service and choose Join."}</p>
          {service === "twitch" && runtime && !runtime.stale && <StreamDetails metadata={runtime.metadata} />}
          <div className="actions">
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
            {!configured && access.owner && <Link className="button" href={`/dashboard/settings#${service}-connection`}>Set up {service === "discord" ? "Discord" : "Twitch"}</Link>}
          </div>
          {!connect && !mute && <p className="subtle">Your role has view-only access to this connection.</p>}
          <div className="rule" />
          <p className="subtle mb-0">{runtime?.identity || "No identity reported"}{runtime?.heartbeatAt && <> · Updated {new Date(runtime.heartbeatAt).toLocaleTimeString()}</>}</p>
        </Panel>;
      })}
    </div>
    <Panel aria-labelledby="commands-title">
      <div className="panel-header"><div><h2 id="commands-title">Useful commands</h2>
        <p>{hasTwitch && `Twitch uses ${settings.commandPrefix}. `}{hasDiscord && "Discord uses /. "}
          {manageCommands ? <>Enable uptime commands in <Link href="/dashboard/features">Features</Link>.</> : "Ask a workspace admin to configure commands."}</p>
      </div></div>
      <table className="command-list"><thead><tr><th scope="col">Command</th><th scope="col">What it does</th></tr></thead>
        <tbody>{COMMAND_DEFINITIONS.map(({ name, description }) => <tr key={name}>
          <td><div className="flex flex-wrap gap-2">{hasTwitch && <code>{settings.commandPrefix}{name}</code>}{hasDiscord && <code>/{name}</code>}</div></td><td>{description}</td>
        </tr>)}</tbody>
      </table>
    </Panel>
  </>;
}

function StreamDetails({ metadata }: { metadata: unknown }) {
  if (!metadata || typeof metadata !== "object") return null;
  const stream = metadata as Record<string, unknown>;
  if (stream.live !== true && stream.live !== false) return <p className="subtle">Stream information is not available yet.</p>;
  return <div className="mb-5">
    <StatusBadge good={stream.live}>{stream.live ? "Stream is live" : "Stream is offline"}</StatusBadge>
    {stream.live && <div className="mt-2.5">
      {typeof stream.title === "string" && <h3>{stream.title}</h3>}
      <p className="subtle mb-0">{typeof stream.category === "string" ? stream.category : "No category"}
        {typeof stream.viewers === "number" && Number.isFinite(stream.viewers) ? ` · ${stream.viewers.toLocaleString()} viewers` : ""}</p>
    </div>}
  </div>;
}
