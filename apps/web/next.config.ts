import "@community-bot/env/web";
import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: resolve(import.meta.dirname, "../.."),
  typedRoutes: true,
  reactCompiler: true,
  devIndicators: false,
  // Native Sharp must resolve from the web app when Webpack externalizes the shared API import.
  serverExternalPackages: ["sharp"],
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] }];
  },
};

export default nextConfig;
