import { getPublicChannel } from "@community-bot/db/public";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Panel, StatusBadge } from "@/components/dashboard-ui";
import PublicHeader from "@/components/public-header";
import CommandDirectory from "@/components/command-directory";

export const dynamic = "force-dynamic";

export default async function ChannelPage() {
  const channel = await getPublicChannel();
  if (!channel) notFound();
  const twitchURL = channel.channelName && /^[a-zA-Z0-9_]{1,25}$/.test(channel.channelName)
    ? "https://www.twitch.tv/" + channel.channelName : null;
  const viewers = channel.twitch.viewers !== null && Number.isFinite(channel.twitch.viewers) && channel.twitch.viewers >= 0
    ? channel.twitch.viewers : null;
  const streamStartedAt = channel.twitch.streamStartedAt && !Number.isNaN(Date.parse(channel.twitch.streamStartedAt))
    ? new Date(channel.twitch.streamStartedAt) : null;
  return <>
    <PublicHeader active="channel" />
    <main className="channel-page">
      <header className="channel-header"><div>
        <h1>{channel.channelName ? "#" + channel.channelName : channel.botName}</h1>
        <p>Commands and community information.</p>
      </div>{twitchURL && <a className="button primary" href={twitchURL} target="_blank" rel="noreferrer">
        {channel.twitch.live === true ? "Watch on Twitch" : "Open Twitch channel"}<ArrowUpRight size={17} aria-hidden="true" />
      </a>}</header>
      <nav className="channel-navigation" aria-label="Community page sections"><a href="#commands">Commands</a><a href="#status">Bot status</a></nav>
      <div className="channel-layout">
        <CommandDirectory commands={channel.commands} botName={channel.botName} />
        <aside className="channel-about" aria-label="Community information">
          <Panel aria-labelledby="channel-about-title"><h2 id="channel-about-title">About this channel</h2>
            <p>{channel.description || "Chat commands and connection information for " + channel.botName + "."}</p>
            <p className="subtle">Powered by {channel.botName}.</p>
          </Panel>
          <Panel className="channel-stream" aria-labelledby="stream-title">
            <div className="channel-aside-heading"><h2 id="stream-title">Twitch stream</h2>
              <StatusBadge good={channel.twitch.live === true}>{channel.twitch.live === true ? "Live" : channel.twitch.live === false ? "Offline" : "Unavailable"}</StatusBadge>
            </div>
            {channel.twitch.live === true ? <div className="channel-stream-details">
              {channel.twitch.title && <h3>{channel.twitch.title}</h3>}
              {(channel.twitch.category || viewers !== null) && <p>{[channel.twitch.category, viewers !== null ? viewers.toLocaleString() + " viewers" : null].filter(Boolean).join(" · ")}</p>}
              {streamStartedAt && <p className="subtle">Started <time dateTime={streamStartedAt.toISOString()}>{streamStartedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</time></p>}
            </div> : <p>{channel.twitch.live === false ? "The channel is not live right now." : "Live stream information is not available right now."}</p>}
          </Panel>
          <Panel id="status" aria-labelledby="bot-status-title"><h2 id="bot-status-title">Bot status</h2>
            <dl className="channel-bot-status">{(["discord", "twitch"] as const).map((service) => {
              const state = channel[service].state;
              return <div key={service}><dt>{service === "discord" ? "Discord bot" : "Twitch bot"}</dt>
                <dd><StatusBadge good={state === "connected" || state === "muted"}>{state.replaceAll("_", " ")}</StatusBadge></dd>
              </div>;
            })}</dl>
          </Panel>
        </aside>
      </div>
    </main>
  </>;
}
