"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

const inputCls =
  "h-10 w-full rounded-lg border border-[var(--hb-border)] bg-[var(--hb-surface-2)]/40 px-3 text-sm text-[var(--hb-fg)] placeholder:text-[var(--hb-subtle)] outline-none transition-colors focus:border-[var(--hb-accent)] focus:ring-1 focus:ring-[var(--hb-accent)]/40";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res =
      mode === "signin"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message ?? "Something went wrong");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="relative grid min-h-svh place-items-center overflow-hidden bg-[var(--hb-bg)] px-6 text-[var(--hb-fg)] [font-family:var(--font-inter)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-[10%] top-[-15%] h-[55%] w-[55%] rounded-full"
          style={{ background: "radial-gradient(circle,rgba(124,91,255,.24),transparent 68%)" }}
        />
        <div
          className="absolute bottom-[-10%] right-[8%] h-[46%] w-[40%] rounded-full"
          style={{ background: "radial-gradient(circle,rgba(45,212,167,.13),transparent 70%)" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className="grid h-12 w-12 place-items-center rounded-[28%] text-xl font-bold text-[var(--hb-accent-fg)]"
            style={{
              background: "var(--hb-accent)",
              boxShadow: "0 8px 28px -8px rgba(15,172,237,.6)",
            }}
          >
            H
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-[var(--hb-muted)]">
            {mode === "signin"
              ? "Sign in to your HowlBot dashboard."
              : "The first account becomes the owner."}
          </p>
        </div>

        <form
          onSubmit={submit}
          className="grid gap-4 rounded-2xl border border-[var(--hb-border)] bg-[var(--hb-surface)]/80 p-6 backdrop-blur-xl"
        >
          {mode === "signup" && (
            <label className="grid gap-1.5">
              <span className="text-xs font-medium">Name</span>
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
          )}
          <label className="grid gap-1.5">
            <span className="text-xs font-medium">Email</span>
            <input
              className={inputCls}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium">Password</span>
            <input
              className={inputCls}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="mt-1 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--hb-accent)] px-5 text-sm font-semibold text-[var(--hb-accent-fg)] outline-none transition-all hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[var(--hb-accent)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--hb-bg)] disabled:opacity-50"
          >
            {busy ? "…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mx-auto mt-4 block text-xs text-[var(--hb-muted)] underline-offset-4 hover:text-[var(--hb-accent)] hover:underline"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
