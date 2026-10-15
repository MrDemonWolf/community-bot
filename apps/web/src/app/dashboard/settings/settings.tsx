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

export default function Settings() {
  const accessQuery = useQuery(trpc.access.me.queryOptions());
  const query = useQuery(trpc.settings.get.queryOptions());
  const sections = [
    { id: "profile-picture", label: "Profile picture", group: "Account" },
    { id: "appearance", label: "Appearance", group: "Account" },
    ...(accessQuery.data?.owner ? [{ id: "preferences", label: "Preferences", group: "Workspace" }] : []),
    ...(accessQuery.data && canAccess(accessQuery.data, "presence:manage", "discord") ? [{ id: "discord-presence", label: "Discord presence", group: "Workspace" }] : []),
    ...(accessQuery.data?.owner ? [
      { id: "discord-connection", label: "Discord connection", group: "Workspace" },
      { id: "twitch-connection", label: "Twitch connection", group: "Workspace" },
    ] : []),
  ];
  const activeSection = useActiveSection(sections.map((section) => section.id).join("|"), Boolean(query.data && accessQuery.data));
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
    <div className="settings-layout">
    <nav aria-label="Settings sections" className="settings-sections">
      {["Account", "Workspace"].map((group) => {
        const items = sections.filter((section) => section.group === group);
        return items.length ? <div className="settings-section-group" key={group}>
          <h2>{group}</h2><div>{items.map((section) => <a key={section.id} href={`#${section.id}`}
            aria-current={activeSection === section.id ? "location" : undefined}>{section.label}</a>)}</div>
        </div> : null;
      })}
    </nav>
    <div className="settings-panels">
      <ProfilePictureSettings />
      <AppearanceSettings />
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
    </div>
  </>;
}

function useActiveSection(sectionKey: string, ready: boolean) {
  const [active, setActive] = useState("");
  useEffect(() => {
    if (!ready) return;
    const ids = sectionKey.split("|");
    let frame = 0;
    function update() {
      frame = 0;
      const threshold = Math.max(120, window.innerHeight * 0.2);
      let current = ids[0] ?? "";
      for (const id of ids) {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= threshold) current = id;
      }
      setActive(current);
    }
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    // These anchors mount after query data arrives; restore incoming deep links without replacing any form.
    const linked = window.location.hash.slice(1);
    if (ids.includes(linked)) document.getElementById(linked)?.scrollIntoView({ block: "start" });
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
    };
  }, [sectionKey, ready]);
  return active;
}
