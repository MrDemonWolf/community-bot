"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogCloseButton,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Settings } from "lucide-react";
import { EmbedPreview } from "./embed-preview";

interface ChannelData {
  id: string;
  twitchChannelId: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  isLive: boolean;
  notificationChannelId: string | null;
  notificationRoleId: string | null;
  updateMessageLive: boolean;
  deleteWhenOffline: boolean;
  autoPublish: boolean;
  useCustomMessage: boolean;
  customOnlineMessage: string | null;
  customOfflineMessage: string | null;
}

const PREVIEW_VARIABLES: Record<string, string> = {
  streamer: "StreamerName",
  title: "Playing some games!",
  game: "Just Chatting",
  viewers: "1,234",
  url: "https://www.twitch.tv/streamername",
  thumbnail: "https://example.com/thumb.jpg",
  duration: "2h 30m",
};

export function ChannelSettingsDialog({
  channel,
  monitoredChannelsQueryKey,
}: {
  channel: ChannelData;
  monitoredChannelsQueryKey: readonly unknown[];
}) {
  const queryClient = useQueryClient();

  const [notifChannelId, setNotifChannelId] = useState(
    channel.notificationChannelId ?? ""
  );
  const [notifRoleId, setNotifRoleId] = useState(
    channel.notificationRoleId ?? ""
  );
  const [updateMessageLive, setUpdateMessageLive] = useState(
    channel.updateMessageLive
  );
  const [deleteWhenOffline, setDeleteWhenOffline] = useState(
    channel.deleteWhenOffline
  );
  const [autoPublish, setAutoPublish] = useState(channel.autoPublish);
  const [useCustomMessage, setUseCustomMessage] = useState(
    channel.useCustomMessage
  );
  const [customOnlineMessage, setCustomOnlineMessage] = useState(
    channel.customOnlineMessage ?? ""
  );
  const [customOfflineMessage, setCustomOfflineMessage] = useState(
    channel.customOfflineMessage ?? ""
  );

  const { data: channels, isLoading: channelsLoading } = useQuery(
    trpc.discordGuild.getGuildChannels.queryOptions()
  );

  const { data: roles, isLoading: rolesLoading } = useQuery(
    trpc.discordGuild.getGuildRoles.queryOptions()
  );

  const mutation = useMutation(
    trpc.discordGuild.updateChannelSettings.mutationOptions({
      onSuccess: () => {
        toast.success("Channel settings saved.");
        queryClient.invalidateQueries({
          queryKey: monitoredChannelsQueryKey,
        });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  function handleSave() {
    mutation.mutate({
      channelId: channel.id,
      notificationChannelId:
        notifChannelId && notifChannelId !== "_none" ? notifChannelId : null,
      notificationRoleId:
        notifRoleId && notifRoleId !== "_none" && notifRoleId !== ""
          ? notifRoleId
          : null,
      updateMessageLive,
      deleteWhenOffline,
      autoPublish,
      useCustomMessage,
      customOnlineMessage: customOnlineMessage || null,
      customOfflineMessage: customOfflineMessage || null,
    });
  }

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          <Settings className="size-3.5" />
          Configure
        </Button>
      </DialogTrigger>
      <DialogPopup className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogCloseButton />
        <DialogTitle className="font-heading">
          {channel.displayName ?? channel.username ?? "Channel"} Settings
        </DialogTitle>
        <DialogDescription>
          Per-channel notification overrides. Leave blank to use guild defaults.
        </DialogDescription>

        <div className="mt-4 space-y-5">
          {/* Notification Channel Override */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Notification Channel Override
            </label>
            {channelsLoading ? (
              <div className="h-8 rounded bg-muted animate-pulse" />
            ) : (
              <select
                value={notifChannelId}
                onChange={(e) => setNotifChannelId(e.target.value)}
                className="border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-none border px-2.5 py-2 text-xs outline-none focus-visible:ring-1"
              >
                <option value="">Use guild default</option>
                <option value="_none">(None)</option>
                {channels?.map((c) => (
                  <option key={c.id} value={c.id}>
                    # {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Notification Role Override */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Notification Role Override
            </label>
            {rolesLoading ? (
              <div className="h-8 rounded bg-muted animate-pulse" />
            ) : (
              <select
                value={notifRoleId}
                onChange={(e) => setNotifRoleId(e.target.value)}
                className="border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-none border px-2.5 py-2 text-xs outline-none focus-visible:ring-1"
              >
                <option value="">Use guild default</option>
                <option value="_none">No mention</option>
                <option value="everyone">@everyone</option>
                {roles?.map((r) => (
                  <option key={r.id} value={r.id}>
                    @{r.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Behavior Toggles */}
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={updateMessageLive}
                onChange={(e) => setUpdateMessageLive(e.target.checked)}
                className="accent-brand-main"
              />
              <div>
                <span className="text-sm font-medium text-foreground">
                  Update message while live
                </span>
                <p className="text-xs text-muted-foreground">
                  Periodically update the embed with current viewer count and
                  game
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={deleteWhenOffline}
                onChange={(e) => setDeleteWhenOffline(e.target.checked)}
                className="accent-brand-main"
              />
              <div>
                <span className="text-sm font-medium text-foreground">
                  Delete when offline
                </span>
                <p className="text-xs text-muted-foreground">
                  Delete the notification message when the stream ends instead of
                  editing to offline
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={autoPublish}
                onChange={(e) => setAutoPublish(e.target.checked)}
                className="accent-brand-main"
              />
              <div>
                <span className="text-sm font-medium text-foreground">
                  Auto-publish in announcement channels
                </span>
                <p className="text-xs text-muted-foreground">
                  Automatically crosspost notifications sent to announcement
                  channels
                </p>
              </div>
            </label>
          </div>

          {/* Custom Message */}
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={useCustomMessage}
                onChange={(e) => setUseCustomMessage(e.target.checked)}
                className="accent-brand-main"
              />
              <div>
                <span className="text-sm font-medium text-foreground">
                  Use custom embed message
                </span>
                <p className="text-xs text-muted-foreground">
                  Replace the default embed with custom JSON. Variables:{" "}
                  <code className="text-xs">
                    {"{streamer}"} {"{title}"} {"{game}"} {"{viewers}"}{" "}
                    {"{url}"} {"{thumbnail}"} {"{duration}"}
                  </code>
                </p>
              </div>
            </label>

            {useCustomMessage && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Online Embed JSON
                  </label>
                  <textarea
                    value={customOnlineMessage}
                    onChange={(e) => setCustomOnlineMessage(e.target.value)}
                    rows={6}
                    className="border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-none border px-2.5 py-2 font-mono text-xs outline-none focus-visible:ring-1"
                    placeholder='{"title": "{streamer} is live!", "description": "Playing {game}", "color": 9520895}'
                  />
                  <div className="mt-2">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Preview
                    </p>
                    <EmbedPreview
                      json={customOnlineMessage}
                      variables={PREVIEW_VARIABLES}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Offline Embed JSON
                  </label>
                  <textarea
                    value={customOfflineMessage}
                    onChange={(e) => setCustomOfflineMessage(e.target.value)}
                    rows={6}
                    className="border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-none border px-2.5 py-2 font-mono text-xs outline-none focus-visible:ring-1"
                    placeholder='{"title": "{streamer} was live", "description": "Streamed for {duration}", "color": 9520895}'
                  />
                  <div className="mt-2">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Preview
                    </p>
                    <EmbedPreview
                      json={customOfflineMessage}
                      variables={PREVIEW_VARIABLES}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <DialogTrigger>
            <Button variant="outline">Cancel</Button>
          </DialogTrigger>
          <Button disabled={mutation.isPending} onClick={handleSave}>
            {mutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Save Settings
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
