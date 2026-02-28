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
import { CheckCircle2, AlertTriangle, ExternalLink, Copy, Loader2, Check } from "lucide-react";

type Step = "sign-in" | "authorize-bot" | "link-twitch" | "enable-bot" | "complete";

const STEPS: { key: Step; label: string }[] = [
  { key: "sign-in", label: "Sign In" },
  { key: "authorize-bot", label: "Authorize" },
  { key: "link-twitch", label: "Link Twitch" },
  { key: "enable-bot", label: "Enable Bot" },
  { key: "complete", label: "Done" },
];

export default function SetupWizard({ token }: { token: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [step, setStepRaw] = useState<Step>("sign-in");
  const [stepRestored, setStepRestored] = useState(false);
  const [signingIn, setSigningIn] = useState<"twitch" | "discord" | null>(null);
  const [linkingTwitch, setLinkingTwitch] = useState(false);
  const [skippedTwitch, setSkippedTwitch] = useState(false);
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [verificationUri, setVerificationUri] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState<number>(5);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Restore saved step from DB
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

  // Restore step from DB on load
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

  // Check bot status once authenticated
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

  // Auto-advance from sign-in: always go to authorize-bot
  useEffect(() => {
    if (!session || step !== "sign-in" || botStatus === undefined || !stepRestored) return;
    setStep("authorize-bot");
  }, [session, step, botStatus, stepRestored]);

  // Start device code flow when entering authorize-bot step
  useEffect(() => {
    if (step === "authorize-bot" && !deviceCode && !startBotAuthMutation.isPending) {
      startBotAuthMutation.mutate();
    }
  }, [step, deviceCode, startBotAuthMutation.isPending]);

  // Poll for bot authorization
  useEffect(() => {
    if (step !== "authorize-bot" || !deviceCode || botUsername) return;

    const id = setInterval(async () => {
      try {
        const result = await pollBotAuthMutation.mutateAsync({ deviceCode });
        if (result.success) {
          setBotUsername(result.username);
        }
      } catch {
        // Stop polling on hard errors
        clearInterval(id);
      }
    }, pollInterval * 1000);

    return () => clearInterval(id);
  }, [step, deviceCode, pollInterval, botUsername]);

  // Auto-advance from authorize-bot after success
  useEffect(() => {
    if (step === "authorize-bot" && botUsername) {
      const timeout = setTimeout(() => {
        if (botStatus?.hasTwitchLinked) {
          setStep("enable-bot");
        } else {
          setStep("link-twitch");
        }
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [step, botUsername, botStatus?.hasTwitchLinked]);

  // Auto-advance from link-twitch if Twitch is now linked
  useEffect(() => {
    if (step === "link-twitch" && botStatus?.hasTwitchLinked) {
      setStep("enable-bot");
    }
  }, [step, botStatus?.hasTwitchLinked]);

  // Redirect to dashboard after completion
  useEffect(() => {
    if (step === "complete") {
      const timeout = setTimeout(() => router.push("/dashboard"), 2000);
      return () => clearTimeout(timeout);
    }
  }, [step, router]);

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

  const handleEnableBot = () => {
    enableBotMutation.mutate();
  };

  if (sessionPending) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  // Show loading while waiting for botStatus after sign-in redirect
  if (session && step === "sign-in") {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  const currentIndex = stepIndex(step);

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-8">
      <div className="mb-8">
        <Logo className="text-3xl font-bold tracking-tight" />
      </div>

      <Card className="animate-fade-in-up glass w-full max-w-lg rounded-2xl">
        <CardHeader className="pb-2 text-center">
          {/* Step indicator — clean bars with labels */}
          <div className="mb-4 flex items-center justify-center gap-1">
            {STEPS.map((s, i) => {
              const isActive = currentIndex >= i;
              const isCurrent = currentIndex === i;
              return (
                <div key={s.key} className="flex flex-col items-center gap-1.5">
                  <div
                    className={`h-1.5 w-14 rounded-full transition-all duration-300 ${
                      isActive ? "bg-brand-main" : "bg-muted"
                    }`}
                  />
                  <span
                    className={`text-xs transition-colors duration-300 ${
                      isCurrent
                        ? "font-semibold text-brand-main"
                        : isActive
                          ? "text-muted-foreground"
                          : "text-muted-foreground/50"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          <CardTitle className="font-heading text-xl font-bold">
            {step === "sign-in" && "Welcome! Let\u2019s get set up."}
            {step === "authorize-bot" && "Authorize the Bot"}
            {step === "link-twitch" && "Link Your Twitch Account"}
            {step === "enable-bot" && "Enable the Bot"}
            {step === "complete" && "You\u2019re All Set!"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {step === "sign-in" &&
              "Sign in to become the broadcaster."}
            {step === "authorize-bot" &&
              "Log in with the bot\u2019s Twitch account to authorize chat access."}
            {step === "link-twitch" &&
              "Link Twitch to enable bot features for your channel."}
            {step === "enable-bot" &&
              "The bot will join your Twitch channel."}
            {step === "complete" && "Setup is complete. Redirecting to your dashboard\u2026"}
          </p>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pt-4">
          {/* Step content with slide-fade transition */}
          <div key={step} className="animate-slide-fade">
            {/* Step 1: Sign In */}
            {step === "sign-in" && (
              <div className="flex flex-col gap-3">
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
              </div>
            )}

            {/* Step 2: Authorize Bot */}
            {step === "authorize-bot" && (
              <div className="flex flex-col gap-4">
                {botUsername ? (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <CheckCircle2 className="h-16 w-16 text-green-500" />
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      Bot authorized as <strong>{botUsername}</strong>
                    </p>
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
                        <p className="text-xs text-muted-foreground">Your code</p>
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
                        <p className={`text-xs transition-opacity ${codeCopied ? "text-green-500 opacity-100" : "opacity-0"}`}>
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

                {!botUsername && (
                  <Button
                    variant="ghost"
                    className="text-sm text-muted-foreground"
                    onClick={() => {
                      if (botStatus?.hasTwitchLinked) {
                        setStep("enable-bot");
                      } else {
                        setStep("link-twitch");
                      }
                    }}
                  >
                    Skip for now
                  </Button>
                )}
              </div>
            )}

            {/* Step 3: Link Twitch */}
            {step === "link-twitch" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3 rounded-xl border border-yellow-500/15 bg-yellow-500/10 p-4 text-sm text-yellow-600 dark:text-yellow-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Bot features require a linked Twitch account. You can skip
                    this now but the bot won&apos;t work until you link Twitch later.
                  </span>
                </div>

                <Button
                  size="lg"
                  className="w-full rounded-md bg-brand-twitch py-6 text-sm font-bold text-white hover:bg-brand-twitch/80"
                  disabled={linkingTwitch}
                  onClick={handleLinkTwitch}
                >
                  {linkingTwitch ? "Redirecting..." : "Link Twitch Account"}
                </Button>

                <Button
                  variant="ghost"
                  className="text-sm text-muted-foreground"
                  onClick={() => {
                    setSkippedTwitch(true);
                    setStep("enable-bot");
                  }}
                >
                  Skip for now
                </Button>
              </div>
            )}

            {/* Step 4: Enable Bot */}
            {step === "enable-bot" && (
              <div className="flex flex-col gap-3">
                {botStatus?.hasTwitchLinked ? (
                  <div className="flex items-start gap-3 rounded-xl border border-brand-main/15 bg-brand-main/5 p-4 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-main" />
                    <span>
                      Twitch account linked. The bot will automatically join
                      your channel when you complete setup.
                    </span>
                  </div>
                ) : (
                  <div className="rounded-xl bg-surface-raised p-4 text-center text-sm text-muted-foreground">
                    No Twitch account linked — you can enable the bot later from the dashboard.
                  </div>
                )}

                <Button
                  size="lg"
                  className="w-full rounded-md bg-brand-main py-6 text-sm font-bold text-white hover:bg-brand-main/80"
                  onClick={() => completeMutation.mutate({ token })}
                  disabled={completeMutation.isPending}
                >
                  {completeMutation.isPending ? "Completing..." : "Complete Setup"}
                </Button>

                {completeMutation.isError && (
                  <p className="text-center text-sm text-red-500">
                    {completeMutation.error.message}
                  </p>
                )}
              </div>
            )}

            {/* Step 5: Complete */}
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

function stepIndex(step: Step): number {
  return STEPS.findIndex((s) => s.key === step);
}
