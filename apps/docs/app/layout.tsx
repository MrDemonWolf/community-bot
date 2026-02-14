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
      </body>
    </html>
  );
}
