import "@community-bot/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	serverExternalPackages: ["@community-bot/db", "ioredis"],
};

export default nextConfig;

