import Link from "next/link";

export default function PublicHeader({ active }: { active?: "channel" | "privacy" | "terms" }) {
  return <header className="public-site-header">
    <div className="brand public-site-brand"><img src="/brand/logo.svg" width="38" height="38" alt="" /><span>Community Bot<small>by MrDemonWolf</small></span></div>
    <nav aria-label="Public site">
      <Link href="/privacy" aria-current={active === "privacy" ? "page" : undefined}>Privacy</Link>
      <Link href="/terms" aria-current={active === "terms" ? "page" : undefined}>Terms</Link>
      <Link className="button" href="/login">Staff sign in</Link>
    </nav>
  </header>;
}
