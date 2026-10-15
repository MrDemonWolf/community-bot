import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  return <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
    <Link className="brand mb-8" href="/login"><img src="/brand/logo.svg" width="38" height="38" alt="" />Community Bot</Link>
    <header className="mb-8"><span className="eyebrow">MrDemonWolf, Inc.</span><h1>{title}</h1><p>{summary}</p><p className="subtle">Last updated: October 15, 2026</p>
      <nav className="actions" aria-label="Legal pages"><Link className="button" href="/privacy">Privacy Policy</Link><Link className="button" href="/terms">Terms of Service</Link><Link className="button" href="/login">Back to sign in</Link></nav>
    </header>
    <article className="panel space-y-7">{children}</article>
  </main>;
}
