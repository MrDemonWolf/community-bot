"use client";

import { useState } from "react";
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
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

// Bot permissions: Send Messages, Embed Links, Mention Everyone
const BOT_PERMISSIONS = "19456";

export default function DiscordSettings({
  discordAppId,
}: {
  discordAppId: string;
}) {
  const queryClient = useQueryClient();
  const queryKey = trpc.discordGuild.getStatus.queryOptions().queryKey;

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
    return (
      <LinkGuildSection
        discordAppId={discordAppId}
        queryKey={queryKey}
        queryClient={queryClient}
      />
    );
  }

  return (
    <div className="space-y-6">
      <GuildInfoCard
        guild={guild}
        queryKey={queryKey}
        queryClient={queryClient}
      />
      <NotificationChannelCard
        currentValue={guild.notificationChannelId}
        queryKey={queryKey}
        queryClient={queryClient}
      />
      <NotificationRoleCard
        currentValue={guild.notificationRoleId}
        queryKey={queryKey}
        queryClient={queryClient}
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

  const { data: availableGuilds, isLoading } = useQuery({
    ...trpc.discordGuild.listAvailableGuilds.queryOptions(),
    refetchInterval: 10_000,
  });

  const linkMutation = useMutation(
    trpc.discordGuild.linkGuild.mutationOptions({
      onSuccess: () => {
        toast.success("Discord server linked!");
        queryClient.invalidateQueries({ queryKey });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const authorizeUrl = `https://discord.com/oauth2/authorize?client_id=${discordAppId}&scope=bot&permissions=${BOT_PERMISSIONS}`;

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
                onValueChange={setSelectedGuildId}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a server..." />
                </SelectTrigger>
                <SelectContent>
                  {availableGuilds && availableGuilds.length > 0 ? (
                    availableGuilds.map((g) => (
                      <SelectItem key={g.guildId} value={g.guildId}>
                        <span className="flex items-center gap-2">
                          {g.icon ? (
                            <img
                              src={g.icon}
                              alt=""
                              className="size-5 rounded-full"
                            />
                          ) : (
                            <span className="flex size-5 items-center justify-center rounded-full bg-brand-discord text-[10px] font-bold text-white">
                              {(g.name ?? "?")[0]}
                            </span>
                          )}
                          {g.name ?? g.guildId}
                        </span>
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
}: {
  guild: {
    guildId: string;
    name: string | null;
    icon: string | null;
    enabled: boolean;
  };
  queryKey: readonly unknown[];
  queryClient: ReturnType<typeof useQueryClient>;
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
        />
      </CardContent>
    </Card>
  );
}

function EnableToggle({
  enabled,
  queryKey,
  queryClient,
}: {
  enabled: boolean;
  queryKey: readonly unknown[];
  queryClient: ReturnType<typeof useQueryClient>;
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
    </div>
  );
}

function NotificationChannelCard({
  currentValue,
  queryKey,
  queryClient,
}: {
  currentValue: string | null;
  queryKey: readonly unknown[];
  queryClient: ReturnType<typeof useQueryClient>;
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
          The Discord channel where stream notifications will be posted.
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
        ) : (
          <div className="flex gap-3">
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a channel..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">(None)</SelectItem>
                {channels?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    # {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        )}
      </CardContent>
    </Card>
  );
}

function NotificationRoleCard({
  currentValue,
  queryKey,
  queryClient,
}: {
  currentValue: string | null;
  queryKey: readonly unknown[];
  queryClient: ReturnType<typeof useQueryClient>;
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
          The Discord role to mention when a stream goes live.
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
        ) : (
          <div className="flex gap-3">
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a role..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">No role mention</SelectItem>
                {roles?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    @{r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  roleId: roleId && roleId !== "_none" ? roleId : null,
                })
              }
            >
              {mutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Save
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
