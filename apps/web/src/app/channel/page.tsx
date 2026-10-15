import { getPublicChannel } from "@community-bot/db/public";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ChannelPage() {
  const channel = await getPublicChannel();
  if (!channel) notFound();
  const twitchURL =
    channel.channelName && /^[a-zA-Z0-9_]{1,25}$/.test(channel.channelName)
      ? `https://www.twitch.tv/${channel.channelName}`
      : null;
  return (
    <main className="public-page">
      <div className="brand">
        <img src="/brand/logo.svg" alt="" width="42" height="42" />
        <span>
          Community Bot<small>COMMUNITY COMPANION</small>
        </span>
      </div>
      <header className="public-hero">
        <span className="eyebrow" style={{ color: "#66d2ff" }}>
          WELCOME TO THE COMMUNITY
        </span>
        <h1>
          {channel.channelName ? `#${channel.channelName}` : channel.botName}
        </h1>
        <p>
          {channel.description ||
            `${channel.botName} keeps this community connected.`}
        </p>
        <div className="actions">
          <span className="status">Discord · {channel.discord.state}</span>
          <span className="status">Twitch · {channel.twitch.state}</span>
          {channel.twitch.live !== null && (
            <span className={`status ${channel.twitch.live ? "good" : ""}`}>
              {channel.twitch.live ? "Stream is live" : "Stream is offline"}
            </span>
          )}
        </div>
        {channel.twitch.live && (
          <div style={{ marginTop: 24 }}>
            {channel.twitch.title && <h2>{channel.twitch.title}</h2>}
            <p>
              {channel.twitch.category || "No category"}
              {channel.twitch.viewers !== null
                ? ` · ${channel.twitch.viewers.toLocaleString()} viewers`
                : ""}
            </p>
          </div>
        )}
        {twitchURL && (
          <a
            className="button cyan"
            href={twitchURL}
            target="_blank"
            rel="noreferrer"
            style={{ marginTop: 22 }}
          >
            {channel.twitch.live
              ? "Watch on Twitch ↗"
              : "Visit the Twitch channel ↗"}
          </a>
        )}
      </header>
      <section className="panel">
        <h2>Say hello in chat.</h2>
        <p>Here are the commands you can use with {channel.botName}.</p>
        <table className="command-list">
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
        </table>
      </section>
      <p className="subtle" style={{ marginTop: 22 }}>
        Powered by Community Bot · Built for community.
      </p>
    </main>
  );
}
