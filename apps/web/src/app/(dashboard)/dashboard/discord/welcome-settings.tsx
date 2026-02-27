"use client";

import { useState, useEffect } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  UserPlus,
  UserMinus,
  Shield,
  Mail,
} from "lucide-react";
import { EmbedPreview } from "./embed-preview";

interface WelcomeSettings {
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeMessage: string | null;
  welcomeUseEmbed: boolean;
  welcomeEmbedJson: string | null;
  leaveEnabled: boolean;
  leaveChannelId: string | null;
  leaveMessage: string | null;
  leaveUseEmbed: boolean;
  leaveEmbedJson: string | null;
  autoRoleEnabled: boolean;
  autoRoleId: string | null;
  dmWelcomeEnabled: boolean;
  dmWelcomeMessage: string | null;
  dmWelcomeUseEmbed: boolean;
  dmWelcomeEmbedJson: string | null;
}

const PREVIEW_VARIABLES: Record<string, string> = {
  user: "@ExampleUser",
  username: "exampleuser",
  displayName: "ExampleUser",
  server: "My Discord Server",
  memberCount: "1,234",
  tag: "exampleuser",
};

export function WelcomeSettingsCard() {
  const {
    data: settings,
    isLoading,
    isError,
    refetch,
  } = useQuery(trpc.discordGuild.getWelcomeSettings.queryOptions());

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !settings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Welcome & Leave Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" />
            <span>Failed to load welcome settings.</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="text-xs"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Welcome & Leave Messages</CardTitle>
        <CardDescription>
          Configure automatic messages when members join or leave your Discord
          server. You can also assign a role automatically and send a DM welcome
          message.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <WelcomeMessageSection settings={settings} />
        <hr className="border-border" />
        <LeaveMessageSection settings={settings} />
        <hr className="border-border" />
        <AutoRoleSection settings={settings} />
        <hr className="border-border" />
        <DmWelcomeSection settings={settings} />
        <hr className="border-border" />
        <TestButtons settings={settings} />
      </CardContent>
    </Card>
  );
}

