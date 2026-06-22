"use client";
import { Button } from "@community-bot/ui/components/button";
import { Input } from "@community-bot/ui/components/input";
import { Label } from "@community-bot/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

type SettingsView = NonNullable<ReturnType<typeof useSettings>>;
function useSettings() {
  return useQuery(trpc.settings.get.queryOptions()).data;
}

const TIMEZONES: string[] =
  typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC"];

const STEPS = ["Welcome", "Core", "Twitch", "Optional", "Finish"] as const;

export default function SetupWizard() {
  const router = useRouter();
  const qc = useQueryClient();
  const connected = useSearchParams().get("connected");
  const { data } = useQuery(trpc.settings.get.queryOptions());
  const [step, setStep] = useState(0);

  const invalidate = () => qc.invalidateQueries({ queryKey: trpc.settings.get.queryKey() });

  useEffect(() => {
    if (connected) {
      toast.success(`Connected Twitch ${connected} account`);
      invalidate();
      setStep(2);
      router.replace("/setup");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  if (!data) return null;

  return (
    <div className="container mx-auto flex max-w-xl flex-col gap-6 px-4 py-10">
      <Stepper step={step} />
      {step === 0 && <Welcome onNext={() => setStep(1)} />}
      {step === 1 && <CoreStep data={data} onDone={() => setStep(2)} invalidate={invalidate} />}
      {step === 2 && <TwitchStep data={data} onBack={() => setStep(1)} onNext={() => setStep(3)} />}
      {step === 3 && (
        <OptionalStep onBack={() => setStep(2)} onNext={() => setStep(4)} invalidate={invalidate} />
      )}
      {step === 4 && (
        <FinishStep
          onBack={() => setStep(3)}
          onDone={() => router.push("/dashboard")}
          invalidate={invalidate}
        />
      )}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2 text-xs text-muted-foreground">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={i <= step ? "text-[#0FACED]" : ""}>
            {i + 1}. {s}
          </span>
          {i < STEPS.length - 1 && <span>·</span>}
        </li>
      ))}
    </ol>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 rounded-lg border p-6">{children}</div>;
}

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <Panel>
      <div className="rounded-md bg-[#091533] p-6 text-center">
        <h1 className="text-2xl font-bold text-[#0FACED]">HowlBot</h1>
        <p className="mt-1 text-sm text-white/70">Your self-hosted Twitch community bot.</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Let&apos;s connect your channel and the wolfaide bot account, set a few defaults, and
        you&apos;re live.
      </p>
      <div className="flex justify-end">
        <Button onClick={onNext}>Get started</Button>
      </div>
    </Panel>
  );
}

