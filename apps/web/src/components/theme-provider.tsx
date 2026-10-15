"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export default function ThemeProvider({ children }: { children: ReactNode }) {
  // next-themes applies the saved/system attribute before paint; client controls wait for mounting.
  return <NextThemesProvider attribute="data-theme" storageKey="community-bot:theme"
    defaultTheme="system" enableSystem enableColorScheme disableTransitionOnChange>
    {children}
  </NextThemesProvider>;
}
