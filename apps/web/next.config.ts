import "@community-bot/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	output: "standalone",
	typedRoutes: true,
	reactCompiler: true,
	serverExternalPackages: ["@community-bot/db", "ioredis"],
	async redirects() {
		return [
			{
				source: "/public",
				destination: "/p",
				permanent: true,
			},
			{
				source: "/public/:path*",
				destination: "/p/:path*",
				permanent: true,
			},
		];
	},
};

export default nextConfig;

