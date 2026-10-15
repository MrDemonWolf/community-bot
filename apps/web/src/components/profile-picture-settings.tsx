"use client";

import { useId, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, trpc } from "@/utils/trpc";
import { Panel } from "./dashboard-ui";
import ImageCropper from "./image-cropper";
import Link from "next/link";
import { InlineSpinner, LoadingState } from "./loading-state";

const labels = { default: "Use initials", twitch: "Use Twitch picture", discord: "Use Discord picture", custom: "Use saved upload" };

export default function ProfilePictureSettings() {
  const query = useQuery(trpc.profile.get.queryOptions());
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function saved() {
    await queryClient.invalidateQueries({ queryKey: trpc.profile.get.queryKey() });
    setMessage("Profile picture saved.");
  }
  const select = useMutation(trpc.profile.select.mutationOptions({ onSuccess: saved }));
  const upload = useMutation(trpc.profile.upload.mutationOptions({ onSuccess: async () => { setFile(null); await saved(); } }));
  const pending = select.isPending || upload.isPending;
  return <Panel id="profile-picture" aria-labelledby="profile-picture-title" className="scroll-mt-24">
    <div className="panel-header"><div><h2 id="profile-picture-title">Your profile picture</h2><p>Choose how you appear in this dashboard.</p></div></div>
    {query.isPending && <LoadingState label="Loading your picture…" kind="form" />}
    {query.error && <p role="alert" className="notice error">The profile picture could not be loaded. <button className="button" onClick={() => query.refetch()}>Try again</button></p>}
    {query.data && <>
      <div className="profile-picture-row">{query.data.url ? <img className="profile-avatar" src={query.data.url} width="80" height="80" alt="Your profile picture" /> : <span className="avatar profile-initials" aria-hidden="true">{query.data.name.slice(0, 1).toUpperCase() || "?"}</span>}
        <div><strong>{query.data.source === "default" ? "Initials" : query.data.source === "custom" ? "Custom upload" : `${query.data.source === "twitch" ? "Twitch" : "Discord"} picture`}</strong>
          <p className="subtle">Provider pictures are copied when selected. Your saved upload stays available when you switch.</p></div></div>
      <div className="actions">{query.data.choices.map((choice) => <button type="button" key={choice.source} className="button" aria-pressed={query.data.source === choice.source}
        disabled={pending || !choice.available} onClick={() => { setError(""); setMessage(""); select.mutate({ source: choice.source }); }}>{select.isPending && select.variables.source === choice.source && <InlineSpinner />}{labels[choice.source]}</button>)}</div>
      <div className="profile-upload"><label className="field" htmlFor={id}>Upload a picture<input id={id} type="file" accept="image/png,image/jpeg,image/webp" disabled={pending} onChange={(event) => {
        const selected = event.target.files?.[0]; event.target.value = ""; setError(""); setMessage(""); upload.reset(); select.reset();
        if (!selected) return;
        if (!["image/png", "image/jpeg", "image/webp"].includes(selected.type) || selected.size > 10 * 1024 * 1024) { setError("Choose a PNG, JPEG, or WebP image under 10 MB."); return; }
        setFile(selected);
      }} /><small>PNG, JPEG, or WebP, up to 10 MB. Crop and preview before saving.</small></label></div>
      <p className="subtle">Link your personal Twitch or Discord account in <Link href="/access">My accounts</Link> to use its picture. Pictures are resized and compressed automatically. This does not change your picture on Twitch or Discord.</p>
    </>}
    {(error || select.error) && <p className="notice error" role="alert">{error || select.error?.message}</p>}
    {message && <p className="notice success" role="status">{message}</p>}
    {file && <ImageCropper file={file} pending={upload.isPending} error={upload.error?.message} onCancel={() => setFile(null)} onSave={(pngBase64) => upload.mutate({ pngBase64 })} />}
  </Panel>;
}