function CoreStep({
  data,
  onDone,
  invalidate,
}: {
  data: SettingsView;
  onDone: () => void;
  invalidate: () => void;
}) {
  const [prefix, setPrefix] = useState(data.commandPrefix);
  const [channel, setChannel] = useState(data.channelName ?? "");
  const [tz, setTz] = useState(
    data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
  );
  const save = useMutation(
    trpc.settings.updateCore.mutationOptions({
      onSuccess: () => {
        invalidate();
        onDone();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  return (
    <Panel>
      <h2 className="font-medium">Core settings</h2>
      <div className="grid gap-1.5">
        <Label htmlFor="channel">Channel name</Label>
        <Input
          id="channel"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          placeholder="mrdemonwolf"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="prefix">Command prefix</Label>
        <Input
          id="prefix"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder="!"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tz">Timezone</Label>
        <select
          id="tz"
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring"
        >
          {TIMEZONES.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end">
        <Button
          disabled={!channel || !prefix || save.isPending}
          onClick={() => save.mutate({ commandPrefix: prefix, timezone: tz, channelName: channel })}
        >
          {save.isPending ? "Saving…" : "Next"}
        </Button>
      </div>
    </Panel>
  );
}

function ConnectRow({
  role,
  connected,
  login,
  disabled,
}: {
  role: "broadcaster" | "bot";
  connected: boolean;
  login: string | null;
  disabled: boolean;
}) {
  const qc = useQueryClient();
  const disconnect = useMutation(
    trpc.settings.disconnectTwitch.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: trpc.settings.get.queryKey() }),
    }),
  );
  return (
    <div className="flex items-center justify-between rounded-md border p-3 text-sm">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
        <span className="capitalize">{role}</span>
        {login && <span className="text-muted-foreground">({login})</span>}
      </div>
      {connected ? (
        <Button variant="ghost" size="sm" onClick={() => disconnect.mutate({ role })}>
          Disconnect
        </Button>
      ) : (
        <Button
          size="sm"
          disabled={disabled}
          onClick={() => {
            window.location.href = `/api/twitch/connect/${role}`;
          }}
        >
          Connect
        </Button>
      )}
    </div>
  );
}

function TwitchStep({
  data,
  onBack,
  onNext,
}: {
  data: SettingsView;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <Panel>
      <h2 className="font-medium">Connect Twitch</h2>
      {!data.twitchAppConfigured && (
        <p className="rounded-md border border-yellow-600/40 bg-yellow-500/10 p-3 text-xs text-yellow-600 dark:text-yellow-400">
          Set <code>TWITCH_CLIENT_ID</code> and <code>TWITCH_CLIENT_SECRET</code> in the env
          (register an app at dev.twitch.tv/console/apps, redirect{" "}
          <code>/api/twitch/callback</code>) to enable connecting. You can skip and do this later.
        </p>
      )}
      <ConnectRow
        role="broadcaster"
        connected={data.broadcaster.connected}
        login={data.broadcaster.login}
        disabled={!data.twitchAppConfigured}
      />
      <ConnectRow
        role="bot"
        connected={data.bot.connected}
        login={data.bot.login}
        disabled={!data.twitchAppConfigured}
      />
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Next</Button>
      </div>
    </Panel>
  );
}

function OptionalStep({
  onBack,
  onNext,
  invalidate,
}: {
  onBack: () => void;
  onNext: () => void;
  invalidate: () => void;
}) {
  const [discordToken, setDiscordToken] = useState("");
  const [discordGuildId, setDiscordGuildId] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const save = useMutation(
    trpc.settings.updateOptional.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Saved");
        onNext();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  return (
    <Panel>
      <h2 className="font-medium">Optional integrations</h2>
      <p className="text-xs text-muted-foreground">
        All optional — leave blank to skip. Stored encrypted.
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor="discord">Discord bot token</Label>
        <Input
          id="discord"
          type="password"
          value={discordToken}
          onChange={(e) => setDiscordToken(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="guild">Discord guild ID</Label>
        <Input
          id="guild"
          value={discordGuildId}
          onChange={(e) => setDiscordGuildId(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="gemini">Gemini API key</Label>
        <Input
          id="gemini"
          type="password"
          value={geminiKey}
          onChange={(e) => setGeminiKey(e.target.value)}
        />
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onNext}>
            Skip
          </Button>
          <Button
            disabled={save.isPending}
            onClick={() => save.mutate({ discordToken, discordGuildId, geminiKey })}
          >
            {save.isPending ? "Saving…" : "Save & next"}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function FinishStep({
  onBack,
  onDone,
  invalidate,
}: {
  onBack: () => void;
  onDone: () => void;
  invalidate: () => void;
}) {
  const complete = useMutation(
    trpc.settings.completeSetup.mutationOptions({
      onSuccess: () => {
        invalidate();
        onDone();
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  return (
    <Panel>
      <h2 className="font-medium">All set</h2>
      <p className="text-sm text-muted-foreground">
        Finish to open the dashboard. You can reopen this wizard anytime from Settings.
      </p>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button disabled={complete.isPending} onClick={() => complete.mutate()}>
          {complete.isPending ? "Finishing…" : "Finish"}
        </Button>
      </div>
    </Panel>
  );
}
