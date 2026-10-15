import type { Metadata, Viewport } from "next";
import "../index.css";
import "../theme.css";
import "../mobile.css";
import "../profile.css";
import "../cookie.css";
import "../footer.css";
import "../settings.css";
import "../appearance.css";
import "../overview.css";
import "../public-page.css";
import "../public-shell.css";
import "../legal.css";
import "../brand.css";
import SiteFooter from "@/components/site-footer";
import Providers from "@/components/providers";
import Pwa from "@/components/pwa";
import ThemeProvider from "@/components/theme-provider";

export const metadata: Metadata = {
  title: { default: "Community Bot", template: "%s · Community Bot" },
  description: "One creator. Discord and Twitch, connected.",
  icons: { icon: "/brand/logo.svg", apple: "/brand/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Community Bot", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#0A1633", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <Pwa />
          <Providers>{children}</Providers>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
