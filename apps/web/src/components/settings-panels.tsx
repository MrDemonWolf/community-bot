"use client";

import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@community-bot/api/routers/index";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { trpc, queryClient } from "@/utils/trpc";

export type Settings = inferRouterOutputs<AppRouter>["settings"]["get"];
type PresenceInput =
  inferRouterInputs<AppRouter>["settings"]["updateDiscordPresence"];
const text = (form: FormData, key: string) => String(form.get(key) ?? "");

export function CoreSettings({ settings }: { settings: Settings }) {
  const [message, setMessage] = useState("");
  const save = useMutation(
    trpc.settings.updateCore.mutationOptions({
      onSuccess: async () => {
        setMessage("Saved. Your preferences are up to date.");
        await queryClient.invalidateQueries();
      },
    }),
  );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setMessage("");
        const form = new FormData(event.currentTarget);
        save.mutate({
          botName: text(form, "botName"),
          commandPrefix: text(form, "commandPrefix"),
          publicDescription: text(form, "publicDescription"),
          publicPageEnabled: form.get("publicPageEnabled") === "on",
        });
      }}
    >
      <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
        <label className="field">
          Bot display name
          <input
            name="botName"
            defaultValue={settings.botName}
            maxLength={40}
            required
          />
        </label>
        <label className="field">
          Command prefix
          <input
            name="commandPrefix"
            defaultValue={settings.commandPrefix}
            maxLength={5}
            required
          />
          <small>For example, ! turns uptime into !uptime.</small>
        </label>
        <label className="field full">
          Public channel description
          <textarea
            name="publicDescription"
            defaultValue={settings.publicDescription}
            maxLength={280}
            placeholder="A little about your community."
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            name="publicPageEnabled"
            defaultChecked={settings.publicPageEnabled}
          />
          Enable my public channel page
        </label>
      </div>
      <Feedback error={save.error?.message} success={message} />
      <div className="form-footer">
        <button className="button primary" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save preferences"}
        </button>
        <span className="subtle">
          Public pages show commands and connection status only.
        </span>
      </div>
    </form>
  );
}

export function DiscordSettings({ settings }: { settings: Settings }) {
  const [message, setMessage] = useState("");
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const save = useMutation(
    trpc.settings.configureDiscord.mutationOptions({
      onSuccess: async () => {
        setMessage(
          "Discord credentials saved. Use Join to connect the service.",
        );
        await queryClient.invalidateQueries();
      },
    }),
  );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setMessage("");
        const form = new FormData(event.currentTarget);
        save.mutate({
          applicationId: text(form, "applicationId"),
          guildId: text(form, "guildId"),
          ...(text(form, "token") ? { token: text(form, "token") } : {}),
          ...(text(form, "clientSecret") ? { clientSecret: text(form, "clientSecret") } : {}),
        });
      }}
    >
      <p className="subtle">
        Use your existing verified application. Community Bot uses the standard
        server connection intent; presence and member intents are unnecessary.
      </p>
      <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
        <label className="field">
          Application ID
          <input
            name="applicationId"
            defaultValue={settings.discordApplicationId ?? ""}
            inputMode="numeric"
            required
          />
        </label>
        <label className="field">
          Server ID
          <input
            name="guildId"
            defaultValue={settings.discordGuildId ?? ""}
            inputMode="numeric"
            required
          />
          <small>
            Enable Developer Mode in Discord to copy your server ID.
          </small>
        </label>
        <label className="field full">
          Bot token
          <input
            type="password"
            name="token"
            autoComplete="new-password"
            placeholder={
              settings.discordConfigured
                ? "Saved securely · leave blank to keep"
                : "Paste the token from Developer Portal → Bot"
            }
            required={!settings.discordConfigured}
          />
          <small>
            Encrypted before storage. Saved tokens are never sent back to this
            page.
          </small>
        </label>
        <label className="field full">
          Discord application client secret
          <input type="password" name="clientSecret" autoComplete="new-password" placeholder={settings.discordOAuthConfigured ? "Saved securely · leave blank to keep" : "Optional · needed for personal Discord account linking"} />
          <small>From Developer Portal → OAuth2. Register your dashboard origin plus /api/identity/callback/discord as a redirect URL.</small>
        </label>
        <label className="field full">Personal Discord account callback URL<input readOnly value={`${origin}/api/identity/callback/discord`} onFocus={(event) => event.target.select()} /><small>Select and copy this exact URL into your application's OAuth2 redirect URLs.</small></label>
      </div>
      <Feedback error={save.error?.message} success={message} />
      <div className="form-footer">
        <button className="button primary" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save Discord credentials"}
        </button>
        <a
          href="https://discord.com/developers/applications"
          target="_blank"
          rel="noreferrer"
          className="button"
        >
          Developer Portal ↗
        </a>
        {settings.discordApplicationId && (
          <a
            className="button"
            target="_blank"
            rel="noreferrer"
            href={`https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(settings.discordApplicationId)}&scope=bot&permissions=0`}
          >
            Invite to server ↗
          </a>
        )}
      </div>
    </form>
  );
}

