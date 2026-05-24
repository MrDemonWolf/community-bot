import {
  SETUP_STEP_LABELS,
  SETUP_STEP_ORDER,
  SetupStep,
  type MappableRole,
  type SetupStepNumber,
} from "@community-bot/shared";
import { Button } from "@community-bot/ui/components/button";
import { Card } from "@community-bot/ui/components/card";
import { Input } from "@community-bot/ui/components/input";
import { Label } from "@community-bot/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/setup")({
  component: SetupRoute,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) throw redirect({ to: "/login" });
    return { session };
  },
});

function SetupRoute() {
  const router = useRouter();
  const qc = useQueryClient();
  const state = useQuery(trpc.setup.getState.queryOptions());

  const submit = useMutation({
    ...trpc.setup.submitStep.mutationOptions(),
    onSuccess: () => qc.invalidateQueries({ queryKey: trpc.setup.getState.queryKey() }),
    onError: (e) => toast.error(e.message),
  });

  const complete = useMutation({
    ...trpc.setup.complete.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Setup complete");
      router.navigate({ to: "/dashboard" });
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (state.data?.setupComplete) {
      router.navigate({ to: "/dashboard" });
    }
  }, [state.data?.setupComplete, router]);

  if (state.isLoading || !state.data) return <div className="p-6">Loading…</div>;
  if (state.error) return <div className="p-6 text-red-500">{state.error.message}</div>;

  const cfg = state.data;
  const step = cfg.currentStep;

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <ProgressBar current={step} />
      <Card className="mt-4 p-6">
        <h1 className="text-xl font-bold">
          Step {step}: {SETUP_STEP_LABELS[step]}
        </h1>
        <div className="mt-4">
          {step === 1 && (
            <Step1
              onSubmit={(p) => submit.mutate({ step: 1, payload: p })}
              initial={cfg.botDisplayName}
            />
          )}
          {step === 2 && (
            <Step2
              hasCreds={cfg.hasTwitchCreds}
              onSubmit={() => submit.mutate({ step: 2, payload: { acknowledged: true } })}
            />
          )}
          {step === 3 && (
            <Step3
              hasCreds={cfg.hasTwitchCreds}
              onSubmit={(mode) => submit.mutate({ step: 3, payload: { mode } })}
            />
          )}
          {step === 4 && (
            <Step4
              hasCreds={cfg.hasDiscordCreds}
              onSubmit={() => submit.mutate({ step: 4, payload: { acknowledged: true } })}
            />
          )}
          {step === 5 && (
            <Step5 onSubmit={(guildId) => submit.mutate({ step: 5, payload: { guildId } })} />
          )}
          {step === 6 && cfg.discordGuildId && (
            <Step6
              guildId={cfg.discordGuildId}
              onSubmit={(roleMap) => submit.mutate({ step: 6, payload: { roleMap } })}
            />
          )}
          {step === 7 && cfg.discordGuildId && (
            <Step7
              guildId={cfg.discordGuildId}
              initial={{
                channelId: cfg.streamAlertChannelId ?? "",
                embedStyle: (cfg.alertEmbedStyle ?? "rich") as "rich" | "plain",
                alertEveryone: cfg.alertEveryone ?? false,
              }}
              onSubmit={(p) => submit.mutate({ step: 7, payload: p })}
            />
          )}
          {step === 8 && (
            <Step8
              initial={cfg.botMode}
              onSubmit={(botMode) => submit.mutate({ step: 8, payload: { botMode } })}
            />
          )}
          {step === 9 && (
            <Step9
              cfg={cfg}
              onConfirm={() => {
                submit.mutate(
                  { step: 9, payload: { confirmed: true } },
                  { onSuccess: () => complete.mutate() },
                );
              }}
            />
          )}
        </div>
      </Card>
    </div>
  );
}

function ProgressBar({ current }: { current: SetupStepNumber }) {
  return (
    <div className="flex gap-1">
      {SETUP_STEP_ORDER.map((s) => (
        <div
          key={s}
          className={`h-2 flex-1 rounded ${s < current ? "bg-cyan-500" : s === current ? "bg-cyan-300" : "bg-slate-700"}`}
        />
      ))}
    </div>
  );
}

function Step1({
  initial,
  onSubmit,
}: {
  initial: string;
  onSubmit: (p: { botDisplayName: string }) => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <div className="space-y-4">
      <p>
        Welcome. Set your bot's display name (the service name stays <code>community-bot</code>).
      </p>
      <div>
        <Label htmlFor="botName">Bot display name</Label>
        <Input id="botName" value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
      </div>
      <Button onClick={() => onSubmit({ botDisplayName: name.trim() || "community-bot" })}>
        Next
      </Button>
    </div>
  );
}

