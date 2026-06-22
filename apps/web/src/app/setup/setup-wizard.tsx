"use client";
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

const STEPS = ["Welcome", "Twitch", "Bot", "Brand", "Add-ons", "Done"] as const;

// ── primitives ───────────────────────────────────────────────────────────────
function cx(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

function LogoBadge({ size = 40, char = "H" }: { size?: number; char?: string }) {
  return (
    <div
      className="grid place-items-center rounded-[28%] font-bold text-[var(--hb-accent-fg)]"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: "var(--hb-accent)",
        boxShadow: "0 6px 22px -6px rgba(15,172,237,.55)",
      }}
    >
      {char}
    </div>
  );
}

function Btn({
  variant = "primary",
  className,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "twitch" | "discord";
}) {
  const base =
    "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    primary: "bg-[var(--hb-accent)] text-[var(--hb-accent-fg)] hover:brightness-110",
    ghost:
      "border border-[var(--hb-border-2)] text-[var(--hb-fg)] hover:bg-white/5",
    twitch: "bg-[var(--hb-twitch)] text-white hover:brightness-110",
    discord: "bg-[var(--hb-discord)] text-white hover:brightness-110",
  } as const;
  return <button className={cx(base, variants[variant], className)} {...p} />;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-[var(--hb-fg)]">{label}</span>
      {children}
      {hint && <span className="text-xs text-[var(--hb-subtle)]">{hint}</span>}
    </label>
  );
}

const inputCls =
  "h-10 w-full rounded-lg border border-[var(--hb-border)] bg-[var(--hb-surface-2)]/40 px-3 text-sm text-[var(--hb-fg)] placeholder:text-[var(--hb-subtle)] outline-none transition-colors focus:border-[var(--hb-accent)] focus:ring-1 focus:ring-[var(--hb-accent)]/40";

function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-[var(--hb-border)] bg-[var(--hb-surface)]/80 shadow-[0_24px_70px_-24px_rgba(0,0,0,.7)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      className="h-2 w-2 rounded-full"
      style={{ background: ok ? "#2dd4a7" : "var(--hb-subtle)" }}
    />
  );
}

