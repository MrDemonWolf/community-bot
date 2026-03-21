"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import Loader from "@/components/loader";
import Logo from "@/components/logo";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Provider = "discord" | "twitch";

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function TwitchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0 1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [signingIn, setSigningIn] = useState<Provider | null>(null);
  const lastUsedMethod = authClient.getLastUsedLoginMethod();

  if (isPending) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (session) {
    router.push("/dashboard");
    return (
      <div className="flex min-h-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  const handleSignIn = (provider: Provider) => {
    setSigningIn(provider);
    authClient.signIn.social({
      provider,
      callbackURL: "/dashboard",
    });
  };

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-8 sm:py-12">
      {/* Brand / Home link */}
      <div className="mb-8">
        <Logo className="text-3xl font-bold tracking-tight" />
      </div>

      {/* Login Card */}
      <Card className="animate-fade-in-up glass w-full max-w-sm rounded-xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="font-heading text-xl font-semibold tracking-tight">
            Sign in to your account
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Choose your preferred platform to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-2">
          {/* Discord Button */}
          <div className="flex flex-col gap-1">
            <Button
              size="lg"
              className="w-full gap-2 rounded-md bg-brand-discord py-5 text-sm font-bold text-white hover:bg-brand-discord/80"
              disabled={signingIn !== null}
              onClick={() => handleSignIn("discord")}
            >
              <DiscordIcon className="h-5 w-5" />
              {signingIn === "discord"
                ? "Redirecting..."
                : "Continue with Discord"}
            </Button>
            {lastUsedMethod === "discord" && (
              <p className="text-center text-xs text-brand-main">
                Last signed in with Discord
              </p>
            )}
          </div>

          {/* Separator */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium uppercase text-muted-foreground">
              or
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Twitch Button */}
          <div className="flex flex-col gap-1">
            <Button
              size="lg"
              className="w-full gap-2 rounded-md bg-brand-twitch py-5 text-sm font-bold text-white hover:bg-brand-twitch/80"
              disabled={signingIn !== null}
              onClick={() => handleSignIn("twitch")}
            >
              <TwitchIcon className="h-5 w-5" />
              {signingIn === "twitch"
                ? "Redirecting..."
                : "Continue with Twitch"}
            </Button>
            {lastUsedMethod === "twitch" && (
              <p className="text-center text-xs text-brand-main">
                Last signed in with Twitch
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Agreement text */}
      <p className="mt-6 max-w-xs text-center text-xs text-muted-foreground">
        By signing in, you agree to our{" "}
        {process.env.NEXT_PUBLIC_TERMS_OF_SERVICE_URL ? (
          <a
            href={process.env.NEXT_PUBLIC_TERMS_OF_SERVICE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Terms of Service
          </a>
        ) : (
          <span className="underline">Terms of Service</span>
        )}{" "}
        and{" "}
        {process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL ? (
          <a
            href={process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Privacy Policy
          </a>
        ) : (
          <span className="underline">Privacy Policy</span>
        )}
        .
      </p>

      {/* Back to home */}
      <Link
        href="/"
        className="mt-4 text-sm text-muted-foreground hover:text-foreground"
      >
        Back to home
      </Link>

      {/* Copyright */}
      <p className="mt-4 text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()}{" "}
        {process.env.NEXT_PUBLIC_COPYRIGHT_NAME || "Community Bot"}
      </p>
    </div>
  );
}
