import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "Community Bot", short_name: "Community Bot", description: "Your Discord and Twitch dashboard.",
    start_url: "/dashboard", scope: "/", display: "standalone", background_color: "#0A1633", theme_color: "#0A1633",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
