import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "WolfAide", short_name: "WolfAide", description: "Your Discord and Twitch dashboard.",
    start_url: "/dashboard", scope: "/", display: "standalone", background_color: "#091533", theme_color: "#091533",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