export function DiscordPresence({ settings }: { settings: Settings }) {
  const [message, setMessage] = useState("");
  const [activityType, setActivityType] = useState(
    settings.discordActivityType,
  );
  const save = useMutation(
    trpc.settings.updateDiscordPresence.mutationOptions({
      onSuccess: async () => {
        setMessage(
          "Presence saved. The Discord service will apply it shortly.",
        );
        await queryClient.invalidateQueries();
      },
    }),
  );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setMessage("");
        const form = new FormData(event.currentTarget);
        save.mutate({
          status: text(form, "status") as PresenceInput["status"],
          activityType: text(
            form,
            "activityType",
          ) as PresenceInput["activityType"],
          activityText: text(form, "activityText"),
          activityUrl: text(form, "activityUrl"),
        });
      }}
    >
      <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
        <label className="field">
          Online status
          <select name="status" defaultValue={settings.discordStatus}>
            <option value="online">Online</option>
            <option value="idle">Idle</option>
            <option value="dnd">Do not disturb</option>
            <option value="invisible">Invisible</option>
          </select>
        </label>
        <label className="field">
          Activity type
          <select
            name="activityType"
            value={activityType}
            onChange={(event) => setActivityType(event.target.value)}
          >
            <option value="playing">Playing</option>
            <option value="listening">Listening to</option>
            <option value="watching">Watching</option>
            <option value="competing">Competing in</option>
            <option value="streaming">Streaming</option>
            <option value="custom">Custom status</option>
          </select>
        </label>
        <label className="field full">
          Activity text
          <input
            name="activityText"
            maxLength={128}
            defaultValue={settings.discordActivityText}
            placeholder="Hanging out with the community"
          />
          <small>Leave blank to clear the activity.</small>
        </label>
        {activityType === "streaming" && (
          <label className="field full">
            Stream URL
            <input
              type="url"
              name="activityUrl"
              required
              defaultValue={settings.discordActivityUrl ?? ""}
              placeholder="https://twitch.tv/yourchannel"
            />
            <small>Use a Twitch or YouTube stream URL.</small>
          </label>
        )}
      </div>
      <Feedback error={save.error?.message} success={message} />
      <div className="form-footer">
        <button className="button primary" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save Discord presence"}
        </button>
      </div>
    </form>
  );
}

export function TwitchSettings({ settings }: { settings: Settings }) {
  const [message, setMessage] = useState("");
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const save = useMutation(
    trpc.settings.configureTwitch.mutationOptions({
      onSuccess: async () => {
        setMessage(
          "Twitch application saved. Connect the creator and bot accounts below.",
        );
        await queryClient.invalidateQueries();
      },
    }),
  );
  const disconnect = useMutation(
    trpc.settings.disconnectTwitch.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries();
      },
    }),
  );
  return (
    <div>
      <p className="subtle">
        One Twitch application, two separate accounts. Connect your creator
        account first, then the account that sends chat messages.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setMessage("");
          const form = new FormData(event.currentTarget);
          save.mutate({
            clientId: text(form, "clientId"),
            ...(text(form, "clientSecret")
              ? { clientSecret: text(form, "clientSecret") }
              : {}),
          });
        }}
      >
        <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
          <label className="field">
            Twitch client ID
            <input
              name="clientId"
              defaultValue={settings.twitchClientId ?? ""}
              required
            />
          </label>
          <label className="field">
            Twitch client secret
            <input
              type="password"
              name="clientSecret"
              autoComplete="new-password"
              placeholder={
                settings.twitchAppConfigured
                  ? "Saved securely · leave blank to keep"
                  : "Paste your application secret"
              }
              required={!settings.twitchAppConfigured}
            />
          </label>
        </div>
        <Feedback error={save.error?.message} success={message} />
        <div className="form-footer">
          <button className="button primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save Twitch application"}
          </button>
          <a
            href="https://dev.twitch.tv/console/apps"
            target="_blank"
            rel="noreferrer"
            className="button"
          >
            Twitch console ↗
          </a>
        </div>
        <p className="subtle" style={{ marginTop: 15 }}>
          OAuth redirect URL: <code>{origin}/api/twitch/callback</code>
        </p>
        <label className="field">Personal Twitch account callback URL<input readOnly value={`${origin}/api/identity/callback/twitch`} onFocus={(event) => event.target.select()} /><small>Register this additional redirect URL in the same Twitch application so staff can link their own accounts.</small></label>
      </form>
      <div className="rule" />
      <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
        {(["broadcaster", "bot"] as const).map((role) => (
          <div key={role}>
            <h3>
              {role === "broadcaster" ? "1. Creator account" : "2. Bot account"}
            </h3>
            <p className="subtle">
              {settings[role].connected
                ? `Connected as ${settings[role].login}`
                : role === "bot"
                  ? "Use your bot's Twitch account on the consent screen."
                  : "The channel your bot account will join."}
            </p>
            <div className="actions">
              {settings.twitchAppConfigured ? (
                <a className="button" href={`/api/twitch/connect/${role}`}>
                  {settings[role].connected ? "Reconnect" : "Connect"}{" "}
                  {role === "bot" ? "bot" : "creator"}
                </a>
              ) : (
                <button className="button" disabled>
                  Save application first
                </button>
              )}
              {settings[role].connected && (
                <button
                  className="button danger"
                  disabled={disconnect.isPending}
                  onClick={() => disconnect.mutate({ role })}
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <Feedback error={disconnect.error?.message} />
    </div>
  );
}

function Feedback({ error, success }: { error?: string; success?: string }) {
  return (
    <>
      {error && (
        <p role="alert" className="notice error" style={{ marginTop: 18 }}>
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="notice success" style={{ marginTop: 18 }}>
          {success}
        </p>
      )}
    </>
  );
}