function useWelcomeUpdate() {
  const queryClient = useQueryClient();
  const queryKey = trpc.discordGuild.getWelcomeSettings.queryOptions().queryKey;

  return useMutation(
    trpc.discordGuild.updateWelcomeSettings.mutationOptions({
      onSuccess: () => {
        toast.success("Welcome settings updated.");
        queryClient.invalidateQueries({ queryKey });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );
}

function WelcomeMessageSection({ settings }: { settings: WelcomeSettings }) {
  const [enabled, setEnabled] = useState(settings.welcomeEnabled);
  const [channelId, setChannelId] = useState(settings.welcomeChannelId ?? "");
  const [useEmbed, setUseEmbed] = useState(settings.welcomeUseEmbed);
  const [message, setMessage] = useState(settings.welcomeMessage ?? "");
  const [embedJson, setEmbedJson] = useState(settings.welcomeEmbedJson ?? "");

  useEffect(() => {
    setEnabled(settings.welcomeEnabled);
    setChannelId(settings.welcomeChannelId ?? "");
    setUseEmbed(settings.welcomeUseEmbed);
    setMessage(settings.welcomeMessage ?? "");
    setEmbedJson(settings.welcomeEmbedJson ?? "");
  }, [settings]);

  const mutation = useWelcomeUpdate();

  const {
    data: channels,
    isLoading: channelsLoading,
  } = useQuery(trpc.discordGuild.getGuildChannels.queryOptions());

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus className="size-4 text-green-500" />
        <h3 className="text-sm font-semibold">Welcome Message</h3>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {enabled ? (
            <CheckCircle2 className="size-4 text-green-500" />
          ) : (
            <XCircle className="size-4 text-muted-foreground" />
          )}
          <span className="text-sm">
            {enabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => {
            setEnabled(!enabled);
            mutation.mutate({ welcomeEnabled: !enabled });
          }}
        >
          {enabled ? "Disable" : "Enable"}
        </Button>
      </div>

      {enabled && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Channel
            </label>
            {channelsLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <select
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-none border px-2.5 py-2 text-xs outline-none focus-visible:ring-1"
              >
                <option value="">Select a channel...</option>
                {channels?.map((c) => (
                  <option key={c.id} value={c.id}>
                    # {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-muted-foreground">
              Mode:
            </label>
            <button
              type="button"
              onClick={() => setUseEmbed(false)}
              className={`text-xs px-2 py-1 rounded ${!useEmbed ? "bg-brand-main/20 text-brand-main" : "text-muted-foreground"}`}
            >
              Plain Text
            </button>
            <button
              type="button"
              onClick={() => setUseEmbed(true)}
              className={`text-xs px-2 py-1 rounded ${useEmbed ? "bg-brand-main/20 text-brand-main" : "text-muted-foreground"}`}
            >
              Embed
            </button>
          </div>

          {useEmbed ? (
            <div className="space-y-2">
              <textarea
                value={embedJson}
                onChange={(e) => setEmbedJson(e.target.value)}
                placeholder='{"title":"Welcome {displayName}!","description":"Welcome to {server}!","color":3447003}'
                rows={4}
                className="border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-none border px-2.5 py-2 font-mono text-xs outline-none focus-visible:ring-1"
              />
              <EmbedPreview json={embedJson} variables={PREVIEW_VARIABLES} />
            </div>
          ) : (
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Welcome {displayName} to {server}! We now have {memberCount} members."
              rows={3}
              className="border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-none border px-2.5 py-2 text-xs outline-none focus-visible:ring-1"
            />
          )}

          <VariableHint />

          <Button
            size="sm"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                welcomeChannelId: channelId || null,
                welcomeUseEmbed: useEmbed,
                welcomeMessage: message || null,
                welcomeEmbedJson: embedJson || null,
              })
            }
          >
            {mutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Save Welcome Settings
          </Button>
        </div>
      )}
    </div>
  );
}

function LeaveMessageSection({ settings }: { settings: WelcomeSettings }) {
  const [enabled, setEnabled] = useState(settings.leaveEnabled);
  const [channelId, setChannelId] = useState(settings.leaveChannelId ?? "");
  const [useEmbed, setUseEmbed] = useState(settings.leaveUseEmbed);
  const [message, setMessage] = useState(settings.leaveMessage ?? "");
  const [embedJson, setEmbedJson] = useState(settings.leaveEmbedJson ?? "");

  useEffect(() => {
    setEnabled(settings.leaveEnabled);
    setChannelId(settings.leaveChannelId ?? "");
    setUseEmbed(settings.leaveUseEmbed);
    setMessage(settings.leaveMessage ?? "");
    setEmbedJson(settings.leaveEmbedJson ?? "");
  }, [settings]);

  const mutation = useWelcomeUpdate();

  const {
    data: channels,
    isLoading: channelsLoading,
  } = useQuery(trpc.discordGuild.getGuildChannels.queryOptions());

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <UserMinus className="size-4 text-red-500" />
        <h3 className="text-sm font-semibold">Leave Message</h3>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {enabled ? (
            <CheckCircle2 className="size-4 text-green-500" />
          ) : (
            <XCircle className="size-4 text-muted-foreground" />
          )}
          <span className="text-sm">
            {enabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => {
            setEnabled(!enabled);
            mutation.mutate({ leaveEnabled: !enabled });
          }}
        >
          {enabled ? "Disable" : "Enable"}
        </Button>
      </div>

      {enabled && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Channel
            </label>
            {channelsLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <select
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-none border px-2.5 py-2 text-xs outline-none focus-visible:ring-1"
              >
                <option value="">Select a channel...</option>
                {channels?.map((c) => (
                  <option key={c.id} value={c.id}>
                    # {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-muted-foreground">
              Mode:
            </label>
            <button
              type="button"
              onClick={() => setUseEmbed(false)}
              className={`text-xs px-2 py-1 rounded ${!useEmbed ? "bg-brand-main/20 text-brand-main" : "text-muted-foreground"}`}
            >
              Plain Text
            </button>
            <button
              type="button"
              onClick={() => setUseEmbed(true)}
              className={`text-xs px-2 py-1 rounded ${useEmbed ? "bg-brand-main/20 text-brand-main" : "text-muted-foreground"}`}
            >
              Embed
            </button>
          </div>

          {useEmbed ? (
            <div className="space-y-2">
              <textarea
                value={embedJson}
                onChange={(e) => setEmbedJson(e.target.value)}
                placeholder='{"title":"Goodbye {displayName}","description":"{username} has left {server}.","color":15158332}'
                rows={4}
                className="border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-none border px-2.5 py-2 font-mono text-xs outline-none focus-visible:ring-1"
              />
              <EmbedPreview json={embedJson} variables={PREVIEW_VARIABLES} />
            </div>
          ) : (
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="{displayName} has left {server}. We now have {memberCount} members."
              rows={3}
              className="border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-none border px-2.5 py-2 text-xs outline-none focus-visible:ring-1"
            />
          )}

          <VariableHint />

          <Button
            size="sm"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                leaveChannelId: channelId || null,
                leaveUseEmbed: useEmbed,
                leaveMessage: message || null,
                leaveEmbedJson: embedJson || null,
              })
            }
          >
            {mutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Save Leave Settings
          </Button>
        </div>
      )}
    </div>
  );
}

function AutoRoleSection({ settings }: { settings: WelcomeSettings }) {
  const [enabled, setEnabled] = useState(settings.autoRoleEnabled);
  const [roleId, setRoleId] = useState(settings.autoRoleId ?? "");

  useEffect(() => {
    setEnabled(settings.autoRoleEnabled);
    setRoleId(settings.autoRoleId ?? "");
  }, [settings]);

  const mutation = useWelcomeUpdate();

  const {
    data: roles,
    isLoading: rolesLoading,
  } = useQuery(trpc.discordGuild.getGuildRoles.queryOptions());

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="size-4 text-brand-discord" />
        <h3 className="text-sm font-semibold">Auto-Role</h3>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {enabled ? (
            <CheckCircle2 className="size-4 text-green-500" />
          ) : (
            <XCircle className="size-4 text-muted-foreground" />
          )}
          <span className="text-sm">
            {enabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => {
            setEnabled(!enabled);
            mutation.mutate({ autoRoleEnabled: !enabled });
          }}
        >
          {enabled ? "Disable" : "Enable"}
        </Button>
      </div>

      {enabled && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Role to assign
            </label>
            {rolesLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-none border px-2.5 py-2 text-xs outline-none focus-visible:ring-1"
              >
                <option value="">Select a role...</option>
                {roles?.map((r) => (
                  <option key={r.id} value={r.id}>
                    @{r.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <Button
            size="sm"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({ autoRoleId: roleId || null })
            }
          >
            {mutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Save Auto-Role
          </Button>
        </div>
      )}
    </div>
  );
}

function DmWelcomeSection({ settings }: { settings: WelcomeSettings }) {
  const [enabled, setEnabled] = useState(settings.dmWelcomeEnabled);
  const [useEmbed, setUseEmbed] = useState(settings.dmWelcomeUseEmbed);
  const [message, setMessage] = useState(settings.dmWelcomeMessage ?? "");
  const [embedJson, setEmbedJson] = useState(settings.dmWelcomeEmbedJson ?? "");

  useEffect(() => {
    setEnabled(settings.dmWelcomeEnabled);
    setUseEmbed(settings.dmWelcomeUseEmbed);
    setMessage(settings.dmWelcomeMessage ?? "");
    setEmbedJson(settings.dmWelcomeEmbedJson ?? "");
  }, [settings]);

  const mutation = useWelcomeUpdate();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="size-4 text-brand-main" />
        <h3 className="text-sm font-semibold">DM Welcome</h3>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {enabled ? (
            <CheckCircle2 className="size-4 text-green-500" />
          ) : (
            <XCircle className="size-4 text-muted-foreground" />
          )}
          <span className="text-sm">
            {enabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => {
            setEnabled(!enabled);
            mutation.mutate({ dmWelcomeEnabled: !enabled });
          }}
        >
          {enabled ? "Disable" : "Enable"}
        </Button>
      </div>

      {enabled && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Sends a DM to new members when they join. Note: this will fail
            silently if the user has DMs disabled.
          </p>

          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-muted-foreground">
              Mode:
            </label>
            <button
              type="button"
              onClick={() => setUseEmbed(false)}
              className={`text-xs px-2 py-1 rounded ${!useEmbed ? "bg-brand-main/20 text-brand-main" : "text-muted-foreground"}`}
            >
              Plain Text
            </button>
            <button
              type="button"
              onClick={() => setUseEmbed(true)}
              className={`text-xs px-2 py-1 rounded ${useEmbed ? "bg-brand-main/20 text-brand-main" : "text-muted-foreground"}`}
            >
              Embed
            </button>
          </div>

          {useEmbed ? (
            <div className="space-y-2">
              <textarea
                value={embedJson}
                onChange={(e) => setEmbedJson(e.target.value)}
                placeholder='{"title":"Welcome to {server}!","description":"Hey {displayName}, welcome!"}'
                rows={4}
                className="border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-none border px-2.5 py-2 font-mono text-xs outline-none focus-visible:ring-1"
              />
              <EmbedPreview json={embedJson} variables={PREVIEW_VARIABLES} />
            </div>
          ) : (
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Welcome to {server}, {displayName}! Check out the rules channel."
              rows={3}
              className="border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-none border px-2.5 py-2 text-xs outline-none focus-visible:ring-1"
            />
          )}

          <VariableHint />

          <Button
            size="sm"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                dmWelcomeUseEmbed: useEmbed,
                dmWelcomeMessage: message || null,
                dmWelcomeEmbedJson: embedJson || null,
              })
            }
          >
            {mutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Save DM Settings
          </Button>
        </div>
      )}
    </div>
  );
}

function TestButtons({ settings }: { settings: WelcomeSettings }) {
  const welcomeMutation = useMutation(
    trpc.discordGuild.testWelcomeMessage.mutationOptions({
      onSuccess: () => {
        toast.success("Test message sent! Check your Discord.");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const anyPending = welcomeMutation.isPending;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Test Messages</h3>
      <p className="text-xs text-muted-foreground">
        Send test messages using the bot&apos;s own member as a stand-in.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={
            anyPending ||
            !settings.welcomeEnabled ||
            !settings.welcomeChannelId
          }
          onClick={() => welcomeMutation.mutate({ type: "welcome" })}
        >
          {welcomeMutation.isPending &&
          welcomeMutation.variables?.type === "welcome" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Test Welcome
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={
            anyPending ||
            !settings.leaveEnabled ||
            !settings.leaveChannelId
          }
          onClick={() => welcomeMutation.mutate({ type: "leave" })}
        >
          {welcomeMutation.isPending &&
          welcomeMutation.variables?.type === "leave" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Test Leave
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={anyPending || !settings.dmWelcomeEnabled}
          onClick={() => welcomeMutation.mutate({ type: "dm" })}
        >
          {welcomeMutation.isPending &&
          welcomeMutation.variables?.type === "dm" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Test DM
        </Button>
      </div>
    </div>
  );
}

function VariableHint() {
  return (
    <p className="text-xs text-muted-foreground">
      Variables:{" "}
      <code className="text-xs">{"{user}"}</code>{" "}
      <code className="text-xs">{"{username}"}</code>{" "}
      <code className="text-xs">{"{displayName}"}</code>{" "}
      <code className="text-xs">{"{server}"}</code>{" "}
      <code className="text-xs">{"{memberCount}"}</code>{" "}
      <code className="text-xs">{"{tag}"}</code>
    </p>
  );
}
