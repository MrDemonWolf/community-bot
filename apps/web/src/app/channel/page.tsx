import { getPublicChannel } from "@community-bot/db/public";
import { notFound } from "next/navigation";
import { ArrowUpRight, MessageCircle, Radio } from "lucide-react";
import { Panel, StatusBadge } from "@/components/dashboard-ui";

export const dynamic = "force-dynamic";

export default async function ChannelPage() {
  const channel = await getPublicChannel();
  if (!channel) notFound();
  const twitchURL =
    channel.channelName && /^[a-zA-Z0-9_]{1,25}$/.test(channel.channelName)
      ? `https://www.twitch.tv/${channel.channelName}`
      : null;
  const viewers = channel.twitch.viewers !== null && Number.isFinite(channel.twitch.viewers) && channel.twitch.viewers >= 0
    ? channel.twitch.viewers : null;
  const streamStartedAt = channel.twitch.streamStartedAt && !Number.isNaN(Date.parse(channel.twitch.streamStartedAt))
    ? new Date(channel.twitch.streamStartedAt) : null;
  return (
    <main className="channel-page">
      <div className="channel-topbar"><div className="brand"><img src="/brand/logo.svg" alt="" width="36" height="36" /><span>Community Bot</span></div>
        <nav aria-label="Community page sections"><a href="#status">Bot status</a><a href="#commands">Commands</a></nav>
      </div>
      <header className="channel-header"><div><p className="channel-context">Community channel</p>
        <h1>{channel.channelName ? `#${channel.channelName}` : channel.botName}</h1>
        <p className="channel-description">{channel.description || `Chat commands and connection status for ${channel.botName}.`}</p>
      </div>{twitchURL && <a className="button primary" href={twitchURL} target="_blank" rel="noreferrer">
        {channel.twitch.live === true ? "Watch on Twitch" : "Open Twitch channel"}<ArrowUpRight size={17} aria-hidden="true" />
      </a>}</header>
      <Panel className="channel-stream" aria-labelledby="stream-title">
        <div className="panel-header"><div className="service-name"><span className="service-icon"><Radio size={22} aria-hidden="true" /></span><div><h2 id="stream-title">Stream</h2><p>{channel.channelName ? `Twitch · ${channel.channelName}` : "Twitch"}</p></div></div>
          <StatusBadge good={channel.twitch.live === true}>{channel.twitch.live === true ? "Live" : channel.twitch.live === false ? "Offline" : "Status unavailable"}</StatusBadge>
        </div>
        {channel.twitch.live === true ? <div className="channel-stream-details">
          {channel.twitch.title && <h3>{channel.twitch.title}</h3>}
          {(channel.twitch.category || viewers !== null) && <p>{[channel.twitch.category, viewers !== null ? `${viewers.toLocaleString()} viewers` : null].filter(Boolean).join(" · ")}</p>}
          {streamStartedAt && <p className="subtle">Started <time dateTime={streamStartedAt.toISOString()}>{streamStartedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</time></p>}
        </div> : <p className="channel-stream-note">{channel.twitch.live === false ? "The channel is not live right now." : "Live stream information is not available right now."}</p>}
      </Panel>
      <section id="status" className="channel-section" aria-labelledby="bot-status-title"><div className="channel-section-heading"><h2 id="bot-status-title">Bot status</h2><p>{channel.botName} connects the community on Discord and Twitch.</p></div>
        <div className="channel-connections">{(["discord", "twitch"] as const).map((service) => {
          const state = channel[service].state;
          const Icon = service === "discord" ? MessageCircle : Radio;
          return <Panel key={service} className="channel-connection"><div className="service-name"><span className="service-icon"><Icon size={22} aria-hidden="true" /></span><div><h3>{service === "discord" ? "Discord bot" : "Twitch bot"}</h3><p>{service === "discord" ? "Server connection" : "Chat connection"}</p></div></div>
            <StatusBadge good={state === "connected" || state === "muted"}>{state.replaceAll("_", " ")}</StatusBadge>
          </Panel>;
        })}</div>
      </section>
      <Panel id="commands" className="channel-section" aria-labelledby="commands-title">
        <div className="channel-section-heading"><h2 id="commands-title">Chat commands</h2><p>Use these commands in Twitch chat with {channel.botName}.</p></div>
        {channel.commands.length ? <table className="command-list">
          <thead>
            <tr>
              <th scope="col">Command</th>
              <th scope="col">What it does</th>
            </tr>
          </thead>
          <tbody>
            {channel.commands.map((item) => (
              <tr key={item.command}>
                <td>
                  <code>{item.command}</code>
                </td>
                <td>{item.description}</td>
              </tr>
            ))}
          </tbody>
        </table> : <div className="channel-empty"><MessageCircle size={24} aria-hidden="true" /><p>No chat commands are enabled right now.</p></div>}
      </Panel>
    </main>
  );
}
