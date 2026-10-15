import type { Metadata } from "next";
import Link from "next/link";
import "./style.css";

export const metadata: Metadata = {
  title: { default: "WolfAide | Documentation", template: "%s | WolfAide" },
  description:
    "A simple Discord and Twitch bot for one creator. Setup, connections, and deployment.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const basePath =
    process.env.GITHUB_ACTIONS === "true" ? "/community-bot" : "";
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#content">
          Skip to content
        </a>
        <header>
          <Link href="/" className="brand">
            <img
              src={`${basePath}/brand/logo.svg`}
              alt="MrDemonWolf"
              width="42"
              height="42"
            />
            <span>
              WolfAide <small>FIELD GUIDE</small>
            </span>
          </Link>
          <a href="https://github.com/mrdemonwolf/community-bot">
            Source code ↗
          </a>
        </header>
        <div className="shell">
          <aside>
            <p className="eyebrow">GET CONNECTED</p>
            <nav aria-label="Documentation">
              <Link href="/">
                01 <span>Start here</span>
              </Link>
              <Link href="/local/">
                02 <span>Local setup</span>
              </Link>
              <Link href="/dokploy/">
                03 <span>Dokploy setup</span>
              </Link>
              <Link href="/discord/">
                04 <span>Discord setup</span>
              </Link>
              <Link href="/twitch/">
                05 <span>Twitch setup</span>
              </Link>
              <Link href="/features/">
                06 <span>Staff &amp; features</span>
              </Link>
            </nav>
            <p className="aside-note">
              One creator.
              <br />
              Two connections.
              <br />
              Your dashboard.
            </p>
          </aside>
          <main id="content">{children}</main>
        </div>
        <footer>
          WolfAide by <a href="https://www.mrdemonwolf.com">MrDemonWolf</a>
          <span>Open documentation. Keep credentials private.</span>
        </footer>
      </body>
    </html>
  );
}
