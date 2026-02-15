"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { CheckCircle2, AlertTriangle } from "lucide-react";

type Step = "sign-in" | "link-twitch" | "enable-bot" | "complete";

export default function SetupWizard({ token }: { token: string }) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [step, setStep] = useState<Step>("sign-in");
  const [signingIn, setSigningIn] = useState<"twitch" | "discord" | null>(null);
  const [linkingTwitch, setLinkingTwitch] = useState(false);
  const [skippedTwitch, setSkippedTwitch] = useState(false);

  // Check bot status once authenticated
  const { data: botStatus } = useQuery({
    ...trpc.botChannel.getStatus.queryOptions(),
    enabled: !!session && step !== "sign-in",
  });

  const enableBotMutation = useMutation(
    trpc.botChannel.enable.mutationOptions({
      onSuccess: () => setStep("complete"),
    })
  );

  const completeMutation = useMutation(
    trpc.setup.complete.mutationOptions({
      onSuccess: () => {
        setTimeout(() => router.push("/dashboard"), 2000);
      },
    })
  );

  // Auto-advance from sign-in step when session exists
  if (session && step === "sign-in") {
    // Determine if we need to link Twitch
    const hasTwitch = botStatus?.hasTwitchLinked;
    if (botStatus !== undefined) {
      if (hasTwitch) {
        setStep("enable-bot");
      } else {
        setStep("link-twitch");
      }
    }
  }

  // Auto-advance from link-twitch if Twitch is now linked
  if (session && step === "link-twitch" && botStatus?.hasTwitchLinked) {
    setStep("enable-bot");
  }

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

  const handleComplete = () => {
    completeMutation.mutate({ token });
  };

  if (sessionPending) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-8">
      <div className="mb-8">
        <Logo className="text-3xl font-bold tracking-tight" />
      </div>

      <Card className="animate-fade-in-up glass w-full max-w-md rounded-xl">
        <CardHeader className="pb-2 text-center">
          <CardTitle className="text-lg font-bold">
            {step === "sign-in" && "Welcome! Let's get set up."}
            {step === "link-twitch" && "Link Your Twitch Account"}
            {step === "enable-bot" && "Enable the Bot"}
            {step === "complete" && "All Done!"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {step === "sign-in" &&
              "Sign in to become the broadcaster and admin."}
            {step === "link-twitch" &&
              "Link Twitch to enable bot features for your channel."}
            {step === "enable-bot" &&
              "The bot will join your Twitch channel."}
            {step === "complete" && "Setup is complete. Redirecting..."}
          </p>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pt-4">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2">
            {(["sign-in", "link-twitch", "enable-bot", "complete"] as Step[]).map(
              (s, i) => (
                <div
                  key={s}
                  className={`h-2 w-8 rounded-full transition-colors ${
                    stepIndex(step) >= i
                      ? "bg-brand-main"
                      : "bg-muted"
                  }`}
                />
              )
            )}
          </div>

          {/* Step 1: Sign In */}
          {step === "sign-in" && (
            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                className="w-full rounded-md bg-brand-twitch py-5 text-sm font-bold text-white hover:bg-brand-twitch/80"
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
                className="w-full rounded-md border-brand-discord/30 py-5 text-sm font-medium text-brand-discord hover:bg-brand-discord/10"
                disabled={signingIn !== null}
                onClick={() => handleSignIn("discord")}
              >
                {signingIn === "discord"
                  ? "Redirecting..."
                  : "Sign in with Discord"}
              </Button>
            </div>
          )}

          {/* Step 2: Link Twitch */}
          {step === "link-twitch" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3 rounded-lg bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Bot features require a linked Twitch account. You can skip
                  this now but the bot won't work until you link Twitch later.
                </span>
              </div>

              <Button
                size="lg"
                className="w-full rounded-md bg-brand-twitch py-5 text-sm font-bold text-white hover:bg-brand-twitch/80"
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

          {/* Step 3: Enable Bot */}
          {step === "enable-bot" && (
            <div className="flex flex-col gap-3">
              {skippedTwitch || !botStatus?.hasTwitchLinked ? (
                <div className="rounded-lg bg-surface-raised p-4 text-center text-sm text-muted-foreground">
                  Skipped — you can enable the bot later from the dashboard.
                </div>
              ) : (
                <>
                  {botStatus?.botChannel?.enabled ? (
                    <div className="flex items-center justify-center gap-2 rounded-lg bg-green-500/10 p-4 text-sm text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      Bot joined #{botStatus.botChannel.twitchUsername}!
                    </div>
                  ) : (
                    <Button
                      size="lg"
                      className="w-full rounded-md bg-brand-main py-5 text-sm font-bold text-white hover:bg-brand-main/80"
                      disabled={enableBotMutation.isPending}
                      onClick={handleEnableBot}
                    >
                      {enableBotMutation.isPending
                        ? "Enabling..."
                        : "Enable Bot"}
                    </Button>
                  )}
                </>
              )}

              <Button
                size="lg"
                className="w-full rounded-md bg-brand-main py-5 text-sm font-bold text-white hover:bg-brand-main/80"
                disabled={completeMutation.isPending}
                onClick={handleComplete}
              >
                {completeMutation.isPending
                  ? "Completing setup..."
                  : "Complete Setup"}
              </Button>

              {completeMutation.isError && (
                <p className="text-center text-sm text-red-500">
                  {completeMutation.error.message}
                </p>
              )}
            </div>
          )}

          {/* Step 4: Complete */}
          {step === "complete" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-sm text-muted-foreground">
                You're all set! Redirecting to dashboard...
              </p>
              <Loader />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function stepIndex(step: Step): number {
  const steps: Step[] = ["sign-in", "link-twitch", "enable-bot", "complete"];
  return steps.indexOf(step);
}
