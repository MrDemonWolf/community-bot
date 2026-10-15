"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function Login({
  devLogin,
  googleConfigured,
}: {
  devLogin: boolean;
  googleConfigured: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signIn(local: boolean) {
    setError("");
    setBusy(true);
    try {
      if (local) {
        const response = await fetch("/api/auth/dev-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (!response.ok)
          throw new Error(
            "Development login is unavailable. Check the server configuration.",
          );
        router.push("/dashboard");
        router.refresh();
      } else {
        const result = await authClient.signIn.social({
          provider: "google",
          callbackURL: "/dashboard",
        });
        if (result.error)
          throw new Error(result.error.message || "Google sign-in failed.");
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Sign-in failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand">
          <img src="/brand/logo.svg" alt="" width="46" height="46" />
          <span>
            Community Bot<small>BY MRDEMONWOLF</small>
          </span>
        </div>
        <div>
          <h1>
            Your community.
            <br />
            <span>A little closer.</span>
          </h1>
          <p>
            Discord and Twitch, together in one calm workspace. Built for a
            single creator.
          </p>
        </div>
        <span className="subtle" style={{ color: "#a9b9d4" }}>
          LESS TO MANAGE. MORE TIME TO CREATE.
        </span>
      </section>
      <section className="login-content">
        <div className="login-card">
          <span className="eyebrow">COMMUNITY ACCESS</span>
          <h2>Welcome home.</h2>
          <p>
            Sign in, link your community accounts, and see the tools your roles
            allow.
          </p>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button primary"
            disabled={busy || !googleConfigured}
            onClick={() => signIn(false)}
          >
            Continue with Google <ArrowRight size={17} />
          </button>
          {!googleConfigured && (
            <p className="subtle" style={{ marginTop: 14 }}>
              Google sign-in needs configuration. Set the Google OAuth
              credentials and owner email in your deployment first.
            </p>
          )}
          {devLogin && (
            <>
              <div className="rule" />
              <p className="subtle">LOCAL DEVELOPMENT</p>
              <button
                className="button"
                disabled={busy}
                onClick={() => signIn(true)}
              >
                {busy ? "Signing in…" : "Enter development workspace"}
              </button>
              <p className="subtle" style={{ marginTop: 12 }}>
                A local test account. Available only with development login
                explicitly enabled.
              </p>
            </>
          )}
          <p className="subtle" style={{ marginTop: 30 }}>
            Creator and staff tools are private. Your linked community roles
            determine which tools you can use.
          </p>
        </div>
      </section>
    </main>
  );
}
