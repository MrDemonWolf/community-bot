"use client";

import { useId, useRef, useState } from "react";
import { Check, CircleUserRound, ImageIcon, MessageCircle, Twitch, Upload } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, trpc } from "@/utils/trpc";
import { Panel } from "./dashboard-ui";
import ImageCropper from "./image-cropper";
import Link from "next/link";
import { InlineSpinner, LoadingState } from "./loading-state";

const labels = { default: "Use initials", twitch: "Use Twitch picture", discord: "Use Discord picture", custom: "Use saved upload" };
const sourceNames = { default: "Initials", twitch: "Twitch", discord: "Discord", custom: "Saved upload" };
const sourceIcons = { default: CircleUserRound, twitch: Twitch, discord: MessageCircle, custom: ImageIcon };

export default function ProfilePictureSettings() {
  const query = useQuery(trpc.profile.get.queryOptions());
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
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
      <div className="profile-picture-row">{query.data.url ? <img className="profile-avatar" src={query.data.url} width="64" height="64" alt="Your profile picture" /> : <span className="avatar profile-initials" aria-hidden="true">{query.data.name.slice(0, 1).toUpperCase() || "?"}</span>}
        <div><strong>{query.data.name}</strong><p className="subtle">{sourceNames[query.data.source]}{query.data.source === "twitch" || query.data.source === "discord" ? " picture" : ""}</p></div>
        <button type="button" className="button profile-change-photo" disabled={pending} onClick={() => input.current?.click()}><Upload size={16} aria-hidden="true" />Change photo</button>
      </div>
      <div className="profile-source-choices" role="group" aria-label="Picture source">{query.data.choices.map((choice) => {
        const Icon = sourceIcons[choice.source];
        const selected = query.data.source === choice.source;
        return <button type="button" key={choice.source} className="profile-source" aria-label={labels[choice.source]} aria-pressed={selected}
          disabled={pending || !choice.available} onClick={() => { setError(""); setMessage(""); select.mutate({ source: choice.source }); }}>
          <Icon size={20} aria-hidden="true" /><span><strong>{sourceNames[choice.source]}</strong><small>{selected ? "Selected" : !choice.available ? choice.source === "custom" ? "No upload saved" : "Link account first" : choice.source === "default" ? "Use your name" : choice.source === "custom" ? "Your last upload" : "Linked account"}</small></span>
          {select.isPending && select.variables.source === choice.source ? <InlineSpinner /> : selected && <Check size={17} aria-hidden="true" />}
        </button>;
      })}</div>
      <input ref={input} id={id} className="profile-file-input" aria-label="Upload a picture" aria-describedby={`${id}-help`} tabIndex={-1} type="file" accept="image/png,image/jpeg,image/webp" disabled={pending} onChange={(event) => {
        const selected = event.target.files?.[0]; event.target.value = ""; setError(""); setMessage(""); upload.reset(); select.reset();
        if (!selected) return;
        if (!["image/png", "image/jpeg", "image/webp"].includes(selected.type) || selected.size > 10 * 1024 * 1024) { setError("Choose a PNG, JPEG, or WebP image under 10 MB."); return; }
        setFile(selected);
      }} />
      <p className="subtle profile-upload-help" id={`${id}-help`}>PNG, JPEG, or WebP, up to 10 MB. Crop before saving.</p>
      <p className="subtle profile-accounts-help">Link Twitch or Discord in <Link href="/access">My accounts</Link> to use its picture here. Your provider profile stays unchanged.</p>
    </>}
    {(error || select.error) && <p className="notice error" role="alert">{error || select.error?.message}</p>}
    {message && <p className="notice success" role="status">{message}</p>}
    {file && <ImageCropper file={file} pending={upload.isPending} error={upload.error?.message} onCancel={() => setFile(null)} onSave={(pngBase64) => upload.mutate({ pngBase64 })} />}
  </Panel>;
}
