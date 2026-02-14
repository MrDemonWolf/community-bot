"use client";

import { useEffect, useRef } from "react";

export default function TwitchEmbed({
  channel,
  isLive,
}: {
  channel: string;
  isLive: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const parent = window.location.hostname;
    const iframe = document.createElement("iframe");
    iframe.src = `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${parent}&muted=true&autoplay=${isLive}`;
    iframe.width = "100%";
    iframe.height = "100%";
    iframe.allowFullscreen = true;
    iframe.style.border = "0";
    iframe.style.borderRadius = "0.5rem";

    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(iframe);
  }, [channel, isLive]);

  return (
    <div
      ref={containerRef}
      className="aspect-video w-full overflow-hidden rounded-lg border border-gray-200 bg-black dark:border-white/10"
    />
  );
}
