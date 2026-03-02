import { execSync } from "node:child_process";
import "@community-bot/env/web";
import type { NextConfig } from "next";

function getGitSha(): string {
	try {
		return execSync("git rev-parse --short HEAD").toString().trim();
	} catch {
		return "unknown";
	}
}

const nextConfig: NextConfig = {
	output: "standalone",
	env: {
		NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? "0.0.0",
		NEXT_PUBLIC_GIT_SHA: getGitSha(),
	},
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

