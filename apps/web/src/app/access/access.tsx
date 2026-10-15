"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Link2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { canAccess } from "@community-bot/core/permissions";
import { queryClient, trpc } from "@/utils/trpc";
import { useEffect, useState } from "react";

export default function Access({ userName }: { userName: string }) {
  const [linked, setLinked] = useState("");
  useEffect(() => {
    const provider = new URLSearchParams(window.location.search).get("linked");
    if (provider === "twitch" || provider === "discord") setLinked(provider === "twitch" ? "Twitch" : "Discord");
  }, []);
  const query = useQuery(trpc.access.me.queryOptions(undefined, { refetchInterval: 15000 }));
  const disconnect = useMutation(trpc.access.disconnect.mutationOptions({ onSuccess: async () => { setLinked(""); await queryClient.invalidateQueries(); } }));
  const access = query.data;
  const staff = access && canAccess(access, "dashboard:view");
  const linkedAccount = access && (access.identities.twitch.linked || access.identities.discord.linked);
  return <main className="public-page">
    <div className="page-heading"><Link className="brand" href="/access"><img src="/brand/logo.svg" alt="" width="42" height="42" /><span>Community Bot<small>COMMUNITY ACCESS</small></span></Link><button className="button" onClick={async () => { await authClient.signOut(); window.location.assign("/login"); }}>Sign out</button></div>
    <span className="eyebrow">YOUR ACCOUNTS, YOUR ACCESS</span><h1>Welcome, {userName.split(" ")[0]}.</h1><p className="lead">Connect the accounts you use in this community. Your roles unlock the matching tools automatically.</p>
    {linked && <p role="status" className="notice success">Your {linked} account is linked. Role checks may take up to a minute to refresh.</p>}
    {query.isPending && <p role="status">Checking your access…</p>}
    {query.error && <p className="notice error" role="alert">{query.error.message} <button className="button" onClick={() => query.refetch()}>Try again</button></p>}
    {disconnect.error && <p className="notice error" role="alert">{disconnect.error.message}</p>}
    {access && <>
      <div className="next-step"><ShieldCheck size={25} /><div><h3>{staff ? "Your tools are ready" : linkedAccount ? "Your accounts are linked" : "Your next step: link an account"}</h3><p>{staff ? "Your current roles are listed below. Permissions stay scoped to each platform." : linkedAccount ? "Your community roles are listed below. Staff tools appear when the creator maps a qualifying staff role. VIP and subscriber membership do not grant staff controls." : "Link Twitch or Discord to check your community roles. Linking an account does not grant staff access by itself."}</p></div>{staff && <Link className="button primary" href="/dashboard">Open dashboard →</Link>}</div>
      <div className="mb-[26px] grid grid-cols-1 gap-5 xl:grid-cols-2">{(["twitch", "discord"] as const).map((provider) => <section className="panel" key={provider}><div className="panel-header"><div className="service-name"><span className="service-icon"><Link2 size={21} /></span><h2>{provider === "twitch" ? "Twitch" : "Discord"}</h2></div><span className={access.identities[provider].linked ? "status good" : "status"}>{access.identities[provider].linked ? "Linked" : "Not linked"}</span></div><p>{access.identities[provider].login || "Connect your personal account to check its roles."}</p>{access.identities[provider].providerUserId && <AccountID provider={provider} value={access.identities[provider].providerUserId} />}<div className="actions"><a className="button primary" href={`/api/identity/connect/${provider}`}>{access.identities[provider].linked ? "Relink account" : `Link ${provider === "twitch" ? "Twitch" : "Discord"}`}</a>{access.identities[provider].linked && <button className="button danger" disabled={disconnect.isPending} onClick={() => disconnect.mutate({ provider })}>Unlink</button>}</div><p className="subtle" style={{ marginTop: 17, marginBottom: 0 }}>Role check: {access.sync[provider].state}{access.sync[provider].checkedAt ? ` · ${new Date(access.sync[provider].checkedAt!).toLocaleString()}` : ""}</p></section>)}</div>
      <section className="panel"><h2>Your community roles</h2>{access.owner && <p className="notice success">Creator · Full access to this workspace.</p>}{access.grants.length ? <ul className="grant-list">{access.grants.map((grant, index) => <li key={`${grant.platform}-${grant.role}-${index}`}><strong>{grant.role}</strong><span>{grant.platform} · {grant.source}</span></li>)}</ul> : !access.owner && <p>No mapped roles yet. Your creator can map existing community roles to dashboard tools.</p>}<p className="subtle">VIP and subscriber status can identify community membership. They do not grant moderation or administrative controls by default.</p><button className="button" disabled={query.isFetching} onClick={() => query.refetch()}>{query.isFetching ? "Checking…" : "Refresh my access"}</button></section>
    </>}
  </main>;
}

function AccountID({ provider, value }: { provider: "twitch" | "discord"; value: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return <div style={{ marginBottom: 18 }}>
    <label className="field">{provider === "twitch" ? "Twitch" : "Discord"} account ID<input readOnly value={value} onFocus={(event) => event.target.select()} /></label>
    <div className="form-footer" style={{ marginTop: 9 }}><button type="button" className="button" aria-label={`Copy ${provider === "twitch" ? "Twitch" : "Discord"} account ID`} onClick={async () => {
      setMessage(""); setError("");
      try { await navigator.clipboard.writeText(value); setMessage("Account ID copied."); }
      catch { setError("Copy failed. Select the account ID above and copy it manually."); }
    }}>Copy account ID</button>{message && <span className="subtle" role="status">{message}</span>}</div>
    {error && <p role="alert" className="notice error" style={{ marginTop: 10 }}>{error}</p>}
  </div>;
}
