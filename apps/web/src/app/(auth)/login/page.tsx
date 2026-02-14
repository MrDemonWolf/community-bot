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
      <div className="flex min-h-full items-center justify-center bg-gray-50 dark:bg-[#091533]">
        <Loader />
      </div>
    );
  }

  if (session) {
    router.push("/dashboard");
    return (
      <div className="flex min-h-full items-center justify-center bg-gray-50 dark:bg-[#091533]">
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
    <div className="flex min-h-full flex-col items-center justify-center bg-gray-50 px-4 py-12 dark:bg-[#091533]">
      {/* Brand / Home link */}
      <div className="mb-8">
        <Logo className="text-3xl font-bold tracking-tight" />
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-sm border-gray-200 bg-white dark:border-white/10 dark:bg-[#0d1f42]">
        <CardHeader className="pb-2 text-center">
          <CardTitle className="text-sm font-semibold uppercase tracking-widest text-gray-500 dark:text-white/70">
            Log in with...
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-2">
          {/* Discord Button */}
          <div className="flex flex-col gap-1">
            <Button
              size="lg"
              className="w-full rounded-md bg-[#5865F2] py-5 text-sm font-bold text-white hover:bg-[#4752C4]"
              disabled={signingIn !== null}
              onClick={() => handleSignIn("discord")}
            >
              {signingIn === "discord" ? "Redirecting..." : "Discord"}
            </Button>
            {lastUsedMethod === "discord" && (
              <p className="text-center text-xs text-[#00ACED]">
                Last signed in with Discord
              </p>
            )}
          </div>

          {/* Separator */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
            <span className="text-xs font-medium uppercase text-gray-400 dark:text-white/40">
              or
            </span>
            <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
          </div>

          {/* Twitch Button */}
          <div className="flex flex-col gap-1">
            <Button
              size="lg"
              className="w-full rounded-md bg-[#9146FF] py-5 text-sm font-bold text-white hover:bg-[#7B2FF0]"
              disabled={signingIn !== null}
              onClick={() => handleSignIn("twitch")}
            >
              {signingIn === "twitch" ? "Redirecting..." : "Twitch"}
            </Button>
            {lastUsedMethod === "twitch" && (
              <p className="text-center text-xs text-[#00ACED]">
                Last signed in with Twitch
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Back to home */}
      <Link
        href="/"
        className="mt-6 text-sm text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white/70"
      >
        Back to home
      </Link>
    </div>
  );
}
