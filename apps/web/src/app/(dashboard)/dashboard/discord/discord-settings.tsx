"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  AlertCircle,
  Send,
  Radio,
  Plus,
  Trash2,
} from "lucide-react";
import { ChannelSettingsDialog } from "./channel-settings-dialog";
import { canControlBot } from "@/utils/roles";

const BOT_PERMISSIONS = "2147633152";

export default function DiscordSettings({
  discordAppId,
}: {
  discordAppId: string;
}) {
  const queryClient = useQueryClient();
  const queryKey = trpc.discordGuild.getStatus.queryOptions().queryKey;

  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canEdit = canControlBot(profile?.role ?? "USER");

  const { data: guild, isLoading } = useQuery(
    trpc.discordGuild.getStatus.queryOptions()
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!guild) {
    return canEdit ? (
      <LinkGuildSection
        discordAppId={discordAppId}
        queryKey={queryKey}
        queryClient={queryClient}
      />
    ) : (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No Discord server linked yet. A lead moderator can link one.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <GuildInfoCard
        guild={guild}
        queryKey={queryKey}
        queryClient={queryClient}
        canEdit={canEdit}
      />
      <NotificationChannelCard
        currentValue={guild.notificationChannelId}
        queryKey={queryKey}
        queryClient={queryClient}
        canEdit={canEdit}
      />
      <NotificationRoleCard
        currentValue={guild.notificationRoleId}
        queryKey={queryKey}
        queryClient={queryClient}
        canEdit={canEdit}
      />
      <RoleMappingCard
        currentAdminRoleId={guild.adminRoleId}
        currentModRoleId={guild.modRoleId}
        queryKey={queryKey}
        queryClient={queryClient}
        canEdit={canEdit}
      />
      <TestNotificationCard hasChannel={!!guild.notificationChannelId} canEdit={canEdit} />
      <MonitoredChannelsCard canEdit={canEdit} />
    </div>
  );
}

function LinkGuildSection({
  discordAppId,
  queryKey,
  queryClient,
}: {
  discordAppId: string;
  queryKey: readonly unknown[];
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [selectedGuildId, setSelectedGuildId] = useState<string>("");
  const autoLinked = useRef(false);

  const { data: availableGuilds, isLoading } = useQuery({
    ...trpc.discordGuild.listAvailableGuilds.queryOptions(),
    refetchInterval: 10_000,
  });

  const linkMutation = useMutation(
    trpc.discordGuild.linkGuild.mutationOptions({
      onSuccess: () => {
        toast.success("Discord server linked!");
        void queryClient.invalidateQueries();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  // Auto-link when there's exactly one available guild
  useEffect(() => {
    if (
      availableGuilds?.length === 1 &&
      !linkMutation.isPending &&
      !autoLinked.current
    ) {
      autoLinked.current = true;
      linkMutation.mutate({ guildId: availableGuilds[0].guildId });
    }
  }, [availableGuilds, linkMutation]);

  const authorizeUrl = `https://discord.com/oauth2/authorize?client_id=${discordAppId}&scope=bot&permissions=${BOT_PERMISSIONS}`;

  // Show loading state while auto-linking
  if (linkMutation.isPending) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-8">
          <Loader2 className="size-5 animate-spin text-brand-discord" />
          <span className="text-sm text-muted-foreground">
            Linking Discord server...
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Add Bot to Server</CardTitle>
          <CardDescription>
            First, add the bot to your Discord server. Then select it from the
            dropdown below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a href={authorizeUrl} target="_blank" rel="noopener noreferrer">
            <Button className="bg-brand-discord hover:bg-brand-discord/80 text-white">
              <ExternalLink className="size-4" />
              Add Bot to Server
            </Button>
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Link Discord Server</CardTitle>
          <CardDescription>
            Select a server that the bot has joined but isn&apos;t linked to any
            account yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {isLoading ? (
              <Skeleton className="h-8 flex-1" />
            ) : (
              <Select
                value={selectedGuildId}
                onValueChange={(v) => setSelectedGuildId(v ?? "")}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a server..." />
                </SelectTrigger>
                <SelectContent>
                  {availableGuilds && availableGuilds.length > 0 ? (
                    availableGuilds.map((g) => (
                      <SelectItem key={g.guildId} value={g.guildId}>
                        {g.name ?? g.guildId}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="_empty" disabled>
                      No servers available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
            <Button
              disabled={
                linkMutation.isPending ||
                !selectedGuildId ||
                selectedGuildId === "_empty"
              }
              onClick={() => linkMutation.mutate({ guildId: selectedGuildId })}
            >
              {linkMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Link Server
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GuildInfoCard({
  guild,
  queryKey,
  queryClient,
  canEdit,
}: {
  guild: {
    guildId: string;
    name: string | null;
    icon: string | null;
    enabled: boolean;
  };
  queryKey: readonly unknown[];
  queryClient: ReturnType<typeof useQueryClient>;
  canEdit: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          {guild.icon ? (
            <img
              src={guild.icon}
              alt={guild.name ?? "Server icon"}
              className="size-12 rounded-full"
            />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-full bg-brand-discord text-lg font-bold text-white">
              {(guild.name ?? "?")[0]}
            </span>
          )}
          <div>
            <CardTitle className="font-heading">
              {guild.name ?? guild.guildId}
            </CardTitle>
            <CardDescription>
              Guild ID: <code className="text-xs">{guild.guildId}</code>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <EnableToggle
          enabled={guild.enabled}
          queryKey={queryKey}
          queryClient={queryClient}
          canEdit={canEdit}
        />
      </CardContent>
    </Card>
  );
}

function EnableToggle({
  enabled,
  queryKey,
  queryClient,
  canEdit,
}: {
  enabled: boolean;
  queryKey: readonly unknown[];
  queryClient: ReturnType<typeof useQueryClient>;
  canEdit: boolean;
}) {
  const enableMutation = useMutation(
    trpc.discordGuild.enable.mutationOptions({
      onSuccess: () => {
        toast.success("Discord notifications enabled.");
        queryClient.invalidateQueries({ queryKey });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const disableMutation = useMutation(
    trpc.discordGuild.disable.mutationOptions({
      onSuccess: () => {
        toast.success("Discord notifications disabled.");
        queryClient.invalidateQueries({ queryKey });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const isPending = enableMutation.isPending || disableMutation.isPending;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {enabled ? (
          <CheckCircle2 className="size-4 text-green-500" />
        ) : (
          <XCircle className="size-4 text-muted-foreground" />
        )}
        <span className="text-sm">
          Notifications {enabled ? "enabled" : "disabled"}
        </span>
      </div>
      {canEdit && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() =>
            enabled ? disableMutation.mutate() : enableMutation.mutate()
          }
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {enabled ? "Disable" : "Enable"}
        </Button>
      )}
    </div>
  );
}

function NotificationChannelCard({
  currentValue,
  queryKey,
  queryClient,
  canEdit,
}: {
  currentValue: string | null;
  queryKey: readonly unknown[];
  queryClient: ReturnType<typeof useQueryClient>;
  canEdit: boolean;
}) {
  const [channelId, setChannelId] = useState(currentValue ?? "");

  const {
    data: channels,
    isLoading,
    isError,
    refetch,
  } = useQuery(trpc.discordGuild.getGuildChannels.queryOptions());

  const mutation = useMutation(
    trpc.discordGuild.setNotificationChannel.mutationOptions({
      onSuccess: () => {
        toast.success("Notification channel updated.");
        queryClient.invalidateQueries({ queryKey });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Notification Channel</CardTitle>
        <CardDescription>
          The Discord channel where Twitch live stream notifications will be
          posted. When a stream goes live, the bot sends an embed with the
          stream title, game, and viewer count.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : isError ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" />
            <span>Failed to load channels.</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="text-xs"
            >
              Retry
            </Button>
          </div>
        ) : canEdit ? (
            <div className="flex gap-3">
              <select
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex-1 rounded-none border px-2.5 py-2 text-xs outline-none focus-visible:ring-1"
              >
                <option value="">Select a channel...</option>
                <option value="_none">(None)</option>
                {channels?.map((c) => (
                  <option key={c.id} value={c.id}>
                    # {c.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    channelId:
                      channelId && channelId !== "_none" ? channelId : null,
                  })
                }
              >
                {mutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Save
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {channels?.find((c) => c.id === channelId)
                ? `# ${channels.find((c) => c.id === channelId)!.name}`
                : "Not set"}
            </p>
          )}
      </CardContent>
    </Card>
  );
}

function NotificationRoleCard({
  currentValue,
  queryKey,
  queryClient,
  canEdit,
}: {
  currentValue: string | null;
  queryKey: readonly unknown[];
  queryClient: ReturnType<typeof useQueryClient>;
  canEdit: boolean;
}) {
  const [roleId, setRoleId] = useState(currentValue ?? "");

  const {
    data: roles,
    isLoading,
    isError,
    refetch,
  } = useQuery(trpc.discordGuild.getGuildRoles.queryOptions());

  const mutation = useMutation(
    trpc.discordGuild.setNotificationRole.mutationOptions({
      onSuccess: () => {
        toast.success("Notification role updated.");
        queryClient.invalidateQueries({ queryKey });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Notification Role</CardTitle>
        <CardDescription>
          Choose which role to mention when a Twitch stream goes live. This
          ping is included in the live notification message posted to your
          notification channel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : isError ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" />
            <span>Failed to load roles.</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="text-xs"
            >
              Retry
            </Button>
          </div>
        ) : canEdit ? (
            <div className="flex gap-3">
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex-1 rounded-none border px-2.5 py-2 text-xs outline-none focus-visible:ring-1"
              >
                <option value="">Select a role...</option>
                <option value="_none">No mention</option>
                <option value="everyone">@everyone</option>
                {roles?.map((r) => (
                  <option key={r.id} value={r.id}>
                    @{r.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    roleId: roleId && roleId !== "_none" && roleId !== "" ? roleId : null,
                  })
                }
              >
                {mutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Save
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {roleId === "everyone"
                ? "@everyone"
                : roles?.find((r) => r.id === roleId)
                  ? `@${roles.find((r) => r.id === roleId)!.name}`
                  : "Not set"}
            </p>
          )}
      </CardContent>
    </Card>
  );
}

function RoleMappingCard({
  currentAdminRoleId,
  currentModRoleId,
  queryKey,
  queryClient,
  canEdit,
}: {
  currentAdminRoleId: string | null;
  currentModRoleId: string | null;
  queryKey: readonly unknown[];
  queryClient: ReturnType<typeof useQueryClient>;
  canEdit: boolean;
}) {
  const [adminRoleId, setAdminRoleId] = useState(currentAdminRoleId ?? "");
  const [modRoleId, setModRoleId] = useState(currentModRoleId ?? "");

  const {
    data: roles,
    isLoading,
    isError,
    refetch,
  } = useQuery(trpc.discordGuild.getGuildRoles.queryOptions());

  const mutation = useMutation(
    trpc.discordGuild.setRoleMapping.mutationOptions({
      onSuccess: () => {
        toast.success("Role mapping updated.");
        queryClient.invalidateQueries({ queryKey });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Role Mapping</CardTitle>
        <CardDescription>
          Configure which Discord roles map to admin and mod permissions for bot
          commands. Admin role can manage Twitch notifications and bot settings.
          Mod role can manage quotes. Falls back to Discord permissions if not
          set.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : isError ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" />
            <span>Failed to load roles.</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="text-xs"
            >
              Retry
            </Button>
          </div>
        ) : canEdit ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Admin Role
              </label>
              <select
                value={adminRoleId}
                onChange={(e) => setAdminRoleId(e.target.value)}
                className="border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-none border px-2.5 py-2 text-xs outline-none focus-visible:ring-1"
              >
                <option value="">None (use Discord permissions)</option>
                {roles?.map((r) => (
                  <option key={r.id} value={r.id}>
                    @{r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Mod Role
              </label>
              <select
                value={modRoleId}
                onChange={(e) => setModRoleId(e.target.value)}
                className="border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-none border px-2.5 py-2 text-xs outline-none focus-visible:ring-1"
              >
                <option value="">None (use Discord permissions)</option>
                {roles?.map((r) => (
                  <option key={r.id} value={r.id}>
                    @{r.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  adminRoleId: adminRoleId || null,
                  modRoleId: modRoleId || null,
                })
              }
            >
              {mutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Save
            </Button>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Admin Role:{" "}
              {roles?.find((r) => r.id === adminRoleId)
                ? `@${roles.find((r) => r.id === adminRoleId)!.name}`
                : "Not set"}
            </p>
            <p>
              Mod Role:{" "}
              {roles?.find((r) => r.id === modRoleId)
                ? `@${roles.find((r) => r.id === modRoleId)!.name}`
                : "Not set"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MonitoredChannelsCard({ canEdit }: { canEdit: boolean }) {
  const [newUsername, setNewUsername] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    data: channels,
    isLoading,
    isError,
    refetch,
  } = useQuery(trpc.discordGuild.listMonitoredChannels.queryOptions());

  const monitoredChannelsQueryKey =
    trpc.discordGuild.listMonitoredChannels.queryOptions().queryKey;

  const addMutation = useMutation(
    trpc.discordGuild.addMonitoredChannel.mutationOptions({
      onSuccess: (data) => {
        setNewUsername("");
        void queryClient.invalidateQueries({ queryKey: monitoredChannelsQueryKey });
        toast.success(`Now monitoring ${data.displayName}.`);
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const removeMutation = useMutation(
    trpc.discordGuild.removeMonitoredChannel.mutationOptions({
      onSuccess: () => {
        setDeleteConfirmId(null);
        void queryClient.invalidateQueries({ queryKey: monitoredChannelsQueryKey });
        toast.success("Channel removed.");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Monitored Channels</CardTitle>
        <CardDescription>
          Configure per-channel notification settings, custom embeds, and
          behavior overrides for each monitored Twitch channel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {canEdit && (
          <form
            className="mb-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = newUsername.trim();
              if (trimmed) addMutation.mutate({ username: trimmed });
            }}
          >
            <Input
              placeholder="Twitch username..."
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="flex-1"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newUsername.trim() || addMutation.isPending}
            >
              {addMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Add
            </Button>
          </form>
        )}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" />
            <span>Failed to load monitored channels.</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="text-xs"
            >
              Retry
            </Button>
          </div>
        ) : !channels || channels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No monitored Twitch channels yet.{canEdit && " Add one above to get started."}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {channels.map((ch) => (
              <div
                key={ch.id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  {ch.profileImageUrl ? (
                    <img
                      src={ch.profileImageUrl}
                      alt={ch.displayName ?? ch.username ?? ""}
                      className="size-8 rounded-full"
                    />
                  ) : (
                    <span className="flex size-8 items-center justify-center rounded-full bg-brand-twitch text-xs font-bold text-white">
                      {(ch.displayName ?? ch.username ?? "?")[0]}
                    </span>
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {ch.displayName ?? ch.username}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Radio
                        className={`size-3 ${ch.isLive ? "text-green-500" : "text-muted-foreground"}`}
                      />
                      {ch.isLive ? "Live" : "Offline"}
                      {(ch.notificationChannelId ||
                        ch.notificationRoleId ||
                        ch.useCustomMessage) && (
                        <span className="ml-1.5 text-brand-main">
                          (overrides active)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1.5">
                    <ChannelSettingsDialog
                      channel={ch}
                      monitoredChannelsQueryKey={monitoredChannelsQueryKey}
                    />
                    {deleteConfirmId === ch.id ? (
                      <>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={removeMutation.isPending}
                          onClick={() => removeMutation.mutate({ channelId: ch.id })}
                        >
                          {removeMutation.isPending && (
                            <Loader2 className="size-4 animate-spin" />
                          )}
                          Remove
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmId(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => setDeleteConfirmId(ch.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TestNotificationCard({ hasChannel, canEdit }: { hasChannel: boolean; canEdit: boolean }) {
  const mutation = useMutation(
    trpc.discordGuild.testNotification.mutationOptions({
      onSuccess: () => {
        toast.success(
          "Test notification sent! Watch your Discord channel for the live → update → offline sequence."
        );
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Test Notification</CardTitle>
        <CardDescription>
          Send a test Twitch live notification to your notification channel. The
          bot will post a fake live embed, update the viewer count after 5
          seconds, then mark the stream as offline after 10 seconds.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!canEdit ? (
          <p className="text-sm text-muted-foreground">
            Only lead moderators can send test notifications.
          </p>
        ) : !hasChannel ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="size-4" />
            <span>Set a notification channel first to send a test.</span>
          </div>
        ) : (
          <Button
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Send Test Notification
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
