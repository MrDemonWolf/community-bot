"use client";

import { Toaster } from "sonner";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/utils/trpc";
import { useTheme } from "next-themes";

export default function Providers({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster theme={resolvedTheme === "dark" ? "dark" : "light"} richColors position="bottom-right" />
    </QueryClientProvider>
  );
}
