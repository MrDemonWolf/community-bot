"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { canAccess } from "@community-bot/core/permissions";
import Link from "next/link";
import { queryClient, trpc } from "@/utils/trpc";

export default function Features() {
  const access = useQuery(trpc.access.me.queryOptions());
  const query = useQuery(trpc.features.list.queryOptions());
  const update = useMutation(trpc.features.update.mutationOptions({ onSuccess: async () => { await queryClient.invalidateQueries(); } }));
  return <>
    <header className="page-heading"><div><span className="eyebrow">SMALL TOOLS, CLEAR PURPOSE</span><h1>Choose your features.</h1><p>Keep only the features your community uses. Each tool follows your platform permissions.</p></div></header>
    {(query.isPending || access.isPending) && <p role="status">Loading features…</p>}
    {(query.error || access.error || update.error) && <p className="notice error" role="alert">{query.error?.message || access.error?.message || update.error?.message}</p>}
    {update.isSuccess && <p className="notice success" role="status">Feature preference saved. The running services will apply it shortly.</p>}
    <div className="grid gap-5">{query.data?.map((feature) => {
      const allowed = access.data && canAccess(access.data, feature.capability, feature.platform);
      return <section className="panel" key={`${feature.id}:${feature.platform}`}><div className="panel-header"><div><span className="eyebrow">{feature.platform}</span><h2>{feature.name}</h2><p>{feature.description}</p></div><span className={feature.enabled ? "status good" : "status"}>{feature.enabled ? "Enabled" : "Disabled"}</span></div><div className="actions"><button className={feature.enabled ? "button" : "button primary"} disabled={!allowed || update.isPending} onClick={() => update.mutate({ featureId: feature.id, platform: feature.platform, enabled: !feature.enabled, config: feature.config })}>{feature.enabled ? "Disable feature" : "Enable feature"}</button>{feature.id === "presence" && <Link className="button" href="/dashboard">Edit Discord presence</Link>}{feature.id === "channel-points" && access.data && canAccess(access.data, "redemptions:view", "twitch") && <Link className="button" href="/dashboard/rewards">Manage channel points</Link>}</div>{!allowed && <p className="subtle" style={{ marginTop: 15 }}>Your current role can view this feature but cannot change it.</p>}{feature.id === "channel-points" && <p className="subtle" style={{ marginTop: 15 }}>The creator must also opt in and authorize reward permissions on Twitch. Channel Points require an eligible creator account.</p>}</section>;
    })}</div>
  </>;
}