function Step2({ hasCreds, onSubmit }: { hasCreds: boolean; onSubmit: () => void }) {
  if (!hasCreds)
    return (
      <MissingCreds
        varNames={["TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET"]}
        consoleUrl="https://dev.twitch.tv/console/apps"
      />
    );
  const linked = useTwitchLinked();
  return (
    <div className="space-y-4">
      <p>Connect your broadcaster Twitch account. This grants the dashboard your identity.</p>
      {linked ? (
        <p className="text-green-500">Linked as @{linked}</p>
      ) : (
        <Button
          onClick={() => authClient.signIn.social({ provider: "twitch", callbackURL: "/setup" })}
        >
          Sign in with Twitch
        </Button>
      )}
      <Button variant="secondary" disabled={!linked} onClick={onSubmit}>
        Next
      </Button>
    </div>
  );
}

function Step3({
  hasCreds,
  onSubmit,
}: {
  hasCreds: boolean;
  onSubmit: (mode: "same_account" | "separate_account_connected") => void;
}) {
  if (!hasCreds)
    return (
      <MissingCreds
        varNames={["TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET"]}
        consoleUrl="https://dev.twitch.tv/console/apps"
      />
    );
  return (
    <div className="space-y-4">
      <p>
        Use the same Twitch account as the bot, or connect a separate bot account. If separate, sign
        out of Twitch in another browser/incognito first to avoid Twitch SSO auto-picking your
        broadcaster account.
      </p>
      <div className="flex gap-3">
        <Button onClick={() => onSubmit("same_account")}>Use same account</Button>
        <Button
          variant="secondary"
          onClick={() => {
            window.location.href = `${import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000"}/api/oauth/twitch-bot/start`;
          }}
        >
          Connect separate bot account
        </Button>
        <Button variant="ghost" onClick={() => onSubmit("separate_account_connected")}>
          I already linked it — Next
        </Button>
      </div>
    </div>
  );
}

function Step4({ hasCreds, onSubmit }: { hasCreds: boolean; onSubmit: () => void }) {
  if (!hasCreds)
    return (
      <MissingCreds
        varNames={["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_BOT_TOKEN"]}
        consoleUrl="https://discord.com/developers/applications"
      />
    );
  return (
    <div className="space-y-4">
      <p>Sign in with Discord (for guild discovery), then invite the bot to your server.</p>
      <div className="flex gap-3">
        <Button
          onClick={() => authClient.signIn.social({ provider: "discord", callbackURL: "/setup" })}
        >
          Sign in with Discord
        </Button>
        <Button variant="secondary" onClick={onSubmit}>
          Next
        </Button>
      </div>
    </div>
  );
}

function Step5({ onSubmit }: { onSubmit: (guildId: string) => void }) {
  const guilds = useQuery(trpc.setup.listDiscordGuilds.queryOptions());
  const [picked, setPicked] = useState<string>("");
  if (guilds.isLoading) return <p>Loading guilds…</p>;
  if (guilds.error) return <p className="text-red-500">{guilds.error.message}</p>;
  const items = guilds.data ?? [];
  if (items.length === 0) return <p>No servers with Manage Server permission found.</p>;
  return (
    <div className="space-y-4">
      <p>Pick the Discord server to manage.</p>
      <select
        className="w-full rounded border border-slate-700 bg-slate-900 p-2"
        value={picked}
        onChange={(e) => setPicked(e.target.value)}
      >
        <option value="">— Select —</option>
        {items.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      <Button disabled={!picked} onClick={() => onSubmit(picked)}>
        Next
      </Button>
    </div>
  );
}

function Step6({
  guildId,
  onSubmit,
}: {
  guildId: string;
  onSubmit: (roleMap: Record<string, MappableRole>) => void;
}) {
  const roles = useQuery(trpc.setup.listDiscordRoles.queryOptions({ guildId }));
  const [map, setMap] = useState<Record<string, MappableRole | "">>({});
  if (roles.isLoading) return <p>Loading roles…</p>;
  if (roles.error) return <p className="text-red-500">{roles.error.message}</p>;
  const items = roles.data ?? [];
  return (
    <div className="space-y-4">
      <p>Map Discord roles → community-bot roles. Leave blank to ignore.</p>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left">Discord role</th>
            <th className="text-left">community-bot role</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id}>
              <td className="py-1">{r.name}</td>
              <td>
                <select
                  className="rounded border border-slate-700 bg-slate-900 p-1"
                  value={map[r.id] ?? ""}
                  onChange={(e) =>
                    setMap((m) => ({ ...m, [r.id]: e.target.value as MappableRole | "" }))
                  }
                >
                  <option value="">—</option>
                  <option value="mod">mod</option>
                  <option value="vip">vip</option>
                  <option value="sub">sub</option>
                  <option value="viewer">viewer</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button
        onClick={() => {
          const cleaned: Record<string, MappableRole> = {};
          for (const [k, v] of Object.entries(map)) if (v) cleaned[k] = v;
          onSubmit(cleaned);
        }}
      >
        Next
      </Button>
    </div>
  );
}

