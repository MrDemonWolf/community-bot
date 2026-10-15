"use client";

import { useQuery } from "@tanstack/react-query";
import { canAccess } from "@community-bot/core/permissions";
import { CoreSettings, DiscordPresence, DiscordSettings, TwitchSettings } from "@/components/settings-panels";
import { PageHeading, Panel, StatusBadge } from "@/components/dashboard-ui";
import { trpc } from "@/utils/trpc";

export default function Settings() {
  const accessQuery = useQuery(trpc.access.me.queryOptions());
  const query = useQuery(trpc.settings.get.queryOptions());
  if (query.isPending || accessQuery.isPending) return <p role="status">Loading settings…</p>;
  if (query.error || accessQuery.error || !query.data || !accessQuery.data) return <p className="notice error" role="alert">
    Settings could not be loaded. <button className="button" onClick={() => { void query.refetch(); void accessQuery.refetch(); }}>Try again</button>
  </p>;
  const settings = query.data;
  const access = accessQuery.data;
  const presence = canAccess(access, "presence:manage", "discord");
  return <>
    <PageHeading eyebrow="WORKSPACE SETTINGS" title="Make it yours."
      description={access.owner ? "Manage your community preferences and platform connections." : "Manage the Discord presence available to your role."}
    />
    <nav aria-label="Settings sections" className="actions mb-6">
      {access.owner && <a className="button" href="#preferences">Preferences</a>}
      {presence && <a className="button" href="#discord-presence">Discord presence</a>}
      {access.owner && <><a className="button" href="#discord-connection">Discord connection</a><a className="button" href="#twitch-connection">Twitch connection</a></>}
    </nav>
    <div className="grid gap-5">
      {access.owner && <Panel id="preferences" aria-labelledby="preferences-title" className="scroll-mt-24">
        <div className="panel-header"><div><h2 id="preferences-title">Community preferences</h2><p>Your bot name, command prefix, and public page.</p></div></div>
        <CoreSettings settings={settings} />
      </Panel>}
      {presence && <Panel id="discord-presence" aria-labelledby="presence-title" className="scroll-mt-24">
        <div className="panel-header"><div><h2 id="presence-title">Discord presence</h2><p>Choose the status and activity people see beside your bot.</p></div></div>
        <DiscordPresence settings={settings} />
      </Panel>}
      {access.owner && <>
        <Panel id="discord-connection" aria-labelledby="discord-settings-title" className="scroll-mt-24">
          <div className="panel-header"><div><h2 id="discord-settings-title">Discord application</h2><p>Credentials and server connection.</p></div>
            <StatusBadge good={settings.discordConfigured}>{settings.discordConfigured ? "Configured" : "Setup needed"}</StatusBadge></div>
          <DiscordSettings settings={settings} />
        </Panel>
        <Panel id="twitch-connection" aria-labelledby="twitch-settings-title" className="scroll-mt-24">
          <div className="panel-header"><div><h2 id="twitch-settings-title">Twitch application & accounts</h2><p>Keep your creator and bot accounts connected separately.</p></div>
            <StatusBadge good={settings.broadcaster.connected && settings.bot.connected}>{settings.broadcaster.connected && settings.bot.connected ? "Configured" : "Setup needed"}</StatusBadge></div>
          <TwitchSettings settings={settings} />
        </Panel>
      </>}
    </div>
  </>;
}
