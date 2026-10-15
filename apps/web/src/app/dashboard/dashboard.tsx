"use client";

import {
  Activity,
  ArrowUpRight,
  Check,
  MessageCircle,
  Radio,
} from "lucide-react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CoreSettings,
  DiscordPresence,
  DiscordSettings,
  TwitchSettings,
} from "@/components/settings-panels";
import { trpc, queryClient } from "@/utils/trpc";
import { canAccess } from "@community-bot/core/permissions";

export default function Dashboard({ userName }: { userName: string }) {
  const accessQuery = useQuery(trpc.access.me.queryOptions());
  const query = useQuery(
    trpc.settings.get.queryOptions(undefined, { refetchInterval: 5000 }),
  );
  const control = useMutation(
    trpc.settings.control.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries();
      },
    }),
  );
  const settings = query.data;
  if (query.isPending || accessQuery.isPending) return <p role="status">Loading your workspace…</p>;
  if (query.error || !settings || accessQuery.error || !accessQuery.data)
    return (
      <div className="notice error" role="alert">
        We couldn't load your settings.{" "}
        <button className="button" onClick={() => query.refetch()}>
          Try again
        </button>
      </div>
    );
  const access = accessQuery.data;
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">YOUR COMMUNITY AT A GLANCE</span>
          <h1>Hey, {userName.split(" ")[0]}.</h1>
          <p>Two connections. One place to keep things running.</p>
        </div>
        {settings.publicPageEnabled && (
          <Link className="button" href="/channel" target="_blank">
            View public page <ArrowUpRight size={15} />
          </Link>
        )}
      </header>
      {access.owner && !settings.discordConfigured && !settings.bot.connected ? (
        <div className="next-step">
          <Activity size={27} />
          <div>
            <h3>Your next step: connect a service</h3>
            <p>
              Start with Discord or Twitch. You can add the other whenever
              you're ready.
            </p>
          </div>
          <Link href="/setup" className="button primary">
            Continue setup →
          </Link>
        </div>
      ) : (
        <div className="next-step">
          <Check size={24} />
          <div>
            <h3>Your workspace, your pace.</h3>
            <p>
              Connection status comes from each running service and refreshes
              every five seconds.
            </p>
          </div>
          {access.owner && <Link href="/setup" className="button">
            Review setup
          </Link>}
        </div>
      )}
      {control.error && (
        <p role="alert" className="notice error">
          {control.error.message}
        </p>
      )}
      {control.isSuccess && (
        <p role="status" className="notice">
          Request saved. Wait for the service status below to confirm the
          change.
        </p>
      )}
      <div className="mb-[26px] grid grid-cols-1 gap-5 xl:grid-cols-2">
        {(["discord", "twitch"] as const).filter((service) => canAccess(access, "dashboard:view", service)).map((service) => {
          const runtime = settings.runtimes.find(
            (item) => item.service === service,
          );
          const configured =
            service === "discord"
              ? settings.discordConfigured
              : settings.broadcaster.connected && settings.bot.connected;
          const enabled =
            service === "discord"
              ? settings.discordEnabled
              : settings.twitchEnabled;
          const state = runtime
            ? runtime.stale
              ? "No recent heartbeat"
              : runtime.state
            : "Waiting for service";
          const connected =
            !runtime?.stale &&
            (runtime?.state === "connected" || runtime?.state === "muted");
          const Icon = service === "discord" ? MessageCircle : Radio;
          return (
            <section
              className="panel"
              key={service}
              aria-label={
                service === "discord"
                  ? "Discord connection"
                  : "Twitch connection"
              }
            >
              <div className="panel-header">
                <div className="service-name">
                  <span className="service-icon">
                    <Icon size={23} />
                  </span>
                  <div>
                    <h2>{service === "discord" ? "Discord" : "Twitch"}</h2>
                    <p>
                      {service === "discord"
                        ? "Your server companion"
                        : settings.channelName
                          ? `#${settings.channelName}`
                          : "Your stream companion"}
                    </p>
                  </div>
                </div>
                <span className={`status ${connected ? "good" : ""}`}>
                  {state}
                </span>
              </div>
              <p className="service-detail">
                {!configured
                  ? access.owner ? "Finish connecting this service in the settings below." : "The creator needs to finish connecting this service."
                  : runtime?.stale
                    ? "The service has stopped reporting. Check its deployment logs."
                    : runtime?.detail ||
                      "Credentials are ready. Start the service and choose Join."}
              </p>
              {service === "twitch" && runtime && !runtime.stale && (
                <StreamDetails metadata={runtime.metadata} />
              )}
              <div className="actions">
                <button
                  className="button primary"
                  disabled={!canAccess(access, "bot:connect", service) || !configured || control.isPending || enabled}
                  onClick={() => control.mutate({ service, action: "join" })}
                >
                  Join
                </button>
                <button
                  className="button"
                  disabled={!canAccess(access, "bot:connect", service) || !enabled || control.isPending}
                  onClick={() => control.mutate({ service, action: "leave" })}
                >
                  Leave
                </button>
                {service === "twitch" && (
                  <button
                    className="button"
                    disabled={!canAccess(access, "bot:mute", "twitch") || !configured || control.isPending}
                    onClick={() =>
                      control.mutate({
                        service,
                        action: settings.twitchMuted ? "unmute" : "mute",
                      })
                    }
                  >
                    {settings.twitchMuted ? "Unmute replies" : "Mute replies"}
                  </button>
                )}
              </div>
              <div className="rule" />
              <span className="subtle">
                {runtime?.identity || "No identity reported"} ·{" "}
                {runtime?.heartbeatAt
                  ? `Last heartbeat ${new Date(runtime.heartbeatAt).toLocaleTimeString()}`
                  : "No heartbeat yet"}
              </span>
            </section>
          );
        })}
      </div>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>A few useful commands</h2>
            <p>
              Available in Twitch chat when the bot is connected and unmuted.
            </p>
          </div>
        </div>
        <table className="command-list">
          <thead>
            <tr>
              <th scope="col">Command</th>
              <th scope="col">What it does</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>{settings.commandPrefix}uptime</code>
              </td>
              <td>How long the Twitch bot process has been running.</td>
            </tr>
            <tr>
              <td>
                <code>{settings.commandPrefix}botuptime</code>
              </td>
              <td>How long the Twitch bot process has been running.</td>
            </tr>
            <tr>
              <td>
                <code>{settings.commandPrefix}serveruptime</code>
              </td>
              <td>
                OS-reported host uptime; containers may share their host's
                clock.
              </td>
            </tr>
            <tr>
              <td>
                <code>{settings.commandPrefix}streamuptime</code>
              </td>
              <td>How long the current stream has been live.</td>
            </tr>
            <tr>
              <td>
                <code>{settings.commandPrefix}commands</code>
              </td>
              <td>Show the available commands.</td>
            </tr>
          </tbody>
        </table>
      </section>
      {access.owner && <><h2 className="section-title">Make it yours</h2>
      <section className="panel">
        <CoreSettings settings={settings} />
      </section></>}
      {canAccess(access, "presence:manage", "discord") && <><h2 className="section-title">Discord presence</h2>
      <section className="panel">
        <p className="subtle">
          Choose what people see beside your bot. No privileged intents
          required.
        </p>
        <DiscordPresence settings={settings} />
      </section></>}
      {access.owner && <><h2 className="section-title">Connections</h2>
      <section className="panel">
        <h2>Discord application</h2>
        <DiscordSettings settings={settings} />
      </section>
      <section className="panel" style={{ marginTop: 20 }}>
        <h2>Twitch application & accounts</h2>
        <TwitchSettings settings={settings} />
      </section></>}
    </>
  );
}

function StreamDetails({ metadata }: { metadata: unknown }) {
  if (!metadata || typeof metadata !== "object") return null;
  const stream = metadata as Record<string, unknown>;
  if (stream.live !== true && stream.live !== false)
    return <p className="subtle">Stream information is not available yet.</p>;
  return (
    <div style={{ marginBottom: 20 }}>
      <span className={`status ${stream.live ? "good" : ""}`}>
        {stream.live ? "Stream is live" : "Stream is offline"}
      </span>
      {stream.live && (
        <div style={{ marginTop: 10 }}>
          {typeof stream.title === "string" && <h3>{stream.title}</h3>}
          <p className="subtle" style={{ marginBottom: 0 }}>
            {typeof stream.category === "string"
              ? stream.category
              : "No category"}
            {typeof stream.viewers === "number" &&
            Number.isFinite(stream.viewers)
              ? ` · ${stream.viewers.toLocaleString()} viewers`
              : ""}
          </p>
        </div>
      )}
    </div>
  );
}