// ── wizard ───────────────────────────────────────────────────────────────────
export default function SetupWizard() {
  const router = useRouter();
  const qc = useQueryClient();
  const connected = useSearchParams().get("connected");
  const { data } = useQuery(trpc.settings.get.queryOptions());
  const [step, setStep] = useState(0);

  const invalidate = () => qc.invalidateQueries({ queryKey: trpc.settings.get.queryKey() });

  useEffect(() => {
    if (connected) {
      toast.success(`Connected ${connected} account`);
      invalidate();
      setStep(connected === "broadcaster" ? 1 : 2);
      router.replace("/setup");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  if (!data) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-auto bg-[var(--hb-bg)] text-[var(--hb-fg)] [font-family:var(--font-inter)]"
    >
      {/* ambient gradient blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-[10%] top-[-15%] h-[55%] w-[55%] rounded-full"
          style={{ background: "radial-gradient(circle,rgba(124,91,255,.24),transparent 68%)" }}
        />
        <div
          className="absolute right-[12%] top-[24%] h-[46%] w-[40%] rounded-full"
          style={{ background: "radial-gradient(circle,rgba(45,212,167,.13),transparent 70%)" }}
        />
      </div>

      <div className="relative z-10 flex min-h-full flex-col">
        {/* top bar */}
        <header className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <LogoBadge size={30} />
            <span className="text-sm font-bold tracking-tight">HowlBot setup</span>
          </div>
          <span className="text-xs font-medium text-[var(--hb-muted)]">
            Step {step + 1} of {STEPS.length}
          </span>
        </header>

        {/* horizontal stepper */}
        <div className="flex justify-center px-6 pt-2">
          <ol className="flex w-full max-w-2xl items-center">
            {STEPS.map((label, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <li key={label} className="flex flex-1 items-center last:flex-none">
                  <button
                    onClick={() => setStep(i)}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span
                      className={cx(
                        "grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition-colors",
                        active && "bg-[var(--hb-accent)] text-[var(--hb-accent-fg)]",
                        done && "bg-[var(--hb-accent-soft)] text-[var(--hb-accent)]",
                        !active && !done && "bg-white/5 text-[var(--hb-subtle)]",
                      )}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <span
                      className={cx(
                        "text-[11px] font-medium",
                        active ? "text-[var(--hb-fg)]" : "text-[var(--hb-subtle)]",
                      )}
                    >
                      {label}
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <span
                      className={cx(
                        "mx-2 h-px flex-1",
                        i < step ? "bg-[var(--hb-accent)]/50" : "bg-white/10",
                      )}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {/* step body */}
        <div className="flex flex-1 items-start justify-center px-6 py-10">
          <div
            key={step}
            className="w-full max-w-[560px]"
            style={{ animation: "hb-fade .25s ease" }}
          >
            {step === 0 && <Welcome onNext={() => setStep(1)} />}
            {step === 1 && (
              <ConnectStep
                data={data}
                role="broadcaster"
                title="Connect your Twitch channel"
                subtitle="This is your broadcaster account — the channel HowlBot manages."
                blurb="HowlBot needs permission to read chat and post as your commands fire."
                onBack={() => setStep(0)}
                onNext={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <ConnectStep
                data={data}
                role="bot"
                title="Connect the bot account"
                subtitle="Use a separate Twitch account for the bot. Everything HowlBot says in chat shows under that name, not yours."
                blurb="Twitch recommends a dedicated account just for the bot. Log in as that account to continue."
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
              />
            )}
            {step === 3 && (
              <BrandStep data={data} onBack={() => setStep(2)} onNext={() => setStep(4)} invalidate={invalidate} />
            )}
            {step === 4 && (
              <AddonsStep data={data} onBack={() => setStep(3)} onNext={() => setStep(5)} invalidate={invalidate} />
            )}
            {step === 5 && (
              <DoneStep data={data} onBack={() => setStep(4)} invalidate={invalidate} onDone={() => router.push("/dashboard")} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── steps ────────────────────────────────────────────────────────────────────
function Welcome({ onNext }: { onNext: () => void }) {
  const features = [
    "Connect your Twitch channel and bot account",
    "Name your bot and set your defaults",
    "Add Discord, AI, and weather when you're ready",
  ];
  return (
    <GlassCard className="overflow-hidden">
      <div className="flex flex-col items-center px-9 pb-2 pt-10 text-center">
        <LogoBadge size={56} />
        <h1 className="mt-5 text-[30px] font-bold tracking-tight text-white">
          Welcome to HowlBot
        </h1>
        <p className="mt-2.5 max-w-sm text-sm leading-relaxed text-white/65">
          Your self-hosted bot for Twitch and Discord. Run commands, timers, and alerts from one
          calm dashboard.
        </p>
      </div>
      <div className="flex flex-col items-center gap-4 px-9 pb-8 pt-7">
        <ul className="grid gap-2.5">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2.5 text-sm text-[var(--hb-muted)]">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--hb-accent-soft)] text-[11px] text-[var(--hb-accent)]">
                ✓
              </span>
              {f}
            </li>
          ))}
        </ul>
        <Btn className="mt-2 w-full" onClick={onNext}>
          Get started
        </Btn>
      </div>
    </GlassCard>
  );
}

function ConnectStep({
  data,
  role,
  title,
  subtitle,
  blurb,
  onBack,
  onNext,
}: {
  data: SettingsView;
  role: "broadcaster" | "bot";
  title: string;
  subtitle: string;
  blurb: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const qc = useQueryClient();
  const conn = role === "broadcaster" ? data.broadcaster : data.bot;
  const disconnect = useMutation(
    trpc.settings.disconnectTwitch.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: trpc.settings.get.queryKey() }),
    }),
  );

  return (
    <GlassCard className="p-8">
      <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--hb-muted)]">{subtitle}</p>

      <div className="mt-6">
        {conn.connected ? (
          <div className="flex items-center justify-between rounded-xl border border-[var(--hb-border)] bg-[var(--hb-surface-2)]/40 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--hb-twitch)]/20 text-sm font-bold uppercase text-[var(--hb-twitch)]">
                {(conn.login ?? "?")[0]}
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  {conn.login}
                  <span className="rounded-full bg-[#2dd4a7]/15 px-2 py-0.5 text-[11px] font-medium text-[#2dd4a7]">
                    ✓ Connected
                  </span>
                </div>
                <div className="text-xs capitalize text-[var(--hb-subtle)]">{role}</div>
              </div>
            </div>
            <Btn variant="ghost" className="h-8 px-3 text-xs" onClick={() => disconnect.mutate({ role })}>
              Disconnect
            </Btn>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--hb-border)] bg-[var(--hb-surface-2)]/40 p-5">
            <div className="text-sm font-semibold text-white">
              Sign in {role === "broadcaster" ? "to your channel" : "as your bot"}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--hb-muted)]">{blurb}</p>
            {!data.twitchAppConfigured && (
              <p className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-2.5 text-[11px] leading-relaxed text-yellow-400">
                Set <code>TWITCH_CLIENT_ID</code> / <code>TWITCH_CLIENT_SECRET</code> in the env to
                enable. Redirect: <code>/api/twitch/callback</code>.
              </p>
            )}
            <Btn
              variant="twitch"
              className="mt-4 w-full"
              disabled={!data.twitchAppConfigured}
              onClick={() => {
                window.location.href = `/api/twitch/connect/${role}`;
              }}
            >
              Connect with Twitch
            </Btn>
          </div>
        )}
      </div>

      <Nav onBack={onBack} onNext={onNext} />
    </GlassCard>
  );
}