function Step7({
  guildId,
  initial,
  onSubmit,
}: {
  guildId: string;
  initial: { channelId: string; embedStyle: "rich" | "plain"; alertEveryone: boolean };
  onSubmit: (p: {
    channelId: string;
    embedStyle: "rich" | "plain";
    alertEveryone: boolean;
  }) => void;
}) {
  const channels = useQuery(trpc.setup.listDiscordChannels.queryOptions({ guildId }));
  const [channelId, setChannelId] = useState(initial.channelId);
  const [embedStyle, setEmbedStyle] = useState<"rich" | "plain">(initial.embedStyle);
  const [alertEveryone, setAlertEveryone] = useState(initial.alertEveryone);
  if (channels.isLoading) return <p>Loading channels…</p>;
  if (channels.error) return <p className="text-red-500">{channels.error.message}</p>;
  return (
    <div className="space-y-4">
      <div>
        <Label>Alert channel</Label>
        <select
          className="w-full rounded border border-slate-700 bg-slate-900 p-2"
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
        >
          <option value="">— Select —</option>
          {(channels.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>Embed style</Label>
        <div className="flex gap-4">
          <label>
            <input
              type="radio"
              checked={embedStyle === "rich"}
              onChange={() => setEmbedStyle("rich")}
            />{" "}
            Rich
          </label>
          <label>
            <input
              type="radio"
              checked={embedStyle === "plain"}
              onChange={() => setEmbedStyle("plain")}
            />{" "}
            Plain
          </label>
        </div>
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={alertEveryone}
          onChange={(e) => setAlertEveryone(e.target.checked)}
        />
        Ping @everyone on stream live
      </label>
      <Button
        disabled={!channelId}
        onClick={() => onSubmit({ channelId, embedStyle, alertEveryone })}
      >
        Next
      </Button>
    </div>
  );
}

function Step8({
  initial,
  onSubmit,
}: {
  initial: "single_account" | "separate_account";
  onSubmit: (m: "single_account" | "separate_account") => void;
}) {
  const [mode, setMode] = useState(initial);
  return (
    <div className="space-y-4">
      <p>How should the bot send chat messages?</p>
      <label className="block">
        <input
          type="radio"
          checked={mode === "single_account"}
          onChange={() => setMode("single_account")}
        />{" "}
        Single-account mode (broadcaster identity also sends bot messages)
      </label>
      <label className="block">
        <input
          type="radio"
          checked={mode === "separate_account"}
          onChange={() => setMode("separate_account")}
        />{" "}
        Separate bot account (uses the bot tokens linked in Step 3)
      </label>
      <Button onClick={() => onSubmit(mode)}>Next</Button>
    </div>
  );
}

type Step9Cfg = {
  botDisplayName: string;
  discordGuildId: string | null;
  streamAlertChannelId: string | null;
  alertEmbedStyle: string;
  alertEveryone: boolean;
  botMode: string;
  roleMap: Record<string, string> | null;
};

function Step9({ cfg, onConfirm }: { cfg: Step9Cfg; onConfirm: () => void }) {
  return (
    <div className="space-y-4">
      <p>Review configuration. Click Confirm to finalize.</p>
      <pre className="overflow-auto rounded bg-slate-900 p-3 text-xs">
        {JSON.stringify(
          {
            botDisplayName: cfg.botDisplayName,
            discordGuildId: cfg.discordGuildId,
            streamAlertChannelId: cfg.streamAlertChannelId,
            alertEmbedStyle: cfg.alertEmbedStyle,
            alertEveryone: cfg.alertEveryone,
            botMode: cfg.botMode,
            roleMapEntries: Object.keys(cfg.roleMap ?? {}).length,
          },
          null,
          2,
        )}
      </pre>
      <Button onClick={onConfirm}>Confirm</Button>
    </div>
  );
}

function MissingCreds({ varNames, consoleUrl }: { varNames: string[]; consoleUrl: string }) {
  return (
    <div className="space-y-3 rounded border border-red-700 bg-red-950/40 p-4">
      <p className="font-semibold text-red-400">Missing OAuth credentials</p>
      <p>
        Set the following env vars in <code>apps/server/.env</code> and restart the server:
      </p>
      <ul className="list-inside list-disc">
        {varNames.map((v) => (
          <li key={v}>
            <code>{v}</code>
          </li>
        ))}
      </ul>
      <p>
        Get them from the{" "}
        <a className="text-cyan-400 underline" href={consoleUrl} target="_blank" rel="noreferrer">
          developer console
        </a>
        .
      </p>
    </div>
  );
}

function useTwitchLinked(): string | null {
  // Twitch sign-in via Better-Auth puts user.email + image. Detect via session.user being present
  // and providerId=twitch in account. For Phase 0 simplicity, just check session existence.
  const session = authClient.useSession();
  return session.data?.user?.name ?? null;
}

// Used by SetupStep enum to silence unused import warning when only types kick in.
void SetupStep;
