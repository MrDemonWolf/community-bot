import type { Metadata } from "next";
import { Montserrat, Roboto } from "next/font/google";
import "../index.css";
import Providers from "@/components/providers";
import CookieConsent from "@/components/cookie-consent";

const montserrat = Montserrat({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const roboto = Roboto({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Community Bot",
  description: "Community Bot Dashboard",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "256x256" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${montserrat.variable} ${roboto.variable} antialiased`}
      >
        <Providers>
          {children}
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}