function BrandStep({
  data,
  onBack,
  onNext,
  invalidate,
}: {
  data: SettingsView;
  onBack: () => void;
  onNext: () => void;
  invalidate: () => void;
}) {
  const [botName, setBotName] = useState(data.botName);
  const [accent, setAccent] = useState(data.accentColor);
  const [channel, setChannel] = useState(data.channelName ?? "");
  const [prefix, setPrefix] = useState(data.commandPrefix);
  const [tz, setTz] = useState(
    data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
  );
  const save = useMutation(
    trpc.settings.updateCore.mutationOptions({
      onSuccess: () => {
        invalidate();
        onNext();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  return (
    <GlassCard className="p-8">
      <h2 className="text-2xl font-bold tracking-tight text-white">Make it yours</h2>
      <p className="mt-2 text-sm text-[var(--hb-muted)]">
        Give your bot a name and look, then set your defaults. You can change any of this later.
      </p>

      <div className="mt-6 grid gap-5">
        <div className="flex items-center gap-4">
          <div
            className="grid h-14 w-14 place-items-center rounded-2xl text-2xl font-bold text-[var(--hb-accent-fg)]"
            style={{ background: accent }}
          >
            {(botName || "H")[0].toUpperCase()}
          </div>
          <div className="grid flex-1 gap-1.5">
            <Field label="Bot name">
              <input className={inputCls} value={botName} onChange={(e) => setBotName(e.target.value)} placeholder="HowlBot" />
            </Field>
          </div>
        </div>

        <Field label="Accent color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="h-10 w-12 cursor-pointer rounded-lg border border-[var(--hb-border)] bg-transparent"
            />
            <input className={cx(inputCls, "flex-1")} value={accent} onChange={(e) => setAccent(e.target.value)} />
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Channel name">
            <input className={inputCls} value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="mrdemonwolf" />
          </Field>
          <Field label="Command prefix">
            <input className={inputCls} value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="!" />
          </Field>
        </div>

        <Field label="Timezone">
          <select className={inputCls} value={tz} onChange={(e) => setTz(e.target.value)}>
            {TIMEZONES.map((z) => (
              <option key={z} value={z} className="bg-[var(--hb-surface)]">
                {z}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Nav
        onBack={onBack}
        nextLabel={save.isPending ? "Saving…" : "Continue"}
        nextDisabled={!botName || !channel || !prefix || !/^#[0-9a-fA-F]{6}$/.test(accent) || save.isPending}
        onNext={() =>
          save.mutate({ botName, accentColor: accent, channelName: channel, commandPrefix: prefix, timezone: tz })
        }
      />
    </GlassCard>
  );
}

function AddonsStep({
  data,
  onBack,
  onNext,
  invalidate,
}: {
  data: SettingsView;
  onBack: () => void;
  onNext: () => void;
  invalidate: () => void;
}) {
  const [discordToken, setDiscordToken] = useState("");
  const [discordGuildId, setDiscordGuildId] = useState(data.discordGuildId ?? "");
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
    <GlassCard className="p-8">
      <h2 className="text-2xl font-bold tracking-tight text-white">Add-ons</h2>
      <p className="mt-2 text-sm text-[var(--hb-muted)]">
        Flip on any add-on you want to set up now. Everything here is optional and can wait.
      </p>

      <div className="mt-6 grid gap-3">
        <Addon name="Discord" color="var(--hb-discord)" badge={data.discordConfigured ? "Connected" : "Optional"} desc="Bridge go-live pings, roles, and relays.">
          <Field label="Bot token">
            <input className={inputCls} type="password" value={discordToken} onChange={(e) => setDiscordToken(e.target.value)} placeholder={data.discordConfigured ? "•••••• (saved)" : ""} />
          </Field>
          <Field label="Guild ID">
            <input className={inputCls} value={discordGuildId} onChange={(e) => setDiscordGuildId(e.target.value)} />
          </Field>
        </Addon>

        <Addon name="Gemini AI" color="#9168ff" badge={data.geminiConfigured ? "Connected" : "Optional"} desc="AI shoutouts, moderation, and personas.">
          <Field label="API key">
            <input className={inputCls} type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder={data.geminiConfigured ? "•••••• (saved)" : ""} />
          </Field>
        </Addon>

        <Addon name="Weather" color="#2dd4a7" badge="Soon" desc="WeatherKit for the $(weather) variable." muted>
          <p className="text-xs text-[var(--hb-subtle)]">WeatherKit .p8 upload lands with the events phase.</p>
        </Addon>
      </div>

      <Nav
        onBack={onBack}
        backSlot={
          <Btn variant="ghost" onClick={onNext}>
            Skip
          </Btn>
        }
        nextLabel={save.isPending ? "Saving…" : "Save & continue"}
        nextDisabled={save.isPending}
        onNext={() => save.mutate({ discordToken, discordGuildId, geminiKey })}
      />
    </GlassCard>
  );
}

function Addon({
  name,
  color,
  badge,
  desc,
  muted,
  children,
}: {
  name: string;
  color: string;
  badge: string;
  desc: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cx("rounded-xl border border-[var(--hb-border)] bg-[var(--hb-surface-2)]/30 p-4", muted && "opacity-70")}>
      <div className="flex items-center gap-3">
        <span className="h-8 w-8 rounded-lg" style={{ background: color }} />
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            {name}
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--hb-muted)]">
              {badge}
            </span>
          </div>
          <div className="text-xs text-[var(--hb-subtle)]">{desc}</div>
        </div>
      </div>
      <div className="mt-3 grid gap-3">{children}</div>
    </div>
  );
}

function DoneStep({
  data,
  onBack,
  onDone,
  invalidate,
}: {
  data: SettingsView;
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
  const stats = [
    { label: "Twitch", ok: data.broadcaster.connected },
    { label: "Bot", ok: data.bot.connected },
  ];
  return (
    <GlassCard className="p-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#2dd4a7]/15 text-2xl text-[#2dd4a7]">
        ✓
      </div>
      <h2 className="mt-5 text-[26px] font-bold tracking-tight text-white">The pack is ready</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--hb-muted)]">
        <span className="text-white">{data.botName}</span> is set up. Jump in and add your first
        command, or head to the dashboard.
      </p>

      <div className="mt-6 flex justify-center gap-2">
        {stats.map((s) => (
          <span
            key={s.label}
            className="flex items-center gap-2 rounded-full border border-[var(--hb-border)] bg-[var(--hb-surface-2)]/40 px-3 py-1.5 text-xs text-[var(--hb-muted)]"
          >
            <Dot ok={s.ok} />
            {s.label} {s.ok ? "online" : "—"}
          </span>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Btn variant="ghost" onClick={onBack}>
          Back
        </Btn>
        <Btn disabled={complete.isPending} onClick={() => complete.mutate()}>
          {complete.isPending ? "Finishing…" : "Go to dashboard →"}
        </Btn>
      </div>
    </GlassCard>
  );
}

// shared back/next footer
function Nav({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled,
  backSlot,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  backSlot?: React.ReactNode;
}) {
  return (
    <div className="mt-8 flex items-center justify-between">
      <Btn variant="ghost" onClick={onBack}>
        Back
      </Btn>
      <div className="flex gap-2">
        {backSlot}
        <Btn disabled={nextDisabled} onClick={onNext}>
          {nextLabel}
        </Btn>
      </div>
    </div>
  );
}
