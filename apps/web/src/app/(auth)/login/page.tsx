"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Loader from "@/components/loader";
import Logo from "@/components/logo";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Provider = "discord" | "twitch";

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
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      {/* Brand / Home link */}
      <div className="mb-8">
        <Logo className="text-3xl font-bold tracking-tight" />
      </div>

      {/* Login Card */}
      <Card className="animate-fade-in-up glass w-full max-w-sm rounded-xl">
        <CardHeader className="pb-2 text-center">
          <CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Log in with...
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-2">
          {/* Discord Button */}
          <div className="flex flex-col gap-1">
            <Button
              size="lg"
              className="w-full rounded-md bg-brand-discord py-5 text-sm font-bold text-white hover:bg-brand-discord/80"
              disabled={signingIn !== null}
              onClick={() => handleSignIn("discord")}
            >
              {signingIn === "discord" ? "Redirecting..." : "Discord"}
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
              className="w-full rounded-md bg-brand-twitch py-5 text-sm font-bold text-white hover:bg-brand-twitch/80"
              disabled={signingIn !== null}
              onClick={() => handleSignIn("twitch")}
            >
              {signingIn === "twitch" ? "Redirecting..." : "Twitch"}
            </Button>
            {lastUsedMethod === "twitch" && (
              <p className="text-center text-xs text-brand-main">
                Last signed in with Twitch
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Back to home */}
      <Link
        href="/"
        className="mt-6 text-sm text-muted-foreground hover:text-foreground"
      >
        Back to home
      </Link>
    </div>
  );
}
