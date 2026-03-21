"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Loader from "@/components/loader";
import Logo from "@/components/logo";
import {
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Loader2,
  Check,
  Palette,
} from "lucide-react";

type Step =
  | "sign-in"
  | "link-accounts"
  | "invite-discord"
  | "branding"
  | "enable-bot"
  | "complete";

const STEPS: { key: Step; label: string; optional?: boolean }[] = [
  { key: "sign-in", label: "Sign In" },
  { key: "link-accounts", label: "Link Accounts" },
  { key: "invite-discord", label: "Invite Bot" },
  { key: "branding", label: "Branding", optional: true },
  { key: "enable-bot", label: "Enable Bot" },
  { key: "complete", label: "Done" },
];

/* ------------------------------------------------------------------ */
/*  Step Progress Bar                                                  */
/* ------------------------------------------------------------------ */

function StepProgressBar({
  currentStep,
  steps,
}: {
  currentStep: Step;
  steps: typeof STEPS;
}) {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="mb-6 w-full">
      {/* Desktop: labels */}
      <div className="hidden sm:flex items-center justify-center gap-1">
        {steps.map((s, i) => {
          const isCompleted = i < currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <div key={s.key} className="flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-1">
                {i > 0 && (
                  <div
                    className={`h-0.5 w-6 rounded-full transition-all duration-300 ${
                      i <= currentIndex ? "bg-brand-main" : "bg-muted"
                    }`}
                  />
                )}
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                    isCompleted
                      ? "bg-green-500 text-white"
                      : isCurrent
                        ? "bg-brand-main text-white"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    i + 1
                  )}
                </div>
              </div>
              <span
                className={`text-xs transition-colors duration-300 ${
                  isCurrent
                    ? "font-semibold text-brand-main"
                    : isCompleted
                      ? "font-medium text-green-500"
                      : "text-muted-foreground/50"
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mobile: dots */}
      <div className="flex sm:hidden items-center justify-center gap-2">
        {steps.map((s, i) => {
          const isCompleted = i < currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <div
              key={s.key}
              className={`rounded-full transition-all duration-300 ${
                isCompleted
                  ? "h-2.5 w-2.5 bg-green-500"
                  : isCurrent
                    ? "h-3 w-3 bg-brand-main"
                    : "h-2 w-2 bg-muted"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Wizard                                                        */
/* ------------------------------------------------------------------ */

export default function SetupWizard({ token }: { token: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [step, setStepRaw] = useState<Step>("sign-in");
  const [stepRestored, setStepRestored] = useState(false);
  const [signingIn, setSigningIn] = useState<"twitch" | "discord" | null>(null);
  const [linkingTwitch, setLinkingTwitch] = useState(false);
  const [linkingDiscord, setLinkingDiscord] = useState(false);
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [verificationUri, setVerificationUri] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState<number>(5);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // ── Restore saved step from DB ──────────────────────────────────
  const { data: savedStep } = useQuery({
    ...trpc.setup.getStep.queryOptions(),
    enabled: !!session,
  });

  const saveStepMutation = useMutation(
    trpc.setup.saveStep.mutationOptions()
  );

  const setStep = useCallback(
    (newStep: Step) => {
      setStepRaw(newStep);
      if (newStep !== "sign-in" && newStep !== "complete") {
        saveStepMutation.mutate({ step: newStep });
      }
    },
    [saveStepMutation]
  );

  // Restore step from DB on load (show that step, don't skip past it)
  useEffect(() => {
    if (!session || stepRestored || !savedStep) return;
    if (savedStep.step && savedStep.step !== "sign-in") {
      const validSteps: Step[] = STEPS.map((s) => s.key);
      if (validSteps.includes(savedStep.step as Step)) {
        setStepRaw(savedStep.step as Step);
      }
    }
    setStepRestored(true);
  }, [session, savedStep, stepRestored]);

  // If signed in and step is still sign-in, mark restored so UI shows
  useEffect(() => {
    if (session && !stepRestored && savedStep !== undefined) {
      if (!savedStep?.step || savedStep.step === "sign-in") {
        setStepRestored(true);
      }
    }
  }, [session, stepRestored, savedStep]);

  // ── Bot channel status ──────────────────────────────────────────
  const { data: botStatus } = useQuery({
    ...trpc.botChannel.getStatus.queryOptions(),
    enabled: !!session,
  });

  const enableBotMutation = useMutation(
    trpc.botChannel.enable.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.botChannel.getStatus.queryOptions().queryKey,
        });
      },
    })
  );

  const completeMutation = useMutation(
    trpc.setup.complete.mutationOptions({
      onSuccess: () => {
        setStep("complete");
      },
    })
  );

  // ── Bot auth (Device Code Flow) ─────────────────────────────────
  const startBotAuthMutation = useMutation(
    trpc.setup.startBotAuth.mutationOptions({
      onSuccess: (data) => {
        setDeviceCode(data.deviceCode);
        setVerificationUri(data.verificationUri);
        setUserCode(data.userCode);
        setPollInterval(data.interval || 5);
      },
    })
  );

  const pollBotAuthMutation = useMutation(
    trpc.setup.pollBotAuth.mutationOptions()
  );

  // Start device code flow when entering enable-bot step
  useEffect(() => {
    if (step === "enable-bot" && !deviceCode && !startBotAuthMutation.isPending) {
      startBotAuthMutation.mutate();
    }
  }, [step, deviceCode, startBotAuthMutation.isPending]);

  // Poll for bot authorization
  useEffect(() => {
    if (step !== "enable-bot" || !deviceCode || botUsername) return;

    const id = setInterval(async () => {
      try {
        const result = await pollBotAuthMutation.mutateAsync({ deviceCode });
        if (result.success) {
          setBotUsername(result.username);
        }
      } catch {
        clearInterval(id);
      }
    }, pollInterval * 1000);

    return () => clearInterval(id);
  }, [step, deviceCode, pollInterval, botUsername]);

  // Redirect to dashboard after completion
  useEffect(() => {
    if (step === "complete") {
      const timeout = setTimeout(() => router.push("/dashboard"), 3000);
      return () => clearTimeout(timeout);
    }
  }, [step, router]);

  // ── Handlers ────────────────────────────────────────────────────
  const handleSignIn = (provider: "twitch" | "discord") => {
    setSigningIn(provider);
    authClient.signIn.social({
      provider,
      callbackURL: `/setup/${token}`,
    });
  };

  const handleLinkTwitch = () => {
    setLinkingTwitch(true);
    authClient.linkSocial({
      provider: "twitch",
      callbackURL: `/setup/${token}`,
    });
  };

  const handleLinkDiscord = () => {
    setLinkingDiscord(true);
    authClient.linkSocial({
      provider: "discord",
      callbackURL: `/setup/${token}`,
    });
  };

  const advanceStep = () => {
    const currentIndex = STEPS.findIndex((s) => s.key === step);
    if (currentIndex < STEPS.length - 1) {
      setStep(STEPS[currentIndex + 1]!.key);
    }
  };

  // ── Loading states ──────────────────────────────────────────────
  if (sessionPending) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  // ── Step titles & descriptions ──────────────────────────────────
  const stepMeta: Record<Step, { title: string; description: string }> = {
    "sign-in": {
      title: "Welcome to Community Bot",
      description: "Sign in to become the broadcaster and start setting up your bot.",
    },
    "link-accounts": {
      title: "Link Your Accounts",
      description: "Connect your Discord and Twitch accounts for full functionality.",
    },
    "invite-discord": {
      title: "Invite Bot to Discord",
      description: "Add the bot to your Discord server for stream notifications.",
    },
    branding: {
      title: "Branding",
      description: "Customize the look and feel of your bot and dashboard.",
    },
    "enable-bot": {
      title: "Authorize the Bot",
      description:
        "Log in with the bot\u2019s Twitch account to authorize chat access.",
    },
    complete: {
      title: "You\u2019re All Set!",
      description: "Setup is complete. Redirecting to your dashboard\u2026",
    },
  };

  const meta = stepMeta[step];

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-8">
      <div className="mb-8">
        <Logo className="text-3xl font-bold tracking-tight" />
      </div>

      <Card className="animate-fade-in-up glass w-full max-w-lg rounded-2xl">
        <CardHeader className="pb-2 text-center">
          <StepProgressBar currentStep={step} steps={STEPS} />

          <CardTitle className="font-heading text-xl font-bold">
            {meta.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{meta.description}</p>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pt-4">
          <div key={step} className="animate-slide-fade">
            {/* ── Step 1: Sign In ─────────────────────────────── */}
            {step === "sign-in" && (
              <div className="flex flex-col gap-3">
                {session ? (
                  <div className="flex flex-col items-center gap-4">
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      Signed in as <strong>{session.user.name}</strong>
                    </p>
                    <Button
                      size="lg"
                      className="w-full rounded-md bg-brand-main py-6 text-sm font-bold text-white hover:bg-brand-main/80"
                      onClick={advanceStep}
                    >
                      Continue
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      size="lg"
                      className="w-full rounded-md bg-brand-twitch py-6 text-sm font-bold text-white hover:bg-brand-twitch/80"
                      disabled={signingIn !== null}
                      onClick={() => handleSignIn("twitch")}
                    >
                      {signingIn === "twitch"
                        ? "Redirecting..."
                        : "Sign in with Twitch (recommended)"}
                    </Button>

                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs font-medium uppercase text-muted-foreground">
                        or
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full rounded-md border-brand-discord/30 py-6 text-sm font-medium text-brand-discord hover:bg-brand-discord/10"
                      disabled={signingIn !== null}
                      onClick={() => handleSignIn("discord")}
                    >
                      {signingIn === "discord"
                        ? "Redirecting..."
                        : "Sign in with Discord"}
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* ── Step 2: Link Accounts ───────────────────────── */}
            {step === "link-accounts" && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Twitch card */}
                  <div
                    className={`flex flex-col items-center gap-3 rounded-xl border p-4 ${
                      botStatus?.hasTwitchLinked
                        ? "border-green-500/30 bg-green-500/5"
                        : "border-brand-twitch/20 bg-brand-twitch/5"
                    }`}
                  >
                    <div className="text-sm font-semibold text-brand-twitch">
                      Twitch
                    </div>
                    {botStatus?.hasTwitchLinked ? (
                      <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        Connected
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="bg-brand-twitch text-white hover:bg-brand-twitch/80"
                        disabled={linkingTwitch}
                        onClick={handleLinkTwitch}
                      >
                        {linkingTwitch ? "Redirecting..." : "Link Twitch"}
                      </Button>
                    )}
                  </div>

                  {/* Discord card */}
                  <div
                    className={`flex flex-col items-center gap-3 rounded-xl border p-4 ${
                      botStatus?.hasDiscordLinked
                        ? "border-green-500/30 bg-green-500/5"
                        : "border-brand-discord/20 bg-brand-discord/5"
                    }`}
                  >
                    <div className="text-sm font-semibold text-brand-discord">
                      Discord
                    </div>
                    {botStatus?.hasDiscordLinked ? (
                      <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        Connected
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="bg-brand-discord text-white hover:bg-brand-discord/80"
                        disabled={linkingDiscord}
                        onClick={handleLinkDiscord}
                      >
                        {linkingDiscord ? "Redirecting..." : "Link Discord"}
                      </Button>
                    )}
                  </div>
                </div>

                <Button
                  size="lg"
                  className="w-full rounded-md bg-brand-main py-6 text-sm font-bold text-white hover:bg-brand-main/80"
                  onClick={advanceStep}
                >
                  Continue
                </Button>

                {(!botStatus?.hasTwitchLinked || !botStatus?.hasDiscordLinked) && (
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={advanceStep}
                  >
                    Skip for now
                  </button>
                )}
              </div>
            )}

            {/* ── Step 3: Invite Discord Bot ──────────────────── */}
            {step === "invite-discord" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col items-center gap-3 rounded-xl border border-brand-discord/20 bg-brand-discord/5 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-discord/20">
                    <ExternalLink className="h-6 w-6 text-brand-discord" />
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    Add the Community Bot to your Discord server to receive
                    stream notifications and use slash commands.
                  </p>
                  <a
                    href="/api/discord/invite"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-discord px-6 py-3 text-sm font-bold text-white hover:bg-brand-discord/80"
                  >
                    Invite to Discord
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>

                <Button
                  size="lg"
                  className="w-full rounded-md bg-brand-main py-6 text-sm font-bold text-white hover:bg-brand-main/80"
                  onClick={advanceStep}
                >
                  Continue
                </Button>

                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={advanceStep}
                >
                  Skip for now
                </button>
              </div>
            )}

            {/* ── Step 4: Branding (placeholder for CB-94) ────── */}
            {step === "branding" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-raised p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-main/10">
                    <Palette className="h-6 w-6 text-brand-main" />
                  </div>
                  <p className="text-center text-sm font-medium text-foreground">
                    Branding Customization
                  </p>
                  <p className="text-center text-sm text-muted-foreground">
                    Customize your bot&apos;s appearance and dashboard branding.
                    This feature is coming soon.
                  </p>
                </div>

                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={advanceStep}
                >
                  Skip for now
                </button>
              </div>
            )}

            {/* ── Step 5: Enable Bot (Device Code Flow) ───────── */}
            {step === "enable-bot" && (
              <div className="flex flex-col gap-4">
                {botUsername ? (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <CheckCircle2 className="h-16 w-16 text-green-500" />
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      Bot authorized as <strong>{botUsername}</strong>
                    </p>
                    <Button
                      size="lg"
                      className="w-full rounded-md bg-brand-main py-6 text-sm font-bold text-white hover:bg-brand-main/80"
                      onClick={() => completeMutation.mutate({ token })}
                      disabled={completeMutation.isPending}
                    >
                      {completeMutation.isPending
                        ? "Completing..."
                        : "Complete Setup"}
                    </Button>
                  </div>
                ) : verificationUri ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex items-start gap-3 rounded-xl border border-brand-twitch/15 bg-brand-twitch/5 p-4 text-sm">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-twitch" />
                      <span className="text-muted-foreground">
                        Use a separate Twitch account for the bot (e.g.
                        &quot;YourNameBot&quot;), not your broadcaster account.
                      </span>
                    </div>

                    {userCode && (
                      <div className="flex w-full flex-col items-center gap-1.5">
                        <p className="text-xs text-muted-foreground">
                          Your code
                        </p>
                        <button
                          type="button"
                          className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-surface-raised px-6 py-4 font-mono text-2xl font-bold tracking-[0.3em] transition-colors hover:bg-surface-overlay"
                          onClick={() => {
                            navigator.clipboard.writeText(userCode);
                            setCodeCopied(true);
                            setTimeout(() => setCodeCopied(false), 2000);
                          }}
                        >
                          {userCode}
                          <Copy className="h-5 w-5 text-muted-foreground" />
                        </button>
                        <p
                          className={`text-xs transition-opacity ${codeCopied ? "text-green-500 opacity-100" : "opacity-0"}`}
                        >
                          Copied!
                        </p>
                      </div>
                    )}

                    <div className="flex w-full gap-2">
                      <a
                        href={verificationUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-brand-twitch py-3 text-sm font-bold text-white hover:bg-brand-twitch/80"
                      >
                        Authorize on Twitch
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        className="flex items-center justify-center rounded-md bg-brand-twitch/20 px-3 text-brand-twitch hover:bg-brand-twitch/30"
                        onClick={() => {
                          navigator.clipboard.writeText(verificationUri);
                          setLinkCopied(true);
                          setTimeout(() => setLinkCopied(false), 2000);
                        }}
                        title="Copy link"
                      >
                        {linkCopied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-main" />
                      <span>Waiting for authorization...</span>
                    </div>
                  </div>
                ) : startBotAuthMutation.isError ? (
                  <div className="rounded-xl bg-red-500/10 p-4 text-center text-sm text-red-500">
                    {startBotAuthMutation.error.message}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-4">
                    <Loader />
                  </div>
                )}

                {completeMutation.isError && (
                  <p className="text-center text-sm text-red-500">
                    {completeMutation.error.message}
                  </p>
                )}

                {!botUsername && (
                  <Button
                    variant="ghost"
                    className="text-sm text-muted-foreground"
                    onClick={() => completeMutation.mutate({ token })}
                    disabled={completeMutation.isPending}
                  >
                    {completeMutation.isPending
                      ? "Completing..."
                      : "Skip and complete setup"}
                  </Button>
                )}
              </div>
            )}

            {/* ── Step 6: Complete ────────────────────────────── */}
            {step === "complete" && (
              <div className="flex flex-col items-center gap-4 py-6">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
                <p className="text-sm text-muted-foreground">
                  Redirecting to your dashboard...
                </p>
                <Loader />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
