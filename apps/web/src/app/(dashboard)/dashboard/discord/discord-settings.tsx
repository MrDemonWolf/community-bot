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
import { Switch } from "@/components/ui/switch";
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
  ScrollText,
  Users,
  Hash,
  AtSign,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Shield,
  Link2,
  Settings2,
  Activity,
  Gamepad2,
} from "lucide-react";
import { ChannelSettingsDialog } from "./channel-settings-dialog";
import { canControlBot } from "@/utils/roles";

const BOT_PERMISSIONS = "2147633152";

// Discord logo SVG for the link card
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1569 2.4189z" />
    </svg>
  );
}

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
        <Card className="glass">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-16 w-full" />
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
      <Card className="glass">
        <CardContent className="flex items-center gap-3 py-8">
          <DiscordIcon className="size-6 text-brand-discord" />
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
        discordAppId={discordAppId}
        queryKey={queryKey}
        queryClient={queryClient}
        canEdit={canEdit}
      />
      <NotificationConfigCard
        guild={guild}
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
      <LoggingConfigCard canEdit={canEdit} />
      <BotPresenceCard canEdit={canEdit} />
      <MonitoredChannelsCard canEdit={canEdit} />
      <TestNotificationCard
        hasChannel={!!guild.notificationChannelId}
        canEdit={canEdit}
      />
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
      <Card className="glass">
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
    <Card className="glass border-brand-discord/20">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-brand-discord/15">
          <DiscordIcon className="size-10 text-brand-discord" />
        </div>
        <h3 className="font-heading text-xl font-semibold text-foreground">
          Link your Discord server
        </h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Add the bot to your Discord server, then select it from the dropdown
          to link it to your dashboard.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
          <a href={authorizeUrl} target="_blank" rel="noopener noreferrer">
            <Button className="bg-brand-discord text-white hover:bg-brand-discord/80">
              <ExternalLink className="size-4" />
              Add Bot to Server
            </Button>
          </a>
        </div>

        <div className="mt-6 flex w-full max-w-md gap-3">
          {isLoading ? (
            <Skeleton className="h-10 flex-1" />
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
            className="bg-brand-discord text-white hover:bg-brand-discord/80"
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
            <Link2 className="size-4" />
            Link Server
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function GuildInfoCard({
  guild,
  discordAppId,
  queryKey,
  queryClient,
  canEdit,
}: {
  guild: {
    guildId: string;
    name: string | null;
    icon: string | null;
    enabled: boolean;
    muted: boolean;
    memberCount?: number | null;
  };
  discordAppId: string;
  queryKey: readonly unknown[];
  queryClient: ReturnType<typeof useQueryClient>;
  canEdit: boolean;
}) {
  const authorizeUrl = `https://discord.com/oauth2/authorize?client_id=${discordAppId}&scope=bot&permissions=${BOT_PERMISSIONS}`;

  return (
    <Card className="glass overflow-hidden">
      {/* Discord-colored accent bar */}
      <div className="h-1 bg-brand-discord" />
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          {guild.icon ? (
            <img
              src={guild.icon}
              alt={guild.name ?? "Server icon"}
              className="size-16 rounded-full ring-2 ring-brand-discord/30"
            />
          ) : (
            <span className="flex size-16 items-center justify-center rounded-full bg-brand-discord text-xl font-bold text-white ring-2 ring-brand-discord/30">
              {(guild.name ?? "?")[0]}
            </span>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-lg font-semibold text-foreground">
                {guild.name ?? guild.guildId}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-500">
                <CheckCircle2 className="size-3" />
                Linked
              </span>
            </div>
            {guild.memberCount != null && (
              <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="size-3.5" />
                  {guild.memberCount.toLocaleString()} members
                </span>
              </div>
            )}
          </div>
          {canEdit && (
            <a href={authorizeUrl} target="_blank" rel="noopener noreferrer">
              <Button
                variant="outline"
                size="sm"
                className="border-brand-discord/30 text-brand-discord hover:bg-brand-discord/10"
              >
                Re-link
              </Button>
            </a>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <EnableToggle
            enabled={guild.enabled}
            queryKey={queryKey}
            queryClient={queryClient}
            canEdit={canEdit}
          />
          <MuteToggle
            muted={guild.muted}
            queryKey={queryKey}
            queryClient={queryClient}
            canEdit={canEdit}
          />
        </div>
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
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface-raised/50 px-4 py-3">
      <div className="flex items-center gap-2.5">
        {enabled ? (
          <Bell className="size-4 text-brand-discord" />
        ) : (
          <BellOff className="size-4 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-medium text-foreground">Notifications</p>
          <p className="text-xs text-muted-foreground">
            {enabled ? "Enabled" : "Disabled"}
          </p>
        </div>
      </div>
      {canEdit && (
        <Switch
          checked={enabled}
          onCheckedChange={() =>
            enabled ? disableMutation.mutate() : enableMutation.mutate()
          }
          disabled={isPending}
          aria-label="Toggle notifications"
        />
      )}
    </div>
  );
}

function MuteToggle({
  muted,
  queryKey,
  queryClient,
  canEdit,
}: {
  muted: boolean;
  queryKey: readonly unknown[];
  queryClient: ReturnType<typeof useQueryClient>;
  canEdit: boolean;
}) {
  const muteMutation = useMutation(
    trpc.discordGuild.mute.mutationOptions({
      onSuccess: () => {
        toast.success("Discord bot muted. Notifications paused.");
        queryClient.invalidateQueries({ queryKey });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const unmuteMutation = useMutation(
    trpc.discordGuild.unmute.mutationOptions({
      onSuccess: () => {
        toast.success("Discord bot unmuted. Notifications resumed.");
        queryClient.invalidateQueries({ queryKey });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const isPending = muteMutation.isPending || unmuteMutation.isPending;

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface-raised/50 px-4 py-3">
      <div className="flex items-center gap-2.5">
        {muted ? (
          <VolumeX className="size-4 text-amber-500" />
        ) : (
          <Volume2 className="size-4 text-green-500" />
        )}
        <div>
          <p className="text-sm font-medium text-foreground">Bot Audio</p>
          <p className="text-xs text-muted-foreground">
            {muted ? "Muted (paused)" : "Active"}
          </p>
        </div>
      </div>
      {canEdit && (
        <Switch
          checked={!muted}
          onCheckedChange={() =>
            muted ? unmuteMutation.mutate() : muteMutation.mutate()
          }
          disabled={isPending}
          aria-label="Toggle mute"
        />
      )}
    </div>
  );
}

function NotificationConfigCard({
  guild,
  queryKey,
  queryClient,
  canEdit,
}: {
  guild: {
    notificationChannelId: string | null;
    notificationRoleId: string | null;
    enabled: boolean;
  };
  queryKey: readonly unknown[];
  queryClient: ReturnType<typeof useQueryClient>;
  canEdit: boolean;
}) {
  const [channelId, setChannelId] = useState(
    guild.notificationChannelId ?? ""
  );
  const [roleId, setRoleId] = useState(guild.notificationRoleId ?? "");

  const {
    data: channels,
    isLoading: channelsLoading,
    isError: channelsError,
    refetch: refetchChannels,
  } = useQuery(trpc.discordGuild.getGuildChannels.queryOptions());

  const {
    data: roles,
    isLoading: rolesLoading,
    isError: rolesError,
    refetch: refetchRoles,
  } = useQuery(trpc.discordGuild.getGuildRoles.queryOptions());

  const channelMutation = useMutation(
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

  const roleMutation = useMutation(
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

  const isLoading = channelsLoading || rolesLoading;
  const isError = channelsError || rolesError;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading">
          <Bell className="size-5 text-brand-discord" />
          Notification Config
        </CardTitle>
        <CardDescription>
          Configure where Twitch live stream notifications are posted and which
          role gets mentioned.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" />
            <span>Failed to load server data.</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                refetchChannels();
                refetchRoles();
              }}
              className="text-xs"
            >
              Retry
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Channel Selector */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Hash className="size-4 text-brand-discord/70" />
                Notification Channel
              </label>
              {canEdit ? (
                <div className="space-y-2">
                  <Select
                    value={channelId || "_none"}
                    onValueChange={(v) =>
                      setChannelId(v === "_none" ? "" : v ?? "")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {channels?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          # {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="w-full bg-brand-discord text-white hover:bg-brand-discord/80"
                    disabled={channelMutation.isPending}
                    onClick={() =>
                      channelMutation.mutate({
                        channelId:
                          channelId && channelId !== "_none"
                            ? channelId
                            : null,
                      })
                    }
                  >
                    {channelMutation.isPending && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    Save Channel
                  </Button>
                </div>
              ) : (
                <p className="rounded-lg border border-border bg-surface-raised/50 px-3 py-2 text-sm text-muted-foreground">
                  {(() => {
                    const selected = channels?.find(
                      (c) => c.id === channelId
                    );
                    return selected ? `# ${selected.name}` : "Not set";
                  })()}
                </p>
              )}
            </div>

            {/* Role Selector */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <AtSign className="size-4 text-brand-discord/70" />
                Notification Role
              </label>
              {canEdit ? (
                <div className="space-y-2">
                  <Select
                    value={roleId || "_none"}
                    onValueChange={(v) =>
                      setRoleId(v === "_none" ? "" : v ?? "")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      <SelectItem value="everyone">@everyone</SelectItem>
                      {roles?.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          @{r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="w-full bg-brand-discord text-white hover:bg-brand-discord/80"
                    disabled={roleMutation.isPending}
                    onClick={() =>
                      roleMutation.mutate({
                        roleId:
                          roleId &&
                          roleId !== "_none" &&
                          roleId !== ""
                            ? roleId
                            : null,
                      })
                    }
                  >
                    {roleMutation.isPending && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    Save Role
                  </Button>
                </div>
              ) : (
                <p className="rounded-lg border border-border bg-surface-raised/50 px-3 py-2 text-sm text-muted-foreground">
                  {(() => {
                    if (roleId === "everyone") return "@everyone";
                    const matchedRole = roles?.find((r) => r.id === roleId);
                    return matchedRole ? `@${matchedRole.name}` : "Not set";
                  })()}
                </p>
              )}
            </div>
          </div>
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
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading">
          <Shield className="size-5 text-brand-discord" />
          Role Mapping
        </CardTitle>
        <CardDescription>
          Configure which Discord roles map to admin and mod permissions for bot
          commands. Falls back to Discord permissions if not set.
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Admin Role
                </label>
                <Select
                  value={adminRoleId || "_none"}
                  onValueChange={(v) =>
                    setAdminRoleId(v === "_none" ? "" : v ?? "")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None (use Discord permissions)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">
                      None (use Discord permissions)
                    </SelectItem>
                    {roles?.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        @{r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Mod Role
                </label>
                <Select
                  value={modRoleId || "_none"}
                  onValueChange={(v) =>
                    setModRoleId(v === "_none" ? "" : v ?? "")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None (use Discord permissions)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">
                      None (use Discord permissions)
                    </SelectItem>
                    {roles?.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        @{r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-brand-discord text-white hover:bg-brand-discord/80"
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface-raised/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Admin Role</p>
              <p className="text-sm font-medium text-foreground">
                {roles?.find((r) => r.id === adminRoleId)
                  ? `@${roles.find((r) => r.id === adminRoleId)!.name}`
                  : "Not set"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface-raised/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Mod Role</p>
              <p className="text-sm font-medium text-foreground">
                {roles?.find((r) => r.id === modRoleId)
                  ? `@${roles.find((r) => r.id === modRoleId)!.name}`
                  : "Not set"}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ACTIVITY_TYPES = [
  { value: "PLAYING", label: "Playing" },
  { value: "STREAMING", label: "Streaming" },
  { value: "LISTENING", label: "Listening to" },
  { value: "WATCHING", label: "Watching" },
  { value: "COMPETING", label: "Competing in" },
  { value: "CUSTOM", label: "Custom" },
] as const;

function BotPresenceCard({ canEdit }: { canEdit: boolean }) {
  const { data: presence, isLoading } = useQuery(
    trpc.discordGuild.getPresence.queryOptions()
  );

  const [activityText, setActivityText] = useState("");
  const [activityType, setActivityType] = useState("CUSTOM");
  const [activityUrl, setActivityUrl] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (presence && !initialized) {
      setActivityText(presence.activityText ?? "");
      setActivityType(presence.activityType ?? "CUSTOM");
      setActivityUrl(presence.activityUrl ?? "");
      setInitialized(true);
    }
  }, [presence, initialized]);

  const mutation = useMutation(
    trpc.discordGuild.setPresence.mutationOptions({
      onSuccess: () => {
        toast.success("Bot presence updated.");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading">
          <Gamepad2 className="size-5 text-brand-discord" />
          Bot Presence
        </CardTitle>
        <CardDescription>
          Configure the bot&apos;s activity status shown in Discord (e.g.
          &quot;Watching over the Wolf Lair&quot;).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Activity Type */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Activity className="size-4 text-brand-discord/70" />
                  Activity Type
                </label>
                {canEdit ? (
                  <Select
                    value={activityType}
                    onValueChange={(v) => setActivityType(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="rounded-lg border border-border bg-surface-raised/50 px-3 py-2 text-sm text-muted-foreground">
                    {ACTIVITY_TYPES.find((t) => t.value === activityType)
                      ?.label ?? "Custom"}
                  </p>
                )}
              </div>

              {/* Activity Text */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Settings2 className="size-4 text-brand-discord/70" />
                  Activity Text
                </label>
                {canEdit ? (
                  <Input
                    value={activityText}
                    onChange={(e) => setActivityText(e.target.value)}
                    placeholder="e.g. Watching over the Wolf Lair"
                    maxLength={128}
                  />
                ) : (
                  <p className="rounded-lg border border-border bg-surface-raised/50 px-3 py-2 text-sm text-muted-foreground">
                    {activityText || "Not set"}
                  </p>
                )}
              </div>
            </div>

            {/* Stream URL - only shown when type is STREAMING */}
            {activityType === "STREAMING" && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <ExternalLink className="size-4 text-brand-discord/70" />
                  Stream URL
                </label>
                {canEdit ? (
                  <Input
                    value={activityUrl}
                    onChange={(e) => setActivityUrl(e.target.value)}
                    placeholder="https://twitch.tv/username"
                    type="url"
                  />
                ) : (
                  <p className="rounded-lg border border-border bg-surface-raised/50 px-3 py-2 text-sm text-muted-foreground">
                    {activityUrl || "Not set"}
                  </p>
                )}
              </div>
            )}

            {canEdit && (
              <Button
                className="w-full bg-brand-discord text-white hover:bg-brand-discord/80 sm:w-auto"
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    activityText: activityText || null,
                    activityType: activityType as "PLAYING" | "STREAMING" | "LISTENING" | "WATCHING" | "COMPETING" | "CUSTOM",
                    activityUrl: activityUrl || null,
                  })
                }
              >
                {mutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Save Presence
              </Button>
            )}
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
        void queryClient.invalidateQueries({
          queryKey: monitoredChannelsQueryKey,
        });
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
        void queryClient.invalidateQueries({
          queryKey: monitoredChannelsQueryKey,
        });
        toast.success("Channel removed.");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 font-heading">
              <Radio className="size-5 text-brand-twitch" />
              Monitored Channels
            </CardTitle>
            <CardDescription>
              Twitch channels monitored for live stream notifications.
            </CardDescription>
          </div>
          {canEdit && (
            <form
              className="flex shrink-0 gap-2"
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
                className="w-48"
              />
              <Button
                type="submit"
                size="sm"
                className="bg-brand-discord text-white hover:bg-brand-discord/80"
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
        </div>
      </CardHeader>
      <CardContent>
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
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10">
            <Radio className="mb-3 size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              No monitored channels yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {canEdit
                ? "Add a Twitch channel above to get started."
                : "A lead moderator can add channels."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {channels.map((ch) => (
              <div
                key={ch.id}
                className="group flex items-center justify-between rounded-lg border border-border bg-surface-raised/30 px-4 py-3 transition-colors hover:bg-surface-raised/60"
              >
                <div className="flex items-center gap-3">
                  {ch.profileImageUrl ? (
                    <img
                      src={ch.profileImageUrl}
                      alt={ch.displayName ?? ch.username ?? ""}
                      className="size-10 rounded-full ring-2 ring-brand-twitch/20"
                    />
                  ) : (
                    <span className="flex size-10 items-center justify-center rounded-full bg-brand-twitch text-xs font-bold text-white">
                      {(ch.displayName ?? ch.username ?? "?")[0]}
                    </span>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-brand-twitch">
                      {ch.displayName ?? ch.username}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className={`inline-block size-2 rounded-full ${
                          ch.isLive ? "bg-green-500" : "bg-muted-foreground/40"
                        }`}
                      />
                      {ch.isLive ? "Live" : "Offline"}
                      {(ch.notificationChannelId ||
                        ch.notificationRoleId ||
                        ch.useCustomMessage) && (
                        <span className="ml-1.5 rounded bg-brand-discord/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-discord">
                          Overrides
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
                          onClick={() =>
                            removeMutation.mutate({ channelId: ch.id })
                          }
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
                        size="icon-xs"
                        className="text-red-400 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-red-300"
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

function LoggingConfigCard({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();

  const { data: logConfig, isLoading: logLoading } = useQuery(
    trpc.discordGuild.getLogConfig.queryOptions()
  );

  const {
    data: channels,
    isLoading: channelsLoading,
    isError: channelsError,
    refetch,
  } = useQuery(trpc.discordGuild.getGuildChannels.queryOptions());

  const [moderationChannelId, setModerationChannelId] = useState("");
  const [serverChannelId, setServerChannelId] = useState("");
  const [voiceChannelId, setVoiceChannelId] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (logConfig && !initialized) {
      setModerationChannelId(logConfig.moderationChannelId ?? "");
      setServerChannelId(logConfig.serverChannelId ?? "");
      setVoiceChannelId(logConfig.voiceChannelId ?? "");
      setInitialized(true);
    }
  }, [logConfig, initialized]);

  const mutation = useMutation(
    trpc.discordGuild.setLogConfig.mutationOptions({
      onSuccess: () => {
        toast.success("Log channels updated.");
        void queryClient.invalidateQueries();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const isLoading = logLoading || channelsLoading;

  const channelOptions = [
    {
      label: "Moderation Logs",
      description: "Bans, kicks, warns, and mutes",
      value: moderationChannelId,
      onChange: setModerationChannelId,
    },
    {
      label: "Server Logs",
      description: "Channel and role changes",
      value: serverChannelId,
      onChange: setServerChannelId,
    },
    {
      label: "Voice Logs",
      description: "Voice channel joins, leaves, and moves",
      value: voiceChannelId,
      onChange: setVoiceChannelId,
    },
  ];

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading">
          <ScrollText className="size-5 text-brand-discord" />
          Event Logging
        </CardTitle>
        <CardDescription>
          Configure channels for server event logs. The bot will send embedded
          messages when channels, roles, or voice states change.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : channelsError ? (
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
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {channelOptions.map((opt) => (
                <div key={opt.label} className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    {opt.label}
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {opt.description}
                  </p>
                  <Select
                    value={opt.value || "_none"}
                    onValueChange={(v) =>
                      opt.onChange(v === "_none" ? "" : v ?? "")
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Disabled" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Disabled</SelectItem>
                      {channels?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          # {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              className="bg-brand-discord text-white hover:bg-brand-discord/80"
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  moderationChannelId: moderationChannelId || null,
                  serverChannelId: serverChannelId || null,
                  voiceChannelId: voiceChannelId || null,
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
          <div className="grid gap-3 sm:grid-cols-3">
            {channelOptions.map((opt) => (
              <div
                key={opt.label}
                className="rounded-lg border border-border bg-surface-raised/50 px-3 py-2"
              >
                <p className="text-xs text-muted-foreground">{opt.label}</p>
                <p className="text-sm font-medium text-foreground">
                  {channels?.find((c) => c.id === opt.value)
                    ? `# ${channels.find((c) => c.id === opt.value)!.name}`
                    : "Disabled"}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TestNotificationCard({
  hasChannel,
  canEdit,
}: {
  hasChannel: boolean;
  canEdit: boolean;
}) {
  const mutation = useMutation(
    trpc.discordGuild.testNotification.mutationOptions({
      onSuccess: () => {
        toast.success(
          "Test notification sent! Watch your Discord channel for the live -> update -> offline sequence."
        );
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading">
          <Send className="size-5 text-brand-discord" />
          Test Notification
        </CardTitle>
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
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
            <AlertCircle className="size-4 text-amber-500" />
            <span>Set a notification channel first to send a test.</span>
          </div>
        ) : (
          <Button
            className="bg-brand-discord text-white hover:bg-brand-discord/80"
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
