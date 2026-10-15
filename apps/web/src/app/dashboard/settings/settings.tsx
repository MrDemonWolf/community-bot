"use client";

import { LoadingState } from "@/components/loading-state";

import { useQuery } from "@tanstack/react-query";
import { canAccess } from "@community-bot/core/permissions";
import { CoreSettings, DiscordPresence, DiscordSettings, TwitchSettings } from "@/components/settings-panels";
import { PageHeading, Panel, StatusBadge } from "@/components/dashboard-ui";
import { trpc } from "@/utils/trpc";
import ProfilePictureSettings from "@/components/profile-picture-settings";
import AppearanceSettings from "@/components/appearance-settings";
import { useEffect, useState } from "react";
import { settingsSectionsFor } from "@/components/navigation";

export default function Settings() {
  const accessQuery = useQuery(trpc.access.me.queryOptions());
  const query = useQuery(trpc.settings.get.queryOptions());
  const sections = settingsSectionsFor(accessQuery.data ?? { owner: false, grants: [] });
  const activeSection = useSelectedSection(sections.map((section) => section.id).join("|"), Boolean(query.data && accessQuery.data));
  if ((query.isPending || accessQuery.isPending) && !query.error && !accessQuery.error) return <LoadingState label="Loading settings…" kind="form" />;
  if (query.error || accessQuery.error || !query.data || !accessQuery.data) return <p className="notice error" role="alert">
    Settings could not be loaded. <button className="button" onClick={() => { void query.refetch(); void accessQuery.refetch(); }}>Try again</button>
  </p>;
  const settings = query.data;
  const access = accessQuery.data;
  const presence = canAccess(access, "presence:manage", "discord");
  return <>
    <PageHeading title="Settings"
      description={access.owner ? "Manage your profile, community preferences, and connections." : "Manage your profile and the settings available to your role."}
    />
    <label className="field settings-picker">Settings section
      <select value={activeSection} onChange={(event) => { window.location.hash = event.target.value; }}>
      {["Account", "Workspace"].map((group) => {
        const items = sections.filter((section) => section.group === group);
        return items.length ? <optgroup label={group} key={group}>{items.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}</optgroup> : null;
      })}
      </select>
    </label>
    <div className="settings-panels">
      <div className="settings-panel" data-settings-panel="profile-picture" hidden={activeSection !== "profile-picture"}><ProfilePictureSettings /></div>
      <div className="settings-panel" data-settings-panel="appearance" hidden={activeSection !== "appearance"}><AppearanceSettings /></div>
      {access.owner && <div className="settings-panel" data-settings-panel="preferences" hidden={activeSection !== "preferences"}><Panel id="preferences" aria-labelledby="preferences-title" className="scroll-mt-24">
        <div className="panel-header"><div><h2 id="preferences-title">Community preferences</h2><p>Your bot name, command prefix, and public page.</p></div></div>
        <CoreSettings settings={settings} />
      </Panel></div>}
      {presence && <div className="settings-panel" data-settings-panel="discord-presence" hidden={activeSection !== "discord-presence"}><Panel id="discord-presence" aria-labelledby="presence-title" className="scroll-mt-24">
        <div className="panel-header"><div><h2 id="presence-title">Discord presence</h2><p>Choose the status and activity people see beside your bot.</p></div></div>
        <DiscordPresence settings={settings} />
      </Panel></div>}
      {access.owner && <>
        <div className="settings-panel" data-settings-panel="discord-connection" hidden={activeSection !== "discord-connection"}><Panel id="discord-connection" aria-labelledby="discord-settings-title" className="scroll-mt-24">
          <div className="panel-header"><div><h2 id="discord-settings-title">Discord application</h2><p>Credentials and server connection.</p></div>
            <StatusBadge good={settings.discordConfigured}>{settings.discordConfigured ? "Configured" : "Setup needed"}</StatusBadge></div>
          <DiscordSettings settings={settings} />
        </Panel></div>
        <div className="settings-panel" data-settings-panel="twitch-connection" hidden={activeSection !== "twitch-connection"}><Panel id="twitch-connection" aria-labelledby="twitch-settings-title" className="scroll-mt-24">
          <div className="panel-header"><div><h2 id="twitch-settings-title">Twitch application & accounts</h2><p>Keep your creator and bot accounts connected separately.</p></div>
            <StatusBadge good={settings.broadcaster.connected && settings.bot.connected}>{settings.broadcaster.connected && settings.bot.connected ? "Configured" : "Setup needed"}</StatusBadge></div>
          <TwitchSettings settings={settings} />
        </Panel></div>
      </>}
    </div>
  </>;
}

function useSelectedSection(sectionKey: string, ready: boolean) {
  const [active, setActive] = useState("profile-picture");
  useEffect(() => {
    if (!ready) return;
    const ids = sectionKey.split("|");
    function update() {
      const hash = window.location.hash.slice(1);
      setActive(ids.includes(hash) ? hash : ids[0] ?? "profile-picture");
      window.scrollTo({ top: 0 });
    }
    // Hash navigation switches visibility only; mounted forms retain unsaved fields and native history still works.
    update();
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
  }, [sectionKey, ready]);
  return sectionKey.split("|").includes(active) ? active : "profile-picture";
}
