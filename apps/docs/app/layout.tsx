import { RootProvider } from "fumadocs-ui/provider/next";
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./global.css";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Community Bot",
    template: "%s | Community Bot",
  },
  description:
    "Documentation for the MrDemonWolf Community Bot — Discord and Twitch bots, web dashboard, and shared packages.",
  metadataBase: new URL(
    "https://mrdemonwolf.github.io/community-bot"
  ),
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
        <footer className="border-t py-6 text-center text-sm text-fd-muted-foreground">
          &copy; {new Date().getFullYear()}{" "}
          <a
            href="https://mrdemonwolf.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-fd-foreground underline underline-offset-4 hover:text-fd-primary"
          >
            MrDemonWolf, Inc.
          </a>
          {" "}All rights reserved.
        </footer>
      </body>
    </html>
  );
}
