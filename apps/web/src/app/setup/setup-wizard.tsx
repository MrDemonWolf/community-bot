"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CoreSettings,
  DiscordPresence,
  DiscordSettings,
  TwitchSettings,
} from "@/components/settings-panels";
import { queryClient, trpc } from "@/utils/trpc";

export default function SetupWizard() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("connected"))
      setStep(2);
  }, []);
  const router = useRouter();
  const query = useQuery(trpc.settings.get.queryOptions());
  const finish = useMutation(
    trpc.settings.completeSetup.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries();
        router.push("/dashboard");
        router.refresh();
      },
    }),
  );
  const settings = query.data;
  return (
    <div className="setup-page">
      <Link href="/dashboard" className="brand setup-brand">
        <img src="/brand/logo.svg" alt="" width="42" height="42" />
        <span>
          WolfAide<small>YOUR COMMUNITY, CONNECTED</small>
        </span>
      </Link>
      <main className="setup-wrap">
        <span className="eyebrow">LET'S MAKE THIS EASY</span>
        <h1>One step at a time.</h1>
        <p>
          A name, a connection, and you're ready. Both services are optional.
        </p>
        <ol className="steps" aria-label="Setup progress">
          {["Your workspace", "Discord", "Twitch"].map((label, index) => (
            <li key={label} aria-current={step === index ? "step" : undefined}>
              {index + 1}. {label}
            </li>
          ))}
        </ol>
        {query.isPending && <p role="status">Loading your settings…</p>}
        {query.error && (
          <p role="alert" className="notice error">
            {query.error.message}{" "}
            <button className="button" onClick={() => query.refetch()}>
              Try again
            </button>
          </p>
        )}
        {settings && (
          <section className="panel">
            {step === 0 && (
              <>
                <h2>A home for your community</h2>
                <p>
                  Set your display name and choose whether viewers can see your
                  command page.
                </p>
                <CoreSettings settings={settings} />
              </>
            )}
            {step === 1 && (
              <>
                <span className="eyebrow">OPTIONAL CONNECTION</span>
                <h2>Bring your Discord bot</h2>
                <p>
                  Keep your existing verified application. Save its credentials
                  here, then choose how it appears.
                </p>
                <DiscordSettings settings={settings} />
                <div className="rule" />
                <h3>Your bot's presence</h3>
                <DiscordPresence settings={settings} />
              </>
            )}
            {step === 2 && (
              <>
                <span className="eyebrow">OPTIONAL CONNECTION</span>
                <h2>Meet your Twitch accounts</h2>
                <p>
                  Your creator account owns the channel. Your bot account joins
                  chat and replies to commands.
                </p>
                <TwitchSettings settings={settings} />
              </>
            )}
          </section>
        )}
        {finish.error && (
          <p role="alert" className="notice error">
            {finish.error.message}
          </p>
        )}
        <div className="setup-links">
          <button
            className="button"
            disabled={step === 0 || finish.isPending}
            onClick={() => setStep(step - 1)}
          >
            ← Back
          </button>
          {step < 2 ? (
            <button
              className="button primary"
              disabled={!settings}
              onClick={() => setStep(step + 1)}
            >
              {step === 0 ? "Next: Discord" : "Next: Twitch"} →
            </button>
          ) : (
            <button
              className="button primary"
              disabled={finish.isPending || !settings}
              onClick={() => finish.mutate()}
            >
              {finish.isPending ? "Finishing…" : "Open my dashboard →"}
            </button>
          )}
        </div>
        <p className="subtle" style={{ marginTop: 20 }}>
          Save any edits before continuing. You can revisit every setting from
          the dashboard.
        </p>
      </main>
    </div>
  );
}
