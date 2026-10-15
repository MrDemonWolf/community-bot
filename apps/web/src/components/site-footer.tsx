import Link from "next/link";
import CookieNotice from "./cookie-notice";

export default function SiteFooter() {
  const revision = process.env.NEXT_PUBLIC_APP_REVISION;
  return <footer className="site-footer">
    <div className="footer-summary"><span>Community Bot by <a href="https://www.mrdemonwolf.com">MrDemonWolf, Inc.</a></span>
      {revision ? <a className="build-revision" href={`https://github.com/MrDemonWolf/community-bot/commit/${revision}`} title={`Deployed commit ${revision}`}>Build <code>{revision.slice(0, 7)}</code></a>
        : <span className="subtle">Build revision unavailable</span>}
    </div>
    <nav aria-label="Legal and project information"><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link><a href={`https://github.com/MrDemonWolf/community-bot/blob/${revision || "main"}/CHANGELOG.md`}>Changelog</a></nav>
    <CookieNotice />
  </footer>;
}
