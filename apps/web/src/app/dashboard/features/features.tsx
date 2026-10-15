"use client";

import { InlineSpinner, LoadingState } from "@/components/loading-state";

import { useMutation, useQuery } from "@tanstack/react-query";
import { canAccess } from "@community-bot/core/permissions";
import Link from "next/link";
import { PageHeading, Panel, StatusBadge } from "@/components/dashboard-ui";
import { queryClient, trpc } from "@/utils/trpc";

export default function Features() {
  const access = useQuery(trpc.access.me.queryOptions());
  const query = useQuery(trpc.features.list.queryOptions());
  const update = useMutation(trpc.features.update.mutationOptions({ onSuccess: async () => { await queryClient.invalidateQueries(); } }));
  return <>
    <PageHeading title="Features"
      description="Keep the tools your community uses. You can change these whenever you need."
    />
    {(query.isPending || access.isPending) && !query.error && !access.error && <LoadingState label="Loading features…" />}
    {(query.error || access.error || update.error) && <p className="notice error" role="alert">{query.error?.message || access.error?.message || update.error?.message}</p>}
    {update.isSuccess && <p className="notice success" role="status">Feature preference saved. The running services will apply it shortly.</p>}
    <div className="feature-grid">{query.data?.map((feature) => {
      const allowed = access.data && canAccess(access.data, feature.capability, feature.platform);
      return <Panel className="feature-card" key={`${feature.id}:${feature.platform}`} aria-label={`${feature.platform} ${feature.name}`}>
        <div className="panel-header">
          <div><span className="eyebrow">{feature.platform}</span><h2>{feature.name}</h2><p>{feature.description}</p></div>
          <StatusBadge good={feature.enabled}>{feature.enabled ? "Enabled" : "Disabled"}</StatusBadge>
        </div>
        <div className="actions">
          <button className={feature.enabled ? "button" : "button primary"} disabled={!allowed || update.isPending}
            onClick={() => update.mutate({ featureId: feature.id, platform: feature.platform, enabled: !feature.enabled, config: feature.config })}>
            {update.isPending && update.variables?.featureId === feature.id && update.variables.platform === feature.platform && <InlineSpinner />}{feature.enabled ? "Disable feature" : "Enable feature"}
          </button>
          {feature.id === "presence" && allowed && <Link className="button" href="/dashboard/settings#discord-presence">Edit Discord presence</Link>}
          {feature.id === "channel-points" && access.data && canAccess(access.data, "redemptions:view", "twitch") && <Link className="button" href="/dashboard/rewards">Manage channel points</Link>}
        </div>
        {!allowed && <p className="subtle mt-4 mb-0">Your role can view this feature. An admin can change it.</p>}
        {feature.id === "channel-points" && <p className="subtle mt-4 mb-0">The creator must also authorize rewards in Channel Points. Twitch requires an eligible creator account.</p>}
      </Panel>;
    })}</div>
  </>;
}
