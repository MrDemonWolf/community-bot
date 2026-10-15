"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ROLES } from "@community-bot/core/permissions";
import { queryClient, trpc } from "@/utils/trpc";

const reload = async () => { await queryClient.invalidateQueries(); };
type StaffRole = Exclude<(typeof ROLES)[number], "viewer">;

export default function StaffAccess() {
  const query = useQuery(trpc.access.config.queryOptions());
  const roles = useQuery(trpc.access.discordRoles.queryOptions());
  const [provider, setProvider] = useState<"twitch" | "discord">("discord");
  const [targetRole, setTargetRole] = useState<StaffRole>("moderator");
  const [message, setMessage] = useState("");
  const configure = useMutation(trpc.access.configure.mutationOptions({ onSuccess: async () => { setMessage("Role sync settings saved."); await reload(); } }));
  const save = useMutation(trpc.access.saveMapping.mutationOptions({ onSuccess: reload }));
  const remove = useMutation(trpc.access.deleteMapping.mutationOptions({ onSuccess: reload }));
  const data = query.data;
  if (query.isPending) return <p role="status">Loading staff access…</p>;
  if (query.error || !data) return <p className="notice error" role="alert">{query.error?.message || "Access settings unavailable."}</p>;
  const error = configure.error || save.error || remove.error;
  return <>
    <header className="page-heading"><div><span className="eyebrow">CREATOR ONLY · COMMUNITY ROLES</span><h1>The right tools.<br />For the right people.</h1><p>People sign in with Google, link their own accounts, and receive access from the roles you map here.</p></div></header>
    {error && <p role="alert" className="notice error">{error.message}</p>}{message && <p role="status" className="notice success">{message}</p>}
    <div className="next-step"><div><h3>Keep the first mapping small</h3><p>Map your Discord moderator role to Discord moderator. Add access to Twitch separately when you intend to share it.</p></div></div>
    <section className="panel"><h2>1. Enable role checks</h2><p>Role checks are optional. The creator account always keeps access, including when a provider is unavailable.</p>
      <form onSubmit={(event) => { event.preventDefault(); setMessage(""); const form = new FormData(event.currentTarget); configure.mutate({ permissionSyncTwitch: form.get("permissionSyncTwitch") === "on", permissionSyncDiscord: form.get("permissionSyncDiscord") === "on", twitchLeadModeratorIds: String(form.get("twitchLeadModeratorIds") ?? "").split(/[\s,]+/).filter(Boolean) }); }}>
        <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2"><label className="checkbox"><input name="permissionSyncTwitch" type="checkbox" defaultChecked={data.permissionSyncTwitch} />Check Twitch community roles</label><label className="checkbox"><input name="permissionSyncDiscord" type="checkbox" defaultChecked={data.permissionSyncDiscord} />Check Discord server roles</label><label className="field full">Explicit Twitch lead moderator user IDs<textarea name="twitchLeadModeratorIds" defaultValue={data.twitchLeadModeratorIds.join("\n")} placeholder="One numeric Twitch user ID per line" /><small>Ask a moderator to copy their Twitch ID from My accounts. Use one ID per line for trusted leads when Twitch cannot provide durable lead-role evidence.</small></label></div><div className="form-footer"><button className="button primary" disabled={configure.isPending}>{configure.isPending ? "Saving…" : "Save role checks"}</button></div>
      </form>
      {data.permissionSyncTwitch && <p className="notice" style={{ marginTop: 20 }}>Twitch role checks need creator permission. <a href="/api/twitch/connect/broadcaster">Reauthorize the creator account</a> after enabling them.</p>}
      {!data.discordOAuthConfigured && <p className="notice" style={{ marginTop: 20 }}>For Discord identity linking, add the application client secret in the dashboard's Discord application settings. The bot token alone cannot authorize personal identities.</p>}
    </section>
    <h2 className="section-title">2. Map an existing role</h2>
    <section className="panel"><form onSubmit={(event) => { event.preventDefault(); setMessage(""); const form = new FormData(event.currentTarget); save.mutate({ provider, sourceRoleId: String(form.get("sourceRoleId") ?? ""), role: String(form.get("role")) as "admin" | "lead_moderator" | "moderator" | "vip" | "subscriber", scopes: (["twitch", "discord"] as const).filter((platform) => form.get(platform) === "on") }, { onSuccess: () => setMessage("Role mapping saved.") }); }}>
      <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2"><label className="field">Where the role comes from<select value={provider} onChange={(event) => { setProvider(event.target.value as "twitch" | "discord"); setTargetRole("moderator"); }}><option value="discord">Discord server role</option><option value="twitch">Twitch native role</option></select></label>
      <label className="field">Existing role{provider === "twitch" ? <select name="sourceRoleId" onChange={(event) => setTargetRole(event.target.value as StaffRole)}><option value="moderator">Moderator</option><option value="lead_moderator">Lead moderator</option><option value="vip">VIP</option><option value="subscriber">Subscriber</option></select> : <input name="sourceRoleId" list="discord-roles" required inputMode="numeric" placeholder="Paste a Discord role ID" />}</label>
      <datalist id="discord-roles">{roles.data?.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</datalist>
      <label className="field">Dashboard role<select name="role" value={targetRole} onChange={(event) => setTargetRole(event.target.value as StaffRole)}>{ROLES.filter((role) => role !== "viewer").map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</select><small>Admin manages platform features. Lead moderator adds join/leave. Moderator handles mute and redemption actions.</small></label>
      <fieldset className="field" key={provider}><legend>Apply access to</legend><label className="checkbox"><input name="discord" type="checkbox" defaultChecked={provider === "discord"} />Discord tools</label><label className="checkbox"><input name="twitch" type="checkbox" defaultChecked={provider === "twitch"} />Twitch tools</label><small>Choose each platform deliberately. The VIP and subscriber dashboard roles grant no staff controls. Selecting a staff role grants its staff tools.</small></fieldset>
      </div><div className="form-footer"><button className="button primary" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save role mapping"}</button></div>
    </form>{roles.error && <p className="subtle" style={{ marginTop: 16 }}>Discord role names could not be loaded. You can still paste a role ID from Discord.</p>}</section>
    <h2 className="section-title">Current mappings</h2><section className="panel">{data.mappings.length ? <ul className="grant-list">{data.mappings.map((mapping) => <li key={mapping.id}><div><strong>{mapping.provider} · {roles.data?.find((role) => role.id === mapping.sourceRoleId)?.name || mapping.sourceRoleId}</strong><span style={{ display: "block" }}>{mapping.role.replaceAll("_", " ")} → {mapping.scopes.join(" + ")}</span></div><button className="button danger" disabled={remove.isPending} onClick={() => remove.mutate({ id: mapping.id })}>Remove mapping</button></li>)}</ul> : <p>No mappings yet. People can link accounts, but staff tools remain unavailable until you map their roles.</p>}<div className="rule" /><h3>Use a Twitch starter set</h3><p className="subtle">Explicitly adds native moderator → moderator, lead moderator → lead moderator, VIP → VIP, and subscriber → subscriber, scoped to Twitch only. Existing custom mappings stay in place.</p><button className="button" disabled={save.isPending} onClick={async () => { setMessage(""); try { for (const role of ["moderator", "lead_moderator", "vip", "subscriber"] as const) { if (data.mappings.some((mapping) => mapping.provider === "twitch" && mapping.sourceRoleId === role && mapping.role === role)) continue; await save.mutateAsync({ provider: "twitch", sourceRoleId: role, role, scopes: ["twitch"] }); } setMessage("Twitch starter mappings saved. Review the list above."); } catch { setMessage(""); } }}>Add Twitch starter mappings</button></section>
  </>;
}
