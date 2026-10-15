import type { Metadata, Viewport } from "next";
import "../index.css";
import "../mobile.css";
import "../profile.css";
import Providers from "@/components/providers";
import Pwa from "@/components/pwa";

export const metadata: Metadata = {
  title: { default: "Community Bot", template: "%s · Community Bot" },
  description: "One creator. Discord and Twitch, connected.",
  icons: { icon: "/brand/logo.svg", apple: "/brand/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Community Bot", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#091533", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Pwa />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
